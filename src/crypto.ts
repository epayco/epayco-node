import { createCipheriv } from "node:crypto";

const IV_HEX = "0000000000000000";

function cipherAlgorithm(keyBytes: number): string {
  switch (keyBytes) {
    case 16:
      return "aes-128-cbc";
    case 24:
      return "aes-192-cbc";
    case 32:
      return "aes-256-cbc";
    default:
      throw new RangeError(
        `Invalid key length: ${keyBytes} bytes. AES requires 16, 24, or 32 bytes.`,
      );
  }
}

export function encrypt(value: unknown, userKey: string): string {
  const key = Buffer.from(userKey, "hex");
  // CryptoJS parsed "0000000000000000" as hex → 8 bytes, then zero-padded to
  // the AES block size (16 bytes) internally. We replicate that behavior.
  const ivRaw = Buffer.from(IV_HEX, "hex");
  const iv = Buffer.alloc(16, 0);
  ivRaw.copy(iv);

  const algo = cipherAlgorithm(key.length);
  const cipher = createCipheriv(algo, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);

  return encrypted.toString("base64");
}

export function encryptHex(userKey: string): { i: string; p: string } {
  // Must match the original CryptoJS behavior:
  // CryptoJS.enc.Hex.parse("0000000000000000") → 8 zero bytes → base64
  const key = Buffer.from(userKey, "hex");
  const iv = Buffer.from(IV_HEX, "hex");

  return {
    i: iv.toString("base64"),
    p: key.toString("base64"),
  };
}

export function encodeBasicAuth(apiKey: string, privateKey: string): string {
  return Buffer.from(`${apiKey}:${privateKey}`, "utf8").toString("base64");
}
