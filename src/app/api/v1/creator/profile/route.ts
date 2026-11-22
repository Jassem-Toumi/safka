import { getProfile, updateProfile } from "@/server/creators/profile";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { CreatorProfileInput } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/creator/profile — the signed-in creator's draft, evidence and published snapshot. */
export const GET = route((req) => {
  const user = requireUser(req, ["CREATOR"]);
  return json(getProfile(getDb(), user.id));
});

/** PUT /api/v1/creator/profile — save the draft (requires expectedVersion). */
export const PUT = route(async (req) => {
  const user = requireUser(req, ["CREATOR"]);
  const input = parse(CreatorProfileInput, await readJson(req));
  return json(updateProfile(getDb(), user.id, input));
});
