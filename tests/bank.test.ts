import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, mockFetch } from "./setup";

describe("Bank", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({ token: "test_bearer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls create with correct URL", async () => {
    const client = createTestClient();
    await client.bank.create({
      bank: "1022",
      invoice: "1472050778",
      description: "pay test",
      value: "10000",
      tax: "0",
      tax_base: "0",
      currency: "COP",
      type_person: "0",
      doc_type: "CC",
      doc_number: "10358519",
      name: "testing",
      last_name: "PAYCO",
      email: "no-responder@payco.co",
      country: "CO",
      cell_phone: "3010000001",
      url_response: "https://secure.payco.co/test",
      url_confirmation: "https://secure.payco.co/test",
      method_confirmation: "GET",
    });

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("/restpagos/pagos/debitos.json"),
    );
    expect(createCall).toBeDefined();
  });

  it("calls getBanks", async () => {
    const client = createTestClient();
    await client.bank.getBanks();

    const calls = fetchMock.mock.calls;
    const banksCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/restpagos/pse/bancos.json"),
    );
    expect(banksCall).toBeDefined();
  });
});
