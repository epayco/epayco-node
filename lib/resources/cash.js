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
cash.prototype.create = function(type, options) {
    var url;
    switch (type) {
        case "efecty":
            url = "/v2/efectivo/efecty";
            break;
        case "baloto":
            url = "/v2/efectivo/baloto";
            break;
        case "gana":
            url = "/v2/efectivo/gana";
            break;
        case "redservi":
            url = "/v2/efectivo/redservi";
            break;
        case "puntored":
            url = "/v2/efectivo/puntored";
            break;
        case "sured":
                url = "/v2/efectivo/sured";
                break;
        default:
            throw new EpaycoError(this._epayco.lang, 109);
    }
    return this.request('post', url, options, sw = true, cashData = true, sp = false);
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
