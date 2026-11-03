var util = require('util');
var EpaycoError = require('./errors');
var Resource = require('./');
var msTransactionCash = require('../gateways/msTransactionCash');

module.exports = cash;

function cash(epayco) {
    Resource.call(this, epayco);
}

util.inherits(cash, Resource);

cash.prototype.create = function(type, options) {
    if (this._epayco.usesLegacyFlow('cash')) {
        return this._legacyCreate(type, options);
    }
    var franchise = msTransactionCash.FRANCHISE_MAP[type];
    if (!franchise) {
        throw new EpaycoError(this._epayco.lang, 109);
    }
    return msTransactionCash.createTransaction(this._epayco, franchise, options);
};

cash.prototype._legacyCreate = function(type, options) {
    var url;
    switch (type) {
        case "efecty":
            url = "/restpagos/v2/efectivo/efecty";
            break;
        case "baloto":
            url = "/restpagos/v2/efectivo/baloto";
            break;
        case "gana":
            url = "/restpagos/v2/efectivo/gana";
            break;
        case "redservi":
            url = "/restpagos/v2/efectivo/redservi";
            break;
        case "puntored":
            url = "/restpagos/v2/efectivo/puntored";
            break;
        case "sured":
            url = "/restpagos/v2/efectivo/sured";
            break;
        default:
            throw new EpaycoError(this._epayco.lang, 109);
    }
    return this.request('post', url, options, true, true);
};

cash.prototype.get = function(uid) {
    if (this._epayco.usesLegacyFlow('cash')) {
        return this._legacyGet(uid);
    }
    return msTransactionCash.getTransaction(this._epayco, uid);
};

cash.prototype._legacyGet = function(uid) {
    return this.request('get', "/restpagos/transaction/response.json?ref_payco=" + uid + "&&public_key=" + this._epayco.apiKey, {}, true);
};
