import { handleUpload } from "@/server/deals/media";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/deals/{id}/uploads — multipart `file`, one MP4 up to 20 MiB. Creator only. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req, ["CREATOR"]);
  const { id } = await params;
  return json(await handleUpload(getDb(), user, id, req), 201);
});
