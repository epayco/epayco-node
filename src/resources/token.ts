import { Resource } from "@/resources/resource";
import type { ApiResponse, TokenCreateOptions } from "@/types";

export class Token extends Resource {
  create(options: TokenCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/v1/tokens",
      options as Record<string, unknown>,
    );
  }
}
