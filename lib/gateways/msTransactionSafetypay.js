/**
 * Gateway for the new "ms-transaction" microservice (apiflow.epayco.io) used to
 * create/query SafetyPay transactions, replacing the legacy apify flow used by
 * lib/resources/safetypay.js (`POST /payment/process/safetypay` against
 * BASE_URL_APIFY, i.e. the pre-SDK-1354 `Resource#request(..., apify = true)`
 * call).
 *
 * Mirrors lib/gateways/msTransactionBank.js (SDK-1355) and
 * lib/gateways/msTransactionCash.js (SDK-1352) field-for-field for the
 * encryption/auth/generic-transaction-endpoint plumbing, which is shared
 * across every ms-transaction payment method -- only buildBody's
 * paymentMethod/paymentMethodData and mapToLegacyShape's field mapping are
 * SafetyPay-specific. Kept as its own self-contained module (not importing
 * from msTransactionBank.js/msTransactionCash.js) on purpose, matching those
 * files' own note about being independently unit-testable and isolated from
 * Resource#request.
 *
 * Endpoints verified empirically against real pre-prod (merchant from
 * epayco-node-test's .env, SDK-1354 QA):
 *  - POST https://apiflow.epayco.io/payment/api/v1/transactions -- the
 *    ticket's own documented endpoint
 *    (POST .../payment/api/v1/safetypay/transactions) returned a plain 404
 *    ("404 page not found"); the SAME generic transactions endpoint
 *    msTransactionBank.js/msTransactionCash.js already use, with
 *    paymentMethod "SP", returned 200 with a real SafetyPay checkout URL.
 *  - GET https://apiflow.epayco.io/payment/api/v1/transactions/{refPayco} --
 *    same story: the ticket's documented query endpoint
 *    (GET .../v1/safetypay/transactions?ref_payco={id}) also 404s; this
 *    generic per-refPayco endpoint (identical to Bank's/Cash's getTransaction)
 *    returned the transaction. Also matches the already-shipped Python SDK's
 *    own ms-transaction migration (epayco-python,
 *    epaycosdk/gateways/ms_transaction.py's MsTransactionGateway, which uses
 *    this exact same generic TRANSACTIONS_URL for every payment method
 *    including safetypay) -- not guessed, corroborated by a second,
 *    independently-migrated SDK.
 *
 * Module dependencies
 */
var CryptoJS = require('crypto-js');
var fetch = require('node-fetch');
var axios = require('axios');
var EpaycoError = require('../resources/errors');

/**
 * Default per-request timeout (ms) for both the node-fetch and axios calls
 * this module makes (login, create, get).
 */
var REQUEST_TIMEOUT_MS = 10000;

/**
 * Base hosts (env-overridable), same hosts msTransactionBank.js/
 * msTransactionCash.js use -- SafetyPay goes through the same generic
 * ms-transaction transactions endpoint, only paymentMethod/paymentMethodData
 * differ (verified empirically, see this file's header note).
 */
var BASE_URL_MS_TRANSACTION = process.env.BASE_URL_MS_TRANSACTION || 'https://apiflow.epayco.io';
var BASE_URL_MS_TRANSACTION_AUTH = process.env.BASE_URL_MS_TRANSACTION_AUTH || 'https://eks-apify-service.epayco.io';

/**
 * AES-256-CBC IV literal used by ms-transaction. See msTransactionBank.js's
 * identical constant for the full rationale -- required as-is by the backend.
 */
var IV_STRING = '0000000000000000';

/**
 * Legacy `country` option (ISO alpha-2, e.g. "CO") -> the ISO alpha-3 code
 * ms-transaction's `paymentMethodData.country` field requires for SafetyPay
 * specifically (verified empirically: "CO" is rejected with "El campo
 * country no es válido.", "COL" succeeds). Only Colombia confirmed directly
 * against the real API here; the "CO"->"COL" entry mirrors the already-
 * shipped Python SDK's own ms-transaction migration
 * (epayco-python, epaycosdk/mappers/safetypay.py's `SafetypayRequestMapper.
 * _ISO_ALPHA3`, which has the exact same single-entry map) -- corroborated,
 * not guessed. Other SafetyPay countries (Peru, Mexico, etc.) are NOT in
 * Python's map either, so this SDK doesn't invent them; falls back to the
 * plain `country` value unchanged for anything not in this map (same
 * fallback Python's mapper uses).
 */
var ISO_ALPHA3_BY_ALPHA2 = { CO: 'COL' };

/**
 * @param {String} country ISO alpha-2 country code (legacy `options.country`)
 * @return {String} ISO alpha-3 equivalent if known, otherwise `country` as-is
 */
function toIsoAlpha3(country) {
    return ISO_ALPHA3_BY_ALPHA2[country] || country;
}

/**
 * Guard against a misconfigured merchant key silently producing wrong
 * ciphertext (see msTransactionBank.js assertValidPrivateKey).
 *
 * @param {String} privateKey
 * @param {String} [lang] ES or EN, defaults to ES.
 */
function assertValidPrivateKey(privateKey, lang) {
    if (typeof privateKey !== 'string' || Buffer.byteLength(privateKey, 'utf8') !== 32) {
        throw new EpaycoError(lang || 'ES', 103);
    }
}

/**
 * Encrypt a single value with AES-256-CBC/PKCS7. See
 * msTransactionBank.js encryptValue for the full rationale.
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
 * publicKey stays plaintext, null/undefined leaves are omitted.
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
 * Encrypt a full ms-transaction request body. See
 * msTransactionBank.js encryptBody for the full rationale.
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
 * Bucket the legacy extra1..extra6 options into the extras object the new
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
 * Whether options carries any of the legacy split-payment fields. See
 * msTransactionBank.js hasSplitPaymentOptions.
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
 * Accept split_receivers as either a JSON string or an already-parsed
 * array. See msTransactionBank.js parseSplitReceivers.
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
 * Map the legacy snake_case split-payment options into the root-level
 * splitPayment object ms-transaction expects -- same convention Bank's/
 * Cash's buildSplitPayment use, and the same shape the already-shipped
 * Python SDK's SafetypayRequestMapper builds from `options["split_payment"]`.
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
 * Map the legacy safetypay.create(options) options (README's Safetypay
 * section) into the ms-transaction plaintext body shape verified against the
 * real API (see this file's header note).
 *
 * `document` (NOT `doc_number` like Bank's/Cash's `options.doc_number`) is
 * SafetyPay's own documented legacy field name for this -- see README.md's
 * Safetypay example (`document: "123456789"`) and
 * `lib/keylang_apify.json`'s `"doc_number": "document"` entry (the legacy
 * apify flow's field translator, which only fires if the caller happens to
 * use `doc_number` instead -- both end up meaning the same thing today).
 * `options.doc_number` is still accepted as a fallback for callers migrating
 * from Bank's/Cash's naming convention, but `options.document` takes
 * precedence to match the documented/legacy convention.
 *
 * `paymentMethodData.country` uses the ISO alpha-3 code (see toIsoAlpha3)
 * SafetyPay's ms-transaction integration requires, while the root-level
 * `country` field keeps the plain ISO alpha-2 value every other
 * ms-transaction payment method uses -- both confirmed empirically to be
 * required as different formats for this one field.
 *
 * `confirmationMethod` defaults to "POST" (NOT "GET" like Bank's/Cash's
 * buildBody) -- matches the already-shipped Python SDK's SafetypayRequestMapper
 * default. Still fully overridable via `options.method_confirmation`/
 * `options.metodoconfirmacion` either way.
 *
 * `extrasEpayco.extra5` is set to "P44", matching Bank's/Cash's buildBody
 * (msTransactionBank.js/msTransactionCash.js) -- this literal is an
 * internal-tracking marker for this SDK's own legacy-POST traffic, not
 * something specific to any one payment method: lib/resources/index.js's
 * Resource#request auto-injects `{extra5: "P44"}` on every legacy POST
 * regardless of payment method (see lib/resources/index.js:39), and both
 * Bank's and Cash's already-merged ms-transaction migrations (SDK-1355,
 * SDK-1352) replicate that same literal explicitly for exactly that reason.
 * The already-shipped Python SDK uses "P43" here instead, but that is just
 * that other codebase's own convention -- it uses "P43" uniformly for every
 * migrated method there (including cash/PSE, where this Node repo uses
 * "P44"), so it is not a precedent applicable to this repo. Resolved by
 * consistency with this repo's own Bank/Cash migrations, not left pending.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Object} plaintext ms-transaction body
 */
function buildBody(epaycoCtx, options) {
    options = options || {};
    var country = options.country || 'CO';
    var body = {
        invoice: options.invoice,
        quotes: '1',
        documentType: options.doc_type,
        document: options.document || options.doc_number,
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
        baseTax: options.tax_base !== undefined ? options.tax_base : 0,
        currency: options.currency || 'COP',
        testMode: epaycoCtx.test === 'TRUE',
        uniqueTransactionPerBill: options.unique_transaction_per_bill === true,
        paymentMethod: 'SP',
        country: country,
        ip: options.ip,
        responseUrl: options.url_response || null,
        confirmationUrl: options.url_confirmation || null,
        confirmationMethod: options.method_confirmation || options.metodoconfirmacion || 'POST',
        description: options.description,
        integrationType: { tipo_checkout: 'smart_checkout', modo_pago: 'safetypay' },
        publicKey: epaycoCtx.apiKey,
        extras: buildExtras(options),
        extrasEpayco: Object.assign({ extra1: '', extra2: '', extra3: '' }, options.extrasEpayco, { extra5: 'P44' }),
        paymentMethodData: {
            country: toIsoAlpha3(country),
            expirationDate: options.end_date
        }
    };
    var splitPayment = buildSplitPayment(options);
    if (splitPayment) {
        body.splitPayment = splitPayment;
    }
    return body;
}

/**
 * Resolve the client IP. See msTransactionBank.js resolveIp.
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
 * Log in against the ms-transaction auth host. See msTransactionBank.js login.
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
 * refPayco is interpolated directly into the request path (see
 * getTransaction below) -- validate strictly first. See
 * msTransactionBank.js assertValidRefPayco for the full rationale.
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
 * When ms-transaction rejects a request, the real failure detail lives in
 * `data.errors[].message` (a ValidationException shape: `{errorType,
 * errorTypeDescription, errors: [{code, message}]}`), not in the top-level
 * `message` field -- that top-level `message` is a generic, unhelpful
 * "Transaction request" for every validation failure observed. Without this,
 * `mapToLegacyShape` (which only knows the success-path `data` shape) mapped
 * `textResponse` to that generic string and every other `data.*` field to
 * `undefined`, silently discarding the actual reason.
 *
 * Verified empirically: a SafetyPay split-payment transaction rejected by the
 * real API returned
 * `{"message":"Transaction request","data":{"errorType":"ValidationException",
 * "errors":[{"message":"El valor de la transacción no concuerda a la suma del
 * split."}]}}` -- `textResponse` came back as the useless "Transaction
 * request" before this fix.
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
 * Map a successful ms-transaction response into the exact response shape the
 * legacy apify safetypay endpoint returns today (see
 * lib/resources/safetypay.js pre-SDK-1354 `.create()`), so callers get the
 * identical shape regardless of which backend actually served the request --
 * mirrors msTransactionBank.js/msTransactionCash.js mapToLegacyShape.
 *
 * Verified field-by-field against a REAL PAIRED CALL to both backends
 * (SDK-1354 QA, epayco-node-test's real test merchant/keys): the legacy
 * apify endpoint's actual response shape is camelCase already (`titleResponse`,
 * `textResponse`, `lastAction`, `data.refPayco`, etc) -- NOT the
 * snake_case/Spanish shape Bank's/Cash's truly-legacy secure.payco.co
 * endpoints return (`title_response`, `ref_payco`, `valor`...). This is
 * consistent with `lib/resources/safetypay.js`'s pre-SDK-1354 `.create()`
 * already going through the `apify = true` flow (BASE_URL_APIFY,
 * `eks-apify-service.epayco.io`) rather than the older `secure.payco.co`
 * flow Bank/Cash used pre-migration.
 *
 * Also cross-checked against the already-shipped Python SDK's own
 * ms-transaction migration for safetypay (epayco-python,
 * epaycosdk/mappers/safetypay.py's `SafetypayResponseMapper`), which maps
 * the exact same new-response fields into the exact same legacy field names
 * used below -- independent corroboration, not just this one paired call.
 *
 * `autorization` (sic, matches the real legacy response's own typo -- single
 * "h") is read from `data.authorization`.
 *
 * `transactionId` and `ticketId` are both read from `data.refPayco`/
 * `data.receipt` respectively: the real paired legacy response showed
 * `transactionId` === `refPayco` and `ticketId` === `recibo`/`receipt`
 * (all matching values), same relationship Bank's mapToLegacyShape found for
 * its own `transactionID`/`ticketId` fields (see msTransactionBank.js).
 *
 * `country` has NO equivalent in the ms-transaction response's `data` object
 * (only inside the masked `payerInformation.country`, e.g. "C*") -- read
 * from the original caller-supplied `options` instead, same rationale
 * Bank's/Cash's mapToLegacyShape use for PII fields.
 *
 * `codResponse`/`codError`: the real legacy response has BOTH fields, empty
 * strings in the one successful paired call observed (no real error-path
 * example captured to disambiguate them further). Mapped per the
 * already-shipped Python SDK's SafetypayResponseMapper: `codResponse` reads
 * `data.responseCode` (the new flow's own error/status code, e.g. "P004"),
 * `codError` is always "" (no equivalent field identified in the new
 * response) -- not guessed independently, matches that verified precedent.
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @param {Object} options the original caller-supplied options
 * @return {Object} legacy-shaped response
 */
function mapToLegacyShape(raw, options) {
    options = options || {};
    var success = !!raw.success;
    var data = raw.data || {};
    var providerData = data.paymentProviderData;
    if (!providerData || Array.isArray(providerData)) {
        providerData = {};
    }
    var extrasEpaycoNew = data.extrasEpayco || {};
    return {
        success: success,
        titleResponse: success ? 'Ok' : (raw.message || 'Error'),
        textResponse: success ? raw.message : extractErrorMessage(raw),
        lastAction: 'Envio Transaction Safetypay',
        data: {
            refPayco: data.refPayco,
            invoice: data.invoice,
            description: data.description,
            value: data.amount,
            tax: data.tax,
            ico: data.ico,
            taxBase: data.taxBase,
            currency: data.currency,
            status: data.status,
            response: data.response,
            codResponse: data.responseCode !== undefined ? data.responseCode : '',
            codError: '',
            autorization: data.authorization,
            receipt: data.receipt,
            date: data.date,
            country: options.country || 'CO',
            city: data.city,
            urlBank: providerData.urlPayment || '',
            transactionId: data.refPayco,
            ticketId: data.receipt,
            extras: data.extras || {},
            extras_epayco: { extra5: extrasEpaycoNew.extra5 }
        }
    };
}

/**
 * Create a SafetyPay transaction against the ms-transaction generic
 * transactions endpoint. Resolves with the same response shape the legacy
 * apify endpoint returns (see mapToLegacyShape) -- SDK-1354 requires callers
 * to see one consistent shape regardless of which backend actually served
 * the request.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Promise<Object>} legacy-shaped response (see mapToLegacyShape)
 */
function createTransaction(epaycoCtx, options) {
    return resolveIp(options)
        .then(function (ip) {
            var body = buildBody(epaycoCtx, Object.assign({}, options, { ip: ip }));
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
        .then(function (raw) { return mapToLegacyShape(raw, options); })
        .catch(function (err) {
            console.error('msTransactionSafetypay create error:', err.message);
            return { error: err.message };
        });
}

/**
 * Query a SafetyPay transaction by refPayco against the ms-transaction
 * generic transactions endpoint. Uses the SAME generic
 * /payment/api/v1/transactions/{refPayco} endpoint Bank's/Cash's
 * getTransaction use (see msTransactionBank.js/msTransactionCash.js) --
 * confirmed empirically against real pre-prod: it returns 200 with the
 * SafetyPay transaction. The `/v1/safetypay/transactions?ref_payco=...`
 * endpoint shown in SDK-1354's Jira description returned 404 in that same
 * test and is not used (same pattern already seen in SDK-1355's own Jira
 * description for Bank, see msTransactionBank.js's getTransaction).
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {String} refPayco must be a plain positive integer (see
 *        assertValidRefPayco)
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
            console.error('msTransactionSafetypay get error:', message);
            return { error: message };
        });
}

module.exports = {
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_TRANSACTION_AUTH: BASE_URL_MS_TRANSACTION_AUTH,
    ISO_ALPHA3_BY_ALPHA2: ISO_ALPHA3_BY_ALPHA2,
    toIsoAlpha3: toIsoAlpha3,
    encryptValue: encryptValue,
    encryptBody: encryptBody,
    buildBody: buildBody,
    buildExtras: buildExtras,
    buildSplitPayment: buildSplitPayment,
    parseSplitReceivers: parseSplitReceivers,
    resolveIp: resolveIp,
    login: login,
    mapToLegacyShape: mapToLegacyShape,
    createTransaction: createTransaction,
    getTransaction: getTransaction
};
