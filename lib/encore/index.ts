import Debug from 'debug';
const debug = Debug('epayco:api');

import Token from '../resources/token';
import Customers from '../resources/customers';
import Subscriptions from '../resources/subscriptions';
import Bank from '../resources/bank';
import Cash from '../resources/cash';
import Charge from '../resources/charge';
import Plans from '../resources/plans';
import Safetypay from '../resources/safetypay';
import Daviplata from '../resources/daviplata';
import { EpaycoError } from '../resources/errors';
import { EpaycoOptions } from '../types';

interface EpaycoInstance {
  token: Token;
  customers: Customers;
  plans: Plans;
  subscriptions: Subscriptions;
  bank: Bank;
  cash: Cash;
  charge: Charge;
  safetypay: Safetypay;
  daviplata: Daviplata;
}

const Epayco = (options: EpaycoOptions): EpaycoInstance => {
  if (!options.lang || typeof options.lang !== 'string') {
    options.lang = 'ES';
  }

  if (!['ES', 'EN'].includes(options.lang)) {
    throw new Error(`LANG: ${options.lang} is invalid`);
  }

  if (
    typeof options.apiKey !== 'string' ||
    typeof options.privateKey !== 'string' ||
    typeof options.test !== 'boolean'
  ) {
    throw new EpaycoError(options.lang as 'ES' | 'EN', 100);
  }

  const instance = {
    apiKey: options.apiKey,
    privateKey: options.privateKey,
    lang: options.lang,
    test: options.test ? 'TRUE' : 'FALSE'
  };

  return {
    token: new Token(instance),
    customers: new Customers(instance),
    plans: new Plans(instance),
    subscriptions: new Subscriptions(instance),
    bank: new Bank(instance),
    cash: new Cash(instance),
    charge: new Charge(instance),
    safetypay: new Safetypay(instance),
    daviplata: new Daviplata(instance)
  };
};

export default Epayco;