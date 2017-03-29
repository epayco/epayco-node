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
            url = "/restpagos/pagos/efecties.json";
            break;
        case "efecty":
            url = "/restpagos/pagos/balotos.json";
            break;
        case "efecty":
            url = "/restpagos/pagos/balotos.json";
            break;
        default:
            throw new EpaycoError(this._epayco.lang, 109);
    }
    return this.request('post', url, options, sw = true);
};

/**
 * Retrieve Subscriptions
 *
 * @param {String} uid
 * @api public
 */
cash.prototype.get = function(uid) {
    return this.request('get', "/restpagos/pse/transactioninfomation.json?transactionID=" + uid + "&&public_key=" + this._epayco.apiKey, {}, sw = true);
};
