import { afterEach, describe, expect, it } from "vitest";
import { GET as listProducts, POST as createProduct } from "@/app/api/v1/products/route";
import { GET as getProduct, PATCH as patchProduct } from "@/app/api/v1/products/[id]/route";
import { setDbForTests } from "@/server/db/db";
import { checkLandingUrl } from "@/server/products/products";
import { SEED } from "@/server/seed/ids";
import { Product } from "@/shared/contracts";
import { body, ctx, freshDb, req, signIn } from "./helpers";

afterEach(() => setDbForTests(undefined));

describe("products", () => {
  it("lists only the brand's own products", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const { data } = await body(await listProducts(req("GET", "/api/v1/products", { cookie }), ctx()));
    expect(data.items.map((p: Product) => p.id).sort()).toEqual([SEED.products.whisper75, SEED.products.deskMat].sort());
  });

  it("creates (201) and patches; other brands get 404", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const res = await createProduct(req("POST", "/api/v1/products", { cookie, body: { name: "Quiet Keycaps", description: "PBT keycaps.", landingUrl: "" } }), ctx());
    expect(res.status).toBe(201);
    const p = Product.parse((await body(res)).data);
    expect(p.landingUrl).toBeNull();

    const patched = await patchProduct(req("PATCH", `/api/v1/products/${p.id}`, { cookie, body: { landingUrl: "https://example.com/keycaps" } }), ctx({ id: p.id }));
    expect(patched.status).toBe(200);
    expect((await body(patched)).data).toMatchObject({ name: "Quiet Keycaps", landingUrl: "https://example.com/keycaps" });

    const other = await signIn(SEED.users.brandNorthwind);
    expect((await getProduct(req("GET", `/api/v1/products/${p.id}`, { cookie: other }), ctx({ id: p.id }))).status).toBe(404);
    expect((await patchProduct(req("PATCH", `/api/v1/products/${p.id}`, { cookie: other, body: { name: "x" } }), ctx({ id: p.id }))).status).toBe(404);
  });

  it("rejects unsafe landing URLs", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    for (const landingUrl of ["http://example.com", "https://user:pw@example.com", "https://127.0.0.1/x", "https://localhost/x", "https://[::1]/", "https://10.0.0.5", "https://192.168.1.1", "https://169.254.169.254/"]) {
      const res = await createProduct(req("POST", "/api/v1/products", { cookie, body: { name: "x", description: "y", landingUrl } }), ctx());
      expect(res.status, landingUrl).toBe(400);
    }
    expect(checkLandingUrl("https://shop.example.com/a?b=1")).toBe("https://shop.example.com/a?b=1");
  });

  it("requires the brand role and a same-origin write", async () => {
    freshDb();
    const creator = await signIn(SEED.users.creatorClackLab);
    expect((await listProducts(req("GET", "/api/v1/products", { cookie: creator }), ctx())).status).toBe(403);
    const brand = await signIn(SEED.users.brandHushkeys);
    const cross = await createProduct(req("POST", "/api/v1/products", { cookie: brand, body: { name: "x", description: "y", landingUrl: null }, headers: { origin: "https://evil.example" } }), ctx());
    expect(cross.status).toBe(403);
  });
});
