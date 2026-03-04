import { Resource } from "@/resources/resource";
import type {
  ApiResponse,
  DaviplataConfirmOptions,
  DaviplataCreateOptions,
} from "@/types";

export class Daviplata extends Resource {
  create(options: DaviplataCreateOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/payment/process/daviplata",
      options as Record<string, unknown>,
      false,
      false,
      true,
      true,
    );
  }

  confirm(options: DaviplataConfirmOptions): Promise<ApiResponse> {
    return this.request(
      "post",
      "/payment/confirm/daviplata",
      options as Record<string, unknown>,
      false,
      false,
      true,
      true,
    );
  }
}
