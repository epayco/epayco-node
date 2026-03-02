export type Lang = "ES" | "EN";

export type HttpMethod = "get" | "post";

export type ErrorCode =
  | "100"
  | "101"
  | "102"
  | "103"
  | "104"
  | "105"
  | "106"
  | "107"
  | "108"
  | "109";

export interface EpaycoOptions {
  apiKey: string;
  privateKey: string;
  test: boolean;
  lang?: Lang;
}

export interface EpaycoConfig {
  apiKey: string;
  privateKey: string;
  test: "TRUE" | "FALSE";
  lang: Lang;
}

export interface AuthResponse {
  bearer_token?: string;
  token?: string;
}

export interface ApiResponse {
  [key: string]: unknown;
}

export interface TokenCreateOptions {
  "card[number]": string;
  "card[exp_year]": string;
  "card[exp_month]": string;
  "card[cvc]": string;
  [key: string]: unknown;
}

export interface CustomerCreateOptions {
  token_card: string;
  name: string;
  email: string;
  phone: string;
  default: boolean;
  [key: string]: unknown;
}

export interface CustomerUpdateOptions {
  name?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface CustomerDeleteOptions {
  franchise: string;
  mask: string;
  customer_id: string;
  [key: string]: unknown;
}

export interface CustomerAddDefaultCardOptions {
  customer_id: string;
  token: string;
  franchise: string;
  mask: string;
  [key: string]: unknown;
}

export interface CustomerAddNewTokenOptions {
  customer_id: string;
  token_card: string;
  [key: string]: unknown;
}

export interface PlanCreateOptions {
  id_plan: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  trial_days: number;
  [key: string]: unknown;
}

export interface SubscriptionCreateOptions {
  id_plan: string;
  customer: string;
  token_card: string;
  doc_type: string;
  doc_number: string;
  [key: string]: unknown;
}

export interface SubscriptionChargeOptions {
  id_plan: string;
  customer: string;
  token_card: string;
  doc_type: string;
  doc_number: string;
  [key: string]: unknown;
}

export interface BankCreateOptions {
  bank: string;
  invoice: string;
  description: string;
  value: string;
  tax: string;
  tax_base: string;
  currency: string;
  type_person: string;
  doc_type: string;
  doc_number: string;
  name: string;
  last_name: string;
  email: string;
  country: string;
  cell_phone: string;
  url_response: string;
  url_confirmation: string;
  method_confirmation: string;
  [key: string]: unknown;
}

export type CashProvider =
  | "efecty"
  | "baloto"
  | "gana"
  | "redservi"
  | "puntored"
  | "sured";

export interface CashCreateOptions {
  invoice: string;
  description: string;
  value: string;
  tax: string;
  tax_base: string;
  currency: string;
  type_person: string;
  doc_type: string;
  doc_number: string;
  name: string;
  last_name: string;
  email: string;
  cell_phone: string;
  end_date: string;
  url_response: string;
  url_confirmation: string;
  method_confirmation: string;
  [key: string]: unknown;
}

export interface ChargeCreateOptions {
  token_card: string;
  customer_id: string;
  doc_type: string;
  doc_number: string;
  name: string;
  last_name: string;
  email: string;
  bill: string;
  description: string;
  value: string;
  tax: string;
  tax_base: string;
  currency: string;
  dues: string;
  [key: string]: unknown;
}

export interface DaviplataCreateOptions {
  doc_type: string;
  doc_number: string;
  name: string;
  last_name: string;
  email: string;
  ind_country: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  ip: string;
  currency: string;
  invoice: string;
  description: string;
  value: string;
  tax: string;
  tax_base: string;
  ico: string;
  test: string;
  url_response: string;
  url_confirmation: string;
  method_confirmation: string;
  [key: string]: unknown;
}

export interface DaviplataConfirmOptions {
  ref_payco: string;
  id_session_token: string;
  otp: string;
  [key: string]: unknown;
}

export interface SafetypayCreateOptions {
  cash: string;
  end_date: string;
  doc_type: string;
  doc_number: string;
  name: string;
  last_name: string;
  email: string;
  ind_country: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  ip: string;
  currency: string;
  invoice: string;
  description: string;
  value: string;
  tax: string;
  tax_base: string;
  ico: string;
  test: string;
  url_response: string;
  url_confirmation: string;
  method_confirmation: string;
  [key: string]: unknown;
}
