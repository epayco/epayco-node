import { describe, expect, it } from "vitest";

import { createEpayco, Epayco, EpaycoError } from "../src/index";

describe("Epayco", () => {
  it("creates an instance with valid options", () => {
    const client = new Epayco({
      apiKey: "pk_test",
      privateKey: "sk_test",
      test: true,
    });
    expect(client.apiKey).toBe("pk_test");
    expect(client.privateKey).toBe("sk_test");
    expect(client.test).toBe("TRUE");
    expect(client.lang).toBe("ES");
  });

  it("sets test to FALSE when test option is false", () => {
    const client = new Epayco({
      apiKey: "pk_test",
      privateKey: "sk_test",
      test: false,
    });
    expect(client.test).toBe("FALSE");
  });

  it("accepts lang option", () => {
    const client = new Epayco({
      apiKey: "pk_test",
      privateKey: "sk_test",
      test: true,
      lang: "EN",
    });
    expect(client.lang).toBe("EN");
  });

  it("throws EpaycoError when apiKey is missing", () => {
    expect(
      () =>
        new Epayco({
          apiKey: undefined as unknown as string,
          privateKey: "sk_test",
          test: true,
        }),
    ).toThrow(EpaycoError);
  });

  it("throws EpaycoError when privateKey is missing", () => {
    expect(
      () =>
        new Epayco({
          apiKey: "pk_test",
          privateKey: undefined as unknown as string,
          test: true,
        }),
    ).toThrow(EpaycoError);
  });

  it("throws EpaycoError when test is not boolean", () => {
    expect(
      () =>
        new Epayco({
          apiKey: "pk_test",
          privateKey: "sk_test",
          test: "true" as unknown as boolean,
        }),
    ).toThrow(EpaycoError);
  });

  it("throws Error for invalid lang", () => {
    expect(
      () =>
        new Epayco({
          apiKey: "pk_test",
          privateKey: "sk_test",
          test: true,
          lang: "FR" as "ES",
        }),
    ).toThrow("LANG: FR is invalid");
  });

  it("has all resource properties", () => {
    const client = new Epayco({
      apiKey: "pk_test",
      privateKey: "sk_test",
      test: true,
    });
    expect(client.token).toBeDefined();
    expect(client.customers).toBeDefined();
    expect(client.plans).toBeDefined();
    expect(client.subscriptions).toBeDefined();
    expect(client.bank).toBeDefined();
    expect(client.cash).toBeDefined();
    expect(client.charge).toBeDefined();
    expect(client.safetypay).toBeDefined();
    expect(client.daviplata).toBeDefined();
  });

  it("createEpayco factory returns Epayco instance", () => {
    const client = createEpayco({
      apiKey: "pk_test",
      privateKey: "sk_test",
      test: true,
    });
    expect(client).toBeInstanceOf(Epayco);
  });
});
