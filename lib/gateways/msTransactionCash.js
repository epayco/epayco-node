/**
 * Gateway for the new "ms-transaction" microservice (apiflow.epayco.io) used to
 * create/query cash (Efectivo) transactions, replacing the legacy
 * secure.payco.co/restpagos/v2/efectivo/{type} flow used by lib/resources/cash.js.
 *
 * Kept isolated from lib/resources/index.js (Resource#request) on purpose: this
 * flow talks to different hosts, uses a different auth handshake (Basic login
 * against eks-apify-service.epayco.io -> short-lived JWT) and a different
 * per-field AES-256-CBC encryption scheme than the legacy secure.payco.co flow,
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

/**
 * Default per-request timeout (ms) for both the node-fetch and axios calls
 * this module makes (login, create, get) -- none of the three had a timeout
 * before, so a slow/hanging upstream could hang the caller's promise
 * indefinitely. node-fetch v2's `timeout` option and axios' `timeout` option
 * both abort the in-flight request after this many ms.
 */
var REQUEST_TIMEOUT_MS = 10000;

/**
 * Base hosts (env-overridable, matching the BASE_URL_SDK/SECURE_URL_SDK pattern
 * already used in lib/resources/index.js).
 *
 * NOTE: this is intentionally NOT the same host as the existing `apify` flag in
 * lib/resources/index.js (BASE_URL_APIFY, default "https://apify.epayco.co",
 * used today by safetypay.js/daviplata.js). The ms-transaction cash flow talks
 * to a different, newer host (eks-apify-service.epayco.io for auth,
 * apiflow.epayco.io for the transaction itself), verified empirically against
 * the real API.
 */
var BASE_URL_MS_TRANSACTION = process.env.BASE_URL_MS_TRANSACTION || 'https://apiflow.epayco.io';
var BASE_URL_MS_TRANSACTION_AUTH = process.env.BASE_URL_MS_TRANSACTION_AUTH || 'https://eks-apify-service.epayco.io';

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
 * Bucket the legacy extra1..extra6 options into the `extras` object the new
 * contract expects.
 *
 * @param {Object} options
 * @return {Object}
 */
function buildExtras(options) {
    var extras = {};
    ['extra1', 'extra2', 'extra3', 'extra4', 'extra5', 'extra6'].forEach(function (key) {
        if (options[key] !== undefined && options[key] !== null) {
            extras[key] = options[key];
        }
    });
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

/**
 * Map the legacy snake_case cash options (see README's Cash section /
 * tests/cash.js, and keylang.json for the equivalent legacy field names) into
 * the ms-transaction plaintext body shape verified against the real API.
 *
 * Known, deliberate gaps vs. the legacy /restpagos/v2/efectivo/{type} flow
 * (no verified equivalent field in the new contract -- flagged for follow-up,
 * not silently best-effort-mapped):
 *  - `end_date` (voucher expiration) has no field in the verified contract;
 *    it is NOT forwarded. Expiration appears to be computed server-side per
 *    franchise (see the `paymentProviderData.expirationDate` in the response).
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
        extrasEpayco: Object.assign({ extra1: '', extra2: '', extra3: '' }, options.extrasEpayco, { extra5: 'P44' })
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
 * @param {String} apiKey
 * @param {String} privateKey
 * @return {Promise<String>} JWT
 */
function login(apiKey, privateKey) {
    var basicToken = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(apiKey + ':' + privateKey));
    return fetch(BASE_URL_MS_TRANSACTION_AUTH + '/login', {
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + basicToken
        }
    })
        .then(function (res) { return res.json(); })
        .then(function (json) { return json && json.token; });
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
 * Known gap (no verified source field in the ms-transaction response,
 * flagged rather than guessed):
 *  - `cod_respuesta` (legacy: numeric, e.g. 3): ms-transaction only exposes
 *    `responseCode` as a string (e.g. "P004", which lines up with legacy's
 *    separate `cod_error` field instead -- see mapping below). Left `null`.
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
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @param {Object} options the original caller-supplied options
 * @param {String} type the `type` cash.create(type, options) was called with
 * @return {Object} legacy-shaped response
 */
function mapToLegacyShape(raw, options, type) {
    var success = !!raw.success;
    var data = raw.data || {};
    var providerData = data.paymentProviderData || {};
    return {
        success: success,
        title_response: success ? 'SUCCESS' : 'ERROR',
        text_response: raw.message,
        last_action: 'Crear pin ' + type,
        data: {
            ref_payco: data.refPayco,
            factura: data.invoice,
            descripcion: data.description,
            valor: data.amount,
            iva: data.tax,
            ico: data.ico,
            baseiva: data.taxBase,
            valorneto: data.amount,
            moneda: data.currency,
            banco: type.toUpperCase(),
            estado: data.status,
            respuesta: data.response,
            autorizacion: data.authorization,
            recibo: data.receipt,
            fecha: data.date,
            franquicia: data.franchise,
            cod_respuesta: null,
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
            pin: providerData.pin,
            codigoproyecto: providerData.agreementCode,
            fechapago: data.date,
            fechaexpiracion: providerData.expirationDate,
            factor_conversion: providerData.trm,
            valor_pesos: data.amount
        }
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
        .then(function (res) { return res.json(); })
        .then(function (raw) { return mapToLegacyShape(raw, options, TYPE_BY_FRANCHISE[franchise]); })
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
 * @return {Promise<Object>} the ms-transaction response body as-is
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
            });
        })
        .then(function (result) { return result.data; })
        .catch(function (error) {
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
    buildSplitPayment: buildSplitPayment,
    parseSplitReceivers: parseSplitReceivers,
    resolveIp: resolveIp,
    login: login,
    createTransaction: createTransaction,
    getTransaction: getTransaction
};
