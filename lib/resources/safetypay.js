/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');

/**
 * Expose constructor
 */
module.exports = safetypay;

/**
 * Customers constructor
 */
function safetypay(epayco) {
    Resource.call(this, epayco);
}

util.inherits(safetypay, Resource);

/**
 * Create Subscriptions
 * @param {Object} options
 * @api public
 */
safetypay.prototype.create = function(options) {
    return this.request('post', '/payment/process/safetypay', options, sw = false,cashData = false,card =true,  apify = true);
};


