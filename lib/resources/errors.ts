import { readFileSync } from 'fs';
import { join } from 'path';

interface ErrorMessages {
    [key: string]: {
        ES: string;
        EN: string;
    }
}

export class EpaycoError extends Error {
    constructor(lang: 'ES' | 'EN', code: number) {
        const errors: ErrorMessages = JSON.parse(
            readFileSync(join(__dirname, '../errors.json'), 'utf8')
        );
        
        super(errors[code][lang]);
        this.name = 'EpaycoError';
        Error.captureStackTrace(this, EpaycoError);
    }
} 