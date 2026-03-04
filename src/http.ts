import { BASE_URL, BASE_URL_APIFY } from "@/constants";
import { encodeBasicAuth } from "@/crypto";
import type { AuthResponse, HttpMethod } from "@/types";

export async function authenticate(
  apiKey: string,
  privateKey: string,
  apify?: boolean,
): Promise<AuthResponse> {
  const url = apify ? `${BASE_URL_APIFY}/login` : `${BASE_URL}/v1/auth/login`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let body: string;

  if (apify) {
    const token = encodeBasicAuth(apiKey, privateKey);
    headers.Authorization = `Basic ${token};`;
    body = JSON.stringify({});
  } else {
    body = JSON.stringify({
      public_key: apiKey,
      private_key: privateKey,
    });
  }

  const res = await fetch(url, {
    method: "post",
    body,
    headers,
  });

  return res.json() as Promise<AuthResponse>;
}

export async function sendRequest(
  method: HttpMethod,
  url: string,
  headers: Record<string, string>,
  data?: Record<string, unknown>,
): Promise<unknown> {
  const options: RequestInit = {
    method,
    headers,
  };

  if (method === "post" && data) {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);
  return res.json();
}

export async function getIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = (await res.json()) as { ip: string };
    return data.ip;
  } catch {
    return "";
  }
}
