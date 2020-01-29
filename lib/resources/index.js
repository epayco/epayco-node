/**
 * Module dependencies
 */
var request = require('superagent'),
    CryptoJS = require('crypto-js'),
    EpaycoError = require('./errors'),
    debug = require('debug')('epayco:api');

// Constants
const BASE_URL = "https://api.secure.payco.co",
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

Resource.prototype.request = function(method, url, data, sw, cashData) {
    //Set ip
    data["ip"] = data.ip || getIp()
    data["test"] = this._epayco.test;

    if (sw) {
       
        data = setData(data, this._epayco.privateKey, this._epayco.apiKey, this._epayco.test,cashData);
        url = BASE_URL_SECURE + url;
    } else {
        url = BASE_URL + url;
    }
    
   //console.log(data);
   // process.exit()
    return new Promise((resolve, reject) => {
        request(method, url)
            .auth(this._epayco.apiKey, '')
            .set('type', 'sdk')
            .query(method === 'get' && data || {})
            .send(method !== 'get' && data || {})
            .end(function(err, res) {
                if (res.ok) {
                    return resolve(res.body);
                } else {
                    return reject(res.error);
                }
            });
    });
    return this;
};

function setData(data, privateKey, publicKey, test,cashData) {
    if(cashData){
      
        var set = {};
        for (var key in data) {
            if (data) {
                set[langkey(key)] = data[key];
            }
        }
        set["public_key"] = publicKey;
        set["i"] = "MDAwMDAwMDAwMDAwMDAwMA==";
        set["enpruebas"] = test;
        set["lenguaje"] = "javascript";
        set["p"] = '';
        return set;
    }else{
    var set = {},
        hex = encryptHex(privateKey);
    for (var key in data) {
        if (data.hasOwnProperty(key)) {
            set[langkey(key)] = encrypt(data[key], privateKey);
        }
    }
    set["public_key"] = publicKey;
    set["i"] = hex.i;
    set["enpruebas"] = encrypt(test, privateKey);
    set["lenguaje"] = "javascript";
    set["p"] = hex.p;
    return set;
}
}

/**
 * Traslate keys
 * @param  {string} value key eng
 * @return {string}       traslate key
 */
function langkey(value) {
	var obj = require("../keylang.json");
	if (obj[value]) {
		return obj[value]
	} else {
		return value
	}
}

/**
 * Encrypt text
 * @param  {string} value plain text
 * @param  {string} key   private key user
 * @return {string}       text encrypt
 */
function encrypt(value, userKey) {
    var key = CryptoJS.enc.Hex.parse(userKey),
        iv = CryptoJS.enc.Hex.parse("0000000000000000"),
        text = CryptoJS.AES.encrypt(value, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
    return text.ciphertext.toString(CryptoJS.enc.Base64);
}

/**
 * Get bites petition secure
 * @param  {string} userKey private key user
 * @return {object}         bites from crypto-js
 */
function encryptHex(userKey) {
    var key = CryptoJS.enc.Hex.parse(userKey),
        iv = CryptoJS.enc.Hex.parse("0000000000000000");
    return {
        i: iv.toString(CryptoJS.enc.Base64),
        p: key.toString(CryptoJS.enc.Base64)
    }
}

/**
 * Get ip from server
 * @return {string} Server id
 */
function getIp() {
    return require('ip').address();
}

/**
 * Expose constructor
 */
module.exports = Resource;
