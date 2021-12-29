/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('.');

/**
 * Expose constructor
 */
module.exports = daviplata;

/**
 * Daviplata constructor
 */
function daviplata (epayco){
    Resource.call(this, epayco);

}
/**
 * Create Trx Daviplata
 * @param {Object} options
 * @api public
 */
    daviplata.prototype.create = function (options) {
    return this.request('post', '/payment/process/daviplata', options, sw = false, cashData = false, card= false, apify = true);
}

daviplata.prototype.confirm = function(options) {
    return this.request('post', '/payment/confirm/daviplata', options, sw = false, cashData = false, card= false, apify = true);

}


util.inherits(daviplata, Resource);



