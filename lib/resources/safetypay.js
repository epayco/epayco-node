/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');
var msTransactionSafetypay = require('../gateways/msTransactionSafetypay');

module.exports = safetypay;

function safetypay(epayco) {
    Resource.call(this, epayco);
}

util.inherits(safetypay, Resource);

/**
 * Create a SafetyPay transaction.
 *
 * As of SDK-1354, this goes through the new ms-transaction microservice
 * (apiflow.epayco.io) by default instead of the legacy apify
 * POST /payment/process/safetypay endpoint -- see
 * lib/gateways/msTransactionSafetypay.js for the request-building/encryption
 * details. A merchant can opt back into the legacy backend for SafetyPay
 * specifically by passing `transactionMethods: ["safetypay"]` to the
 * `Epayco` constructor, mirroring the same opt-out bank.js/cash.js use for
 * SDK-1355/SDK-1352.
 *
 * The public signature (`options`, legacy snake_case option names) and the
 * resolved promise's shape (matching the legacy response, see
 * msTransactionSafetypay.js#mapToLegacyShape) are unchanged either way.
 *
 * @param {Object} options
 * @api public
 */
safetypay.prototype.create = function (options) {
    if (this._epayco.usesLegacyFlow('safetypay')) {
        return this._legacyCreate(options);
    }
    return msTransactionSafetypay.createTransaction(this._epayco, options);
};

/**
 * Legacy SafetyPay creation, unchanged from the pre-SDK-1354 implementation.
 *
 * @param {Object} options
 * @api private
 */
safetypay.prototype._legacyCreate = function (options) {
    return this.request('post', '/payment/process/safetypay', options, sw = false, cashData = false, card = true, apify = true);
};

/**
 * Retrieve a SafetyPay transaction by refPayco.
 *
 * New in SDK-1354: the pre-SDK-1354 legacy apify flow never had a query
 * method for SafetyPay (lib/resources/safetypay.js only ever had .create()),
 * so there is no legacy behavior to preserve here and no
 * `transactionMethods: ["safetypay"]` opt-out for this method specifically --
 * it always queries the ms-transaction microservice.
 *
 * @param {String} uid refPayco
 * @api public
 */
safetypay.prototype.get = function (uid) {
    return msTransactionSafetypay.getTransaction(this._epayco, uid);
};
