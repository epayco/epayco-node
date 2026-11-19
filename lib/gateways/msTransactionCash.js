/**
 * Gateway for the new "ms-transaction" microservice (apiflow.epayco.io) used to
 * create/query cash (Efectivo) transactions, replacing the legacy
 * secure.payco.co/restpagos/v2/efectivo/{type} flow used by lib/resources/cash.js.
 *
 * Kept isolated from lib/resources/index.js (Resource#request) on purpose: this
 * flow talks to different hosts, uses a different auth handshake (OAuth2
 * client_credentials against apiflow.epayco.io/authentication -> short-lived
 * JWT) and a different per-field AES-256-CBC encryption scheme than the
 * legacy secure.payco.co flow,
 * so folding it into Resource#request's already-overloaded flag signature
 * (sw/cashData/card/apify) would make that method harder to reason about. This
 * module is also written so the pure body-building/encryption logic can be unit
 * tested without any network access (see tests/cash.js).
 *
 * Module dependencies
 */
var CryptoJS = require('crypto-js');
var fetch = require('node-fetch');
var axios = require('axios');
var EpaycoError = require('../resources/errors');
var msTransactionConfig = require('./msTransactionConfig');

/**
 * Default per-request timeout (ms) for both the node-fetch and axios calls
 * this module makes (login, create, get) -- none of the three had a timeout
 * before, so a slow/hanging upstream could hang the caller's promise
 * indefinitely. node-fetch v2's `timeout` option and axios' `timeout` option
 * both abort the in-flight request after this many ms.
 */
var REQUEST_TIMEOUT_MS = 10000;

/**
 * Base hosts, centralized in ./msTransactionConfig so every ms-transaction
 * gateway resolves them from one place (see that module for the env vars and
 * defaults).
 *
 * NOTE: this is intentionally NOT the same host as the existing `apify` flag in
 * lib/resources/index.js (BASE_URL_APIFY, default "https://apify.epayco.co",
 * used today by safetypay.js/daviplata.js). Auth and the transaction itself
 * are both under apiflow.epayco.io (different paths -- see login() and
 * createTransaction()/getTransaction() below), verified empirically against
 * the real API. Cash authenticates against the newer
 * `/authentication/api/v2/login` endpoint (SDK-1352), hence the _AUTH_V2
 * host rather than the Basic-auth `/login` one Bank/SafetyPay/Daviplata use.
 */
var BASE_URL_MS_TRANSACTION = msTransactionConfig.BASE_URL_MS_TRANSACTION;
var BASE_URL_MS_TRANSACTION_AUTH = msTransactionConfig.BASE_URL_MS_TRANSACTION_AUTH_V2;

/**
 * AES-256-CBC IV literal used by ms-transaction (verified empirically: the
 * "i" field of a successful request is the base64 encoding of this literal
 * ASCII string, i.e. CryptoJS.enc.Utf8.parse(IV_STRING), NOT
 * CryptoJS.enc.Hex.parse(IV_STRING) like lib/resources/index.js's encrypt()/
 * encryptHex() do for the legacy secure.payco.co flow).
 *
 * INTENTIONAL, not an oversight: this static IV is required as-is by the
 * ms-transaction backend, which decrypts every request assuming this exact
 * value -- it's the same literal already used by this repo's own legacy
 * encrypt()/encryptHex() (lib/resources/index.js) and by the already-shipped
 * Python SDK's ms-transaction migration (epaycosdk/gateways/ms_transaction.py).
 * Do not "fix" this into a random/per-request IV without a corresponding
 * backend change; doing so would break real transaction creation.
 */
var IV_STRING = '0000000000000000';

/**
 * Legacy `cash.create(type, options)` first-argument -> ms-transaction
 * `paymentMethodData.franchise` code. Verified empirically against the real
 * API (each returned success:true with the matching nameBank).
 */
var FRANCHISE_MAP = {
    efecty: 'EF',
    baloto: 'BA',
    gana: 'GA',
    redservi: 'RS',
    puntored: 'PR',
    sured: 'SR'
};

/**
 * How legacy spells each type inside `last_action` ("Crear pin <name>").
 * Only the two multi-word names differ from the type string itself, which is
 * why this map exists at all -- measured against the real legacy endpoint for
 * all six types: efecty/baloto/gana/sured come back spelled exactly like the
 * type, while redservi -> "red servi" and puntored -> "punto red".
 */
var LAST_ACTION_NAME_MAP = {
    redservi: 'red servi',
    puntored: 'punto red'
};

/**
 * Legacy's `text_response` on the cash success path. A fixed string, not
 * derived from the transaction: measured identical across all six types
 * (efecty, baloto, gana, redservi, puntored, sured). ms-transaction's own
 * `raw.message` says "Transacción creada exitosamente" instead, which is why
 * it isn't used here -- legacy's wording is the contract callers migrating
 * from it already match on.
 */
var SUCCESS_TEXT_RESPONSE = 'Transacción y pin generados exitosamente';

/**
 * Legacy's `text_response` on a cash validation failure. A fixed generic
 * string: the specific reasons are in data.errores, not here.
 */
var VALIDATION_TEXT_RESPONSE = 'Algunos campos son invalidos, por favor corrija los errores y vuelva a intentarlo';

var EXTRA_KEYS = ['extra1', 'extra2', 'extra3', 'extra4', 'extra5', 'extra6', 'extra7', 'extra8', 'extra9', 'extra10'];

/**
 * Guard against a misconfigured merchant key silently producing wrong
 * ciphertext: the AES key is `privateKey`'s raw UTF-8 bytes with no
 * transformation (no hashing/derivation), so AES-256-CBC requires it to be
 * exactly 32 bytes. Anything else (a shorter test/staging key, a copy-paste
 * truncation, etc.) would previously be silently accepted by
 * CryptoJS.enc.Utf8.parse and produce ciphertext the backend can't decrypt --
 * fail fast instead with a clear error.
 *
 * @param {String} privateKey
 * @param {String} [lang] 'ES'|'EN', defaults to 'ES' (matches Epayco's own
 *        default in lib/index.js) when the caller doesn't have an epayco
 *        instance in scope (e.g. calling encryptValue/encryptBody directly).
 */
function assertValidPrivateKey(privateKey, lang) {
    if (typeof privateKey !== 'string' || Buffer.byteLength(privateKey, 'utf8') !== 32) {
        throw new EpaycoError(lang || 'ES', 103);
    }
}

/**
 * Encrypt a single value with AES-256-CBC/PKCS7, key = privateKey as raw UTF-8
 * bytes, iv = the literal ASCII string IV_STRING as raw UTF-8 bytes. Mirrors
 * the encrypt() helper in lib/resources/index.js *in spirit* (same algorithm/
 * padding/mode), but uses Utf8.parse instead of Hex.parse for both key and iv
 * -- lib/resources/index.js's encrypt()/encryptHex() Hex.parse the key/iv,
 * which only matches this scheme if privateKey happens to be valid hex, and
 * produces an 8-byte (not 16-byte) IV for a 16-char literal, which is wrong
 * for AES-CBC. That existing helper is used for a different backend
 * (secure.payco.co) and left untouched here.
 *
 * @param {*} value
 * @param {String} privateKey
 * @param {String} [lang] see assertValidPrivateKey
 * @return {String} base64 ciphertext
 */
function encryptValue(value, privateKey, lang) {
    assertValidPrivateKey(privateKey, lang);
    var text = typeof value === 'string' ? value : JSON.stringify(value);
    var key = CryptoJS.enc.Utf8.parse(privateKey);
    var iv = CryptoJS.enc.Utf8.parse(IV_STRING);
    var encrypted = CryptoJS.AES.encrypt(text, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

/**
 * base64(IV_STRING), sent as the "i" field on every request.
 */
function ivBase64() {
    return CryptoJS.enc.Utf8.parse(IV_STRING).toString(CryptoJS.enc.Base64);
}

/**
 * Recursively encrypt every leaf value of a plain object, preserving shape.
 * `publicKey` stays plaintext, null/undefined leaves are omitted.
 *
 * @param {Object} obj
 * @param {String} privateKey
 * @param {String} [lang] see assertValidPrivateKey
 * @return {Object}
 */
function encryptObject(obj, privateKey, lang) {
    var out = {};
    Object.keys(obj).forEach(function (key) {
        var value = obj[key];
        if (value === null || value === undefined) {
            return;
        }
        if (key === 'publicKey') {
            out[key] = value;
            return;
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
            out[key] = encryptObject(value, privateKey, lang);
            return;
        }
        out[key] = encryptValue(value, privateKey, lang);
    });
    return out;
}

/**
 * Encrypt a full ms-transaction request body: every field-value AES-encrypted
 * (nested objects encrypted leaf-by-leaf, same shape), except `publicKey`
 * which stays plaintext, plus the "i" (base64 iv) and encrypted "language"
 * fields ms-transaction expects.
 *
 * @param {Object} body plaintext body (see buildBody)
 * @param {String} privateKey
 * @param {String} [lang] see assertValidPrivateKey
 * @return {Object}
 */
function encryptBody(body, privateKey, lang) {
    var encrypted = encryptObject(body, privateKey, lang);
    encrypted.i = ivBase64();
    encrypted.language = encryptValue('node', privateKey, lang);
    return encrypted;
}

/**
 * Bucket the legacy extra1..extra10 options into the `extras` object the new
 * contract expects.
 *
 * @param {Object} options
 * @return {Object}
 */
function buildExtras(options) {
    var extras = {};
    EXTRA_KEYS.forEach(function (key) {
        if (options[key] !== undefined && options[key] !== null) {
            extras[key] = options[key];
        }
    });
    return extras;
}

/**
 * Build the extrasEpayco object: the integrator's `extrasEpayco` values win,
 * and extra5 falls back to the "P44" marker only when it was not sent (or
 * was sent empty).
 *
 * @param {Object} options
 * @return {Object}
 */
function buildExtrasEpayco(options) {
    var sent = options && options.extrasEpayco && typeof options.extrasEpayco === 'object' ? options.extrasEpayco : {};
    var extras = Object.assign({ extra1: '', extra2: '', extra3: '' }, sent);
    if (extras.extra5 === undefined || extras.extra5 === null || extras.extra5 === '') {
        extras.extra5 = 'P44';
    }
    return extras;
}

/**
 * Whether `options` carries any of the legacy split-payment fields, i.e.
 * whether the caller actually opted into split payments at all (see
 * buildSplitPayment below -- we only ever add a `splitPayment` block to the
 * body when this is true, never an empty/default one on every request).
 *
 * @param {Object} options
 * @return {Boolean}
 */
function hasSplitPaymentOptions(options) {
    return !!(options.splitpayment || options.split_app_id || options.split_merchant_id ||
        options.split_type || options.split_primary_receiver || options.split_primary_receiver_fee ||
        options.split_rule || options.split_receivers);
}

/**
 * `split_receivers` is documented (README) as `JSON.stringify(...)`-ed by the
 * caller, but callers/harnesses that already hold an array (or that
 * JSON.stringify it themselves upstream, e.g. this repo's test harness'
 * Cash.js route) may pass either a JSON string or an already-parsed array
 * through -- accept both instead of assuming one shape.
 *
 * @param {String|Array} splitReceivers
 * @return {Array|undefined}
 */
function parseSplitReceivers(splitReceivers) {
    if (splitReceivers === undefined || splitReceivers === null) {
        return undefined;
    }
    if (typeof splitReceivers === 'string') {
        try {
            return JSON.parse(splitReceivers);
        } catch (e) {
            return splitReceivers;
        }
    }
    return splitReceivers;
}

/**
 * Map the legacy snake_case split-payment options (`splitpayment`,
 * `split_app_id`, `split_merchant_id`, `split_type`, `split_primary_receiver`,
 * `split_primary_receiver_fee`, `split_rule`, `split_receivers` -- same names
 * documented in README's Split 1-1/Split Multiple cash examples) into the
 * root-level `splitPayment` object ms-transaction expects. Mirrors the
 * already-completed Python SDK migration's CashRequestMapper
 * (epayco-python, ms-transaction-migration branch, SDK-1029/SDK-1030),
 * which solved this same mapping for its own cash flow.
 *
 * Returns undefined (not an empty/default object) when the caller didn't
 * pass any split-payment option, so buildBody only adds `splitPayment` to
 * the request when split payments were actually requested.
 *
 * `splitReceivers` itself, however, is always present once `splitPayment` is
 * built -- defaulting to `[]` when `split_receivers` wasn't passed (e.g. the
 * Split 1-1 case) -- mirroring Python's CashRequestMapper
 * (`split_info.get("split_receivers", [])`, epaycosdk/mappers/cash.py).
 * ms-transaction's backend unconditionally reads
 * `splitPayment.splitReceivers`; omitting the key entirely (as `undefined`
 * does once JSON.stringify'd) makes the real API 500 with
 * "Undefined property: stdClass::$splitReceivers" instead of treating a
 * missing key as empty.
 *
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Object|undefined}
 */
function buildSplitPayment(options) {
    if (!hasSplitPaymentOptions(options)) {
        return undefined;
    }
    return {
        splitMethod: 'multiple',
        splitAppId: options.split_app_id,
        splitMerchantId: options.split_merchant_id,
        splitType: options.split_type || '02',
        splitPrimaryReceiver: options.split_primary_receiver,
        splitPrimaryReceiverFee: options.split_primary_receiver_fee !== undefined ? options.split_primary_receiver_fee : '0',
        splitRule: options.split_rule || 'multiple',
        splitReceivers: parseSplitReceivers(options.split_receivers) || []
    };
}

var DATE_PREFIX_REGEX = /^(\d{4}-\d{2}-\d{2})[ T]/;

function expirationDateOnly(endDate) {
    var match = DATE_PREFIX_REGEX.exec(String(endDate));
    return match ? match[1] : endDate;
}

/**
 * Map the legacy snake_case cash options (see README's Cash section /
 * tests/cash.js, and keylang.json for the equivalent legacy field names) into
 * the ms-transaction plaintext body shape verified against the real API.
 *
 * Known, deliberate gaps vs. the legacy /restpagos/v2/efectivo/{type} flow
 * (no verified equivalent field in the new contract -- flagged for follow-up,
 * not silently best-effort-mapped):
 *  - `type_person` has no field in the verified contract; NOT forwarded.
 *
 * Split-payment options (see buildSplitPayment above) ARE forwarded, mapped
 * into a root-level `splitPayment` object, mirroring the Python SDK's already
 * completed ms-transaction migration for cash (epayco-python,
 * ms-transaction-migration branch, SDK-1029/SDK-1030's CashRequestMapper).
 * `credits` (split-by-credits) is forwarded too, but inside
 * `paymentMethodData.credits` (sibling of `franchise`), not inside
 * `splitPayment`, per that same verified mapper.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {String} franchise mapped franchise code (see FRANCHISE_MAP)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Object} plaintext ms-transaction body
 */
function buildBody(epaycoCtx, franchise, options) {
    options = options || {};
    var paymentMethodData = { franchise: franchise };
    if (options.end_date) {
        paymentMethodData.expirationDate = expirationDateOnly(options.end_date);
    }
    if (options.credits !== undefined && options.credits !== null) {
        paymentMethodData.credits = options.credits;
    }
    var body = {
        invoice: options.invoice,
        quotes: '1',
        documentType: options.doc_type,
        document: options.doc_number,
        names: options.name,
        lastNames: options.last_name,
        phone: options.phone,
        cellphone: options.cell_phone,
        address: options.address,
        city: options.city,
        email: options.email,
        amount: options.value,
        tax: options.tax !== undefined ? options.tax : 0,
        ico: options.ico !== undefined ? options.ico : 0,
        taxBase: options.tax_base !== undefined ? options.tax_base : 0,
        currency: options.currency || 'COP',
        testMode: epaycoCtx.test === 'TRUE',
        uniqueTransactionPerBill: options.unique_transaction_per_bill === true,
        paymentMethod: 'CASH',
        paymentMethodData: paymentMethodData,
        country: options.country || 'CO',
        ip: options.ip,
        responseUrl: options.url_response || null,
        confirmationUrl: options.url_confirmation || null,
        confirmationMethod: options.method_confirmation || options.metodoconfirmacion || 'GET',
        description: options.description,
        integrationType: { tipo_checkout: 'smart_checkout', modo_pago: 'cash' },
        publicKey: epaycoCtx.apiKey,
        extras: buildExtras(options),
        // extra5:"P44" mirrors the internal-tracking marker lib/resources/index.js's
        // Resource#request auto-injects (data["extras_epayco"] = {extra5:"P44"})
        // for every legacy POST, so ePayco's backend keeps identifying this SDK's
        // traffic the same way after the migration.
        extrasEpayco: buildExtrasEpayco(options)
    };
    var splitPayment = buildSplitPayment(options);
    if (splitPayment) {
        body.splitPayment = splitPayment;
    }
    return body;
}

/**
 * Resolve the client IP the same way lib/resources/index.js's Resource#request
 * does today for non-card flows: use options.ip if present, otherwise fetch it
 * from ipify.
 *
 * @param {Object} options
 * @return {Promise<String|undefined>}
 */
function resolveIp(options) {
    if (options && options.ip) {
        return Promise.resolve(options.ip);
    }
    return fetch('https://api.ipify.org?format=json', { timeout: REQUEST_TIMEOUT_MS })
        .then(function (response) { return response.json(); })
        .then(function (data) { return data.ip; })
        .catch(function () { return undefined; });
}

/**
 * Log in against the ms-transaction auth host and return the JWT to use as a
 * Bearer token. Not cached: the JWT is short-lived (~30min), so callers
 * re-login per request, matching what was verified empirically.
 *
 * Uses the OAuth2 client_credentials flow against
 * apiflow.epayco.io/authentication/api/v2/login (previously
 * eks-ms-authentication-service.epayco.io/api/v2/auth/login, and before that
 * a Basic-auth login against eks-apify-service.epayco.io -- same merchant
 * apiKey/privateKey each time, sent as client_id/client_secret in a JSON body,
 * JWT nested under `data.token`). Verified empirically: same request/response
 * shape as the previous host, and the returned Bearer token is accepted
 * identically by apiflow.epayco.io/payment/api/v1/transactions.
 *
 * @param {String} apiKey
 * @param {String} privateKey
 * @return {Promise<String>} JWT
 */
function login(apiKey, privateKey) {
    return fetch(BASE_URL_MS_TRANSACTION_AUTH + '/authentication/api/v2/login', {
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: apiKey,
            client_secret: privateKey,
            grant_type: 'client_credentials'
        })
    })
        .then(function (res) { return res.json(); })
        .then(function (json) { return json && json.data && json.data.token; });
}

/**
 * `refPayco`/`uid` is interpolated directly into the request path (see
 * getTransaction below), so it must be strictly validated first rather than
 * best-effort URL-encoded: every real refPayco we've seen (e.g. 1000008905)
 * is a plain positive integer, and this value commonly arrives from a
 * less-trusted source (a redirect query string, a confirmation callback, a
 * customer-facing "check my payment" form) an integrator may forward
 * unsanitized. Reject anything that isn't a plain positive integer (no `/`,
 * `..`, `#`, `?`, extra path segments, etc.) before it ever reaches the
 * network call.
 *
 * @param {String|Number} refPayco
 * @param {String} [lang] see assertValidPrivateKey
 */
var REF_PAYCO_REGEX = /^[1-9][0-9]*$/;
function assertValidRefPayco(refPayco, lang) {
    var isPlainPositiveInteger = (typeof refPayco === 'string' || typeof refPayco === 'number') &&
        REF_PAYCO_REGEX.test(String(refPayco));
    if (!isPlainPositiveInteger) {
        throw new EpaycoError(lang || 'ES', 103);
    }
}

/**
 * franchise code (see FRANCHISE_MAP) -> the `type` argument cash.create(type,
 * options) was called with, e.g. "EF" -> "efecty". Needed by
 * mapToLegacyShape below: two legacy response fields (`banco`, `last_action`)
 * are derived from `type` itself (`type.toUpperCase()`, "Crear pin " + type),
 * verified empirically against the real legacy endpoint for efecty/gana/baloto.
 */
var TYPE_BY_FRANCHISE = Object.keys(FRANCHISE_MAP).reduce(function (acc, type) {
    acc[FRANCHISE_MAP[type]] = type;
    return acc;
}, {});

/**
 * `estado`/`status` text (Spanish, case-insensitive) -> legacy `cod_respuesta`
 * numeric code. Mirrors the equivalent PHP switch already used elsewhere in
 * the ePayco ecosystem for this exact mapping (status text -> response
 * code), given by the requester rather than reverse-engineered here.
 *
 * Cross-checked against the one real value we've observed both backends
 * return for the same transaction: ms-transaction's `status: "Pendiente"`
 * maps to `3` below, which matches the legacy endpoint's own `cod_respuesta:
 * 3` for that same "Pendiente" transaction (see SDK-1352 QA notes) -- the
 * other cases (aprobada/rechazada/etc.) are not yet cross-checked against a
 * real ms-transaction response in that state.
 *
 * @param {String} estadoTexto e.g. "Pendiente", "Rechazada"
 * @return {Number}
 */
function codRespuestaFromEstado(estadoTexto) {
    switch (String(estadoTexto || '').toLowerCase()) {
        case 'aprobada':
        case 'aceptada':
            return 1;
        case 'rechazada':
            return 2;
        case 'pendiente':
            return 3;
        case 'fallida':
            return 4;
        case 'reversada':
        case 'reversado':
            return 6;
        case 'retenido':
            return 7;
        case 'abandonada':
            return 10;
        case 'cancelada':
            return 11;
        default:
            return 0;
    }
}

/**
 * When ms-transaction rejects a request, the real failure detail lives in
 * `data.errors[].message` (a ValidationException shape: `{errorType,
 * errorTypeDescription, errors: [{code, message}]}`), not in the top-level
 * `message` field -- that top-level `message` is a generic, unhelpful
 * "Transaction request" for every validation failure observed. Without this,
 * `mapToLegacyShape` (which only knows the success-path `data` shape) mapped
 * `text_response` to that generic string and every other `data.*` field to
 * `undefined`, silently discarding the actual reason. Found and fixed first
 * in msTransactionSafetypay.js (SDK-1354 split-payment QA), then confirmed
 * this file shares the exact same gap since it shares the exact same
 * unconditional-success-shape pattern.
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @return {String}
 */
function extractErrorMessage(raw) {
    var data = raw && raw.data;
    if (data && Array.isArray(data.errors) && data.errors.length) {
        return data.errors.map(function (e) { return e && e.message; }).filter(Boolean).join(' ');
    }
    return raw && raw.message;
}

/**
 * When ms-transaction rejects a request outright (raw.success === false --
 * no transaction record was ever created server-side, unlike a business
 * decline which comes back as raw.success === true with data.status
 * "Rechazada"), the legacy secure.payco.co endpoint's own comparable failure
 * responses do NOT return the rich transaction-shaped `data` object at all --
 * verified empirically against real paired failures (same merchant, same
 * split-payment options, both backends): legacy returns EITHER a thin
 * validation shape (`{success:false, title_response:'Error',
 * text_response, last_action:'validation transaction', data:{totalerrores,
 * errores:[{codError, errorMessage}]}}`, seen for a duplicate-invoice
 * rejection) OR, for a harder failure, no `data` key whatsoever
 * (`{success:false, title_response:'...', text_response:'Error procesando el
 * pago, por favor intente mas tarde', last_action:'...'}`).
 *
 * Before this, mapToLegacyShape unconditionally built the full success-shaped
 * `data` object even on failure -- with the real transaction fields
 * (ref_payco, estado, franquicia...) undefined, but PII fields
 * (documento/nombres/apellidos/email/tipo_doc) still populated from the
 * caller's own `options`, since those never depended on `raw.data` to begin
 * with. That's misleading: it looks like a partial transaction record came
 * back, when in fact nothing was ever processed -- the PII values are just
 * an echo of what the caller already sent, not confirmation of anything.
 *
 * ms-transaction's own ValidationException shape (`data.errors: [{code,
 * message}]`) is the closest analogue to legacy's `errores` array, so that
 * case maps to it directly; anything else (a plain top-level `message`, no
 * structured errors) maps to legacy's data-less shape instead -- real paired
 * example for Cash specifically: `last_action: 'Ingresar pago en efectivo'`
 * (NOT 'validation transaction', which is only the structured-errors case's
 * own observed value).
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @param {String} [plainAction] last_action to use for the data-less shape;
 *        defaults to 'validation transaction' when the caller doesn't have a
 *        verified method-specific value (see this file's own call site for
 *        Cash's real one).
 * @return {Object} legacy-shaped error response (no fabricated transaction data)
 */
var LEGACY_VALIDATION_ERRORS = [
    { pattern: /expirationDate no es v/i, codError: 'E024', errorMessage: 'Fecha expiración pago invalida o menor a la fecha actual' },
    { pattern: /formato del campo email/i, codError: 'E029', errorMessage: 'Email invalido' },
    { pattern: /document type seleccionado|campo document es inv/i, codError: 'E003', errorMessage: 'El tipo de documento y documento no coinciden' },
    { pattern: /campo (names|last ?names) es obligatorio/i, codError: 'E004', errorMessage: 'Nombres y Apellidos Requeridos' },
    { pattern: /currency seleccionado no es v/i, codError: 'E021', errorMessage: 'Moneda no soportada' },
    { pattern: /validar totales, iva/i, codError: 'E036', errorMessage: 'Error al validar totales, iva, o base iva' },
    { pattern: /monto minimo no superado|amount must be greater/i, codError: 'E014', errorMessage: 'La transacción no se puede iniciar, monto minimo no superado' },
    { pattern: /no concuerda a la suma del split/i, codError: 'S003', errorMessage: 'El valor de la transacción no concuerda a la suma del split' },
    { pattern: /recibidor no est. matriculado/i, codError: 'S012', errorMessage: 'El recibidor no esta matriculado en la app principal' }
];

function toLegacyValidationError(error) {
    var message = String((error && error.message) || '');
    var known = LEGACY_VALIDATION_ERRORS.find(function (entry) { return entry.pattern.test(message); });
    return known
        ? { codError: known.codError, errorMessage: known.errorMessage }
        : { codError: error && error.code, errorMessage: error && error.message };
}

function toLegacyValidationErrors(errors) {
    var seen = {};
    return errors.map(toLegacyValidationError).filter(function (error) {
        var key = error.codError + '|' + error.errorMessage;
        var duplicated = seen[key];
        seen[key] = true;
        return !duplicated;
    });
}

function buildLegacyErrorShape(raw, plainAction) {
    var data = raw && raw.data;
    var hasStructuredErrors = data && !Array.isArray(data) && Array.isArray(data.errors) && data.errors.length;
    if (hasStructuredErrors) {
        return {
            success: false,
            title_response: 'Error',
            // Legacy's generic text for a validation failure; the actual reason
            // travels in data.errores[].errorMessage, exactly as in legacy.
            // Measured identical across every validation failure legacy
            // produced for cash (minimum amount, missing value, invalid email,
            // both split errors). The data-less branch below keeps the real
            // message: it covers auth failures and backend crashes, where the
            // real text is what lets an integrator diagnose the problem.
            text_response: VALIDATION_TEXT_RESPONSE,
            last_action: 'validation transaction',
            data: {
                totalerrores: toLegacyValidationErrors(data.errors).length,
                errores: toLegacyValidationErrors(data.errors)
            }
        };
    }
    return {
        success: false,
        title_response: 'Error',
        text_response: extractErrorMessage(raw),
        last_action: plainAction || 'validation transaction'
    };
}

var NUMERIC_PIN_TYPES = ['gana', 'sured'];
var NUMERIC_AGREEMENT_TYPES = ['efecty'];

function legacyPointName(type) {
    return LAST_ACTION_NAME_MAP[type] || type;
}

function legacyResponseText(response, type) {
    if (!LAST_ACTION_NAME_MAP[type] || typeof response !== 'string') {
        return response;
    }
    var legacyName = LAST_ACTION_NAME_MAP[type].replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });
    var backendName = new RegExp(legacyName.split(' ').join(' ?') + '$', 'i');
    return response.replace(backendName, legacyName);
}

function asText(value) {
    return value === undefined || value === null ? value : String(value);
}

/**
 * Map a successful ms-transaction response into the exact response shape the
 * legacy secure.payco.co/restpagos/v2/efectivo/{type} endpoint returns today
 * (see lib/resources/cash.js#_legacyCreate and tests/cash.js's "legacy flow"
 * suite), so callers get the identical shape regardless of which backend
 * actually served the request -- mirrors the Python SDK's CashResponseMapper
 * (epayco-python, ms-transaction-migration branch, SDK-1029/SDK-1030).
 *
 * Verified field-by-field against real paired pre-prod calls (same merchant,
 * same options) to both backends for `efecty` -- see SDK-1352 QA notes. PII
 * fields (`documento`/`nombres`/`apellidos`/`email`) are read from the
 * original `options` the caller passed, not from the ms-transaction response:
 * that response's `payerInformation` is masked for privacy
 * (e.g. "documentType": "C*"), so it cannot be used to reconstruct them.
 *
 * `cod_respuesta` is derived from `data.status` via codRespuestaFromEstado()
 * above (ms-transaction itself has no numeric equivalent of this field --
 * only `responseCode`, a string like "P004" that lines up with legacy's
 * separate `cod_error` field instead, mapped below).
 *
 * `cc_network_response` IS included below despite having no equivalent field
 * in the ms-transaction response at all: two separate real pre-prod calls
 * (different refPayco, different invoice) both returned the legacy endpoint's
 * identical constant `{code: "0000", message: "Franquicia no registrada"}`
 * for `efecty`, i.e. it isn't derived from the transaction -- it reads as a
 * fixed "not applicable" placeholder this legacy endpoint returns for every
 * non-card cash franchise. Only verified for `efecty`'s success path though;
 * if a caller depends on this for another franchise or an error response,
 * verify against a real call before trusting it.
 *
 * When ms-transaction rejects the request outright (raw.success === false),
 * this returns legacy's own thinner failure shape instead -- see
 * buildLegacyErrorShape.
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @param {Object} options the original caller-supplied options
 * @param {String} type the `type` cash.create(type, options) was called with
 * @return {Object} legacy-shaped response
 */
function mapToLegacyShape(raw, options, type) {
    if (!raw.success) {
        return buildLegacyErrorShape(raw, 'Ingresar pago en efectivo');
    }
    var data = raw.data || {};
    var providerData = data.paymentProviderData || {};
    return {
        success: true,
        title_response: 'SUCCESS',
        text_response: SUCCESS_TEXT_RESPONSE,
        last_action: 'Crear pin ' + legacyPointName(type),
        data: {
            ref_payco: data.refPayco,
            factura: data.invoice,
            descripcion: data.description,
            valor: data.amount,
            iva: data.tax,
            ico: data.ico,
            baseiva: data.taxBase,
            // Legacy's net value is the amount minus tax (25000 for a 29750
            // charge with 4750 iva), which is ms-transaction's `subtotal`.
            // Mapping `amount` here reported the gross figure whenever the
            // transaction carried tax; the two only coincide at tax 0.
            valorneto: typeof data.subtotal === 'number' ? data.subtotal : data.amount,
            moneda: data.currency,
            banco: legacyPointName(type).toUpperCase(),
            estado: data.status,
            respuesta: legacyResponseText(data.response, type),
            autorizacion: data.authorization,
            recibo: data.receipt,
            fecha: data.date,
            franquicia: data.franchise,
            cod_respuesta: codRespuestaFromEstado(data.status),
            cod_error: data.responseCode,
            ip: data.ip,
            enpruebas: data.testMode,
            tipo_doc: options.doc_type,
            documento: options.doc_number,
            nombres: options.name,
            apellidos: options.last_name,
            email: options.email,
            ciudad: options.city || '',
            direccion: options.address || 'NA',
            ind_pais: options.ind_country || null,
            country_card: '',
            extras: data.extras,
            cc_network_response: { code: '0000', message: 'Franquicia no registrada' },
            extras_epayco: { extra5: (data.extrasEpayco || {}).extra5 },
            pin: NUMERIC_PIN_TYPES.indexOf(type) !== -1 ? toQueryNumber(providerData.pin) : asText(providerData.pin),
            codigoproyecto: NUMERIC_AGREEMENT_TYPES.indexOf(type) !== -1 ? toQueryNumber(providerData.agreementCode) : asText(providerData.agreementCode),
            fechapago: data.date,
            fechaexpiracion: providerData.expirationDate,
            factor_conversion: providerData.trm,
            valor_pesos: data.amount
        }
    };
}

var MINIMUM_AMOUNT_ERROR = ['E014', 'La transacción no se puede iniciar, monto minimo no superado'];
var TOTALS_ERROR = ['E036', 'Error al validar totales, iva, o base iva'];
var INVALID_EMAIL_ERROR = ['E029', 'Email invalido'];
var DUPLICATED_INVOICE_ERROR = ['E035', 'Número de factura o referencia cliente duplicada'];
var MISSING_AMOUNT_ERRORS = [MINIMUM_AMOUNT_ERROR, TOTALS_ERROR, MINIMUM_AMOUNT_ERROR];
var MINIMUM_AMOUNT_BY_TYPE = { efecty: 20000, baloto: 10000, redservi: 10000, puntored: 10000 };

function legacyValidationResponse(errors) {
    return {
        success: false,
        title_response: 'Error',
        text_response: VALIDATION_TEXT_RESPONSE,
        last_action: 'validation transaction',
        data: {
            totalerrores: errors.length,
            errores: errors.map(function (error) {
                return { codError: error[0], errorMessage: error[1] };
            })
        }
    };
}

function legacyProcessingErrorResponse() {
    return {
        success: false,
        title_response: 'Error en pago efectivo',
        text_response: 'Error procesando el pago, por favor intente mas tarde',
        last_action: 'Ingresar pago en efectivo'
    };
}

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function validateLegacyInput(options, type) {
    if (options.value === undefined || options.value === null || (typeof options.value === 'number' && !isFinite(options.value))) {
        return legacyValidationResponse(MISSING_AMOUNT_ERRORS);
    }
    var amountText = String(options.value).trim();
    var amount = Number(amountText);
    if (amountText === '' || !isFinite(amount)) {
        return legacyProcessingErrorResponse();
    }
    if (amount <= 0) {
        return legacyValidationResponse(MISSING_AMOUNT_ERRORS);
    }
    if (amount < (MINIMUM_AMOUNT_BY_TYPE[type] || 0)) {
        return legacyValidationResponse([MINIMUM_AMOUNT_ERROR]);
    }
    if (isBlank(options.email)) {
        return legacyValidationResponse([INVALID_EMAIL_ERROR]);
    }
    if (options.invoice !== undefined && options.invoice !== null && String(options.invoice) === '') {
        return legacyValidationResponse([DUPLICATED_INVOICE_ERROR]);
    }
    return null;
}

var SERVER_ERROR_STATUS = 500;

var QUERY_LAST_ACTION = 'Consultar Transaccion';
var QUERY_SUCCESS_TEXT_RESPONSE = 'Transacción consultada existosamente';
var QUERY_NOT_FOUND_TEXT_RESPONSE = 'Transacción no existe';
var QUERY_FAILED_TEXT_RESPONSE = 'No se pudo consultar la transacción';
var NOT_FOUND_MESSAGE_REGEX = /no encontrad/i;
var EXTRA_EPAYCO_KEY_REGEX = /^extra([0-9]+)$/;

function toQueryNumber(value) {
    if (typeof value !== 'string' || value.trim() === '' || !isFinite(Number(value))) {
        return value;
    }
    return Number(value);
}

function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function valueOrDefault(source, key, fallback) {
    var value = source[key];
    return value === undefined || value === null ? fallback : value;
}

function isInternalQueryFailure(status) {
    return status === 401 || status === 403 || status >= 500;
}

function buildQueryErrorShape(raw) {
    var message = extractErrorMessage(raw);
    var hasMessage = typeof message === 'string' && message !== '';
    var textResponse = QUERY_FAILED_TEXT_RESPONSE;
    if (hasMessage) {
        textResponse = NOT_FOUND_MESSAGE_REGEX.test(message) ? QUERY_NOT_FOUND_TEXT_RESPONSE : message;
    }
    return {
        success: false,
        title_response: 'Error',
        text_response: textResponse,
        last_action: QUERY_LAST_ACTION,
        data: {}
    };
}

function buildQueryExtras(extras, extrasEpayco) {
    var mapped = {};
    EXTRA_KEYS.forEach(function (key) {
        mapped['x_' + key] = valueOrDefault(extras, key, '');
    });
    Object.keys(extrasEpayco)
        .filter(function (key) { return EXTRA_EPAYCO_KEY_REGEX.test(key); })
        .sort(function (a, b) {
            return Number(a.match(EXTRA_EPAYCO_KEY_REGEX)[1]) - Number(b.match(EXTRA_EPAYCO_KEY_REGEX)[1]);
        })
        .forEach(function (key) {
            mapped['x_' + key + '_epayco'] = valueOrDefault(extrasEpayco, key, '');
        });
    return mapped;
}

function merchantIdFromToken(token) {
    var parts = String(token || '').split('.');
    if (parts.length < 2) {
        return null;
    }
    try {
        var subject = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')).sub;
        return /^[0-9]+$/.test(String(subject)) ? Number(subject) : null;
    } catch (e) {
        return null;
    }
}

function mapQueryToLegacyShape(raw, merchantId) {
    if (!raw || !raw.success) {
        return buildQueryErrorShape(raw);
    }
    var data = plainObject(raw.data);
    var payer = plainObject(data.payerInformation);
    var status = valueOrDefault(data, 'status', null);
    var code = codRespuestaFromEstado(status);
    var amount = toQueryNumber(valueOrDefault(data, 'amount', null));
    var date = valueOrDefault(data, 'date', null);
    var invoice = valueOrDefault(data, 'invoice', null);
    var receipt = valueOrDefault(data, 'receipt', null);
    var transaction = {
        x_cust_id_cliente: merchantId === undefined ? null : merchantId,
        x_ref_payco: valueOrDefault(data, 'refPayco', null),
        x_id_factura: invoice,
        x_id_invoice: invoice,
        x_description: valueOrDefault(data, 'description', null),
        x_mpd_points: 0,
        x_amount: amount,
        x_amount_country: amount,
        x_amount_ok: amount,
        x_tax: toQueryNumber(valueOrDefault(data, 'tax', null)),
        x_tax_ico: toQueryNumber(valueOrDefault(data, 'ico', null)),
        x_amount_base: toQueryNumber(valueOrDefault(data, 'taxBase', null)),
        x_currency_code: valueOrDefault(data, 'currency', null),
        x_bank_name: valueOrDefault(data, 'nameBank', null),
        x_cardnumber: '*******',
        x_quotas: '',
        x_respuesta: status,
        x_response: status,
        x_approval_code: valueOrDefault(data, 'authorization', null),
        x_transaction_id: receipt === null ? null : String(receipt),
        x_fecha_transaccion: date,
        x_transaction_date: date,
        x_cod_respuesta: code,
        x_cod_response: code,
        x_response_reason_text: valueOrDefault(data, 'response', null),
        x_cod_transaction_state: code,
        x_transaction_state: status,
        x_errorcode: valueOrDefault(data, 'responseCode', null),
        x_franchise: valueOrDefault(data, 'franchise', null),
        x_business: null,
        x_customer_doctype: valueOrDefault(payer, 'documentType', null),
        x_customer_document: valueOrDefault(payer, 'document', null),
        x_customer_name: valueOrDefault(payer, 'names', null),
        x_customer_lastname: valueOrDefault(payer, 'lastNames', null),
        x_customer_email: valueOrDefault(payer, 'email', null),
        x_customer_phone: null,
        x_customer_movil: null,
        x_customer_ind_pais: null,
        x_customer_country: valueOrDefault(payer, 'country', null),
        x_customer_city: valueOrDefault(data, 'city', null),
        x_customer_address: valueOrDefault(payer, 'address', null),
        x_customer_ip: valueOrDefault(data, 'ip', null),
        x_signature: null,
        x_test_request: ['1', 'true'].indexOf(String(valueOrDefault(data, 'testMode', '')).toLowerCase()) !== -1 ? 'TRUE' : 'FALSE',
        x_transaction_cycle: null
    };
    return {
        success: true,
        title_response: 'Correcto',
        text_response: QUERY_SUCCESS_TEXT_RESPONSE,
        last_action: QUERY_LAST_ACTION,
        data: Object.assign(transaction, buildQueryExtras(plainObject(data.extras), plainObject(data.extrasEpayco)))
    };
}

/**
 * Create a cash (Efectivo) transaction against the ms-transaction generic
 * transactions endpoint. Resolves with the same response shape the legacy
 * secure.payco.co endpoint returns (see mapToLegacyShape) -- SDK-1352
 * requires callers to see one consistent shape regardless of which backend
 * actually served the request.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {String} franchise mapped franchise code (see FRANCHISE_MAP)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Promise<Object>} legacy-shaped response (see mapToLegacyShape)
 */
function createTransaction(epaycoCtx, franchise, options) {
    var type = TYPE_BY_FRANCHISE[franchise];
    var invalidInput = validateLegacyInput(options || {}, type);
    if (invalidInput) {
        return Promise.resolve(invalidInput);
    }
    return resolveIp(options)
        .then(function (ip) {
            var body = buildBody(epaycoCtx, franchise, Object.assign({}, options, { ip: ip }));
            var encryptedBody = encryptBody(body, epaycoCtx.privateKey, epaycoCtx.lang);
            return login(epaycoCtx.apiKey, epaycoCtx.privateKey).then(function (token) {
                return fetch(BASE_URL_MS_TRANSACTION + '/payment/api/v1/transactions', {
                    method: 'POST',
                    timeout: REQUEST_TIMEOUT_MS,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(encryptedBody)
                });
            });
        })
        .then(function (res) {
            if (res.status >= SERVER_ERROR_STATUS) {
                return legacyProcessingErrorResponse();
            }
            return res.json().then(function (raw) { return mapToLegacyShape(raw, options, type); });
        })
        .catch(function (err) {
            console.error('msTransactionCash create error:', err.message);
            return { error: err.message };
        });
}

/**
 * Query a cash (Efectivo) transaction by refPayco against the ms-transaction
 * generic transactions endpoint.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {String} refPayco must be a plain positive integer (see
 *        assertValidRefPayco) -- thrown synchronously (before any network
 *        call, including login()) if it isn't, same as cash.create()'s
 *        existing synchronous validation of an unsupported `type`.
 * @return {Promise<Object>} legacy-shaped query response (see mapQueryToLegacyShape)
 */
function getTransaction(epaycoCtx, refPayco) {
    assertValidRefPayco(refPayco, epaycoCtx && epaycoCtx.lang);
    return login(epaycoCtx.apiKey, epaycoCtx.privateKey)
        .then(function (token) {
            return axios({
                url: BASE_URL_MS_TRANSACTION + '/payment/api/v1/transactions/' + encodeURIComponent(String(refPayco)),
                method: 'get',
                timeout: REQUEST_TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            }).then(function (result) { return mapQueryToLegacyShape(result.data, merchantIdFromToken(token)); });
        })
        .catch(function (error) {
            var body = error.response && error.response.data;
            if (body && typeof body === 'object') {
                return isInternalQueryFailure(error.response.status) ? buildQueryErrorShape(null) : mapQueryToLegacyShape(body);
            }
            var message = error.response && error.response.data && error.response.data.message
                ? error.response.data.message
                : error.message;
            console.error('msTransactionCash get error:', message);
            return { error: message };
        });
}

module.exports = {
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_TRANSACTION_AUTH: BASE_URL_MS_TRANSACTION_AUTH,
    FRANCHISE_MAP: FRANCHISE_MAP,
    encryptValue: encryptValue,
    encryptBody: encryptBody,
    buildBody: buildBody,
    buildExtras: buildExtras,
    buildExtrasEpayco: buildExtrasEpayco,
    buildSplitPayment: buildSplitPayment,
    parseSplitReceivers: parseSplitReceivers,
    resolveIp: resolveIp,
    login: login,
    extractErrorMessage: extractErrorMessage,
    buildLegacyErrorShape: buildLegacyErrorShape,
    mapToLegacyShape: mapToLegacyShape,
    mapQueryToLegacyShape: mapQueryToLegacyShape,
    merchantIdFromToken: merchantIdFromToken,
    createTransaction: createTransaction,
    getTransaction: getTransaction
};
