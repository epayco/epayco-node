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
    Plans = require('./resources/plans'),
    Safetypay = require('./resources/safetypay'),
    Daviplata = require('./resources/daviplata'),
    EpaycoError = require('./resources/errors');

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

    if(!options.lang || 'string' != typeof options.lang){
        options.lang = 'ES'
    }
    if(!['ES', 'EN'].includes(options.lang)){
        throw new Error(`LANG: ${options.lang} is invalid`);
    }

    if (
        'string' != typeof options.apiKey ||
        'string' != typeof options.privateKey ||
        'boolean' != typeof options.test
    ) {
        throw new EpaycoError(options.lang, 100);
    }

    /**
     * Init settings
     */
    this.apiKey = options.apiKey;
    this.privateKey = options.privateKey;
    this.lang = options.lang;
    this.test = options.test ? 'TRUE' : 'FALSE';

    /**
     * Payment methods opted back into their legacy backend instead of the new
     * ms-transaction microservices, mirroring the equivalent `transactionMethods`
     * option in the Python SDK (epayco-python's Epayco.gateway_for()). New
     * ms-transaction flows are the default for every migrated payment method;
     * listing a method's name here (e.g. `transactionMethods: ["cash"]`) is an
     * explicit, per-merchant opt-out back to the old backend for that method
     * only -- not a global toggle.
     */
    this.transactionMethods = Array.isArray(options.transactionMethods) ? options.transactionMethods : [];

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
    this.safetypay = new Safetypay(this);
    this.daviplata = new Daviplata(this);
}

/**
 * Whether `paymentMethod` (e.g. "cash") should use its legacy backend instead
 * of the new ms-transaction microservice, per this instance's
 * `transactionMethods` option.
 *
 * @param {String} paymentMethod
 * @return {Boolean}
 * @api public
 */
Epayco.prototype.usesLegacyFlow = function (paymentMethod) {
    return this.transactionMethods.indexOf(paymentMethod) !== -1;
};
