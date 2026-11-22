import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ApiError } from "../http/errors";

export type Db = DatabaseSync;

const SCHEMA_VERSION = 1;

export function repoRoot(): string {
  return process.cwd();
}

export function databasePath(): string {
  return resolve(repoRoot(), process.env.DATABASE_PATH || ".local/safka.db");
}

/** Open a database, apply pragmas and the schema. `:memory:` is supported for tests. */
export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 2000 });
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  migrate(db);
  return db;
}

function migrate(db: Db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null };
  if ((row.v ?? 0) >= SCHEMA_VERSION) return;
  const sql = readFileSync(join(repoRoot(), "src/server/db/schema.sql"), "utf8");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
      SCHEMA_VERSION,
      new Date().toISOString(),
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Survive Next.js dev hot reloads with one connection per process.
const g = globalThis as unknown as { __safkaDb?: Db; __safkaDbOverride?: Db };

export function getDb(): Db {
  if (g.__safkaDbOverride) return g.__safkaDbOverride;
  if (!g.__safkaDb) g.__safkaDb = openDb(databasePath());
  return g.__safkaDb;
}

/** Tests: route all getDb() calls to the given database. Pass undefined to clear. */
export function setDbForTests(db: Db | undefined) {
  g.__safkaDbOverride = db;
}

function isBusy(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /SQLITE_BUSY|database is locked/i.test(msg);
}

/**
 * Run `fn` inside BEGIN IMMEDIATE. `fn` must be synchronous: never await network or file IO inside.
 * Lock contention beyond the busy timeout surfaces as 503 RETRY_LATER.
 */
export function tx<T>(db: Db, fn: () => T extends Promise<unknown> ? never : T): T {
  try {
    db.exec("BEGIN IMMEDIATE");
  } catch (e) {
    if (isBusy(e)) throw new ApiError("RETRY_LATER", "The database is busy. Try again.");
    throw e;
  }
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    if (isBusy(e)) throw new ApiError("RETRY_LATER", "The database is busy. Try again.");
    throw e;
  }
}

export type Row = Record<string, unknown>;

export function one<T = Row>(db: Db, sql: string, ...params: SqlParam[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T = Row>(db: Db, sql: string, ...params: SqlParam[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(db: Db, sql: string, ...params: SqlParam[]) {
  return db.prepare(sql).run(...params);
}

export type SqlParam = string | number | bigint | null | Uint8Array;
