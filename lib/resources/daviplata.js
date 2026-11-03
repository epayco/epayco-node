var util = require('util');
var Resource = require('.');
var msTransactionDaviplata = require('../gateways/msTransactionDaviplata');

module.exports = daviplata;

function daviplata (epayco){
    Resource.call(this, epayco);

}

daviplata.prototype.create = function (options) {
    if (this._epayco.usesLegacyFlow('daviplata')) {
        return this._legacyCreate(options);
    }
    return msTransactionDaviplata.createTransaction(this._epayco, options);
};

daviplata.prototype._legacyCreate = function (options) {
    return this.request('post', '/payment/process/daviplata', options, sw = false, cashData = false, card= true, apify = true);
};

daviplata.prototype.get = function (uid) {
    return msTransactionDaviplata.getTransaction(this._epayco, uid);
};

daviplata.prototype.confirm = function(options) {
    return this.request('post', '/payment/confirm/daviplata', options, sw = false, cashData = false, card= true, apify = true);

}

util.inherits(daviplata, Resource);
