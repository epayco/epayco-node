import Debug from 'debug';
const debug = Debug('epayco:api');

import Token from './resources/token';
import Customers from './resources/customers';
import Subscriptions from './resources/subscriptions';
import Bank from './resources/bank';
import Cash from './resources/cash';
import Charge from './resources/charge';
import Plans from './resources/plans';
import Safetypay from './resources/safetypay';
import Daviplata from './resources/daviplata';
import { EpaycoError } from './resources/errors';
import { EpaycoOptions } from './types';

class Epayco {
    private apiKey: string;
    private privateKey: string;
    private lang: string;
    private test: string;

    public token: Token;
    public customers: Customers;
    public plans: Plans;
    public subscriptions: Subscriptions;
    public bank: Bank;
    public cash: Cash;
    public charge: Charge;
    public safetypay: Safetypay;
    public daviplata: Daviplata;

    constructor(options: EpaycoOptions) {
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

        this.apiKey = options.apiKey;
        this.privateKey = options.privateKey;
        this.lang = options.lang;
        this.test = options.test ? 'TRUE' : 'FALSE';

        this.token = new Token(this);
        this.customers = new Customers(this);
        this.plans = new Plans(this);
        this.subscriptions = new Subscriptions(this);
        this.bank = new Bank(this);
        this.cash = new Cash(this);
        this.charge = new Charge(this);
        this.safetypay = new Safetypay(this);
        this.daviplata = new Daviplata(this);
    }
}

export default Epayco;