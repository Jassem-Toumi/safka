import { searchDirectory } from "@/server/creators/directory";
import { getDb } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { CreatorDirectoryQuery } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/creators?q=&topic=&format= — listed creator cards for brands. */
export const GET = route((req) => {
  requireUser(req, ["BRAND"]);
  const sp = new URL(req.url).searchParams;
  const q = parse(CreatorDirectoryQuery, Object.fromEntries([...sp.entries()].filter(([, v]) => v !== "")));
  return json({ items: searchDirectory(getDb(), q), nextCursor: null });
});
