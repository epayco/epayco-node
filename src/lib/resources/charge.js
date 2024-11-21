/**
 * Module dependencies
 */
const util = require("node:util");
const Resource = require(".");

/**
 * Expose constructor
 */
module.exports = charge;

/**
 * Customers constructor
 */
function charge(epayco) {
  Resource.call(this, epayco);
}

util.inherits(charge, Resource);

/**
 * Create Subscriptions
 * @param {Object} options
 * @api public
 */
charge.prototype.create = function (options) {
  return this.request(
    "post",
    "/payment/v1/charge/create",
    options,
    (sw = false),
  );
};

/**
 * Retrieve Subscriptions
 *
 * @param {String} uid
 * @api public
 */
charge.prototype.get = function (uid) {
  return this.request(
    "get",
    `/restpagos/transaction/response.json?ref_payco=${uid}&&public_key=${this._epayco.apiKey}`,
    {},
    (sw = true),
  );
};
