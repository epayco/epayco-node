import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, mockFetch } from "./setup";

describe("Subscriptions", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({ token: "test_bearer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls create", async () => {
    const client = createTestClient();
    await client.subscriptions.create({
      id_plan: "plan_123",
      customer: "cust_123",
      token_card: "tok_123",
      doc_type: "CC",
      doc_number: "5234567",
    });

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("/recurring/v1/subscription/create"),
    );
    expect(createCall).toBeDefined();
  });

  it("calls cancel", async () => {
    const client = createTestClient();
    await client.subscriptions.cancel("sub_123");

    const calls = fetchMock.mock.calls;
    const cancelCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("/recurring/v1/subscription/cancel"),
    );
    expect(cancelCall).toBeDefined();
  });

  it("calls charge", async () => {
    const client = createTestClient();
    await client.subscriptions.charge({
      id_plan: "plan_123",
      customer: "cust_123",
      token_card: "tok_123",
      doc_type: "CC",
      doc_number: "5234567",
    });

    const calls = fetchMock.mock.calls;
    const chargeCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("/payment/v1/charge/subscription/create"),
    );
    expect(chargeCall).toBeDefined();
  });
});
