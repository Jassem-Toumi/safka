import { accessibleDeal, toDealDto } from "@/server/deals/view";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/deals/{id} — participants, or an admin when the deal has a dispute. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req);
  const { id } = await params;
  const db = getDb();
  const { row, role } = accessibleDeal(db, user, id);
  return json(toDealDto(db, row, role));
});
