/**
 * Module dependencies
 */
var util = require('util');
var Resource = require('./');
var msTransactionBank = require('../gateways/msTransactionBank');

module.exports = bank;

function bank(epayco) {
    Resource.call(this, epayco);
}

util.inherits(bank, Resource);

/**
 * Create a PSE (bank) transaction.
 *
 * As of SDK-1355, this goes through the new ms-transaction microservice
 * (apiflow.epayco.io) by default instead of the legacy secure.payco.co
 * restpagos/v2 PSE endpoint -- see lib/gateways/msTransactionBank.js for the
 * request-building/encryption details. A merchant can opt back into the
 * legacy backend for PSE specifically by passing
 * `transactionMethods: ["bank"]` to the `Epayco` constructor, mirroring the
 * same opt-out `cash.js` uses for SDK-1352.
 *
 * The public signature (`options`, legacy snake_case option names) and the
 * resolved promise's shape (matching the legacy response, see
 * msTransactionBank.js#mapToLegacyShape) are unchanged either way.
 *
 * @param {Object} options
 * @api public
 */
bank.prototype.create = function (options) {
    if (this._epayco.usesLegacyFlow('bank')) {
        return this._legacyCreate(options);
    }
    return msTransactionBank.createTransaction(this._epayco, options);
};

/**
 * Legacy PSE creation, unchanged from the pre-SDK-1355 implementation.
 *
 * @param {Object} options
 * @api private
 */
bank.prototype._legacyCreate = function (options) {
    return this.request('post', '/restpagos/pagos/debitos.json', options, sw = true);
};

/**
 * Retrieve a PSE (bank) transaction.
 *
 * As of SDK-1355, this queries the new ms-transaction microservice by
 * default instead of the legacy /restpagos/pse/transactioninfomation.json
 * endpoint. Same `transactionMethods: ["bank"]` opt-out as .create() above
 * applies here too.
 *
 * @param {String} uid refPayco
 * @api public
 */
bank.prototype.get = function (uid) {
    if (this._epayco.usesLegacyFlow('bank')) {
        return this._legacyGet(uid);
    }
    return msTransactionBank.getTransaction(this._epayco, uid);
};

/**
 * Legacy PSE retrieval, unchanged from the pre-SDK-1355 implementation.
 *
 * @param {String} uid refPayco
 * @api private
 */
bank.prototype._legacyGet = function (uid) {
    return this.request('get', "/restpagos/pse/transactioninfomation.json?transactionID=" + uid + "&&public_key=" + this._epayco.apiKey, {}, sw = true);
};

/**
 * List available PSE banks. Out of SDK-1355's scope (only create + query
 * were migrated) -- stays legacy-only.
 *
 * @param {String} uid
 * @api public
 */
bank.prototype.getBanks = function (uid) {
    return this.request('get', "/restpagos/pse/bancos.json?public_key=" + this._epayco.apiKey, {}, true, true);
};
