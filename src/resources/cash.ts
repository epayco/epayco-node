import { EpaycoError } from "@/errors";
import { Resource } from "@/resources/resource";
import type { ApiResponse, CashCreateOptions, CashProvider } from "@/types";

const CASH_URLS: Record<CashProvider, string> = {
  efecty: "/restpagos/v2/efectivo/efecty",
  baloto: "/restpagos/v2/efectivo/baloto",
  gana: "/restpagos/v2/efectivo/gana",
  redservi: "/restpagos/v2/efectivo/redservi",
  puntored: "/restpagos/v2/efectivo/puntored",
  sured: "/restpagos/v2/efectivo/sured",
};

export class Cash extends Resource {
  create(type: CashProvider, options: CashCreateOptions): Promise<ApiResponse> {
    const url = CASH_URLS[type];
    if (!url) {
      throw new EpaycoError(this._epayco.lang, "109");
    }
    return this.request(
      "post",
      url,
      options as Record<string, unknown>,
      true,
      true,
    );
  }

  get(uid: string): Promise<ApiResponse> {
    return this.request(
      "get",
      `/restpagos/transaction/response.json?ref_payco=${uid}&&public_key=${this._epayco.apiKey}`,
      {},
      true,
    );
  }
}
