/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');

/**
 * Expose constructor
 */
module.exports = bank;

/**
 * Customers constructor
 */
function bank(epayco) {
    Resource.call(this, epayco);
}

util.inherits(bank, Resource);

/**
 * Create Subscriptions
 * @param {Object} options
 * @api public
 */
bank.prototype.create = function(options) {
    return this.request('post', '/restpagos/pagos/debitos.json', options, sw = true);
};

/**
 * Retrieve Subscriptions
 *
 * @param {String} uid
 * @api public
 */
bank.prototype.get = function(uid) {
    return this.request('get', "/restpagos/pse/transactioninfomation.json?transactionID=" + uid + "&&public_key=" + this._epayco.apiKey, {}, sw = true);
};

/**
 * Get Banks
 */
bank.prototype.getBanks = function(uid) {
    return this.request('get', "/restpagos/pse/bancos.json?public_key=" + this._epayco.apiKey, {}, sw = true);
};
