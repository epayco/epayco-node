import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, mockFetch } from "./setup";

describe("Charge", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({ token: "test_bearer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls create with correct URL", async () => {
    const client = createTestClient();
    await client.charge.create({
      token_card: "tok_123",
      customer_id: "cust_123",
      doc_type: "CC",
      doc_number: "1035851980",
      name: "John",
      last_name: "Doe",
      email: "example@email.com",
      bill: "OR-1234",
      description: "Test Payment",
      value: "116000",
      tax: "16000",
      tax_base: "100000",
      currency: "COP",
      dues: "12",
    });

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/payment/v1/charge/create"),
    );
    expect(createCall).toBeDefined();
  });

  it("calls get with uid", async () => {
    const client = createTestClient();
    await client.charge.get("txn_123");

    const calls = fetchMock.mock.calls;
    const getCall = calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("txn_123"),
    );
    expect(getCall).toBeDefined();
  });
});
