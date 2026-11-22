import type { Role } from "@/shared/contracts/enums";
import type { Me } from "@/shared/contracts/identity";
import { getDb, one, run, type Db } from "../db/db";
import { addMs, DAY_MS, nowIso } from "../clock";
import { newToken, sha256 } from "../ids";
import { ApiError } from "./errors";

export const SESSION_COOKIE = "safka_session";
const SESSION_TTL_MS = 7 * DAY_MS;

export type SessionUser = { id: string; role: Role; displayName: string };

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionUser(req: Request, db: Db = getDb()): SessionUser | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = one<{ id: string; role: Role; display_name: string; expires_at: string }>(
    db,
    `SELECT u.id, u.role, u.display_name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    sha256(token),
  );
  if (!row || row.expires_at <= nowIso()) return null;
  return { id: row.id, role: row.role, displayName: row.display_name };
}

/** Require a session, optionally with one of the given roles (403 otherwise). */
export function requireUser(req: Request, roles?: Role[], db: Db = getDb()): SessionUser {
  const u = sessionUser(req, db);
  if (!u) throw new ApiError("AUTH_REQUIRED", "Pick a demo account to continue.");
  if (roles && !roles.includes(u.role)) throw new ApiError("FORBIDDEN", "This account's role can't do that.");
  return u;
}

export function createSession(userId: string, db: Db = getDb()): { token: string; cookie: string } {
  const token = newToken();
  const created = nowIso();
  run(db, "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", sha256(token), userId, created, addMs(created, SESSION_TTL_MS));
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
  return { token, cookie };
}

export function destroySession(req: Request, db: Db = getDb()): string {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) run(db, "DELETE FROM sessions WHERE id = ?", sha256(token));
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function meFor(user: SessionUser, db: Db = getDb()): Me {
  let profileReady = true;
  if (user.role === "CREATOR") {
    const p = one<{ published_version: number | null }>(db, "SELECT published_version FROM creator_profiles WHERE user_id = ?", user.id);
    profileReady = !!p && p.published_version !== null;
  }
  return { id: user.id, role: user.role, displayName: user.displayName, profileReady };
}
