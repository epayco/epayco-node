var util = require('util');
var Resource = require('./');

module.exports = customers;

function customers(epayco) {
    Resource.call(this, epayco);
}

util.inherits(customers, Resource);

customers.prototype.create = function(options) {
    return this.request('post', '/payment/v1/customer/create', options, sw = false);
};

customers.prototype.get = function(uid) {
    return this.request('get', "/payment/v1/customer/" + this._epayco.apiKey + "/" + uid, {}, sw = false);
};

customers.prototype.list = function(options) {
    return this.request('get', "/payment/v1/customers" , options, sw = false, cashData= false, card = true, apify = false);
};

customers.prototype.update = function(uid, options) {
    return this.request('post', "/payment/v1/customer/edit/" + this._epayco.apiKey + "/" + uid, options, sw = false);
};

customers.prototype.delete = function(options) {
    return this.request('post', "/v1/remove/token", options, sw = false);
};

customers.prototype.addDefaultCard = function(options) {
    return this.request('post', "/payment/v1/customer/reasign/card/default", options, sw = false, cashData= false, card = true);
};

customers.prototype.addNewToken = function(options) {
    return this.request('post', "/v1/customer/add/token", options, sw = false, cashData= false, card = true);
};