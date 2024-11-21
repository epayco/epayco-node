/**
 * Module dependencies
 */

const debug = require("debug")("epayco:api");

/**
 * Resources
 */
const Token = require("./resources/token");
const Customers = require("./resources/customers");
const Subscriptions = require("./resources/subscriptions");
const Bank = require("./resources/bank");
const Cash = require("./resources/cash");
const Charge = require("./resources/charge");
const Plans = require("./resources/plans");
const Safetypay = require("./resources/safetypay");
const Daviplata = require("./resources/daviplata");
const EpaycoError = require("./resources/errors");

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

  if (!options.lang || "string" !== typeof options.lang) {
    options.lang = "ES";
  }
  if (!["ES", "EN"].includes(options.lang)) {
    throw new Error(`LANG: ${options.lang} is invalid`);
  }

  if (
    "string" !== typeof options.apiKey ||
    "string" !== typeof options.privateKey ||
    "boolean" !== typeof options.test
  ) {
    throw new EpaycoError(options.lang, 100);
  }

  /**
   * Init settings
   */
  this.apiKey = options.apiKey;
  this.privateKey = options.privateKey;
  this.lang = options.lang;
  this.test = options.test ? "TRUE" : "FALSE";

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
