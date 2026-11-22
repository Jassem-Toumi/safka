import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { getProduct, updateProduct } from "@/server/products/products";
import { ProductPatch } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/products/{id} — one owned product (404 for other brands' IDs). */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req, ["BRAND"]);
  const { id } = await params;
  return json(getProduct(getDb(), user.id, id));
});

/** PATCH /api/v1/products/{id} — partial { name, description, landingUrl }. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req, ["BRAND"]);
  const { id } = await params;
  const patch = parse(ProductPatch, await readJson(req));
  return json(updateProduct(getDb(), user.id, id, patch));
});
