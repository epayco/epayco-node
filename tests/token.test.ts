import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, mockFetch } from "./setup";

describe("Token", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({ token: "test_bearer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls create with correct URL", async () => {
    const client = createTestClient();
    await client.token.create({
      "card[number]": "4575623182290326",
      "card[exp_year]": "2025",
      "card[exp_month]": "07",
      "card[cvc]": "123",
    });

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    const tokenCall = calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/v1/tokens"),
    );
    expect(tokenCall).toBeDefined();
  });
});
