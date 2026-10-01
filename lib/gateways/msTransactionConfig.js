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
 * Read an env var defensively.
 *
 * The own-property check matters: `process.env` inherits from
 * Object.prototype, so prototype pollution elsewhere in the process can
 * otherwise make `process.env.BASE_URL_MS_TRANSACTION_AUTH_V2` return an
 * attacker-chosen host for a var that was never actually set. Values are
 * trimmed because a stray trailing space in a `.env` file would otherwise be
 * sent verbatim into the request URL.
 *
 * @param {String} name
 * @return {String|undefined} the trimmed value, or undefined if unset/blank
 */
function readEnv(name) {
    if (!Object.prototype.hasOwnProperty.call(process.env, name)) {
        return undefined;
    }
    var value = process.env[name];
    if (typeof value !== 'string') {
        return undefined;
    }
    value = value.trim();
    return value === '' ? undefined : value;
}

/**
 * Whether `hostname` is a loopback address. Plain http:// is tolerated for
 * these only, so pointing the SDK at a local mock during development still
 * works without opening a path for plaintext credential egress to a remote
 * host.
 *
 * @param {String} hostname
 * @return {Boolean}
 */
function isLoopback(hostname) {
    return hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]';
}

/**
 * Resolve a host from an env var, rejecting values that would send
 * credentials somewhere unintended.
 *
 * Every host resolved here receives credentials: the apiKey/privateKey pair
 * as OAuth2 client_credentials, or Basic auth for the PSE-group gateways. A
 * malformed value, or one left behind in a `.env` file in the process' cwd
 * (dotenv reads cwd), would otherwise redirect those credentials in the
 * clear with no error. So anything that isn't https:// (or http:// to
 * loopback) is refused and the known-good default is used instead, with a
 * warning naming the variable -- never its value, which could itself carry
 * injected content.
 *
 * Refusing rather than throwing is deliberate: this is a published SDK, and
 * a hard failure at require() time over one bad env var would take down
 * every consumer's process rather than just the misconfigured route.
 *
 * @param {String} name env var to read
 * @return {String|undefined} a safe host, or undefined to fall through
 */
function hostFromEnv(name) {
    var raw = readEnv(name);
    if (raw === undefined) {
        return undefined;
    }
    var parsed;
    try {
        // WHATWG URL, not url.parse(): the legacy parser is deprecated
        // precisely because its lenient behavior has security implications
        // (Node DEP0169), which is the opposite of what this check is for.
        parsed = new URL(raw);
    } catch (e) {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- not a valid absolute URL; using the built-in default instead');
        return undefined;
    }
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopback(parsed.hostname))) {
        return raw;
    }
    console.warn('epayco-sdk-node: ignoring ' + name + ' -- only https:// (or http:// to localhost) is allowed for a host that receives credentials; using the built-in default instead');
    return undefined;
}

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
 * Auth host for the gateways that log in against
 * `/authentication/api/v2/login` (Cash since SDK-1352, and Charge/TDC which
 * followed it).
 */
var BASE_URL_MS_TRANSACTION_AUTH_V2 = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_V2') ||
    LEGACY_AUTH_OVERRIDE ||
    'https://apiflow.epayco.io';

/**
 * Auth host for the gateways that log in against the Basic-auth `/login`
 * endpoint (Bank/PSE, SafetyPay, Daviplata). Deliberately NOT the newer
 * apiflow.epayco.io/authentication endpoint Cash moved to under SDK-1352 --
 * that change was requested for cash specifically; these three match the
 * earlier precedent.
 */
var BASE_URL_MS_TRANSACTION_AUTH_BASIC = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_BASIC') ||
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
    if (hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_V2') === undefined) {
        fallingBack.push('BASE_URL_MS_TRANSACTION_AUTH_V2');
    }
    if (hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_BASIC') === undefined) {
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
