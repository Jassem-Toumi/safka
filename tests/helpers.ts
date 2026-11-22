import { openDb, setDbForTests, type Db } from "@/server/db/db";
import { seedDemo } from "@/server/seed/seed";

export const ORIGIN = "http://127.0.0.1:3000";

/** Fresh in-memory DB with demo seed, wired into getDb(). */
export function freshDb(seed = true, now = new Date()): Db {
  const db = openDb(":memory:");
  if (seed) seedDemo(db, now);
  setDbForTests(db);
  return db;
}

export function req(method: string, path: string, opts: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { host: "127.0.0.1:3000", ...(opts.headers ?? {}) };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    if (method !== "GET") headers.origin ??= ORIGIN;
  } else if (method !== "GET") {
    headers.origin ??= ORIGIN;
  }
  return new Request(`${ORIGIN}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

export const ctx = <P extends Record<string, string>>(params: P = {} as P) => ({ params: Promise.resolve(params) });

export async function body<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Sign in as a seeded account through the real route; returns the cookie header value. */
export async function signIn(accountId: string): Promise<string> {
  const { POST } = await import("@/app/api/v1/demo/session/route");
  const res = await POST(req("POST", "/api/v1/demo/session", { body: { accountId } }), ctx());
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status}`);
  const set = res.headers.get("set-cookie")!;
  return set.split(";")[0]!;
}
