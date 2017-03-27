/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');

/**
 * Expose constructor
 */
module.exports = token;

/**
 * Customers constructor
 */
function token(epayco) {
    Resource.call(this, epayco);
}

util.inherits(token, Resource);

/**
 * Create Token
 * @param {Object} options
 * @api public
 */
token.prototype.create = function(options) {
    return this.request('post', '/v1/tokens', options, sw = false);
};
