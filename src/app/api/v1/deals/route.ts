import { createDealInTx } from "@/server/deals/create";
import { idempotencyKey, idempotent } from "@/server/deals/idempotency";
import { listDeals } from "@/server/deals/list";
import { getDb, tx } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { CreateDealInput, DealListQuery } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/deals?filter=needs_action|in_progress|closed&campaignId= — inbox for the caller. */
export const GET = route((req) => {
  const user = requireUser(req);
  const sp = new URL(req.url).searchParams;
  const q = parse(DealListQuery, Object.fromEntries([...sp.entries()].filter(([, v]) => v !== "")));
  return json({ items: listDeals(getDb(), user, q), nextCursor: null });
});

/** POST /api/v1/deals — brand sends an offer (direct or campaign). Requires Idempotency-Key. */
export const POST = route(async (req) => {
  const user = requireUser(req, ["BRAND"]);
  const key = idempotencyKey(req);
  const input = parse(CreateDealInput, await readJson(req));
  const db = getDb();
  const saved = tx(db, () => idempotent(db, { actorId: user.id, operation: "CREATE_DEAL", key, payload: input }, 201, () => createDealInTx(db, user, input)));
  return json(saved.body, saved.status, saved.replayed ? { "Idempotent-Replay": "true" } : {});
});
