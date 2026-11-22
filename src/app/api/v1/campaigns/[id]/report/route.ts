import { campaignReport } from "@/server/deals/reports";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/campaigns/{id}/report — campaign owner. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req, ["BRAND"]);
  const { id } = await params;
  return json(campaignReport(getDb(), user.id, id));
});
