export type EpaycoConfig = {
  apiKey: string;
  privateKey: string;
  lang?: "ES" | "EN";
  test?: boolean;
};

export type TokenCard = {
  card_number: string;
  card_exp_year: string;
  card_exp_month: string;
  card_cvc: string;
};

export type Customer = {
  token_card: string;
  name: string;
  email: string;
  phone?: string;
  default?: boolean;
};

export type Plan = {
  id_plan: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  trial_days?: number;
};

export type Subscription = {
  id_plan: string;
  customer: string;
  token_card: string;
  doc_type?: string;
  doc_number?: string;
  url_confirmation?: string;
};

export type Payment = {
  token_card: string;
  customer_id: string;
  doc_type?: string;
  doc_number?: string;
  name?: string;
  last_name?: string;
  email?: string;
  bill?: string;
  description?: string;
  value: number;
  tax?: number;
  tax_base?: number;
  currency: string;
  dues?: number;
  ip?: string;
  url_response?: string;
  url_confirmation?: string;
  method_confirmation?: string;
};
