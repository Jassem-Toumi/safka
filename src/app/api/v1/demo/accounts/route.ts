import { all, getDb } from "@/server/db/db";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";
import type { DemoAccount } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/demo/accounts — seeded demo identities for the local account picker. */
export const GET = route(() => {
  const rows = all<{ id: string; role: DemoAccount["role"]; display_name: string }>(
    getDb(),
    `SELECT id, role, display_name FROM users
     ORDER BY CASE role WHEN 'BRAND' THEN 0 WHEN 'CREATOR' THEN 1 ELSE 2 END, display_name, id`,
  );
  const items: DemoAccount[] = rows.map((r) => ({ id: r.id, role: r.role, displayName: r.display_name }));
  return json({ items, nextCursor: null });
});
