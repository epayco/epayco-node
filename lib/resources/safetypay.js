var util = require('util');
var Resource = require('./');
var msTransactionSafetypay = require('../gateways/msTransactionSafetypay');

module.exports = safetypay;

function safetypay(epayco) {
    Resource.call(this, epayco);
}

util.inherits(safetypay, Resource);

safetypay.prototype.create = function (options) {
    if (this._epayco.usesLegacyFlow('safetypay')) {
        return this._legacyCreate(options);
    }
    return msTransactionSafetypay.createTransaction(this._epayco, options);
};

safetypay.prototype._legacyCreate = function (options) {
    return this.request('post', '/payment/process/safetypay', options, sw = false, cashData = false, card = true, apify = true);
};

safetypay.prototype.get = function (uid) {
    return msTransactionSafetypay.getTransaction(this._epayco, uid);
};
