import { one, run, type Db } from "../db/db";
import { nowIso } from "../clock";
import { ApiError } from "../http/errors";
import { fingerprint } from "../ids";

export function idempotencyKey(req: Request): string {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key || key.length > 200) {
    throw new ApiError("VALIDATION_ERROR", "Send an Idempotency-Key header (1–200 characters).", { "Idempotency-Key": "Required." });
  }
  return key;
}

export type Saved<T> = { status: number; body: T; replayed: boolean };

/**
 * Call inside tx(). Replays a saved success for the same (actor, operation, key) and payload; a different payload with
 * the same key is IDEMPOTENCY_CONFLICT. Replay is checked before any state/version validation (spec §5). Only successes
 * are saved, in the same transaction as the change.
 */
export function idempotent<T>(
  db: Db,
  scope: { actorId: string; operation: string; key: string; payload: unknown },
  status: number,
  fn: () => T,
): Saved<T> {
  const fp = fingerprint(scope.payload);
  const prior = one<{ fingerprint: string; status_code: number; response_json: string }>(
    db,
    "SELECT fingerprint, status_code, response_json FROM idempotency_keys WHERE actor_id = ? AND operation = ? AND key = ?",
    scope.actorId,
    scope.operation,
    scope.key,
  );
  if (prior) {
    if (prior.fingerprint !== fp) throw new ApiError("IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used with a different request.");
    return { status: prior.status_code, body: JSON.parse(prior.response_json) as T, replayed: true };
  }
  const body = fn();
  run(
    db,
    "INSERT INTO idempotency_keys (actor_id, operation, key, fingerprint, status_code, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    scope.actorId,
    scope.operation,
    scope.key,
    fp,
    status,
    JSON.stringify(body),
    nowIso(),
  );
  return { status, body, replayed: false };
}
