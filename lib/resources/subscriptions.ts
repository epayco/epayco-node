import Resource from './';
import { GenericObject } from '../types';

class Subscriptions extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Subscription
     * @param {Object} options
     * @api public
     */
    public async create(options: GenericObject): Promise<any> {
        return this.request('post', '/recurring/v1/subscription/create', options, false);
    }

    /**
     * Retrieve Subscription
     * @param {String} uid
     * @api public
     */
    public async get(uid: string): Promise<any> {
        return this.request('get', `/recurring/v1/subscription/${uid}/${this._epayco.apiKey}`, {}, false);
    }

    /**
     * List Subscriptions
     * @api public
     */
    public async list(): Promise<any> {
        return this.request('get', `/recurring/v1/subscriptions/${this._epayco.apiKey}`, {}, false);
    }

    /**
     * Cancel Subscription
     * @param {String} uid
     * @api public
     */
    public async cancel(uid: string): Promise<any> {
        const options = {
            id: uid,
            public_key: this._epayco.apiKey
        };
        return this.request('post', "/recurring/v1/subscription/cancel", options, false);
    }

    /**
     * Charge Subscription
     * @param {Object} options
     * @api public
     */
    public async charge(options: GenericObject): Promise<any> {
        return this.request('post', "/payment/v1/charge/subscription/create", options, false);
    }
}

export default Subscriptions; 