import { setVisibility } from "@/server/creators/profile";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { VisibilityInput } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/creator/profile/visibility — { visibility: LISTED | HIDDEN, expectedVersion }. */
export const POST = route(async (req) => {
  const user = requireUser(req, ["CREATOR"]);
  const input = parse(VisibilityInput, await readJson(req));
  return json(setVisibility(getDb(), user.id, input));
});
