/**
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
 * @param {String} privateKey
 * @param {String} [lang] ES or EN, defaults to ES.
 */
function assertValidPrivateKey(privateKey, lang) {
    if (typeof privateKey !== 'string' || Buffer.byteLength(privateKey, 'utf8') !== 32) {
        throw new EpaycoError(lang || 'ES', 103);
    }
}

/**
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
        responseUrl: options.url_response || options.url_confirmation || null,
        confirmationUrl: options.url_confirmation || null,
        confirmationMethod: options.method_confirmation || options.metodoconfirmacion || 'POST',
        description: options.description,
        integrationType: { tipo_checkout: 'smart_checkout', modo_pago: 'safetypay' },
        publicKey: epaycoCtx.apiKey,
        extras: buildExtras(options),
        extrasEpayco: buildExtrasEpayco(options),
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
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @param {Object} options the original caller-supplied options
 * @return {Object} legacy-shaped response
 */
/**
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @return {Object} legacy-shaped error response (no fabricated transaction data)
 */
function buildLegacyErrorShape(raw) {
    var data = raw && raw.data;
    var hasStructuredErrors = data && !Array.isArray(data) && Array.isArray(data.errors) && data.errors.length;
    if (hasStructuredErrors) {
        return {
            success: false,
            titleResponse: 'Error',
            textResponse: extractErrorMessage(raw),
            lastAction: 'validation transaction',
            data: {
                totalErrors: data.errors.length,
                errors: data.errors.map(function (e) {
                    return { codError: e && e.code, errorMessage: e && e.message };
                })
            }
        };
    }
    return {
        success: false,
        titleResponse: 'Error',
        textResponse: extractErrorMessage(raw),
        lastAction: 'validation transaction'
    };
}

function mapToLegacyShape(raw, options) {
    options = options || {};
    if (!raw.success) {
        return buildLegacyErrorShape(raw);
    }
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
    buildExtrasEpayco: buildExtrasEpayco,
    buildSplitPayment: buildSplitPayment,
    parseSplitReceivers: parseSplitReceivers,
    resolveIp: resolveIp,
    login: login,
    extractErrorMessage: extractErrorMessage,
    buildLegacyErrorShape: buildLegacyErrorShape,
    mapToLegacyShape: mapToLegacyShape,
    createTransaction: createTransaction,
    getTransaction: getTransaction
};
