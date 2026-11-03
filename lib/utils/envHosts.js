'use strict';

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

function isLoopback(hostname) {
    return hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]';
}

function hostFromEnv(name) {
    var raw = readEnv(name);
    if (raw === undefined) {
        return undefined;
    }
    var parsed;
    try {
        parsed = new URL(raw);
    } catch (e) {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- not a valid absolute URL; using the built-in default instead');
        return undefined;
    }
    if (parsed.username !== '' || parsed.password !== '') {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- must not embed credentials (user:pass@host); using the built-in default instead');
        return undefined;
    }
    if (parsed.search !== '' || parsed.hash !== '') {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- must not carry a query string or fragment; using the built-in default instead');
        return undefined;
    }
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback(parsed.hostname))) {
        console.warn('epayco-sdk-node: ignoring ' + name + ' -- only https:// (or http:// to localhost) is allowed for a host that receives credentials; using the built-in default instead');
        return undefined;
    }
    return (parsed.origin + parsed.pathname).replace(/\/+$/, '');
}

module.exports = Object.freeze({
    readEnv: readEnv,
    hostFromEnv: hostFromEnv
});
