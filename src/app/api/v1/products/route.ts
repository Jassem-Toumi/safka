import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { createProduct, listProducts } from "@/server/products/products";
import { ProductInput } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/products — the brand's products. */
export const GET = route((req) => {
  const user = requireUser(req, ["BRAND"]);
  return json({ items: listProducts(getDb(), user.id), nextCursor: null });
});

/** POST /api/v1/products — { name, description, landingUrl }. */
export const POST = route(async (req) => {
  const user = requireUser(req, ["BRAND"]);
  const input = parse(ProductInput, await readJson(req));
  return json(createProduct(getDb(), user.id, input), 201);
});
