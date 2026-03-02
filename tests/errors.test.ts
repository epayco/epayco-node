import { describe, expect, it } from "vitest";

import { EpaycoError } from "../src/errors";

describe("EpaycoError", () => {
  it("creates error with Spanish message", () => {
    const error = new EpaycoError("ES", "100");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("EpaycoError");
    expect(error.message).toContain("[100]");
    expect(error.message).toContain("sdk");
  });

  it("creates error with English message", () => {
    const error = new EpaycoError("EN", "100");
    expect(error.message).toContain("[100]");
    expect(error.message).toContain("initializing the sdk");
  });

  it("supports all error codes", () => {
    const codes = [
      "100",
      "101",
      "102",
      "103",
      "104",
      "105",
      "106",
      "107",
      "108",
      "109",
    ] as const;
    for (const code of codes) {
      const error = new EpaycoError("EN", code);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
