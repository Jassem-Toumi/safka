import { assetFile } from "@/server/deals/media";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/deals/{id}/assets/{assetId}/playback — same-origin authenticated media URL. */
export const GET = route<{ id: string; assetId: string }>(async (req, { params }) => {
  const user = requireUser(req);
  const { id, assetId } = await params;
  assetFile(getDb(), user, id, assetId);
  return json({ url: `/api/v1/deals/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}/media`, expiresAt: null });
});
