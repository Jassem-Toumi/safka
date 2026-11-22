import { disputeDetail } from "@/server/deals/list";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/admin/disputes/{id} — dispute, authorized deal details and the deal's dispute history. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  requireUser(req, ["ADMIN"]);
  const { id } = await params;
  return json(disputeDetail(getDb(), id));
});
