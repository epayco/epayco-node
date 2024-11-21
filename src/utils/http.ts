import type { EpaycoConfig } from "@/types";
import { CryptoHelper } from "./crypto";

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class HttpClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private crypto: CryptoHelper;

  constructor(config: EpaycoConfig) {
    this.crypto = new CryptoHelper(config);
    this.baseUrl = config.test
      ? "https://api.secure.payco.co/test"
      : "https://api.secure.payco.co";
    this.headers = {
      "Content-Type": "application/json",
      Authorization: this.crypto.createAuthToken(),
      type: "sdk",
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      throw new HttpError(
        data.message || "Request failed",
        response.status,
        data,
      );
    }

    return data as T;
  }

  public async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(params)}` : "";

    const response = await fetch(`${this.baseUrl}${url}${queryString}`, {
      method: "GET",
      headers: this.headers,
    });

    return this.handleResponse<T>(response);
  }

  public async post<T>(url: string, data: Record<string, any>): Promise<T> {
    const signature = this.crypto.createSignature(data);

    const response = await fetch(`${this.baseUrl}${url}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        ...data,
        signature,
      }),
    });

    return this.handleResponse<T>(response);
  }
}
