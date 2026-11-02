var CryptoJS = require('crypto-js');
var fetch = require('node-fetch');
var axios = require('axios');
var EpaycoError = require('../resources/errors');
var msTransactionConfig = require('./msTransactionConfig');

var REQUEST_TIMEOUT_MS = 10000;

var BASE_URL_MS_TRANSACTION = msTransactionConfig.BASE_URL_MS_TRANSACTION;
var BASE_URL_MS_TRANSACTION_AUTH = msTransactionConfig.BASE_URL_MS_TRANSACTION_AUTH_BASIC;

// Static IV required by ms-transaction: changing it needs a coordinated backend change.
var IV_STRING = '0000000000000000';

var PENDING_OTP_TEXT_RESPONSE = 'Transacción generada exitosamente, pendiente confirmacion del usuario con el OTP generado por DaviPlata';
var PENDING_OTP_RESPONSE = 'Esperando confirmacion token DaviPlata';

function assertValidPrivateKey(privateKey, lang) {
    if (typeof privateKey !== 'string' || Buffer.byteLength(privateKey, 'utf8') !== 32) {
        throw new EpaycoError(lang || 'ES', 103);
    }
}

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

function ivBase64() {
    return CryptoJS.enc.Utf8.parse(IV_STRING).toString(CryptoJS.enc.Base64);
}

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

function encryptBody(body, privateKey, lang) {
    var encrypted = encryptObject(body, privateKey, lang);
    encrypted.i = ivBase64();
    encrypted.language = encryptValue('node', privateKey, lang);
    return encrypted;
}

function buildExtras(options) {
    var extras = {};
    ['extra1', 'extra2', 'extra3', 'extra4', 'extra5', 'extra6'].forEach(function (key) {
        if (options[key] !== undefined && options[key] !== null) {
            extras[key] = options[key];
        }
    });
    return extras;
}

function buildExtrasEpayco(options) {
    var sent = options && options.extrasEpayco && typeof options.extrasEpayco === 'object' ? options.extrasEpayco : {};
    var extras = Object.assign({ extra1: '', extra2: '', extra3: '' }, sent);
    if (extras.extra5 === undefined || extras.extra5 === null || extras.extra5 === '') {
        extras.extra5 = 'P44';
    }
    return extras;
}

function hasSplitPaymentOptions(options) {
    return !!(options.splitpayment || options.split_app_id || options.split_merchant_id ||
        options.split_type || options.split_primary_receiver || options.split_primary_receiver_fee ||
        options.split_rule || options.split_receivers);
}

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
        extrasEpayco: buildExtrasEpayco(options),
        paymentMethodData: {}
    };
    var splitPayment = buildSplitPayment(options);
    if (splitPayment) {
        body.splitPayment = splitPayment;
    }
    return body;
}

function resolveIp(options) {
    if (options && options.ip) {
        return Promise.resolve(options.ip);
    }
    return fetch('https://api.ipify.org?format=json', { timeout: REQUEST_TIMEOUT_MS })
        .then(function (response) { return response.json(); })
        .then(function (data) { return data.ip; })
        .catch(function () { return undefined; });
}

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

var REF_PAYCO_REGEX = /^[1-9][0-9]*$/;
function assertValidRefPayco(refPayco, lang) {
    var isPlainPositiveInteger = (typeof refPayco === 'string' || typeof refPayco === 'number') &&
        REF_PAYCO_REGEX.test(String(refPayco));
    if (!isPlainPositiveInteger) {
        throw new EpaycoError(lang || 'ES', 103);
    }
}

function extractErrorMessage(raw) {
    var data = raw && raw.data;
    if (data && Array.isArray(data.errors) && data.errors.length) {
        return data.errors.map(function (e) { return e && e.message; }).filter(Boolean).join(' ');
    }
    return raw && raw.message;
}

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
    var isPendingOtp = data.responseCode === 201 || data.responseCode === '201';
    return {
        success: true,
        titleResponse: 'SUCCESS',
        textResponse: isPendingOtp ? PENDING_OTP_TEXT_RESPONSE : raw.message,
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
            response: isPendingOtp ? PENDING_OTP_RESPONSE : data.response,
            autorization: data.authorization,
            receipt: data.receipt,
            date: data.date,
            franchise: data.franchise,
            codResponse: isPendingOtp ? 3 : (data.responseCode !== undefined ? data.responseCode : ''),
            codError: isPendingOtp ? 'P004' : '',
            ip: data.ip,
            testMode: data.testMode,
            docType: options.doc_type,
            document: options.document || options.doc_number,
            name: options.name,
            lastName: options.last_name,
            email: options.email,
            city: options.city || (!data.city || data.city === 'SIN CIUDAD' ? '' : data.city),
            address: options.address,
            indCountry: '',
            idSessionToken: providerData.paymentSessionId,
            tokenExpirationDate: providerData.paymentSessionExpirationDate,
            daviplataOtpLab: null,
            extras: data.extras || {},
            extras_epayco: { extra5: extrasEpaycoNew.extra5 }
        }
    };
}

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
