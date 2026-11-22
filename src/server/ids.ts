import { createHash, randomBytes, randomUUID } from "node:crypto";

export const newId = (): string => randomUUID();

/** 256-bit opaque token, base64url. */
export const newToken = (): string => randomBytes(32).toString("base64url");

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Stable fingerprint of a JSON payload (key order independent). */
export function fingerprint(value: unknown): string {
  return sha256(stableStringify(value));
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>)
    .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
}
