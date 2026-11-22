import { assetFile, streamMedia } from "@/server/deals/media";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = route<{ id: string; assetId: string }>(async (req, { params }) => {
  const user = requireUser(req);
  const { id, assetId } = await params;
  const { path } = assetFile(getDb(), user, id, assetId);
  return streamMedia(path, req.headers.get("range"), req.method);
});

/** GET /api/v1/deals/{id}/assets/{assetId}/media — authorized MP4 bytes with single Range support. */
export const GET = handler;
export const HEAD = handler;
