import Resource from './';
import { GenericObject } from '../types';

class Charge extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Charge
     * @param {Object} options
     * @api public
     */
    public async create(options: GenericObject): Promise<any> {
        return this.request('post', '/payment/v1/charge/create', options, false);
    }

    /**
     * Retrieve Transaction
     * @param {String} uid
     * @api public
     */
    public async get(uid: string): Promise<any> {
        return this.request(
            'get', 
            `/restpagos/transaction/response.json?ref_payco=${uid}&&public_key=${this._epayco.apiKey}`, 
            {}, 
            true
        );
    }
}

export default Charge; 