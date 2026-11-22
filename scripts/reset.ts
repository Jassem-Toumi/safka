import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { databasePath } from "../src/server/db/db";

// Deletes ONLY the local demo SQLite files and the uploaded MP4 directory. Requires --yes.
if (!process.argv.includes("--yes")) {
  console.error("This deletes the local demo database and uploaded videos. Re-run with: npm run demo:reset -- --yes");
  process.exit(1);
}
const db = databasePath();
for (const p of [db, `${db}-wal`, `${db}-shm`, join(process.cwd(), ".local", "uploads")]) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`Removed ${p}`);
  }
}
console.log("Reset done. Run `npm run demo:seed` to recreate demo data.");
