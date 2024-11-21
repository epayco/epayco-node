/**
 * Module dependencies
 */
const util = require("node:util");
const Resource = require(".");

/**
 * Expose constructor
 */
module.exports = subscriptions;

/**
 * Customers constructor
 */
function subscriptions(epayco) {
  Resource.call(this, epayco);
}

util.inherits(subscriptions, Resource);

/**
 * Create Subscriptions
 * @param {Object} options
 * @api public
 */
subscriptions.prototype.create = function (options) {
  return this.request(
    "post",
    "/recurring/v1/subscription/create",
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
subscriptions.prototype.get = function (uid) {
  return this.request(
    "get",
    `/recurring/v1/subscription/${uid}/${this._epayco.apiKey}`,
    {},
    (sw = false),
  );
};

/**
 * List Subscriptions
 * @api public
 */
subscriptions.prototype.list = function () {
  return this.request(
    "get",
    `/recurring/v1/subscriptions/${this._epayco.apiKey}`,
    {},
    (sw = false),
  );
};

/**
 * Cancel Subscriptions
 *
 * @param {String} uid
 * @api public
 */
subscriptions.prototype.cancel = function (uid) {
  const options = {
    id: uid,
    public_key: this._epayco.apiKey,
  };
  return this.request(
    "post",
    "/recurring/v1/subscription/cancel",
    options,
    (sw = false),
  );
};

/**
 * Charge Subscriptions
 *
 * @param {String} uid
 * @api public
 */
subscriptions.prototype.charge = function (options) {
  return this.request(
    "post",
    "/payment/v1/charge/subscription/create",
    options,
    (sw = false),
  );
};
