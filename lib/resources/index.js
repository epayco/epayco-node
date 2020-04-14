/**
 * Module dependencies
 */
var request = require('superagent'),
    CryptoJS = require('crypto-js'),
    EpaycoError = require('./errors'),
    debug = require('debug')('epayco:api');
    const fetch = require('node-fetch');

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

Resource.prototype.request =async function(method, url, data, sw, cashData, sp,card)  {
    //Set ip

 var auth= await authent(this._epayco.apiKey,this._epayco.privateKey)
const token_bearer='Bearer '+auth['bearer_token'];
  //  console.log("auth",token_bearer)
  // process.exit()

    if(card){

    }else{

        data["ip"] = data.ip || getIp()
        data["test"] = this._epayco.test;
    }
    if (sw) {
        data = setData(data, this._epayco.privateKey, this._epayco.apiKey, this._epayco.test,cashData, sp);
        url = BASE_URL_SECURE + url;
    } else {
        url = BASE_URL + url;
    }

    var options = {
  'method': method,
  'url': url,
  'headers': {
    'Content-Type': 'application/json',
    'type': 'sdk-jwt',
    'lang': 'NODE',
    'Authorization': token_bearer
  }

};
 var send = await sendData(options,data)
  // console.log(send)
  // process.exit()
     return send;
};

Resource.prototype.authentication = function(method, url, data) {
    url = BASE_URL+url;
    return new Promise((resolve, reject) => {
        request(method, url)
            .auth(this._epayco.apiKey, '')
            .set('type', 'sdk-jwt')
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
}

function setData(data, privateKey, publicKey, test,cashData,sp) {

    if(cashData){
        var set = {};
      if(sp){
        for (var key in data) {
            if (data) {
                set[langkey(key,sp)] = data[key];
            }
        }
      }else{
        for (var key in data) {
            if (data) {
                set[langkey(key)] = data[key];
            }
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

function authent(apiKey, privateKey) {
  let params = {
    public_key: apiKey,
    private_key: privateKey,
  };
  return fetch('https://api.secure.payco.co/v1/auth/login', {
    method: 'post',
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
  })
    .then(res => res.json())
    .then(json => json)
    .catch(err => console.error(err));
}

function sendData(options,data){

if (options['method']=='post') {
 let bodysend = data;
  return fetch(options['url'], {
    method:options['method'],
    body: JSON.stringify(bodysend),
    headers: options['headers'],
  })
    .then(res => res.json())
    .then(json => json)
    .catch(err => console.error(err)); 
}else{
    return fetch(options['url'], {
    method:options['method'],
    headers: options['headers'],
  })
    .then(res => res.json())
    .then(json => json)
    .catch(err => console.error(err)); 
}

}


/**
 * Expose constructor
 */
module.exports = Resource;

