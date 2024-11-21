import { createHmac } from "node:crypto";

import type { EpaycoConfig } from "@/types";

export class CryptoHelper {
  private config: EpaycoConfig;

  constructor(config: EpaycoConfig) {
    this.config = config;
  }

  public createAuthToken(): string {
    const auth = Buffer.from(`${this.config.apiKey}:`).toString("base64");

    return `Basic ${auth}`;
  }

  public createSignature(data: Record<string, unknown>): string {
    const keys = Object.keys(data).sort();
    const signString = keys.map((key) => data[key]).join("");

    return createHmac("sha256", this.config.privateKey)
      .update(signString)
      .digest("hex");
  }
}
