import { Resource } from "@/resources/resource";
import type { ApiResponse, SafetypayCreateOptions } from "@/types";

export class Safetypay extends Resource {
  create(options: SafetypayCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/payment/process/safetypay",
      options as Record<string, unknown>,
      false,
      false,
      true,
      true,
    );
  }
}
