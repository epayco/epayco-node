/**
 * Gateway for the new "ms-transaction" microservice (apiflow.epayco.io) used
 * to create card (TDC) charges, replacing the legacy
 * /payment/v1/charge/create endpoint used by lib/resources/charge.js.
 *
 * Mirrors lib/gateways/msTransactionCash.js field-for-field for the
 * encryption/auth/generic-transaction-endpoint plumbing shared across every
 * ms-transaction payment method -- only buildBody's paymentMethod/
 * paymentMethodData and mapToLegacyShape's field mapping are TDC-specific.
 * Kept as its own self-contained module, matching every other ms-transaction
 * gateway's own note about being independently unit-testable and isolated
 * from Resource#request.
 *
 * PRELIMINARY / exploratory: unlike Cash/Bank/SafetyPay/Daviplata (each
 * backed by a merged ticket's full empirical QA), this gateway was built from
 * a single ad-hoc smoke test against real pre-prod (merchant 627579) to
 * unblock a specific 3DS test-card investigation -- verified: tokenMdb +
 * quotes (INSIDE paymentMethodData, not at the request root -- the schema's
 * own top-level `quotes` field description is misleading; only the API's own
 * concrete TDC request example nests it correctly) + uniqueTransactionPerBill
 * (must be a literal boolean, `undefined` 500s server-side) is enough to
 * reach a real authorization result, including an in-progress 3DS status
 * ("Transacción en proceso de verificación por 3ds", responseCode 189). NOT
 * yet verified: split payments, multi-payment (2TC/TC-PSE), subscriptions,
 * Apple Pay/Google Pay/Click to Pay (paymentMethodData's other token
 * variants), or a full field-by-field paired comparison against the legacy
 * endpoint's response across every status (only one real "Rechazada" and one
 * real "Pendiente"/3ds-in-progress response have been observed so far).
 *
 * Auth: reuses Cash's own OAuth2 client_credentials flow
 * (apiflow.epayco.io/authentication/api/v2/login) -- confirmed empirically to
 * be accepted by this same POST /payment/api/v1/transactions endpoint for
 * paymentMethod TDC, exactly as it already is for CASH.
 *
 * Module dependencies
 */
var CryptoJS = require('crypto-js');
var fetch = require('node-fetch');
var EpaycoError = require('../resources/errors');
var msTransactionConfig = require('./msTransactionConfig');

/**
 * Default per-request timeout (ms), same value every other ms-transaction
 * gateway in this repo uses.
 */
var REQUEST_TIMEOUT_MS = 10000;

/**
 * Same hosts msTransactionCash.js uses -- TDC goes through the same generic
 * ms-transaction transactions endpoint and the same `/authentication/api/v2/login`
 * auth host, only paymentMethod/paymentMethodData differ (verified
 * empirically, see this file's header note). Resolved from
 * ./msTransactionConfig so all gateways share one definition.
 */
var BASE_URL_MS_TRANSACTION = msTransactionConfig.BASE_URL_MS_TRANSACTION;
var BASE_URL_MS_TRANSACTION_AUTH = msTransactionConfig.BASE_URL_MS_TRANSACTION_AUTH_V2;

/**
 * AES-256-CBC IV literal used by ms-transaction. See msTransactionCash.js's
 * identical constant for the full rationale -- required as-is by the backend.
 */
var IV_STRING = '0000000000000000';

/**
 * Guard against a misconfigured merchant key silently producing wrong
 * ciphertext. See msTransactionCash.js assertValidPrivateKey.
 *
 * @param {String} privateKey
 * @param {String} [lang] 'ES'|'EN', defaults to 'ES'.
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
 * Encrypt a full ms-transaction request body. See msTransactionCash.js
 * encryptBody for the full rationale.
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
 * contract expects. Accepts both the top-level extra1..6 convention
 * (Bank/Cash/SafetyPay/Daviplata's README examples) and a nested
 * `options.extras` object (this SDK's own charge/payment_info README
 * example), preferring the nested object when both are present.
 *
 * @param {Object} options
 * @return {Object}
 */
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

/**
 * Map the legacy `charge.create(options)` options (README's Payment section)
 * into the ms-transaction plaintext body shape verified against the real API
 * (see this file's header note).
 *
 * `quotes` (installments/"cuotas") is nested INSIDE `paymentMethodData`
 * alongside `tokenMdb` -- verified empirically: the schema's own top-level
 * `quotes` property description is misleading (it applies to other payment
 * methods), only the API's own concrete TDC request/response examples show
 * it nested this way, and a top-level `quotes` is silently ignored, failing
 * validation with "El parametro quotes es incorrecto o es obligatorio."
 *
 * `uniqueTransactionPerBill` must always be a literal boolean, never
 * `undefined` -- confirmed empirically: omitting it 500s server-side
 * (`TransactionRequest::uniqueTransactionPerBillValidate(): Argument #1
 * ($uniqueTransactionPerBill) must be of type string|bool, null given`).
 *
 * Known, NOT YET VERIFIED gaps vs. the legacy /payment/v1/charge/create flow
 * (flagged for follow-up, not silently best-effort-mapped):
 *  - `customer_id`/`use_default_card_customer` (legacy requires a
 *    pre-created customer): NOT forwarded -- the one real paired smoke test
 *    behind this gateway succeeded with only `token_card`, no customer step,
 *    so this may not be required at all for ms-transaction, but that has not
 *    been confirmed either way.
 *  - `dues` (legacy's own name for installments) is accepted as a fallback
 *    for `quotes`, but only `quotes` has been verified against a real
 *    request; `dues` is untested.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Object} plaintext ms-transaction body
 */
/**
 * Whether `options` carries any of the legacy split-payment fields. Same
 * helpers msTransactionCash.js/msTransactionBank.js use (each gateway keeps
 * its own copy by design, so each stays independently testable).
 *
 * Without this, the card flow dropped the split silently: a charge sent with
 * split_* options came back "Aceptada" with no split applied, and even a split
 * whose sum did not add up or whose receiver did not exist was accepted --
 * legacy rejects both.
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
 * Legacy's card endpoint takes `split_receivers` as an ARRAY (a JSON string
 * is rejected with an empty "Error validando datos"), while the other
 * payment methods document a JSON string. Accept both.
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
 * Map the legacy snake_case split options into the root-level `splitPayment`
 * object ms-transaction expects (same mapping as msTransactionCash.js, whose
 * shape was verified against the real API). Undefined when no split option
 * was passed, so the request only carries `splitPayment` when one was asked
 * for.
 *
 * @param {Object} options
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
        // Added after the initial smoke test: the API's own TDC request
        // example always sends this exact pair, and the legacy flow's real
        // 3DS response (accessToken/deviceDataCollectionUrl/referenceId/token)
        // was suspected to depend on it -- the first smoke test (without this
        // field) only ever got back an empty threeDsAuthentication object.
        // NOT YET reconfirmed against a real response with this field added.
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
 * Log in against the ms-transaction auth host. Reuses Cash's own OAuth2
 * client_credentials flow (see msTransactionCash.js login) -- confirmed
 * empirically to be accepted for paymentMethod TDC too.
 *
 * @param {String} apiKey
 * @param {String} privateKey
 * @return {Promise<String>} JWT
 */
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

/**
 * "estado" text (Spanish, case-insensitive) -> legacy cod_respuesta numeric
 * code. See msTransactionCash.js codRespuestaFromEstado for the full mapping
 * rationale -- reused verbatim here (not yet cross-checked against a real
 * ms-transaction TDC "Aceptada"/"Reversada"/etc. response, only "Rechazada"
 * and "Pendiente" have been observed).
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
 * `data.errors[].message` (a ValidationException shape), not in the generic
 * top-level `message` -- same pattern as every other ms-transaction gateway's
 * extractErrorMessage.
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
 * Map a rejected ms-transaction request (raw.success false) into legacy's
 * card validation-failure shape: `{status:false, message, data:{status:'error',
 * description, errors}, statusCode?}` -- see mapToLegacyShape's header for
 * how legacy's two top-level shapes differ.
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @param {Number} [statusCode] the real HTTP status, kept on the data-less branch
 * @return {Object} legacy-shaped validation failure
 */
function buildLegacyErrorShape(raw, statusCode) {
    var data = raw && raw.data;
    var errors = data && !Array.isArray(data) && Array.isArray(data.errors) ? data.errors : null;
    if (errors && errors.length) {
        // Legacy words a rejected card request by its cause and keeps the
        // reasons in data.errors (measured):
        //  - a required field missing: message "Error validando datos",
        //    data.description "Los datos son erroneos o son requeridos por
        //    favor compruebe.", data.errors a STRING ("El campo email es
        //    requerido"), statusCode 400.
        //  - a split rule (sum mismatch, unenrolled receiver): the same
        //    message, data.description "Verifica que los datos enviados seán
        //    existentes o correctos." (the accent typo is legacy's own), and
        //    data.errors an ARRAY of {codError, errorMessage}; no statusCode.
        // ms-transaction returns UUID codes, so the cause is inferred from its
        // wording: "El campo <x> es obligatorio." for a missing field. Only a
        // response whose errors are ALL of that form is the required-field
        // cause; anything else takes the split/rule form. An inference from
        // message text, to revisit if ms-transaction rewords it.
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
    // No structured errors (auth failure, backend crash): keep the real
    // message, which is what lets an integrator diagnose the problem.
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

/**
 * Map an ms-transaction TDC response into the exact shape the legacy
 * /payment/v1/charge/create endpoint returns today (see
 * lib/resources/charge.js#_legacyCreate), so callers see a consistent shape
 * regardless of which backend actually served the request -- same rationale
 * as every other gateway's mapToLegacyShape, but legacy's own shape here is
 * the one that persists: verified empirically (real paired legacy responses,
 * merchant 630478) that legacy has TWO genuinely different top-level shapes
 * depending on success:
 *  - success: `{status:true, success:true, type:'Create payment', data:{...},
 *    object:'payment'}` -- NO top-level `message` at all.
 *  - a request-validation failure (e.g. missing customer_id): `{status:false,
 *    message:'Error validando datos', data:{status:'error', description:'...',
 *    errors:'...'}, statusCode:400}` -- a completely different, much
 *    thinner `data` shape (no transaction fields at all), plus `statusCode`
 *    (the real HTTP status), neither `success` nor `type`/`object`.
 *
 * A ms-transaction ValidationException (e.g. a nonexistent token, malformed
 * field) is the same class of failure -- a rejected request, not a declined
 * transaction -- so it maps to legacy's validation-failure shape, not the
 * success shape with an "estado" describing a decline (a card decline, e.g.
 * "Tarjeta restringida", still comes back as ms-transaction `success:true`
 * with `status:"Rechazada"`, and maps through the success shape below like
 * any other status).
 *
 * NOT a fully verified field-by-field mapping otherwise (see this file's
 * header note): only "Rechazada" and "Pendiente" (in-progress/resolved 3DS)
 * have been paired against this mapping so far, no "Aceptada".
 *
 * `3DS` (verified key name, matches legacy exactly -- NOT `threeDsAuthentication`,
 * an earlier guess before a real paired legacy response was captured) is
 * `paymentProviderData.threeDsAuthentication` passed through as-is. Requires
 * `integrationType.tipo_checkout: 'api'` in the request (see buildBody) --
 * verified empirically: `'onpage'` (the API's own example value) gets back
 * an empty `{}` here instead, `'api'` returns the real Cardinal Cruise
 * device-collection payload (`accessToken`/`deviceDataCollectionUrl`/
 * `referenceId`/`token`), matching legacy's own `3DS` block field-for-field.
 *
 * `country_card`/`ind_pais` (the card's issuing country, e.g. "CA" in the
 * one real legacy response observed) has NO verified equivalent in the
 * ms-transaction response -- `payerInformation.country` is PII-masked
 * (e.g. "C*"), not usable. Left empty rather than guessed.
 *
 * @param {Object} raw ms-transaction response body ({success, message, data})
 * @param {Object} options the original caller-supplied options
 * @param {Number} [statusCode] the real HTTP status ms-transaction responded
 *        with, only used on the validation-failure shape (see above)
 * @return {Object} legacy-shaped response
 */
function mapToLegacyShape(raw, options, statusCode) {
    options = options || {};
    var success = !!raw.success;
    var data = raw.data || {};

    if (!success) {
        return buildLegacyErrorShape(raw, statusCode);
    }

    var providerData = data.paymentProviderData || {};
    // ms-transaction returns `ccNetworkResponse` as an empty object on every
    // transaction observed (approved, rejected and failed), while legacy
    // returns {code, message} -- and in every legacy sample those equal the
    // transaction's own responseCode/response ({"00","Aprobada"} on an
    // approval, {"04", <the decline text>} on a rejection or failure). So
    // when the backend gives nothing, the pair is derived from those two
    // fields; a populated ccNetworkResponse still wins.
    var ccNetworkResponse = providerData.ccNetworkResponse && providerData.ccNetworkResponse.code !== undefined
        ? { code: providerData.ccNetworkResponse.code, message: providerData.ccNetworkResponse.name }
        : { code: data.responseCode, message: data.response };
    // Legacy only carries a `3DS` block when a 3DS challenge applies; on every
    // other transaction the key is absent. ms-transaction returns an empty
    // `threeDsAuthentication` object there, which used to be passed through as
    // `3DS: {}` and add a key legacy does not have.
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

/**
 * Create a card (TDC) charge against the ms-transaction generic transactions
 * endpoint. Resolves with (approximately) the legacy charge shape (see
 * mapToLegacyShape) -- see this file's header note on what is/isn't yet
 * verified.
 *
 * @param {Object} epaycoCtx the Epayco instance (apiKey/privateKey/test)
 * @param {Object} options caller-supplied options (legacy field names)
 * @return {Promise<Object>} approximately legacy-shaped response
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
