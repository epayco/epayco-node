'use strict';

/**
 * Single source of truth for the ms-transaction base hosts every new
 * (non-legacy) gateway in this directory talks to. Each gateway used to
 * declare its own copy of these constants, which meant the same host default
 * was repeated in six files and could silently diverge -- e.g. a backport or
 * a merge touching only one gateway would leave the others pointing somewhere
 * else, and nothing would fail until a transaction hit the wrong host.
 *
 * All values stay env-overridable with the exact same variable names and the
 * exact same defaults each gateway used before being centralized here, so
 * moving a gateway onto this module is a no-op at runtime.
 */

/**
 * The transactions API itself (POST/GET /payment/api/v1/transactions...).
 * Identical for every gateway: Cash, Charge (TDC), Bank (PSE), SafetyPay,
 * Daviplata and Refund all go through the same generic endpoint, only
 * paymentMethod/paymentMethodData differ.
 */
var BASE_URL_MS_TRANSACTION = process.env.BASE_URL_MS_TRANSACTION || 'https://apiflow.epayco.io';

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
var LEGACY_AUTH_OVERRIDE = process.env.BASE_URL_MS_TRANSACTION_AUTH;

/**
 * Auth host for the gateways that log in against
 * `/authentication/api/v2/login` (Cash since SDK-1352, and Charge/TDC which
 * followed it).
 */
var BASE_URL_MS_TRANSACTION_AUTH_V2 = process.env.BASE_URL_MS_TRANSACTION_AUTH_V2 ||
    LEGACY_AUTH_OVERRIDE ||
    'https://apiflow.epayco.io';

/**
 * Auth host for the gateways that log in against the Basic-auth `/login`
 * endpoint (Bank/PSE, SafetyPay, Daviplata). Deliberately NOT the newer
 * apiflow.epayco.io/authentication endpoint Cash moved to under SDK-1352 --
 * that change was requested for cash specifically; these three match the
 * earlier precedent.
 */
var BASE_URL_MS_TRANSACTION_AUTH_BASIC = process.env.BASE_URL_MS_TRANSACTION_AUTH_BASIC ||
    LEGACY_AUTH_OVERRIDE ||
    'https://eks-apify-service.epayco.io';

/**
 * The refund endpoint's own dedicated OAuth2 client_credentials token host.
 * Already had its own env var before centralization, precisely because
 * neither of the two auth hosts above issues a token this endpoint accepts
 * (verified empirically -- see msTransactionRefund.js's header note).
 */
var BASE_URL_MS_AUTHENTICATION = process.env.BASE_URL_MS_AUTHENTICATION || 'https://eks-ms-authentication-service.epayco.io';

module.exports = {
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_TRANSACTION_AUTH_V2: BASE_URL_MS_TRANSACTION_AUTH_V2,
    BASE_URL_MS_TRANSACTION_AUTH_BASIC: BASE_URL_MS_TRANSACTION_AUTH_BASIC,
    BASE_URL_MS_AUTHENTICATION: BASE_URL_MS_AUTHENTICATION
};
