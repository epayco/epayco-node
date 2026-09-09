/**
 * Module dependencies
 */
var util = require('util');
var EpaycoError = require('./errors');
var Resource = require('./');
var msTransactionCash = require('../gateways/msTransactionCash');

/**
 * Expose constructor
 */
module.exports = cash;

/**
 * Customers constructor
 */
function cash(epayco) {
    Resource.call(this, epayco);
}

util.inherits(cash, Resource);

/**
 * Create a cash (Efectivo) transaction.
 *
 * As of SDK-1352, this goes through the new ms-transaction microservice
 * (apiflow.epayco.io) by default instead of the legacy secure.payco.co/
 * restpagos/v2/efectivo/{type} endpoints -- see lib/gateways/msTransactionCash.js
 * for the request-building/encryption details. A merchant can opt back into
 * the legacy backend for cash specifically by passing
 * `transactionMethods: ["cash"]` to the `Epayco` constructor, mirroring the
 * equivalent `transactionMethods` option already used by the Python SDK's own
 * ms-transaction migration (epayco-python, `Epayco.gateway_for`).
 *
 * The public signature (`type`, `options`, legacy snake_case option names)
 * and the resolved promise's shape (the raw gateway response, unmodified by
 * this SDK) are unchanged either way: this method never reshapes what the
 * backend returns, it only changes which backend is called.
 *
 * @param {String} type one of efecty|baloto|gana|redservi|puntored|sured
 * @param {Object} options
 * @api public
 */
cash.prototype.create = function(type, options) {
    if (this._epayco.usesLegacyFlow('cash')) {
        return this._legacyCreate(type, options);
    }
    var franchise = msTransactionCash.FRANCHISE_MAP[type];
    if (!franchise) {
        throw new EpaycoError(this._epayco.lang, 109);
    }
    return msTransactionCash.createTransaction(this._epayco, franchise, options);
};

/**
 * Legacy cash creation, unchanged from the pre-SDK-1352 implementation:
 * one of six secure.payco.co/restpagos/v2/efectivo/{type} endpoints, selected
 * by `type`, through the shared Resource#request (field-name translation +
 * AES encryption, same as every other legacy resource in this repo).
 *
 * @param {String} type one of efecty|baloto|gana|redservi|puntored|sured
 * @param {Object} options
 * @api private
 */
cash.prototype._legacyCreate = function(type, options) {
    var url;
    switch (type) {
        case "efecty":
            url = "/restpagos/v2/efectivo/efecty";
            break;
        case "baloto":
            url = "/restpagos/v2/efectivo/baloto";
            break;
        case "gana":
            url = "/restpagos/v2/efectivo/gana";
            break;
        case "redservi":
            url = "/restpagos/v2/efectivo/redservi";
            break;
        case "puntored":
            url = "/restpagos/v2/efectivo/puntored";
            break;
        case "sured":
            url = "/restpagos/v2/efectivo/sured";
            break;
        default:
            throw new EpaycoError(this._epayco.lang, 109);
    }
    return this.request('post', url, options, true, true);
};

/**
 * Retrieve a cash (Efectivo) transaction by refPayco.
 *
 * As of SDK-1352, this queries the new ms-transaction microservice by default
 * instead of the legacy /restpagos/transaction/response.json endpoint. Same
 * `transactionMethods: ["cash"]` opt-out as .create() above applies here too.
 *
 * @param {String} uid refPayco
 * @api public
 */
cash.prototype.get = function(uid) {
    if (this._epayco.usesLegacyFlow('cash')) {
        return this._legacyGet(uid);
    }
    return msTransactionCash.getTransaction(this._epayco, uid);
};

/**
 * Legacy cash retrieval, unchanged from the pre-SDK-1352 implementation.
 *
 * @param {String} uid refPayco
 * @api private
 */
cash.prototype._legacyGet = function(uid) {
    return this.request('get', "/restpagos/transaction/response.json?ref_payco=" + uid + "&&public_key=" + this._epayco.apiKey, {}, true);
};
