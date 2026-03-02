import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, mockFetch } from "./setup";

describe("Customers", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({ token: "test_bearer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls create with correct URL", async () => {
    const client = createTestClient();
    await client.customers.create({
      token_card: "tok_123",
      name: "Joe Doe",
      email: "joe@payco.co",
      phone: "3005234321",
      default: true,
    });

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("/payment/v1/customer/create"),
    );
    expect(createCall).toBeDefined();
  });

  it("calls get with uid in URL", async () => {
    const client = createTestClient();
    await client.customers.get("cust_123");

    const calls = fetchMock.mock.calls;
    const getCall = calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("cust_123"),
    );
    expect(getCall).toBeDefined();
  });

  it("calls list", async () => {
    const client = createTestClient();
    await client.customers.list();

    const calls = fetchMock.mock.calls;
    const listCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/payment/v1/customers/"),
    );
    expect(listCall).toBeDefined();
  });
});
