import Resource from './';
import { EpaycoTokenResult, CreditCardInfo } from '../types';

class Token extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Token
     * @param {Object} options
     * @api public
     */
    public async create(options: CreditCardInfo): Promise<EpaycoTokenResult> {
        return this.request('post', '/v1/tokens', options, false);
    }
}

export default Token;