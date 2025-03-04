import Resource from './';
import { CustomerInfo, GenericObject } from '../types';

class Customers extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Customer
     * @param {Object} options
     * @api public
     */
    public async create(options: CustomerInfo): Promise<any> {
        return this.request('post', '/payment/v1/customer/create', options, false);
    }

    /**
     * Retrieve Customer
     * @param {String} uid
     * @api public
     */
    public async get(uid: string): Promise<any> {
        return this.request('get', `/payment/v1/customer/${this._epayco.apiKey}/${uid}`, {}, false);
    }

    /**
     * List Customers
     * @api public
     */
    public async list(): Promise<any> {
        return this.request('get', `/payment/v1/customers/${this._epayco.apiKey}`, {}, false);
    }

    /**
     * Update Customer
     * @param {String} uid
     * @param {Object} options
     * @api public
     */
    public async update(uid: string, options: GenericObject): Promise<any> {
        return this.request('post', `/payment/v1/customer/edit/${this._epayco.apiKey}/${uid}`, options, false);
    }

    /**
     * Delete Customer
     * @param {Object} options
     * @api public
     */
    public async delete(options: GenericObject): Promise<any> {
        return this.request('post', "/v1/remove/token", options, false);
    }

    /**
     * Add default card
     * @param {Object} options
     * @api public
     */
    public async addDefaultCard(options: GenericObject): Promise<any> {
        return this.request('post', "/payment/v1/customer/reasign/card/default", options, false, false, true);
    }

    /**
     * Add new token
     * @param {Object} options
     * @api public
     */
    public async addNewToken(options: GenericObject): Promise<any> {
        return this.request('post', "/v1/customer/add/token", options, false, false, true);
    }
}

export default Customers; 