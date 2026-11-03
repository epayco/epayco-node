var CryptoJS = require('crypto-js');
var fetch = require('node-fetch');
var EpaycoError = require('../resources/errors');
var msTransactionConfig = require('./msTransactionConfig');

var REQUEST_TIMEOUT_MS = 10000;

var BASE_URL_MS_TRANSACTION = msTransactionConfig.BASE_URL_MS_TRANSACTION;
var BASE_URL_MS_TRANSACTION_AUTH = msTransactionConfig.BASE_URL_MS_TRANSACTION_AUTH_V2;

// Static IV required by ms-transaction: changing it needs a coordinated backend change.
var IV_STRING = '0000000000000000';

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
    if (options.extras && typeof options.extras === 'object') {
        return options.extras;
    }
    var extras = {};
    ['extra1', 'extra2', 'extra3', 'extra4', 'extra5', 'extra6'].forEach(function (key) {
        if (options[key] !== undefined && options[key] !== null) {
            extras[key] = options[key];
        }
    });
    return extras;
}

function hasSplitPaymentOptions(options) {
    var flag = options.splitpayment;
    if (flag === false || flag === 0 || (typeof flag === 'string' && /^(false|0)$/i.test(flag.trim()))) {
        return false;
    }
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
        invoice: options.bill || options.invoice,
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
        paymentMethod: 'TDC',
        paymentMethodData: {
            tokenMdb: options.token_card,
            quotes: String(options.quotes || options.dues || '1')
        },
        country: options.country || 'CO',
        ip: options.ip,
        responseUrl: options.url_response || options.url_confirmation || null,
        confirmationUrl: options.url_confirmation || null,
        confirmationMethod: options.method_confirmation || 'POST',
        description: options.description,
        integrationType: { tipo_checkout: 'api', modo_pago: 'TDC' },
        publicKey: epaycoCtx.apiKey,
        extras: buildExtras(options)
    };
    // Omitted unless sent: ms-transaction tags TDC with its own extra5 ("P51") when extrasEpayco is absent.
    if (options.extrasEpayco && typeof options.extrasEpayco === 'object') {
        body.extrasEpayco = options.extrasEpayco;
    }
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
    return fetch(BASE_URL_MS_TRANSACTION_AUTH + '/authentication/api/v2/login', {
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: apiKey,
            client_secret: privateKey,
            grant_type: 'client_credentials'
        })
    })
        .then(function (res) { return res.json(); })
        .then(function (json) { return json && json.data && json.data.token; });
}

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

function extractErrorMessage(raw) {
    var data = raw && raw.data;
    if (data && !Array.isArray(data) && Array.isArray(data.errors) && data.errors.length) {
        return data.errors.map(function (e) { return e && e.message; }).filter(Boolean).join(' ');
    }
    return raw && raw.message;
}

function buildLegacyErrorShape(raw, statusCode) {
    var data = raw && raw.data;
    var errors = data && !Array.isArray(data) && Array.isArray(data.errors) ? data.errors : null;
    if (errors && errors.length) {
        var requiredOnly = errors.every(function (e) {
            return e && typeof e.message === 'string' && /es obligatorio\.?$/i.test(e.message.trim());
        });
        if (requiredOnly) {
            return {
                status: false,
                message: 'Error validando datos',
                data: {
                    status: 'error',
                    description: 'Los datos son erroneos o son requeridos por favor compruebe.',
                    errors: errors.map(function (e) { return e.message; }).join(' ')
                },
                statusCode: 400
            };
        }
        return {
            status: false,
            message: 'Error validando datos',
            data: {
                status: 'error',
                description: 'Verifica que los datos enviados seán existentes o correctos.',
                errors: errors.map(function (e) {
                    return { codError: e && e.code, errorMessage: e && e.message };
                })
            }
        };
    }
    return {
        status: false,
        message: extractErrorMessage(raw),
        data: {
            status: 'error',
            description: 'Los datos son erroneos o son requeridos por favor compruebe.',
            errors: extractErrorMessage(raw)
        },
        statusCode: statusCode
    };
}

function mapToLegacyShape(raw, options, statusCode) {
    options = options || {};
    var success = !!raw.success;
    var data = raw.data || {};

    if (!success) {
        return buildLegacyErrorShape(raw, statusCode);
    }

    var providerData = data.paymentProviderData || {};
    var ccNetworkResponse = providerData.ccNetworkResponse && providerData.ccNetworkResponse.code !== undefined
        ? { code: providerData.ccNetworkResponse.code, message: providerData.ccNetworkResponse.name }
        : { code: data.responseCode, message: data.response };
    var threeDs = providerData.threeDsAuthentication;
    var hasThreeDs = threeDs && typeof threeDs === 'object' && Object.keys(threeDs).length > 0;
    var result = {
        status: true,
        success: true,
        type: 'Create payment',
        data: {
            ref_payco: data.refPayco,
            factura: data.invoice,
            descripcion: data.description,
            valor: data.amount,
            iva: data.tax,
            ico: data.ico,
            baseiva: data.taxBase,
            valorneto: data.subtotal !== undefined ? data.subtotal : data.amount,
            moneda: data.currency,
            banco: data.nameBank,
            estado: data.status,
            respuesta: data.response,
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
            ind_pais: '',
            country_card: '',
            extras: data.extras,
            cc_network_response: ccNetworkResponse,
            extras_epayco: { extra5: (data.extrasEpayco || {}).extra5 }
        },
        object: 'payment'
    };
    if (hasThreeDs) {
        result.data['3DS'] = threeDs;
    }
    return result;
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
        .then(function (res) {
            return res.json().then(function (raw) { return { raw: raw, statusCode: res.status }; });
        })
        .then(function (result) { return mapToLegacyShape(result.raw, options, result.statusCode); })
        .catch(function (err) {
            console.error('msTransactionCharge create error:', err.message);
            return { error: err.message };
        });
}

module.exports = {
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_TRANSACTION_AUTH: BASE_URL_MS_TRANSACTION_AUTH,
    encryptValue: encryptValue,
    encryptBody: encryptBody,
    buildBody: buildBody,
    buildExtras: buildExtras,
    resolveIp: resolveIp,
    login: login,
    mapToLegacyShape: mapToLegacyShape,
    createTransaction: createTransaction
};
