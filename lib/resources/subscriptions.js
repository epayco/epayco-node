var util = require('util');
var Resource = require('./');

module.exports = subscriptions;

function subscriptions(epayco) {
    Resource.call(this, epayco);
}

util.inherits(subscriptions, Resource);

subscriptions.prototype.create = function(options) {
    return this.request('post', '/recurring/v1/subscription/create', options, sw = false);
};

subscriptions.prototype.get = function(uid) {
    return this.request('get', "/recurring/v1/subscription/" + uid + "/" + this._epayco.apiKey, {}, sw = false);
};

subscriptions.prototype.list = function() {
    return this.request('get', "/recurring/v1/subscriptions/" + this._epayco.apiKey, {}, sw = false);
};

subscriptions.prototype.cancel = function(uid) {
    var options = {
        id: uid,
        public_key: this._epayco.apiKey
    }
    return this.request('post', "/recurring/v1/subscription/cancel", options, sw = false);
};

subscriptions.prototype.charge = function(options) {
    return this.request('post', "/payment/v1/charge/subscription/create", options, sw = false);
};
