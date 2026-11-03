'use strict';

var envHosts = require('../utils/envHosts');
var hostFromEnv = envHosts.hostFromEnv;

var BASE_URL_MS_TRANSACTION = hostFromEnv('BASE_URL_MS_TRANSACTION') ||
    'https://apiflow-green.epayco.co';

var LEGACY_AUTH_OVERRIDE = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH');

var EXPLICIT_AUTH_V2 = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_V2');
var EXPLICIT_AUTH_BASIC = hostFromEnv('BASE_URL_MS_TRANSACTION_AUTH_BASIC');

var BASE_URL_MS_TRANSACTION_AUTH_V2 = EXPLICIT_AUTH_V2 ||
    LEGACY_AUTH_OVERRIDE ||
    'https://apiflow-green.epayco.co';

var BASE_URL_MS_TRANSACTION_AUTH_BASIC = EXPLICIT_AUTH_BASIC ||
    LEGACY_AUTH_OVERRIDE ||
    'https://apify-green.epayco.co';

var BASE_URL_MS_AUTHENTICATION = hostFromEnv('BASE_URL_MS_AUTHENTICATION') ||
    'https://ms-auth-green.epayco.co';

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

module.exports = Object.freeze({
    BASE_URL_MS_TRANSACTION: BASE_URL_MS_TRANSACTION,
    BASE_URL_MS_TRANSACTION_AUTH_V2: BASE_URL_MS_TRANSACTION_AUTH_V2,
    BASE_URL_MS_TRANSACTION_AUTH_BASIC: BASE_URL_MS_TRANSACTION_AUTH_BASIC,
    BASE_URL_MS_AUTHENTICATION: BASE_URL_MS_AUTHENTICATION
});
