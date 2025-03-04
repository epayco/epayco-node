export interface EpaycoOptions {
    apiKey: string;
    privateKey: string;
    test: boolean;
    lang?: string;
}

export interface RequestOptions {
    method: string;
    url: string;
    headers: {
        'Content-Type': string;
        type: string;
        lang: string;
        Authorization: string;
    }
}

export interface GenericObject {
    [key: string]: any;
}

export interface EpaycoTokenResult {
    status:  boolean;
    id:      string;
    success: boolean;
    type:    string;
    data:    Data;
    card:    Card;
    object:  string;
}

export interface Card {
    exp_month: string;
    exp_year:  string;
    name:      string;
    mask:      string;
}

export interface Data {
    status:   string;
    id:       string;
    created:  string;
    livemode: boolean;
}
