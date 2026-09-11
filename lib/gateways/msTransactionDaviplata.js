/**
 * Gateway for the new "ms-transaction" microservice (apiflow.epayco.io) used to
 * create/query Daviplata transactions, replacing the legacy apify flow used by
 * lib/resources/daviplata.js (`POST /payment/process/daviplata` against
 * BASE_URL_APIFY, i.e. the pre-SDK-1353 `Resource#request(..., apify = true)`
 * call).
 *
 * Mirrors lib/gateways/msTransactionSafetypay.js (SDK-1354) field-for-field
 * for the encryption/auth/generic-transaction-endpoint plumbing, which is
 * shared across every ms-transaction payment method -- only buildBody's
 * paymentMethod/paymentMethodData and mapToLegacyShape's field mapping are
 * Daviplata-specific. Kept as its own self-contained module for the same
 * reasons documented in msTransactionSafetypay.js (independently unit-testable,
 * isolated from Resource#request).
 *
 * `.confirm()` (the OTP-confirmation step, see lib/resources/daviplata.js) is
 * NOT migrated here -- SDK-1353's ticket only asks for create + query, and
 * ms-transaction's generic transactions endpoint has no equivalent for
 * confirming a session's OTP. This matches the already-shipped Python SDK's
 * own ms-transaction migration (epayco-python, epaycosdk/resources.py's
 * `Daviplata.confirm()`), which also left `confirm()` permanently on the
 * legacy `payment/confirm/daviplata` endpoint while migrating `create()`/
 * `get()` -- corroborated, not a guess.
 *
 * Endpoint verified empirically against real pre-prod (comercio 630339,
 * SDK-1353 QA):
 *  - POST https://apiflow.epayco.io/payment/api/v1/transactions with
 *    paymentMethod "DP" (per the ticket's own example body) -- returns 200
 *    with a real (business-rejected in this sandbox: "Daviplata no disponible
 *    para iniciar la transacción") but well-formed response, confirming the
 *    endpoint/contract are wired correctly. Same generic transactions endpoint
 *    msTransactionSafetypay.js/msTransactionBank.js/msTransactionCash.js
 *    already use.
 *  - GET https://apiflow.epayco.io/payment/api/v1/transactions/{refPayco} --
 *    same generic per-refPayco endpoint as the other three gateways, returns
 *    200 with the transaction. Matches the ticket's own documented query
 *    endpoint exactly (unlike Bank's/SafetyPay's tickets, which each
 *    documented a payment-method-specific query path that actually 404s).
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
 * Base hosts (env-overridable), same hosts msTransactionSafetypay.js/
 * msTransactionBank.js use -- Daviplata goes through the same generic
 * ms-transaction transactions endpoint, only paymentMethod differs (verified
 * empirically, see this file's header note). Deliberately NOT the newer
 * apiflow.epayco.io/authentication auth endpoint msTransactionCash.js moved
 * to (SDK-1352) -- that change was requested for cash specifically; this
 * gateway matches the majority precedent (Bank/SafetyPay) instead.
 */
var BASE_URL_MS_TRANSACTION = process.env.BASE_URL_MS_TRANSACTION || 'https://apiflow.epayco.io';
var BASE_URL_MS_TRANSACTION_AUTH = process.env.BASE_URL_MS_TRANSACTION_AUTH || 'https://eks-apify-service.epayco.io';

/**
 * AES-256-CBC IV literal used by ms-transaction. See msTransactionSafetypay.js's
 * identical constant for the full rationale -- required as-is by the backend.
 */
var IV_STRING = '0000000000000000';

/**
 * Guard against a misconfigured merchant key silently producing wrong
 * ciphertext (see msTransactionSafetypay.js assertValidPrivateKey).
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
 * msTransactionSafetypay.js encryptValue for the full rationale.
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
 * msTransactionSafetypay.js encryptBody for the full rationale.
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
 * msTransactionSafetypay.js hasSplitPaymentOptions.
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
 * array. See msTransactionSafetypay.js parseSplitReceivers.
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
 * splitPayment object ms-transaction expects -- same convention Safetypay's/
 * Bank's/Cash's buildSplitPayment use, and the same shape the ticket's own
 * example body documents (`splitPayment: {splitMethod, splitAppId, ...}`).
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
 * Map the legacy daviplata.create(options) options (README's Daviplata
 * section) into the ms-transaction plaintext body shape verified against the
 * real API (see this file's header note).
 *
 * `country`/`city`/`address` have no equivalent field in the ticket's own
 * example body or in the already-shipped Python SDK's DaviplataRequestMapper
 * (epaycosdk/mappers/daviplata.py) -- `country` still defaults to "CO" for
 * consistency with every other ms-transaction payment method in this repo,
 * but is NOT sent as part of `paymentMethodData` (unlike SafetyPay, which
 * needs an ISO-alpha3 country there) since neither the ticket nor Python's
 * mapper does that for Daviplata. `paymentMethodData` stays `{}`, exactly as
 * documented in the ticket's own curl example.
 *
 * `confirmationMethod` defaults to "POST", matching the already-shipped
 * Python SDK's DaviplataRequestMapper default (same as SafetyPay's).
 *
 * `extrasEpayco.extra5` is set to "P44", matching Bank's/Cash's/SafetyPay's
 * buildBody in this repo -- see msTransactionSafetypay.js's identical note
 * for why this repo's convention ("P44") differs from the Python SDK's
 * ("P43") and why that's not a precedent to follow here.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Object} plaintext ms-transaction body
 */
function buildBody(epaycoCtx, options) {
    options = options || {};
    var body = {
        invoice: options.invoice,
        documentType: options.doc_type,
        document: options.document || options.doc_number,
        names: options.name,
        lastNames: options.last_name,
        phone: options.phone,
        cellphone: options.cell_phone,
        email: options.email,
        responseUrl: options.url_response || null,
        confirmationUrl: options.url_confirmation || null,
        confirmationMethod: options.method_confirmation || options.metodoconfirmacion || 'POST',
        amount: options.value,
        tax: options.tax !== undefined ? options.tax : 0,
        ico: options.ico !== undefined ? options.ico : 0,
        taxBase: options.tax_base !== undefined ? options.tax_base : 0,
        currency: options.currency || 'COP',
        uniqueTransactionPerBill: options.unique_transaction_per_bill === true,
        testMode: epaycoCtx.test === 'TRUE',
        paymentMethod: 'DP',
        country: options.country || 'CO',
        ip: options.ip,
        description: options.description,
        integrationType: { tipo_checkout: 'api', modo_pago: 'payment' },
        publicKey: epaycoCtx.apiKey,
        extras: buildExtras(options),
        extrasEpayco: Object.assign({ extra1: '', extra2: '', extra3: '' }, options.extrasEpayco, { extra5: 'P44' }),
        paymentMethodData: {}
    };
    var splitPayment = buildSplitPayment(options);
    if (splitPayment) {
        body.splitPayment = splitPayment;
    }
    return body;
}

/**
 * Resolve the client IP. See msTransactionSafetypay.js resolveIp.
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
 * Log in against the ms-transaction auth host. See msTransactionSafetypay.js login.
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
 * msTransactionSafetypay.js assertValidRefPayco for the full rationale.
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
 * `data.errors[].message` (a ValidationException shape), not in the
 * top-level `message` field. See msTransactionSafetypay.js's identical
 * extractErrorMessage for the full rationale (the exact same bug, found and
 * fixed there first for SDK-1354/SDK-1352/SDK-1355 -- applied here from the
 * start instead of being discovered again).
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
 * legacy apify daviplata endpoint returns today (see
 * lib/resources/daviplata.js pre-SDK-1353 `.create()`), so callers get the
 * identical shape regardless of which backend actually served the request --
 * mirrors msTransactionSafetypay.js's mapToLegacyShape.
 *
 * Field names/shape are NOT independently reverse-engineered here: this repo
 * doesn't have test coverage or a captured real legacy Daviplata response to
 * pair against (unlike SafetyPay's SDK-1354, which had a real paired call).
 * Instead this mirrors the already-shipped Python SDK's own ms-transaction
 * migration field-for-field (epayco-python, epaycosdk/mappers/daviplata.py's
 * `DaviplataResponseMapper`, which WAS built against a real legacy Daviplata
 * response) -- `idSessionToken`/`tokenExpirationDate` in particular come from
 * that precedent (`paymentProviderData.paymentSessionId`/
 * `paymentSessionExpirationDate`), not guessed. `daviplataOtpLab` has no
 * known equivalent field in the new response either there or here, so it's
 * left `null` like Python's mapper does. If a real legacy Daviplata response
 * ever gets captured for this repo specifically, re-verify against it before
 * trusting this shape for a field this note doesn't call out explicitly.
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
        titleResponse: success ? 'SUCCESS' : 'Error',
        textResponse: success ? raw.message : extractErrorMessage(raw),
        lastAction: 'Registrar pago en daviplata',
        data: {
            refPayco: data.refPayco,
            invoice: data.invoice,
            description: data.description,
            value: data.amount,
            tax: data.tax,
            ico: data.ico,
            taxBase: data.taxBase,
            netoValue: data.amount,
            currency: data.currency,
            bank: 'DaviPlata',
            estatus: data.status,
            response: data.response,
            autorization: data.authorization,
            receipt: data.receipt,
            date: data.date,
            franchise: data.franchise,
            codResponse: data.responseCode !== undefined ? data.responseCode : '',
            codError: '',
            ip: data.ip,
            testMode: data.testMode,
            docType: options.doc_type,
            document: options.document || options.doc_number,
            name: options.name,
            lastName: options.last_name,
            email: options.email,
            city: data.city,
            address: options.address,
            indCountry: options.ind_country || '',
            idSessionToken: providerData.paymentSessionId,
            tokenExpirationDate: providerData.paymentSessionExpirationDate,
            daviplataOtpLab: null,
            extras: data.extras || {},
            extras_epayco: { extra5: extrasEpaycoNew.extra5 }
        }
    };
}

/**
 * Create a Daviplata transaction against the ms-transaction generic
 * transactions endpoint. Resolves with the same response shape the legacy
 * apify endpoint returns (see mapToLegacyShape) -- SDK-1353 requires callers
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
            console.error('msTransactionDaviplata create error:', err.message);
            return { error: err.message };
        });
}

/**
 * Query a Daviplata transaction by refPayco against the ms-transaction
 * generic transactions endpoint. Uses the SAME generic
 * /payment/api/v1/transactions/{refPayco} endpoint Safetypay's/Bank's/Cash's
 * getTransaction use -- confirmed empirically against real pre-prod: it
 * returns 200 with the Daviplata transaction, matching the ticket's own
 * documented query endpoint exactly.
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
            console.error('msTransactionDaviplata get error:', message);
            return { error: message };
        });
}

module.exports = {
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_TRANSACTION_AUTH: BASE_URL_MS_TRANSACTION_AUTH,
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
