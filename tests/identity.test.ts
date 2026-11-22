import { afterEach, describe, expect, it } from "vitest";
import { GET as getAccounts } from "@/app/api/v1/demo/accounts/route";
import { DELETE as signOut, POST as signInRoute } from "@/app/api/v1/demo/session/route";
import { GET as getMe } from "@/app/api/v1/me/route";
import { setDbForTests } from "@/server/db/db";
import { SEED } from "@/server/seed/ids";
import { DemoAccount, Me } from "@/shared/contracts";
import { body, ctx, freshDb, req, signIn } from "./helpers";

afterEach(() => setDbForTests(undefined));

describe("demo identity", () => {
  it("lists seeded accounts in the standard list shape", async () => {
    freshDb();
    const res = await getAccounts(req("GET", "/api/v1/demo/accounts"), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const { data } = await body(res);
    expect(data.nextCursor).toBeNull();
    for (const a of data.items) DemoAccount.parse(a);
    const roles = new Set(data.items.map((a: DemoAccount) => a.role));
    expect(roles).toEqual(new Set(["BRAND", "CREATOR", "ADMIN"]));
  });

  it("signs in, reads /me, signs out", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    expect(cookie).toMatch(/^safka_session=/);
    const me = await getMe(req("GET", "/api/v1/me", { cookie }), ctx());
    expect(me.status).toBe(200);
    const meData = Me.parse((await body(me)).data);
    expect(meData).toMatchObject({ id: SEED.users.brandHushkeys, role: "BRAND", profileReady: true });

    const out = await signOut(req("DELETE", "/api/v1/demo/session", { cookie }), ctx());
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    const after = await getMe(req("GET", "/api/v1/me", { cookie }), ctx());
    expect(after.status).toBe(401);
    expect((await body(after)).error.code).toBe("AUTH_REQUIRED");
  });

  it("sets an HttpOnly SameSite=Lax cookie", async () => {
    freshDb();
    const res = await signInRoute(req("POST", "/api/v1/demo/session", { body: { accountId: SEED.users.admin } }), ctx());
    const c = res.headers.get("set-cookie")!;
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
  });

  it("reports profileReady for listed vs draft creators", async () => {
    freshDb();
    const listed = await getMe(req("GET", "/api/v1/me", { cookie: await signIn(SEED.users.creatorClackLab) }), ctx());
    expect((await body(listed)).data.profileReady).toBe(true);
    const draft = await getMe(req("GET", "/api/v1/me", { cookie: await signIn(SEED.users.creatorLiveDemo) }), ctx());
    expect((await body(draft)).data.profileReady).toBe(false);
  });

  it("rejects unknown accounts, forged cookies and bad bodies", async () => {
    freshDb();
    const unknown = await signInRoute(req("POST", "/api/v1/demo/session", { body: { accountId: "nope" } }), ctx());
    expect(unknown.status).toBe(404);
    const bad = await signInRoute(req("POST", "/api/v1/demo/session", { body: {} }), ctx());
    expect(bad.status).toBe(400);
    expect((await body(bad)).error.code).toBe("VALIDATION_ERROR");
    const forged = await getMe(req("GET", "/api/v1/me", { cookie: "safka_session=forged" }), ctx());
    expect(forged.status).toBe(401);
  });

  it("enforces loopback host and same-origin writes", async () => {
    freshDb();
    const lan = await getAccounts(req("GET", "/api/v1/demo/accounts", { headers: { host: "192.168.1.5:3000" } }), ctx());
    expect(lan.status).toBe(403);
    const cross = await signInRoute(
      req("POST", "/api/v1/demo/session", { body: { accountId: SEED.users.admin }, headers: { origin: "https://evil.example" } }),
      ctx(),
    );
    expect(cross.status).toBe(403);
  });
});
