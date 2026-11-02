'use strict';

var debug = require('debug')('epayco:api');

var Token = require('./resources/token'),
    Customers = require('./resources/customers'),
    Subscriptions = require('./resources/subscriptions'),
    Bank = require('./resources/bank'),
    Cash = require('./resources/cash'),
    Charge = require('./resources/charge'),
    Plans = require('./resources/plans'),
    Safetypay = require('./resources/safetypay'),
    Daviplata = require('./resources/daviplata'),
    Transaction = require('./resources/transaction'),
    EpaycoError = require('./resources/errors');

module.exports = Epayco;

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

    this.apiKey = options.apiKey;
    this.privateKey = options.privateKey;
    this.lang = options.lang;
    this.test = options.test ? 'TRUE' : 'FALSE';

    this.transactionMethods = Array.isArray(options.transactionMethods) ? options.transactionMethods : [];

    this.token = new Token(this);
    this.customers = new Customers(this);
    this.plans = new Plans(this);
    this.subscriptions = new Subscriptions(this);
    this.bank = new Bank(this);
    this.cash = new Cash(this);
    this.charge = new Charge(this);
    this.safetypay = new Safetypay(this);
    this.daviplata = new Daviplata(this);
    this.transaction = new Transaction(this);
}

Epayco.prototype.usesLegacyFlow = function (paymentMethod) {
    return this.transactionMethods.indexOf(paymentMethod) !== -1;
};
