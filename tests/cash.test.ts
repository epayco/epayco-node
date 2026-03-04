import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EpaycoError } from "../src/errors";
import { createTestClient, mockFetch } from "./setup";

describe("Cash", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const cashOptions = {
    invoice: "1472050778",
    description: "pay test",
    value: "20000",
    tax: "0",
    tax_base: "0",
    currency: "COP",
    type_person: "0",
    doc_type: "CC",
    doc_number: "10358519",
    name: "testing",
    last_name: "PAYCO",
    email: "test@mailinator.com",
    cell_phone: "3010000001",
    end_date: "2025-12-05",
    url_response: "https://secure.payco.co/test",
    url_confirmation: "https://secure.payco.co/test",
    method_confirmation: "GET",
  };

  beforeEach(() => {
    fetchMock = mockFetch({ token: "test_bearer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls create with efecty", async () => {
    const client = createTestClient();
    await client.cash.create("efecty", cashOptions);

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("/restpagos/v2/efectivo/efecty"),
    );
    expect(createCall).toBeDefined();
  });

  it("calls create with baloto", async () => {
    const client = createTestClient();
    await client.cash.create("baloto", cashOptions);

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("/restpagos/v2/efectivo/baloto"),
    );
    expect(createCall).toBeDefined();
  });

  it("throws EpaycoError for invalid cash provider", () => {
    const client = createTestClient();
    expect(() =>
      client.cash.create("invalid" as "efecty", cashOptions),
    ).toThrow(EpaycoError);
  });
});
