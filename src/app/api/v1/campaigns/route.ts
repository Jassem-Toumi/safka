import { createCampaign, listCampaigns } from "@/server/campaigns/campaigns";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { CampaignInput } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/campaigns — the brand's campaigns. */
export const GET = route((req) => {
  const user = requireUser(req, ["BRAND"]);
  return json({ items: listCampaigns(getDb(), user.id), nextCursor: null });
});

/** POST /api/v1/campaigns — save a DRAFT, or `confirm: true` to activate. */
export const POST = route(async (req) => {
  const user = requireUser(req, ["BRAND"]);
  const input = parse(CampaignInput, await readJson(req));
  return json(createCampaign(getDb(), user.id, input), 201);
});
