'use strict';

/**
 * Module dependencies
 */

var debug = require('debug')('epayco:api');


/**
 * Resources
 */
var Token = require('./resources/token'),
    Customers = require('./resources/customers');

/**
 * Expose constructor
 */
module.exports = Epayco;

/**
 * Epayco constructor
 *
 * @param {Object} options
 * @return {Epayco} API client instance
 * @api public
 */

function Epayco(options) {
    if (!(this instanceof Epayco)) {
        return new Epayco(options);
    }

    if ('string' != typeof options.apiKey) {
        throw new Error('Please provide a valid api_key');
    }

    /**
     * Init settings
     */
    this.apiKey = options.apiKey;
    this.privateKey = options.privateKey;
    this.lang = options.lang;
    this.test = options.test;

    /**
     * Resources
     */
    this.token = new Token(this);
    this.customers = new Customers(this);
}
