/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');
var msTransactionRefund = require('../gateways/msTransactionRefund');

module.exports = transaction;

function transaction(epayco) {
    Resource.call(this, epayco);
}

util.inherits(transaction, Resource);

/**
 * Reverse/refund an already-created transaction, regardless of which
 * payment method created it (Cash, Bank/PSE, SafetyPay, Daviplata, or card).
 *
 * New capability -- there is no legacy equivalent anywhere else in this SDK,
 * so there is no `transactionMethods` opt-out for this method: it always
 * goes through the ms-transaction microservice (see
 * lib/gateways/msTransactionRefund.js).
 *
 * @param {String|Number} refPayco the transaction's refPayco
 * @param {Object} [options] only required for BRE-B refunds: `key_payer`
 *        (the payer's key) and `reason` (one of `WRONG_CLIENT`,
 *        `WRONG_AMOUNT`, `DUPLICATE_TRANSFER`, `FRAUD`, `TECHNICAL_FAILURE`,
 *        `WRONG_PRODUCT`, `PRODUCT_NOT_RECEIVED`). Omit for every other
 *        payment method.
 * @api public
 */
transaction.prototype.refund = function (refPayco, options) {
    return msTransactionRefund.refundTransaction(this._epayco, refPayco, options);
};
