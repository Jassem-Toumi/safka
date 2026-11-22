import { getDb, one } from "@/server/db/db";
import { createSession, destroySession, meFor } from "@/server/http/auth";
import { ApiError } from "@/server/http/errors";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { DemoSessionInput, type Role } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/demo/session — start a session for a seeded account. */
export const POST = route(async (req) => {
  const { accountId } = parse(DemoSessionInput, await readJson(req));
  const db = getDb();
  const user = one<{ id: string; role: Role; display_name: string }>(db, "SELECT id, role, display_name FROM users WHERE id = ?", accountId);
  if (!user) throw new ApiError("NOT_FOUND", "Demo account not found.");
  const { cookie } = createSession(user.id, db);
  return json(meFor({ id: user.id, role: user.role, displayName: user.display_name }, db), 200, { "Set-Cookie": cookie });
});

/** DELETE /api/v1/demo/session — sign out. */
export const DELETE = route((req) => {
  const cookie = destroySession(req);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
});
