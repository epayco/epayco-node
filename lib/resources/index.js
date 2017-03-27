/**
 * Module dependencies
 */
var request = require('superagent');
var debug = require('debug')('epayco:api');

// Constants
const BASE_URL = "http://localhost:3000",
    BASE_URL_SECURE = "https://secure.payco.co";

/**
 * Resource constructor
 *
 * @param {Epayco} epayco
 */

function Resource(epayco) {
    this._epayco = epayco;
}

/**
 * Perform requests
 *
 * @param {String} method
 * @param {String} url
 * @param {Object} data
 * @param {Boolean} switch
 */

Resource.prototype.request = function(method, url, data, sw) {
    if (sw) {
        url = BASE_URL_SECURE + url;
    } else {
        url = BASE_URL + url;
    }

    return new Promise((resolve, reject) => {
        request(method, url)
            .auth(this._epayco.apiKey, '')
            .set('type', 'sdk')
            .query(method === 'get' && data || {})
            .send(method !== 'get' && data || {})
            .end(function(res) {
                if (res.ok) {
                    return resolve(res.body);
                } else {
                    return reject(res.error);
                }
            });
    });
    return this;
};

/**
 * Expose constructor
 */
module.exports = Resource;
