/**
 * Module dependencies
 */
var util = require('util');
var EpaycoError = require('./errors');
var Resource = require('./');

/**
 * Expose constructor
 */
module.exports = cash;

/**
 * Customers constructor
 */
function cash(epayco) {
    Resource.call(this, epayco);
}

util.inherits(cash, Resource);

/**
 * Create Subscriptions
 * @param {Object} options
 * @api public
 */
cash.prototype.create = async function(type, options) {
    medio = type.toLowerCase();
    if(medio == "baloto"){
        throw new EpaycoError(this._epayco.lang, 109);
    }
    var methods_payment = await this.request('get', '/payment/cash/entities', [], false, false, false, true);

    if(!methods_payment.data || !Array.isArray(methods_payment.data) || methods_payment.data.length == 0){
        throw new EpaycoError(this._epayco.lang, 106);
    }
    var entities = methods_payment.data.map(function(item){
        return item.name.toLowerCase().replace(" ", "");
    })
    if(!entities.includes(medio)){
        throw new EpaycoError(this._epayco.lang, 109);
    }
    return this.request('post', "/v2/efectivo/"+medio, options, sw = true, cashData = true);
};

/**
 * Retrieve Subscriptions
 *
 * @param {String} uid
 * @api public
 */
cash.prototype.get = function(uid) {
    return this.request('get', "/transaction/response.json?ref_payco=" + uid + "&&public_key=" + this._epayco.apiKey, {}, sw = true);
};
