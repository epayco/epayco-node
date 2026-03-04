import { Resource } from "@/resources/resource";
import type { ApiResponse, PlanCreateOptions } from "@/types";

export class Plans extends Resource {
  create(options: PlanCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/recurring/v1/plan/create",
      options as Record<string, unknown>,
    );
  }

  get(uid: string): Promise<ApiResponse> {
    return this.request(
      "get",
      `/recurring/v1/plan/${this._epayco.apiKey}/${uid}`,
      {},
    );
  }

  list(): Promise<ApiResponse> {
    return this.request(
      "get",
      `/recurring/v1/plans/${this._epayco.apiKey}`,
      {},
    );
  }

  delete(uid: string): Promise<ApiResponse> {
    return this.request(
      "post",
      `/recurring/v1/plan/remove/${this._epayco.apiKey}/${uid}`,
      {},
    );
  }
}
