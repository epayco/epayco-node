import Resource from './';
import { EpaycoTokenResult, GenericObject } from '../types';

class Token extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Token
     * @param {Object} options
     * @api public
     */
    public async create(options: GenericObject): Promise<EpaycoTokenResult> {
        return this.request('post', '/v1/tokens', options, false);
    }
}

export default Token;