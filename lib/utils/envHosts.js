'use strict';

/**
 * Defensive reading of the environment variables that decide which host this
 * SDK sends a merchant's credentials to.
 *
 * This lives outside `gateways/` on purpose. Both layers of the SDK resolve
 * hosts from env vars -- the new ms-transaction gateways
 * (`lib/gateways/msTransactionConfig.js`) and the legacy resource layer
 * (`lib/resources/index.js`) -- and both send apiKey/privateKey to whatever
 * comes out. The checks therefore belong to neither layer: making
 * `resources/` require `gateways/msTransactionConfig` would point the older
 * layer at the newer one and, worse, would run that module's side effects
 * (five env vars resolved, plus a possible deprecation warning about
 * BASE_URL_MS_TRANSACTION_AUTH) inside every consumer that only ever touches
 * plans, customers or subscriptions.
 */

/**
 * Read an env var defensively.
 *
 * The own-property check matters: `process.env` inherits from
 * Object.prototype, so prototype pollution elsewhere in the process can
 * otherwise make `process.env.SECURE_URL_SDK` return an attacker-chosen host
 * for a var that was never actually set -- `??` and `||` only guard against
 * the value being nullish, and a polluted value is not. Values are trimmed
 * because a stray trailing space in a `.env` file would otherwise be sent
 * verbatim into the request URL.
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
 * as OAuth2 client_credentials, as Basic auth, or -- on the legacy path --
 * as a cleartext JSON body to `/v1/auth/login`. A malformed value, or one
 * left behind in a `.env` file in the process' cwd (dotenv reads cwd), would
 * otherwise redirect those credentials in the clear with no error. So
 * anything that isn't https:// (or http:// to loopback) is refused and the
 * known-good default is used instead, with a warning naming the variable --
 * never its value, which could itself carry injected content.
 *
 * Refusing rather than throwing is deliberate: this is a published SDK, and
 * a hard failure at require() time over one bad env var would take down
 * every consumer's process rather than just the misconfigured route.
 *
 * Note this validates the scheme, not the domain. A domain allowlist was
 * considered and rejected: the hosts legitimately span epayco.io and
 * epayco.co (green's own hosts are api-green.secure.payco.co,
 * secure-green.payco.co and apify-green.epayco.co), so a suffix check would
 * refuse valid environments.
 *
 * @param {String} name env var to read
 * @return {String|undefined} a safe host with no trailing slash, or
 *         undefined to fall through to the built-in default
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
    // Userinfo is refused for two reasons: node-fetch and axios both echo the
    // full request URL in error messages, so `https://user:pass@host` would
    // put that password into the consumer's logs the first time the host is
    // unreachable -- defeating this module's own rule that no credential
    // value is ever logged. It also disguises the real host:
    // `https://apiflow.epayco.io@evil.example` reads as legitimate but
    // resolves to evil.example.
    if (parsed.username !== '' || parsed.password !== '') {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- must not embed credentials (user:pass@host); using the built-in default instead');
        return undefined;
    }
    // A query or fragment in a base host is never meaningful and silently
    // corrupts the endpoint path these values get concatenated with: e.g.
    // "https://host?a=1" would produce "POST /?a=1/login". A trailing path IS
    // allowed, since a reverse proxy mounted on a prefix is a legitimate
    // setup and concatenation handles it correctly.
    if (parsed.search !== '' || parsed.hash !== '') {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- must not carry a query string or fragment; using the built-in default instead');
        return undefined;
    }
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback(parsed.hostname))) {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- only https:// (or http:// to localhost) is allowed for a host that receives credentials; using the built-in default instead');
        return undefined;
    }
    // Rebuild from components rather than returning `raw` or `href`, so what
    // callers concatenate is exactly what was validated. Using the pieces
    // (instead of href) is deliberate: an empty fragment leaves `hash` empty
    // but survives in `href` as a trailing "#", and "https://host/#" +
    // "/payment/..." makes the endpoint path a fragment -- the request would
    // silently go to "/". Dropping it here cannot leak a query or fragment by
    // construction. `origin` also punycodes an IDN host, making a homograph
    // visible instead of invisible. The trailing slash is stripped because
    // every caller appends an absolute path.
    return (parsed.origin + parsed.pathname).replace(/\/+$/, '');
}

/**
 * Frozen for the same reason msTransactionConfig freezes its own export, and
 * with more force: this is the module that decides where credentials go, so
 * nothing loaded later should be able to swap hostFromEnv out from under it.
 * Both callers also destructure at load time, so this is belt-and-braces.
 */
module.exports = Object.freeze({
    readEnv: readEnv,
    hostFromEnv: hostFromEnv
});
