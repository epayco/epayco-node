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
 * (apiflow.epayco.io) instead of the legacy secure.payco.co/restpagos/v2/
 * efectivo/{type} endpoints -- see lib/gateways/msTransactionCash.js for the
 * request-building/encryption details. There is no legacy fallback: cash
 * always uses the new flow now (matching the equivalent Python SDK
 * migration), since the ticket did not call for preserving a legacy path.
 *
 * The public signature (`type`, `options`, legacy snake_case option names)
 * and the resolved promise's shape (the raw gateway response, unmodified by
 * this SDK -- see msTransactionCash.createTransaction) are unchanged: exactly
 * as before, this method never reshapes what the backend returns, it only
 * changes which backend is called.
 *
 * @param {String} type one of efecty|baloto|gana|redservi|puntored|sured
 * @param {Object} options
 * @api public
 */
cash.prototype.create = function(type, options) {
    var franchise = msTransactionCash.FRANCHISE_MAP[type];
    if (!franchise) {
        throw new EpaycoError(this._epayco.lang, 109);
    }
    return msTransactionCash.createTransaction(this._epayco, franchise, options);
};

/**
 * Retrieve a cash (Efectivo) transaction by refPayco.
 *
 * As of SDK-1352, this queries the new ms-transaction microservice instead of
 * the legacy /restpagos/transaction/response.json endpoint. Same notes as
 * .create() above re: unchanged public signature/response shape.
 *
 * @param {String} uid refPayco
 * @api public
 */
cash.prototype.get = function(uid) {
    return msTransactionCash.getTransaction(this._epayco, uid);
};
