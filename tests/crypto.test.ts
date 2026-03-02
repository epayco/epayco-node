import { describe, expect, it } from "vitest";

import { encodeBasicAuth, encrypt, encryptHex } from "../src/crypto";

describe("crypto", () => {
  const testKey = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";

  describe("encrypt", () => {
    it("encrypts a string value", () => {
      const result = encrypt("test_value", testKey);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("produces consistent output for same input", () => {
      const result1 = encrypt("hello", testKey);
      const result2 = encrypt("hello", testKey);
      expect(result1).toBe(result2);
    });

    it("produces different output for different inputs", () => {
      const result1 = encrypt("hello", testKey);
      const result2 = encrypt("world", testKey);
      expect(result1).not.toBe(result2);
    });
  });

  describe("encryptHex", () => {
    it("returns i and p properties", () => {
      const result = encryptHex(testKey);
      expect(result).toHaveProperty("i");
      expect(result).toHaveProperty("p");
      expect(typeof result.i).toBe("string");
      expect(typeof result.p).toBe("string");
    });

    it("i is always the zero IV in base64", () => {
      const result = encryptHex(testKey);
      expect(result.i).toBe("AAAAAAAAAAA=");
    });
  });

  describe("encodeBasicAuth", () => {
    it("encodes apiKey:privateKey in base64", () => {
      const result = encodeBasicAuth("myKey", "mySecret");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
