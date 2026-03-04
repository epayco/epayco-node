import { Resource } from "@/resources/resource";
import type {
  ApiResponse,
  SubscriptionChargeOptions,
  SubscriptionCreateOptions,
} from "@/types";

export class Subscriptions extends Resource {
  create(options: SubscriptionCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/recurring/v1/subscription/create",
      options as Record<string, unknown>,
    );
  }

  get(uid: string): Promise<ApiResponse> {
    return this.request(
      "get",
      `/recurring/v1/subscription/${uid}/${this._epayco.apiKey}`,
      {},
    );
  }

  list(): Promise<ApiResponse> {
    return this.request(
      "get",
      `/recurring/v1/subscriptions/${this._epayco.apiKey}`,
      {},
    );
  }

  cancel(uid: string): Promise<ApiResponse> {
    return this.request("post", "/recurring/v1/subscription/cancel", {
      id: uid,
      public_key: this._epayco.apiKey,
    });
  }

  charge(options: SubscriptionChargeOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/payment/v1/charge/subscription/create",
      options as Record<string, unknown>,
    );
  }
}
