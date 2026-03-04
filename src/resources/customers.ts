import { Resource } from "@/resources/resource";
import type {
  ApiResponse,
  CustomerAddDefaultCardOptions,
  CustomerAddNewTokenOptions,
  CustomerCreateOptions,
  CustomerDeleteOptions,
  CustomerUpdateOptions,
} from "@/types";

export class Customers extends Resource {
  create(options: CustomerCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/payment/v1/customer/create",
      options as Record<string, unknown>,
    );
  }

  get(uid: string): Promise<ApiResponse> {
    return this.request(
      "get",
      `/payment/v1/customer/${this._epayco.apiKey}/${uid}`,
      {},
    );
  }

  list(): Promise<ApiResponse> {
    return this.request(
      "get",
      `/payment/v1/customers/${this._epayco.apiKey}`,
      {},
    );
  }

  update(uid: string, options: CustomerUpdateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      `/payment/v1/customer/edit/${this._epayco.apiKey}/${uid}`,
      options as Record<string, unknown>,
    );
  }

  delete(options: CustomerDeleteOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/v1/remove/token",
      options as Record<string, unknown>,
    );
  }

  addDefaultCard(options: CustomerAddDefaultCardOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/payment/v1/customer/reasign/card/default",
      options as Record<string, unknown>,
      false,
      false,
      true,
    );
  }

  addNewToken(options: CustomerAddNewTokenOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/v1/customer/add/token",
      options as Record<string, unknown>,
      false,
      false,
      true,
    );
  }
}
