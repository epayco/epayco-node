import { Resource } from "@/resources/resource";
import type { ApiResponse, BankCreateOptions } from "@/types";

export class Bank extends Resource {
  create(options: BankCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/restpagos/pagos/debitos.json",
      options as Record<string, unknown>,
      true,
    );
  }

  get(uid: string): Promise<ApiResponse> {
    return this.request(
      "get",
      `/restpagos/pse/transactioninfomation.json?transactionID=${uid}&&public_key=${this._epayco.apiKey}`,
      {},
      true,
    );
  }

  getBanks(): Promise<ApiResponse> {
    return this.request(
      "get",
      `/restpagos/pse/bancos.json?public_key=${this._epayco.apiKey}`,
      {},
      true,
    );
  }
}
