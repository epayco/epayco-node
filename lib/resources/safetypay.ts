import Resource from './';
import { GenericObject } from '../types';

class Safetypay extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Safetypay Transaction
     * @param {Object} options
     * @api public
     */
    public async create(options: GenericObject): Promise<any> {
        return this.request('post', '/payment/process/safetypay', options, false, false, true, true);
    }
}

export default Safetypay; 