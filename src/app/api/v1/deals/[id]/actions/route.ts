import { applyActionInTx } from "@/server/deals/actions";
import { idempotencyKey, idempotent } from "@/server/deals/idempotency";
import { getDb, tx } from "@/server/db/db";
import { requireUser } from "@/server/http/auth";
import { json, parse, readJson } from "@/server/http/respond";
import { route } from "@/server/http/route";
import { DealActionInput } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/deals/{id}/actions — { action, expectedVersion, ... } with Idempotency-Key. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = requireUser(req);
  const { id } = await params;
  const key = idempotencyKey(req);
  const input = parse(DealActionInput, await readJson(req));
  const db = getDb();
  const saved = tx(db, () =>
    idempotent(db, { actorId: user.id, operation: `DEAL_ACTION:${id}`, key, payload: input }, 200, () => applyActionInTx(db, user, id, input)),
  );
  return json(saved.body, saved.status, saved.replayed ? { "Idempotent-Replay": "true" } : {});
});
