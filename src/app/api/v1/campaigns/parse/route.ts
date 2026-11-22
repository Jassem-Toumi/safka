import { parseBriefRules } from "@/server/campaigns/parse";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { ownedProductRow } from "@/server/products/products";
import { ParseInput } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/campaigns/parse — "Suggested brief" from { productId, prompt } (RULES mode). */
export const POST = route(async (req) => {
  const user = requireUser(req, ["BRAND"]);
  const input = parse(ParseInput, await readJson(req));
  const product = ownedProductRow(getDb(), user.id, input.productId);
  return json(parseBriefRules(product, input.prompt));
});
