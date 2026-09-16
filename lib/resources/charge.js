/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');
var msTransactionCharge = require('../gateways/msTransactionCharge');

/**
 * Expose constructor
 */
module.exports = charge;

/**
 * Customers constructor
 */
function charge(epayco) {
    Resource.call(this, epayco);
}

util.inherits(charge, Resource);

/**
 * Create a card (TDC) charge.
 *
 * PRELIMINARY: goes through the new ms-transaction microservice
 * (apiflow.epayco.io) by default instead of the legacy
 * /payment/v1/charge/create endpoint -- see
 * lib/gateways/msTransactionCharge.js for the request-building/encryption
 * details AND its header note on what is/isn't yet verified (this gateway
 * was built from a single ad-hoc smoke test, not a full QA pass). A merchant
 * can opt back into the legacy backend for card charges specifically by
 * passing `transactionMethods: ["charge"]` to the `Epayco` constructor,
 * mirroring the same opt-out Cash/Bank/SafetyPay/Daviplata use.
 *
 * @param {Object} options
 * @api public
 */
charge.prototype.create = function(options) {
    if (this._epayco.usesLegacyFlow('charge')) {
        return this._legacyCreate(options);
    }
    return msTransactionCharge.createTransaction(this._epayco, options);
};

/**
 * Legacy card charge creation, unchanged from the pre-migration
 * implementation.
 *
 * @param {Object} options
 * @api private
 */
charge.prototype._legacyCreate = function(options) {
    return this.request('post', '/payment/v1/charge/create', options, sw = false);
};

/**
 * Retrieve Subscriptions
 *
 * @param {String} uid
 * @api public
 */
charge.prototype.get = function(uid) {
    return this.request('get', "/restpagos/transaction/response.json?ref_payco=" + uid + "&&public_key=" + this._epayco.apiKey, {}, sw = true);
};
