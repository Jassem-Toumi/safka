import { ApiError } from "./errors";

export function appOrigin(): URL {
  return new URL(process.env.APP_ORIGIN || "http://127.0.0.1:3000");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Loopback-only guard (spec §2): the Host must match the configured origin, and browser
 * writes must come from that same origin.
 */
export function checkOrigin(req: Request) {
  const origin = appOrigin();
  const host = req.headers.get("host");
  if (host && host.toLowerCase() !== origin.host.toLowerCase()) {
    throw new ApiError("FORBIDDEN", "Requests must use the configured local origin.");
  }
  if (SAFE_METHODS.has(req.method.toUpperCase())) return;
  const reqOrigin = req.headers.get("origin");
  if (reqOrigin !== null) {
    if (reqOrigin !== origin.origin) throw new ApiError("FORBIDDEN", "Cross-origin write rejected.");
    return;
  }
  // No Origin header: allow only if the browser says it is same-origin, or it is not a browser fetch.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new ApiError("FORBIDDEN", "Cross-site write rejected.");
  }
}
