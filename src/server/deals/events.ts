import type { ActorRole } from "@/shared/contracts";
import { one, run, type Db } from "../db/db";
import { newId } from "../ids";

export function addEvent(db: Db, dealId: string, actorId: string | null, role: ActorRole, action: string, at: string, note: string | null = null) {
  const seq = (one<{ s: number | null }>(db, "SELECT MAX(seq) AS s FROM deal_events WHERE deal_id = ?", dealId)?.s ?? 0) + 1;
  run(
    db,
    "INSERT INTO deal_events (id, deal_id, seq, actor_id, actor_role, action, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    newId(),
    dealId,
    seq,
    actorId,
    role,
    action,
    note,
    at,
  );
}
