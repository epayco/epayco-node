/**
 * Gateway for the new "ms-transaction" microservice (apiflow.epayco.io) used to
 * create/query PSE (bank) transactions, replacing the legacy
 * secure.payco.co/restpagos/v2/pse/... flow used by lib/resources/bank.js.
 *
 * Mirrors lib/gateways/msTransactionCash.js (SDK-1352) field-for-field for the
 * encryption/auth/generic-transaction-endpoint plumbing, which is shared
 * across ms-transaction payment methods -- only buildBody's paymentMethod/
 * paymentMethodData and mapToLegacyShape's field mapping are PSE-specific.
 * Kept as its own self-contained module (not importing from
 * msTransactionCash.js) on purpose, matching that file's own note about
 * being independently unit-testable and isolated from Resource#request.
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
 * Base hosts (env-overridable), same hosts msTransactionCash.js uses -- PSE
 * goes through the same generic ms-transaction transactions endpoint, only
 * paymentMethod/paymentMethodData differ (verified empirically).
 */
var BASE_URL_MS_TRANSACTION = process.env.BASE_URL_MS_TRANSACTION || 'https://apiflow.epayco.io';
var BASE_URL_MS_TRANSACTION_AUTH = process.env.BASE_URL_MS_TRANSACTION_AUTH || 'https://eks-apify-service.epayco.io';

/**
 * AES-256-CBC IV literal used by ms-transaction. See msTransactionCash.js's
 * identical constant for the full rationale -- required as-is by the backend.
 */
var IV_STRING = '0000000000000000';

/**
 * Guard against a misconfigured merchant key silently producing wrong
 * ciphertext (see msTransactionCash.js assertValidPrivateKey).
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
 * msTransactionCash.js encryptValue for the full rationale.
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
 * msTransactionCash.js encryptBody for the full rationale.
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
 * msTransactionCash.js hasSplitPaymentOptions.
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
 * array. See msTransactionCash.js parseSplitReceivers.
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
 * splitPayment object ms-transaction expects -- identical convention to
 * Cash's (see README's PSE "Split payment" section, same field names as
 * Cash's). See msTransactionCash.js buildSplitPayment for the full
 * rationale, including why splitReceivers always defaults to [].
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
 * Map the legacy snake_case PSE options (see README's PSE section) into the
 * ms-transaction plaintext body shape verified against the real API.
 * paymentMethod "PSE" and paymentMethodData {typePerson, bankCode} confirmed
 * empirically (real pre-prod call, merchant 630339, returned a real bank
 * redirect URL) -- bank (legacy bank code, e.g. "1077") maps to bankCode,
 * type_person maps to typePerson.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Object} plaintext ms-transaction body
 */
function buildBody(epaycoCtx, options) {
    options = options || {};
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
        paymentMethod: 'PSE',
        paymentMethodData: {
            typePerson: options.type_person,
            bankCode: options.bank
        },
        country: options.country || 'CO',
        ip: options.ip,
        responseUrl: options.url_response || null,
        confirmationUrl: options.url_confirmation || null,
        confirmationMethod: options.method_confirmation || options.metodoconfirmacion || 'GET',
        description: options.description,
        integrationType: { tipo_checkout: 'smart_checkout', modo_pago: 'pse' },
        publicKey: epaycoCtx.apiKey,
        extras: buildExtras(options),
        // extra5 "P44" mirrors the internal-tracking marker lib/resources/index.js's
        // Resource#request auto-injects (data.extras_epayco = {extra5: "P44"})
        // for EVERY legacy POST regardless of payment method (see index.js line
        // ~39, unconditional on method == 'post') -- not cash-specific, so this
        // same literal applies to PSE's legacy POST too.
        extrasEpayco: Object.assign({ extra1: '', extra2: '', extra3: '' }, options.extrasEpayco, { extra5: 'P44' })
    };
    var splitPayment = buildSplitPayment(options);
    if (splitPayment) {
        body.splitPayment = splitPayment;
    }
    return body;
}

/**
 * Resolve the client IP. See msTransactionCash.js resolveIp.
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
 * Log in against the ms-transaction auth host. See msTransactionCash.js login.
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
 * msTransactionCash.js assertValidRefPayco for the full rationale.
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
 * estado/status text -> legacy cod_respuesta numeric code. Identical
 * mapping to msTransactionCash.js codRespuestaFromEstado (same PHP switch,
 * given verbatim by the requester) -- duplicated here rather than shared,
 * matching this repo's existing convention of each ms-transaction gateway
 * module being self-contained (see this file's header note).
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
 * Map a successful ms-transaction response into the exact response shape the
 * legacy PSE endpoint returns today (see lib/resources/bank.js), so callers
 * get the identical shape regardless of which backend actually served the
 * request -- mirrors msTransactionCash.js mapToLegacyShape (SDK-1352).
 *
 * Verified field-by-field against a real paired pre-prod call (merchant
 * 630339, bank code 1077) to both backends -- see SDK-1355 QA notes. PII
 * fields are read from the original options the caller passed, matching
 * msTransactionCash.js's identical rationale (the ms-transaction response's
 * payerInformation is masked).
 *
 * ticketId is read from data.receipt (a string), NOT from
 * paymentProviderData.ticketId (a JSON number): a real paired call showed
 * these two disagree in their last digits (receipt "100000907217890504"
 * vs paymentProviderData.ticketId 100000907217890500) -- ticketId as sent
 * by the backend exceeds JS's safe integer range and loses precision once
 * JSON-parsed, while receipt (string) does not and carries the same value
 * legacy's own recibo/ticketId pair uses (both equal to the same receipt
 * number in the real legacy response).
 *
 * transactionID is read from data.authorization: the real legacy response
 * shows autorizacion and transactionID as the exact same value (e.g. both
 * "5788530"), and the new flow's authorization matches
 * paymentProviderData.trazabilityCode the same way.
 *
 * Fields present in Cash's mapToLegacyShape but NOT present in a real legacy
 * PSE response (banco, franquicia, country_card, cc_network_response, pin,
 * codigoproyecto, fechapago, fechaexpiracion, factor_conversion,
 * valor_pesos, tipo_doc, documento, nombres, apellidos, email, direccion,
 * ind_pais) are deliberately omitted here rather than guessed.
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @return {Object} legacy-shaped response
 */
function mapToLegacyShape(raw) {
    var success = !!raw.success;
    var data = raw.data || {};
    var providerData = data.paymentProviderData || {};
    return {
        success: success,
        title_response: success ? 'SUCCESS' : 'ERROR',
        text_response: raw.message,
        last_action: 'get bank url',
        data: {
            ref_payco: data.refPayco,
            factura: data.invoice,
            descripcion: data.description,
            valor: data.amount,
            iva: data.tax,
            ico: data.ico,
            baseiva: data.taxBase,
            moneda: data.currency,
            estado: data.status,
            respuesta: data.response,
            cod_respuesta: codRespuestaFromEstado(data.status),
            cod_error: data.responseCode,
            autorizacion: data.authorization,
            ciudad: '',
            recibo: data.receipt,
            fecha: data.date,
            urlbanco: providerData.urlPayment,
            transactionID: data.authorization,
            ticketId: data.receipt,
            extras: data.extras,
            extras_epayco: { extra5: (data.extrasEpayco || {}).extra5 },
            ciclo: providerData.cycle !== undefined ? String(providerData.cycle) : undefined
        }
    };
}

/**
 * Create a PSE (bank) transaction against the ms-transaction generic
 * transactions endpoint. Resolves with the same response shape the legacy
 * endpoint returns (see mapToLegacyShape) -- SDK-1355 requires callers to
 * see one consistent shape regardless of which backend actually served the
 * request.
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
        .then(function (raw) { return mapToLegacyShape(raw); })
        .catch(function (err) {
            console.error('msTransactionBank create error:', err.message);
            return { error: err.message };
        });
}

/**
 * Query a PSE (bank) transaction by refPayco against the ms-transaction
 * generic transactions endpoint. Uses the SAME generic
 * /payment/api/v1/transactions/{refPayco} endpoint Cash's getTransaction
 * uses (see msTransactionCash.js) -- confirmed empirically against real
 * pre-prod: it returns 200 with the PSE transaction. The alternate
 * /v1/pse/transactions?ref_payco=... endpoint shown in SDK-1355's Jira
 * description returned 404 in that same test and is not used.
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
            console.error('msTransactionBank get error:', message);
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
