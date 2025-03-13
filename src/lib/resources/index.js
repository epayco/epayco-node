/**
 * Module dependencies
 */
const CryptoJS = require("crypto-js");
const fetch = require("node-fetch");
require("dotenv").config();

// Constants
const BASE_URL = process.env.BASE_URL_SDK
  ? process.env.BASE_URL_SDK
  : "https://api.secure.payco.co";
const BASE_URL_SECURE = process.env.SECURE_URL_SDK
  ? process.env.SECURE_URL_SDK
  : "https://secure.payco.co";
const ENTORNO = process.env.ENTORNO_SDK
  ? process.env.ENTORNO_SDK
  : "/restpagos";
const BASE_URL_APIFY = process.env.BASE_URL_APIFY
  ? process.env.BASE_URL_APIFY
  : "https://apify.epayco.co";

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

Resource.prototype.request = async function (
  method,
  url,
  data,
  sw,
  cashData,
  card,
  apify,
) {
  const auth = await authent(
    this._epayco.apiKey,
    this._epayco.privateKey,
    apify,
  );
  const token_bearer = `Bearer ${auth.bearer_token || auth.token}`;
  data.extras_epayco = { extra5: "P44" };
  if (!card) {
    data.ip = data.ip || (await getIp());
    data.test = this._epayco.test;
  }
  if (sw || apify) {
    data = setData(
      data,
      this._epayco.privateKey,
      this._epayco.apiKey,
      this._epayco.test,
      cashData,
      apify,
    );
  }

  if (apify) {
    url = BASE_URL_APIFY + url;
  } else if (sw) {
    url = BASE_URL_SECURE + url;
  } else {
    url = BASE_URL + url;
  }

  const options = {
    method: method,
    url: url,
    headers: {
      "Content-Type": "application/json",
      type: "sdk-jwt",
      lang: "NODE",
      Authorization: token_bearer,
    },
  };

  const send = await sendData(options, data);

  return send;
};

function setData(data, privateKey, publicKey, test, cashData, apify) {
  const set = {};
  if (apify) {
    for (const key in data) {
      if (data) {
        set[langkeyApify(key)] = data[key];
      }
    }
  } else if (cashData) {
    for (const key in data) {
      if (data) {
        set[langkey(key)] = data[key];
      }
    }
    set.public_key = publicKey;
    set.i = "MDAwMDAwMDAwMDAwMDAwMA==";
    set.enpruebas = test;
    set.lenguaje = "javascript";
    set.p = "";
  } else {
    const hex = encryptHex(privateKey);
    for (const key in data) {
      if (data.hasOwnProperty(key) && key.includes("extras_epayco")) {
        set[langkey(key)] = { extra5: encrypt(data[key].extra5, privateKey) };
      } else {
        set[langkey(key)] = encrypt(data[key], privateKey);
      }
    }
    set.public_key = publicKey;
    set.i = hex.i;
    set.enpruebas = encrypt(test, privateKey);
    set.lenguaje = "javascript";
    set.p = hex.p;
  }
  return set;
}

/**
 * Traslate keys
 * @param  {string} value key eng
 * @return {string}       traslate key
 */
function langkey(value) {
  const obj = require("../keylang.json");
  if (obj[value]) {
    return obj[value];
  }
  return value;
}

function langkeyApify(value) {
  const obj = require("../keylang_apify.json");
  if (obj[value]) {
    return obj[value];
  }
  return value;
}

/**
 * Encrypt text
 * @param  {string} value plain text
 * @param  {string} key   private key user
 * @return {string}       text encrypt
 */
function encrypt(value, userKey) {
  const key = CryptoJS.enc.Hex.parse(userKey);
  const iv = CryptoJS.enc.Hex.parse("0000000000000000");
  const text = CryptoJS.AES.encrypt(value, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return text.ciphertext.toString(CryptoJS.enc.Base64);
}

/**
 * Get bites petition secure
 * @param  {string} userKey private key user
 * @return {object}         bites from crypto-js
 */
function encryptHex(userKey) {
  const key = CryptoJS.enc.Hex.parse(userKey);
  const iv = CryptoJS.enc.Hex.parse("0000000000000000");
  return {
    i: iv.toString(CryptoJS.enc.Base64),
    p: key.toString(CryptoJS.enc.Base64),
  };
}

/**
 * Get ip from server
 * @return {string} Server id
 */
const getIp = async () => {
  const ip = await fetch("https://api.ipify.org?format=json")
    .then((response) => response.json())
    .then((data) => {
      return data.ip;
    })
    .catch((error) => {
      console.log("Error:", error);
    });
  return ip;
};

function authent(apiKey, privateKey, apify) {
  let params = {
    public_key: apiKey,
    private_key: privateKey,
  };
  const url = apify ? `${BASE_URL_APIFY}/login` : `${BASE_URL}/v1/auth/login`;

  const headers = { "Content-Type": "application/json" };
  if (apify) {
    const encoded = CryptoJS.enc.Utf8.parse(`${apiKey}:${privateKey}`);
    const token = CryptoJS.enc.Base64.stringify(encoded);
    headers.Authorization = `Basic ${token};`;
    params = {};
  }
  return fetch(url, {
    method: "post",
    body: JSON.stringify(params),
    headers,
  })
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.error(err));
}

function sendData(options, data) {
  if (options.method === "post") {
    const bodysend = data;
    return fetch(options.url, {
      method: options.method,
      body: JSON.stringify(bodysend),
      headers: options.headers,
    })
      .then((res) => res.json())
      .then((json) => json)
      .catch((err) => console.error(err));
  }
  return fetch(options.url, {
    method: options.method,
    headers: options.headers,
  })
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.error(err));
}

/**
 * Expose constructor
 */
module.exports = Resource;
