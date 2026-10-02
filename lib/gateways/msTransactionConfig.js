'use strict';

/**
 * Single source of truth for the ms-transaction base hosts every new
 * (non-legacy) gateway in this directory talks to. Each gateway used to
 * declare its own copy of these constants, which meant the same host default
 * was repeated in six files and could silently diverge -- e.g. a backport or
 * a merge touching only one gateway would leave the others pointing somewhere
 * else, and nothing would fail until a transaction hit the wrong host.
 *
 * All values stay env-overridable with the same variable names and the same
 * defaults each gateway used before being centralized here, so moving a
 * gateway onto this module is a no-op for any deployment that was already
 * configured correctly.
 */

/**
 * Host resolution is shared with the legacy resource layer (which reads its
 * own BASE_URL_SDK / SECURE_URL_SDK / BASE_URL_APIFY vars and sends the same
 * credentials to them), so the checks live in lib/utils/envHosts.js rather
 * than here. See that module for why each rule exists.
 */
var envHosts = require('../utils/envHosts');
var hostFromEnv = envHosts.hostFromEnv;

/**
 * The transactions API itself (POST/GET /payment/api/v1/transactions...).
 * Identical for every gateway: Cash, Charge (TDC), Bank (PSE), SafetyPay,
 * Daviplata and Refund all go through the same generic endpoint, only
 * paymentMethod/paymentMethodData differ.
 */
var BASE_URL_MS_TRANSACTION = hostFromEnv('BASE_URL_MS_TRANSACTION') ||
    'https://apiflow.epayco.io';

/**
 * The two auth hosts below are intentionally separate env vars.
 *
 * The gateways split into two groups that authenticate against different
 * hosts with different paths: Cash/Charge POST to
 * `/authentication/api/v2/login`, while Bank/SafetyPay/Daviplata POST to the
 * Basic-auth `/login`. Both groups used to read one shared
 * `BASE_URL_MS_TRANSACTION_AUTH` var with different defaults, which meant
 * setting that var in an environment pointed BOTH groups at the same host --
 * necessarily breaking one of them, since no single host serves both login
 * paths. msTransactionRefund.js had already sidestepped this with its own
 * var (see BASE_URL_MS_AUTHENTICATION below); these two now do the same.
 *
 * `BASE_URL_MS_TRANSACTION_AUTH` is still honored as a DEPRECATED fallback so
 * existing deployments that set it keep working, but it is ambiguous by
 * construction -- it feeds both groups. Set the two specific vars instead and
 * the fallback can be dropped.
 */
var LEGACY_AUTH_OVERRIDE = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH');

/**
 * Each env var is resolved exactly once: hostFromEnv warns on a rejected
 * value, so calling it twice for the same var would warn twice.
 */
var EXPLICIT_AUTH_V2 = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_V2');
var EXPLICIT_AUTH_BASIC = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_BASIC');

/**
 * Auth host for the gateways that log in against
 * `/authentication/api/v2/login` (Cash since SDK-1352, and Charge/TDC which
 * followed it).
 */
var BASE_URL_MS_TRANSACTION_AUTH_V2 = EXPLICIT_AUTH_V2 ||
    LEGACY_AUTH_OVERRIDE ||
    'https://apiflow.epayco.io';

/**
 * Auth host for the gateways that log in against the Basic-auth `/login`
 * endpoint (Bank/PSE, SafetyPay, Daviplata). Deliberately NOT the newer
 * apiflow.epayco.io/authentication endpoint Cash moved to under SDK-1352 --
 * that change was requested for cash specifically; these three match the
 * earlier precedent.
 */
var BASE_URL_MS_TRANSACTION_AUTH_BASIC = EXPLICIT_AUTH_BASIC ||
    LEGACY_AUTH_OVERRIDE ||
    'https://eks-apify-service.epayco.io';

/**
 * The refund endpoint's own dedicated OAuth2 client_credentials token host.
 * Already had its own env var before centralization, precisely because
 * neither of the two auth hosts above issues a token this endpoint accepts
 * (verified empirically -- see msTransactionRefund.js's header note).
 */
var BASE_URL_MS_AUTHENTICATION = hostFromEnv('BASE_URL_MS_AUTHENTICATION') ||
    'https://eks-ms-authentication-service.epayco.io';

/**
 * Surface the deprecated var once at load, so an operator who set it can see
 * that it is feeding both auth groups instead of the one they had in mind.
 * Only warns for the groups actually falling back to it.
 */
if (LEGACY_AUTH_OVERRIDE !== undefined) {
    var fallingBack = [];
    if (EXPLICIT_AUTH_V2 === undefined) {
        fallingBack.push('BASE_URL_MS_TRANSACTION_AUTH_V2');
    }
    if (EXPLICIT_AUTH_BASIC === undefined) {
        fallingBack.push('BASE_URL_MS_TRANSACTION_AUTH_BASIC');
    }
    if (fallingBack.length > 0) {
        console.warn('epayco-sdk-node: BASE_URL_MS_TRANSACTION_AUTH is deprecated and ambiguous -- ' +
            'it feeds both auth groups, which use different hosts and different login paths. ' +
            'Currently applied to: ' + fallingBack.join(', ') + '. Set those variables explicitly instead.');
    }
}

/**
 * Frozen so a gateway cannot be redirected by code mutating this object after
 * load. Each gateway also snapshots these into module-local constants at
 * require time, so this is belt-and-braces.
 */
module.exports = Object.freeze({
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_TRANSACTION_AUTH_V2: BASE_URL_MS_TRANSACTION_AUTH_V2,
    BASE_URL_MS_TRANSACTION_AUTH_BASIC: BASE_URL_MS_TRANSACTION_AUTH_BASIC,
    BASE_URL_MS_AUTHENTICATION: BASE_URL_MS_AUTHENTICATION
});
