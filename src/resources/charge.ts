import { Resource } from "@/resources/resource";
import type { ApiResponse, ChargeCreateOptions } from "@/types";

export class Charge extends Resource {
  create(options: ChargeCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/payment/v1/charge/create",
      options as Record<string, unknown>,
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
