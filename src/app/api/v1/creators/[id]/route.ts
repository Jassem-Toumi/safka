import { listedCard } from "@/server/creators/directory";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/creators/{id} — a listed creator's published card (404 unless LISTED). */
export const GET = route<{ id: string }>(async (req, { params }) => {
  requireUser(req, ["BRAND"]);
  const { id } = await params;
  return json(listedCard(getDb(), id));
});
