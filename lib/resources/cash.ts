import Resource from './';
import { EpaycoError } from './errors';
import { GenericObject } from '../types';

type CashType = 'efecty' | 'baloto' | 'gana' | 'redservi' | 'puntored' | 'sured';

class Cash extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Cash Payment
     * @param {CashType} type
     * @param {Object} options
     * @api public
     */
    public async create(type: CashType, options: GenericObject): Promise<any> {
        let url: string;
        
        switch (type) {
            case "efecty":
                url = "/restpagos/v2/efectivo/efecty";
                break;
            case "baloto":
                url = "/restpagos/v2/efectivo/baloto";
                break;
            case "gana":
                url = "/restpagos/v2/efectivo/gana";
                break;
            case "redservi":
                url = "/restpagos/v2/efectivo/redservi";
                break;
            case "puntored":
                url = "/restpagos/v2/efectivo/puntored";
                break;
            case "sured":
                url = "/restpagos/v2/efectivo/sured";
                break;
            default:
                throw new EpaycoError(this._epayco.lang, 109);
        }

        return this.request('post', url, options, true, true);
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

export default Cash; 