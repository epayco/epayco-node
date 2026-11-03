var util = require('util');
var Resource = require('./');
var msTransactionCharge = require('../gateways/msTransactionCharge');

module.exports = charge;

function charge(epayco) {
    Resource.call(this, epayco);
}

util.inherits(charge, Resource);

charge.prototype.create = function(options) {
    if (this._epayco.usesLegacyFlow('charge')) {
        return this._legacyCreate(options);
    }
    return msTransactionCharge.createTransaction(this._epayco, options);
};

charge.prototype._legacyCreate = function(options) {
    return this.request('post', '/payment/v1/charge/create', options, sw = false);
};

charge.prototype.get = function(uid) {
    return this.request('get', "/restpagos/transaction/response.json?ref_payco=" + uid + "&&public_key=" + this._epayco.apiKey, {}, sw = true);
};

charge.prototype.refund = function(uid) {
    return this.request('post', '/restpagos/reverse/transaction/' + uid, {referencePayco: uid}, sw = false);
}
