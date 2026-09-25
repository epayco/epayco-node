/**
 * Gateway for reversing/refunding an already-created CARD (TDC) transaction
 * against the "ms-transaction" microservice's generic transaction-operations
 * API (PUT /transaction/refund/{refPayco}, tag "Operaciones sobre
 * transacciones creadas" -- see
 * https://eks-ms-transaction-service.epayco.io/api/documentation#/Operaciones%20sobre%20transacciones%20creadas/refundTransaction).
 * Does not apply to Cash/Bank/SafetyPay/Daviplata.
 *
 * Unlike Cash/Bank/SafetyPay/Daviplata's gateways, this is NOT a migration of
 * an existing legacy endpoint -- there is no pre-existing refund capability
 * anywhere else in this SDK, so there is no legacy fallback, no
 * `transactionMethods` opt-out, and no `mapToLegacyShape`: the ms-transaction
 * response shape is returned directly (only the error message is unwrapped,
 * same rationale as every other gateway's extractErrorMessage).
 *
 * Auth is also DIFFERENT from every other ms-transaction gateway in this
 * repo. Verified empirically (merchant 630339, real API, see this repo's own
 * session notes): neither of the two auth mechanisms the other four gateways
 * use (apiflow.epayco.io's own /authentication/api/v2/login, or
 * eks-apify-service.epayco.io's Basic /login) is accepted by this endpoint --
 * both return a bare 401 Unauthorized despite minting a valid-looking JWT.
 * The endpoint's own documented OAuth2 client_credentials flow (tokenUrl
 * `.../api/v1/oauth/login`, `application/x-www-form-urlencoded` body, NOT
 * JSON) is the only one confirmed to work, against BOTH the raw
 * eks-ms-transaction-service.epayco.io host AND the existing
 * apiflow.epayco.io gateway this SDK already talks to for every other
 * ms-transaction operation.
 *
 * The refund request body is plain (unencrypted) JSON -- unlike
 * create/get's AES-256-CBC-encrypted body, this endpoint's schema takes
 * plaintext `paymentMethodData.keyPayer`/`.reason` directly.
 *
 * Module dependencies
 */
var fetch = require('node-fetch');
var EpaycoError = require('../resources/errors');

/**
 * Default per-request timeout (ms), same value every other ms-transaction
 * gateway in this repo uses.
 */
var REQUEST_TIMEOUT_MS = 10000;

/**
 * Same host/env-var every other ms-transaction gateway uses for the actual
 * transaction operation.
 */
var BASE_URL_MS_TRANSACTION = process.env.BASE_URL_MS_TRANSACTION || 'https://apiflow-green.epayco.co';

/**
 * The refund endpoint's own dedicated OAuth2 client_credentials token host --
 * deliberately a separate env var from BASE_URL_MS_TRANSACTION_AUTH (used by
 * Bank/SafetyPay/Daviplata for their Basic-auth /login) and from Cash's own
 * apiflow.epayco.io/authentication default: neither of those tokens is
 * accepted here (verified empirically, see this file's header note), so
 * reusing either env var would silently break whichever gateway reads it
 * with a different expected host.
 */
var BASE_URL_MS_AUTHENTICATION = process.env.BASE_URL_MS_AUTHENTICATION || 'https://eks-ms-authentication-service.epayco.io';

/**
 * Log in against the refund endpoint's own OAuth2 client_credentials token
 * host. Verified empirically: the token endpoint rejects a JSON body
 * ("Invalid request: content must be application/x-www-form-urlencoded")
 * and requires the standard OAuth2 form-encoded grant instead.
 *
 * @param {String} apiKey
 * @param {String} privateKey
 * @return {Promise<String>} JWT
 */
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

/**
 * refPayco is interpolated directly into the request path -- validate
 * strictly first, before any network call. Same regex/rationale every other
 * ms-transaction gateway's assertValidRefPayco uses.
 *
 * @param {String|Number} refPayco
 * @param {String} [lang] ES or EN, defaults to ES.
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
 * BRE-B specifically requires `paymentMethodData.keyPayer`/`.reason` (see
 * this endpoint's own documented validation); every other payment method
 * refunds with no body at all. Builds that object only when the caller
 * supplied at least one of the two legacy-style option names, so a plain
 * `refund(refPayco)` call for a non-BRE-B transaction sends no body, matching
 * the documented `requestBody.required: false`.
 *
 * @param {Object} options
 * @return {Object|undefined}
 */
function buildBody(options) {
    options = options || {};
    var keyPayer = options.key_payer || options.keyPayer;
    var reason = options.reason;
    if (keyPayer === undefined && reason === undefined) {
        return undefined;
    }
    return { paymentMethodData: { keyPayer: keyPayer, reason: reason } };
}

/**
 * When ms-transaction rejects the request, the real failure detail lives in
 * `data.errors[].message` (a ValidationException shape), not in the generic
 * top-level `message` -- same pattern as every other ms-transaction gateway's
 * extractErrorMessage. Verified empirically: refunding a nonexistent refPayco
 * returns exactly this shape (`"Transaction # X no encontrada."`).
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @return {String}
 */
function extractErrorMessage(raw) {
    var data = raw && raw.data;
    if (data && !Array.isArray(data) && Array.isArray(data.errors) && data.errors.length) {
        return data.errors.map(function (e) { return e && e.message; }).filter(Boolean).join(' ');
    }
    return raw && raw.message;
}

/**
 * Reverse/refund an existing card (TDC) transaction by refPayco.
 *
 * Verified empirically against the real API (merchant 630339): a
 * non-existent refPayco returns the ValidationException shape
 * extractErrorMessage unwraps; an existing transaction not in a refundable
 * state (anything other than the payment-provider-dependent "approved"
 * status) comes back as `{success: false, message: "", data: []}` -- the
 * endpoint's own documented example message ("Transacción # X no reversada,
 * estado de la transacción Y") was NOT observed in that case, so this
 * gateway does not assume `message` is always populated on failure.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/lang)
 * @param {String|Number} refPayco must be a plain positive integer (see
 *        assertValidRefPayco) -- thrown synchronously, before any network
 *        call, if it isn't.
 * @param {Object} [options] only needed for BRE-B: `key_payer`/`keyPayer` and
 *        `reason` (see buildBody).
 * @return {Promise<Object>} `{success, message, data}` -- the ms-transaction
 *         response as-is, except `message` is unwrapped from the
 *         ValidationException shape on failure (see extractErrorMessage).
 */
function refundTransaction(epaycoCtx, refPayco, options) {
    assertValidRefPayco(refPayco, epaycoCtx && epaycoCtx.lang);
    var body = buildBody(options);
    return login(epaycoCtx.apiKey, epaycoCtx.privateKey)
        .then(function (token) {
            return fetch(BASE_URL_MS_TRANSACTION + '/payment/api/v1/transaction/refund/' + encodeURIComponent(String(refPayco)), {
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
