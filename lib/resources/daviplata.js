/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('.');
var msTransactionDaviplata = require('../gateways/msTransactionDaviplata');

/**
 * Expose constructor
 */
module.exports = daviplata;

/**
 * Daviplata constructor
 */
function daviplata (epayco){
    Resource.call(this, epayco);

}

/**
 * Create a Daviplata transaction.
 *
 * As of SDK-1353, this goes through the new ms-transaction microservice
 * (apiflow.epayco.io) by default instead of the legacy apify
 * POST /payment/process/daviplata endpoint -- see
 * lib/gateways/msTransactionDaviplata.js for the request-building/encryption
 * details. A merchant can opt back into the legacy backend for Daviplata
 * specifically by passing `transactionMethods: ["daviplata"]` to the
 * `Epayco` constructor, mirroring the same opt-out cash.js/bank.js/
 * safetypay.js use for SDK-1352/SDK-1355/SDK-1354.
 *
 * The public signature (`options`, legacy snake_case option names) and the
 * resolved promise's shape (matching the legacy response, see
 * msTransactionDaviplata.js#mapToLegacyShape) are unchanged either way.
 *
 * @param {Object} options
 * @api public
 */
daviplata.prototype.create = function (options) {
    if (this._epayco.usesLegacyFlow('daviplata')) {
        return this._legacyCreate(options);
    }
    return msTransactionDaviplata.createTransaction(this._epayco, options);
};

/**
 * Legacy Daviplata creation, unchanged from the pre-SDK-1353 implementation.
 *
 * @param {Object} options
 * @api private
 */
daviplata.prototype._legacyCreate = function (options) {
    return this.request('post', '/payment/process/daviplata', options, sw = false, cashData = false, card= true, apify = true);
};

/**
 * Retrieve a Daviplata transaction by refPayco.
 *
 * New in SDK-1353: the pre-SDK-1353 legacy apify flow never had a query
 * method for Daviplata (lib/resources/daviplata.js only ever had .create()/
 * .confirm()), so there is no legacy behavior to preserve here and no
 * `transactionMethods: ["daviplata"]` opt-out for this method specifically --
 * it always queries the ms-transaction microservice. Same precedent as
 * SafetyPay's .get() (msTransactionSafetypay.js, SDK-1354).
 *
 * @param {String} uid refPayco
 * @api public
 */
daviplata.prototype.get = function (uid) {
    return msTransactionDaviplata.getTransaction(this._epayco, uid);
};

/**
 * Confirm a Daviplata transaction's OTP. Deliberately NOT migrated to
 * ms-transaction: SDK-1353's ticket only asks for create + query, and
 * ms-transaction's generic transactions endpoint has no equivalent for
 * confirming a session's OTP. Matches the already-shipped Python SDK's own
 * ms-transaction migration (epayco-python, epaycosdk/resources.py's
 * `Daviplata.confirm()`), which also permanently kept this on the legacy
 * `payment/confirm/daviplata` endpoint -- corroborated, not a guess. Always
 * uses the legacy flow regardless of `transactionMethods`, unchanged from
 * the pre-SDK-1353 implementation.
 *
 * @param {Object} options
 * @api public
 */
daviplata.prototype.confirm = function(options) {
    return this.request('post', '/payment/confirm/daviplata', options, sw = false, cashData = false, card= true, apify = true);

}


util.inherits(daviplata, Resource);
