'use strict';

/**
 * Module dependencies
 */

var debug = require('debug')('epayco:api');


/**
 * Resources
 */
var Token = require('./resources/token'),
    Customers = require('./resources/customers'),
    Subscriptions = require('./resources/subscriptions'),
    Bank = require('./resources/bank'),
    Cash = require('./resources/cash'),
    Charge = require('./resources/charge'),
    Plans = require('./resources/plans');

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
    this.test = options.test ? 'TRUE' : 'FALSE';

    /**
     * Resources
     */
    this.token = new Token(this);
    this.customers = new Customers(this);
    this.plans = new Plans(this);
    this.subscriptions = new Subscriptions(this);
    this.bank = new Bank(this);
    this.cash = new Cash(this);
    this.charge = new Charge(this);
}
