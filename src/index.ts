import { EpaycoError } from "@/errors";
import {
  Bank,
  Cash,
  Charge,
  Customers,
  Daviplata,
  Plans,
  Safetypay,
  Subscriptions,
  Token,
} from "@/resources/index";
import type { EpaycoConfig, EpaycoOptions } from "@/types";

export class Epayco {
  readonly apiKey: string;
  readonly privateKey: string;
  readonly lang: EpaycoConfig["lang"];
  readonly test: EpaycoConfig["test"];

  readonly token: Token;
  readonly customers: Customers;
  readonly plans: Plans;
  readonly subscriptions: Subscriptions;
  readonly bank: Bank;
  readonly cash: Cash;
  readonly charge: Charge;
  readonly safetypay: Safetypay;
  readonly daviplata: Daviplata;

  constructor(options: EpaycoOptions) {
    const lang = options.lang ?? "ES";

    if (!["ES", "EN"].includes(lang)) {
      throw new Error(`LANG: ${lang} is invalid`);
    }

    if (
      typeof options.apiKey !== "string" ||
      typeof options.privateKey !== "string" ||
      typeof options.test !== "boolean"
    ) {
      throw new EpaycoError(lang, "100");
    }

    this.apiKey = options.apiKey;
    this.privateKey = options.privateKey;
    this.lang = lang;
    this.test = options.test ? "TRUE" : "FALSE";

    const config: EpaycoConfig = {
      apiKey: this.apiKey,
      privateKey: this.privateKey,
      lang: this.lang,
      test: this.test,
    };

    this.token = new Token(config);
    this.customers = new Customers(config);
    this.plans = new Plans(config);
    this.subscriptions = new Subscriptions(config);
    this.bank = new Bank(config);
    this.cash = new Cash(config);
    this.charge = new Charge(config);
    this.safetypay = new Safetypay(config);
    this.daviplata = new Daviplata(config);
  }
}

export function createEpayco(options: EpaycoOptions): Epayco {
  return new Epayco(options);
}

export default createEpayco;

export { EpaycoError } from "@/errors";
export type * from "@/types";
