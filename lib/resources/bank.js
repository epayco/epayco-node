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
    return this.request('get', "/recurring/v1/subscription/" + uid + "/" + this._epayco.apiKey  + "/", {}, sw = false);
};
