import errors from "@/data/errors.json";
import type { ErrorCode, Lang } from "@/types";

export class EpaycoError extends Error {
  constructor(lang: Lang, code: ErrorCode) {
    const messages = errors[code] as Record<Lang, string> | undefined;
    const message = messages?.[lang] ?? `[${code}] Unknown error`;
    super(message);
    this.name = "EpaycoError";
  }
}
