/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');

/**
 * Expose constructor
 */
module.exports = plans;

/**
 * Customers constructor
 */
function plans(epayco) {
    Resource.call(this, epayco);
}

util.inherits(plans, Resource);

/**
 * Create Plans
 * @param {Object} options
 * @api public
 */
plans.prototype.create = function(options) {
    return this.request('post', '/recurring/v1/plan/create', options, sw = false);
};

/**
 * Retrieve Plan
 *
 * @param {String} uid
 * @api public
 */
plans.prototype.get = function(uid) {
    return this.request('get', "/recurring/v1/plan/" + this._epayco.apiKey + "/" + uid + "/", {}, sw = false);
};

/**
 * List Plans
 * @api public
 */
plans.prototype.list = function() {
    return this.request('get', "/recurring/v1/plans/" + this._epayco.apiKey + "/", {}, sw = false);
};

/**
 * Remove Plan
 *
 * @param {String} uid
 * @api public
 */
plans.prototype.delete = function(uid) {
    return this.request('post', "/recurring/v1/plan/remove/" + this._epayco.apiKey + "/" + uid, {}, sw = false);
};
