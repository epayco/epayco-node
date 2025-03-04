import Resource from './';
import { GenericObject } from '../types';

class Plans extends Resource {
    constructor(epayco: any) {
        super(epayco);
    }

    /**
     * Create Plans
     * @param {Object} options
     * @api public
     */
    public async create(options: GenericObject): Promise<any> {
        return this.request('post', '/recurring/v1/plan/create', options, false);
    }

    /**
     * Retrieve Plan
     * @param {String} uid
     * @api public
     */
    public async get(uid: string): Promise<any> {
        return this.request('get', `/recurring/v1/plan/${this._epayco.apiKey}/${uid}`, {}, false);
    }

    /**
     * List Plans
     * @api public
     */
    public async list(): Promise<any> {
        return this.request('get', `/recurring/v1/plans/${this._epayco.apiKey}`, {}, false);
    }

    /**
     * Remove Plan
     * @param {String} uid
     * @api public
     */
    public async delete(uid: string): Promise<any> {
        return this.request('post', `/recurring/v1/plan/remove/${this._epayco.apiKey}/${uid}`, {}, false);
    }
}

export default Plans; 