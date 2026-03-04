import { vi } from "vitest";

import { Epayco } from "../src/index";

export function createTestClient(): Epayco {
  return new Epayco({
    apiKey: "test_public_key_abc123",
    privateKey: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    test: true,
    lang: "EN",
  });
}

export function mockFetch(response: unknown = {}): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(response),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}
