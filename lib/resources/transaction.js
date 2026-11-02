var util = require('util');
var Resource = require('./');
var msTransactionRefund = require('../gateways/msTransactionRefund');

module.exports = transaction;

function transaction(epayco) {
    Resource.call(this, epayco);
}

util.inherits(transaction, Resource);

transaction.prototype.refund = function (refPayco, options) {
    return msTransactionRefund.refundTransaction(this._epayco, refPayco, options);
};
