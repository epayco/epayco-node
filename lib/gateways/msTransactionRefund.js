var fetch = require('node-fetch');
var EpaycoError = require('../resources/errors');
var msTransactionConfig = require('./msTransactionConfig');

var REQUEST_TIMEOUT_MS = 10000;

var BASE_URL_MS_TRANSACTION = msTransactionConfig.BASE_URL_MS_TRANSACTION;

var BASE_URL_MS_AUTHENTICATION = msTransactionConfig.BASE_URL_MS_AUTHENTICATION;

function login(apiKey, privateKey) {
    var params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', apiKey);
    params.append('client_secret', privateKey);
    params.append('scope', 'apify');
    return fetch(BASE_URL_MS_AUTHENTICATION + '/api/v1/oauth/login', {
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    })
        .then(function (res) {
            return res.json().then(function (json) { return { ok: res.ok, json: json }; });
        })
        .then(function (result) {
            var token = result.json && result.json.access_token && result.json.access_token.accessToken;
            if (!result.ok || !token) {
                var detail = result.json && (result.json.error_description || result.json.error);
                throw new Error('msTransactionRefund auth failed' + (detail ? ': ' + detail : ''));
            }
            return token;
        });
}

var REF_PAYCO_REGEX = /^[1-9][0-9]*$/;
function assertValidRefPayco(refPayco, lang) {
    var isPlainPositiveInteger = (typeof refPayco === 'string' || typeof refPayco === 'number') &&
        REF_PAYCO_REGEX.test(String(refPayco));
    if (!isPlainPositiveInteger) {
        throw new EpaycoError(lang || 'ES', 103);
    }
}

function buildBody(options) {
    options = options || {};
    var keyPayer = options.key_payer || options.keyPayer;
    var reason = options.reason;
    if (keyPayer === undefined && reason === undefined) {
        return undefined;
    }
    return { paymentMethodData: { keyPayer: keyPayer, reason: reason } };
}

function extractErrorMessage(raw) {
    var data = raw && raw.data;
    if (data && !Array.isArray(data) && Array.isArray(data.errors) && data.errors.length) {
        return data.errors.map(function (e) { return e && e.message; }).filter(Boolean).join(' ');
    }
    return raw && raw.message;
}

function refundTransaction(epaycoCtx, refPayco, options) {
    assertValidRefPayco(refPayco, epaycoCtx && epaycoCtx.lang);
    var body = buildBody(options);
    return login(epaycoCtx.apiKey, epaycoCtx.privateKey)
        .then(function (token) {
            return fetch(BASE_URL_MS_TRANSACTION + '/payment/api/v1/transaction/cancel/' + encodeURIComponent(String(refPayco)), {
                method: 'PUT',
                timeout: REQUEST_TIMEOUT_MS,
                headers: Object.assign(
                    { 'Authorization': 'Bearer ' + token },
                    body ? { 'Content-Type': 'application/json' } : {}
                ),
                body: body ? JSON.stringify(body) : undefined
            });
        })
        .then(function (res) { return res.json(); })
        .then(function (raw) {
            return {
                success: !!raw.success,
                message: raw.success ? raw.message : extractErrorMessage(raw),
                data: raw.data
            };
        })
        .catch(function (err) {
            console.error('msTransactionRefund refund error:', err.message);
            return { error: err.message };
        });
}

module.exports = {
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_AUTHENTICATION: BASE_URL_MS_AUTHENTICATION,
    login: login,
    buildBody: buildBody,
    extractErrorMessage: extractErrorMessage,
    refundTransaction: refundTransaction
};
