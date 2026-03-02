import { BASE_URL, BASE_URL_APIFY, BASE_URL_SECURE } from "@/constants";
import { encrypt, encryptHex } from "@/crypto";
import { authenticate, getIp, sendRequest } from "@/http";
import { langkey, langkeyApify } from "@/keylang";
import type { ApiResponse, EpaycoConfig, HttpMethod } from "@/types";

export abstract class Resource {
  protected readonly _epayco: EpaycoConfig;

  constructor(epayco: EpaycoConfig) {
    this._epayco = epayco;
  }

  protected async request<T = ApiResponse>(
    method: HttpMethod,
    url: string,
    data: Record<string, unknown>,
    sw = false,
    cashData = false,
    card = false,
    apify = false,
  ): Promise<T> {
    const auth = await authenticate(
      this._epayco.apiKey,
      this._epayco.privateKey,
      apify,
    );
    const tokenBearer = `Bearer ${auth.bearer_token ?? auth.token}`;

    data.extras_epayco = { extra5: "P44" };

    if (!card) {
      data.ip = data.ip ?? (await getIp());
      data.test = this._epayco.test;
    }

    let body: Record<string, unknown> = data;

    if (sw || apify) {
      body = this.setData(data, cashData, apify);
    }

    let fullUrl: string;
    if (apify) {
      fullUrl = BASE_URL_APIFY + url;
    } else if (sw) {
      fullUrl = BASE_URL_SECURE + url;
    } else {
      fullUrl = BASE_URL + url;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      type: "sdk-jwt",
      lang: "NODE",
      Authorization: tokenBearer,
    };

    return sendRequest(method, fullUrl, headers, body) as Promise<T>;
  }

  private setData(
    data: Record<string, unknown>,
    cashData: boolean,
    apify: boolean,
  ): Record<string, unknown> {
    const set: Record<string, unknown> = {};

    if (apify) {
      for (const key in data) {
        set[langkeyApify(key)] = data[key];
      }
    } else if (cashData) {
      for (const key in data) {
        set[langkey(key)] = data[key];
      }
      set.public_key = this._epayco.apiKey;
      set.i = "MDAwMDAwMDAwMDAwMDAwMA==";
      set.enpruebas = this._epayco.test;
      set.lenguaje = "javascript";
      set.p = "";
    } else {
      const hex = encryptHex(this._epayco.privateKey);
      for (const key in data) {
        if (Object.hasOwn(data, key)) {
          if (key.includes("extras_epayco")) {
            const extras = data[key] as Record<string, string>;
            set[langkey(key)] = {
              extra5: encrypt(extras.extra5, this._epayco.privateKey),
            };
          } else {
            set[langkey(key)] = encrypt(data[key], this._epayco.privateKey);
          }
        }
      }
      set.public_key = this._epayco.apiKey;
      set.i = hex.i;
      set.enpruebas = encrypt(this._epayco.test, this._epayco.privateKey);
      set.lenguaje = "javascript";
      set.p = hex.p;
    }

    return set;
  }
}
