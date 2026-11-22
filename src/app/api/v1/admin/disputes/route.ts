import { listDisputes } from "@/server/deals/list";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/admin/disputes — admin only; open disputes first. */
export const GET = route((req) => {
  requireUser(req, ["ADMIN"]);
  return json({ items: listDisputes(getDb()), nextCursor: null });
});
