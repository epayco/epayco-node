import * as CryptoJS from 'crypto-js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { GenericObject, RequestOptions } from '../types';

dotenv.config();

const BASE_URL = process.env.BASE_URL_SDK || "https://api.secure.payco.co";
const BASE_URL_SECURE = process.env.SECURE_URL_SDK || "https://secure.payco.co";
const ENTORNO = process.env.ENTORNO_SDK || "/restpagos";
const BASE_URL_APIFY = process.env.BASE_URL_APIFY || "https://apify.epayco.co";

// Funciones auxiliares
async function getIp(): Promise<string> {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
}

function encrypt(value: string, userKey: string): string {
    const key = CryptoJS.enc.Hex.parse(userKey);
    const iv = CryptoJS.enc.Hex.parse("0000000000000000");
    const text = CryptoJS.AES.encrypt(value, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return text.ciphertext.toString(CryptoJS.enc.Base64);
}

async function authent(apiKey: string, privateKey: string, apify: boolean): Promise<any> {
    const params = apify ? {} : {
        public_key: apiKey,
        private_key: privateKey,
    };

    const url = apify ?
        BASE_URL_APIFY + "/login" :
        BASE_URL + "/v1/auth/login";

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (apify) {
        const encoded = CryptoJS.enc.Utf8.parse(`${apiKey}:${privateKey}`);
        const token = CryptoJS.enc.Base64.stringify(encoded);
        headers['Authorization'] = `Basic ${token}`;
    }

    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(params),
        headers,
    });
    return response.json();
}

function setData(
    data: GenericObject,
    privateKey: string,
    publicKey: string,
    test: string,
    cashData: boolean,
    apify: boolean
): GenericObject {
    // ... implementación de setData
    return {}; // Implementar la lógica real aquí
}

async function sendData(options: RequestOptions, data: GenericObject): Promise<any> {
    const response = await fetch(options.url, {
        method: options.method,
        body: options.method === 'post' ? JSON.stringify(data) : undefined,
        headers: options.headers,
    });
    return response.json();
}

class Resource {
    protected _epayco: any;

    constructor(epayco: any) {
        this._epayco = epayco;
    }

    protected async request(
        method: string,
        url: string,
        data: GenericObject,
        sw: boolean = false,
        cashData: boolean = false,
        card: boolean = false,
        apify: boolean = false
    ): Promise<any> {
        const auth = await authent(this._epayco.apiKey, this._epayco.privateKey, apify);
        const token_bearer = 'Bearer ' + (auth['bearer_token'] || auth['token']);

        data.extras_epayco = { extra5: "P44" };

        if (!card) {
            data.ip = data.ip || await getIp();
            data.test = this._epayco.test;
        }

        if (sw || apify) {
            data = setData(data, this._epayco.privateKey, this._epayco.apiKey, this._epayco.test, cashData, apify);
        }

        url = apify ? BASE_URL_APIFY + url :
            sw ? BASE_URL_SECURE + url :
                BASE_URL + url;

        const options: RequestOptions = {
            method,
            url,
            headers: {
                'Content-Type': 'application/json',
                'type': 'sdk-jwt',
                'lang': 'NODE',
                'Authorization': token_bearer
            }
        };

        return sendData(options, data);
    }
}

export default Resource;