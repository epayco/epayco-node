var util = require('util');
var Resource = require('./');
var msTransactionBank = require('../gateways/msTransactionBank');

module.exports = bank;

function bank(epayco) {
    Resource.call(this, epayco);
}

util.inherits(bank, Resource);

bank.prototype.create = function (options) {
    if (this._epayco.usesLegacyFlow('bank')) {
        return this._legacyCreate(options);
    }
    return msTransactionBank.createTransaction(this._epayco, options);
};

bank.prototype._legacyCreate = function (options) {
    return this.request('post', '/restpagos/pagos/debitos.json', options, sw = true);
};

bank.prototype.get = function (uid) {
    if (this._epayco.usesLegacyFlow('bank')) {
        return this._legacyGet(uid);
    }
    return msTransactionBank.getTransaction(this._epayco, uid);
};

bank.prototype._legacyGet = function (uid) {
    return this.request('get', "/restpagos/pse/transactioninfomation.json?transactionID=" + uid + "&&public_key=" + this._epayco.apiKey, {}, sw = true);
};

bank.prototype.getBanks = function (uid) {
    if (this._epayco.usesLegacyFlow('bank')) {
        return this._legacyGetBanks(uid);
    }
    return msTransactionBank.getBanks(this._epayco);
};

bank.prototype._legacyGetBanks = function (uid) {
    return this.request('get', "/restpagos/pse/bancos.json?public_key=" + this._epayco.apiKey, {}, true, true);
};
