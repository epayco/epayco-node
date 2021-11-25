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
class daviplata {
    constructor(epayco) {
        Resource.call(this, epayco);
    }
    /**
     * Create Trx Daviplata
     * @param {Object} options
     * @api public
     */
    create(options) {
        return this.request('post', '/payment/process/daviplata', options, sw = false, cashData = false, sp = true, apify = true);
    }

    confirm(options) {
        return this.request('post', '/payment/confirm/daviplata', options, sw = false, cashData = false, sp = true, apify = true);

    }
}

util.inherits(daviplata, Resource);



