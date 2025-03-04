import Resource from './';
import { GenericObject } from '../types';

class Daviplata extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Trx Daviplata
     * @param {Object} options
     * @api public
     */
    public async create(options: GenericObject): Promise<any> {
        return this.request('post', '/payment/process/daviplata', options, false, false, true, true);
    }

    /**
     * Confirm Daviplata
     * @param {Object} options
     * @api public
     */
    public async confirm(options: GenericObject): Promise<any> {
        return this.request('post', '/payment/confirm/daviplata', options, false, false, true, true);
    }
}

export default Daviplata; 