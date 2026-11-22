import { getCampaign, updateCampaign } from "@/server/campaigns/campaigns";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { CampaignPatch } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/campaigns/{id} */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req, ["BRAND"]);
  const { id } = await params;
  return json(getCampaign(getDb(), user.id, id));
});

/** PATCH /api/v1/campaigns/{id} — edit (expectedVersion), confirm, or { status: "CLOSED", expectedVersion }. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req, ["BRAND"]);
  const { id } = await params;
  const patch = parse(CampaignPatch, await readJson(req));
  return json(updateCampaign(getDb(), user.id, id, patch));
});
