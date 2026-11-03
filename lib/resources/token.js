var util = require('util');
var Resource = require('./');

module.exports = token;

function token(epayco) {
    Resource.call(this, epayco);
}

util.inherits(token, Resource);

token.prototype.create = function(options) {
    return this.request('post', '/v1/tokens', options, sw = false);
};
