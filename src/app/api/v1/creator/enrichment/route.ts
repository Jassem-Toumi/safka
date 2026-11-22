import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { runEnrichment } from "@/server/youcom/enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/creator/enrichment — one You.com search for the saved channel; synchronous terminal result. */
export const POST = route(async (req) => {
  const user = requireUser(req, ["CREATOR"]);
  return json(await runEnrichment(getDb(), user.id));
});
