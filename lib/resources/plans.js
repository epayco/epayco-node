var util = require('util');
var Resource = require('./');

module.exports = plans;

function plans(epayco) {
    Resource.call(this, epayco);
}

util.inherits(plans, Resource);

plans.prototype.create = function(options) {
    return this.request('post', '/recurring/v1/plan/create', options, sw = false);
};

plans.prototype.get = function(uid) {
    return this.request('get', "/recurring/v1/plan/" + this._epayco.apiKey + "/" + uid, {}, sw = false);
};

plans.prototype.list = function() {
    return this.request('get', "/recurring/v1/plans/" + this._epayco.apiKey, {}, sw = false);
};

plans.prototype.update = function(uid,options) {
    return this.request('post', "/recurring/v1/plan/edit/" + uid, options, sw = false);
};

plans.prototype.delete = function(uid) {
    return this.request('post', "/recurring/v1/plan/remove/" + this._epayco.apiKey + "/" + uid, {}, sw = false);
};
