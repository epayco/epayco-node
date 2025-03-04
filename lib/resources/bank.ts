import Resource from './';
import { GenericObject } from '../types';

class Bank extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Bank Debit
     * @param {Object} options
     * @api public
     */
    public async create(options: GenericObject): Promise<any> {
        return this.request('post', '/restpagos/pagos/debitos.json', options, true);
    }

    /**
     * Retrieve Transaction
     * @param {String} uid
     * @api public
     */
    public async get(uid: string): Promise<any> {
        return this.request(
            'get', 
            `/restpagos/pse/transactioninfomation.json?transactionID=${uid}&&public_key=${this._epayco.apiKey}`, 
            {}, 
            true
        );
    }

    /**
     * Get Banks List
     */
    public async getBanks(): Promise<any> {
        return this.request(
            'get', 
            `/restpagos/pse/bancos.json?public_key=${this._epayco.apiKey}`, 
            {}, 
            true
        );
    }
}

export default Bank; 