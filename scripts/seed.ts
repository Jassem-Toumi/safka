import { databasePath, openDb } from "../src/server/db/db";
import { seedDemo } from "../src/server/seed/seed";

const path = databasePath();
const db = openDb(path);
const s = seedDemo(db);
db.close();
console.log(`Seeded ${path}: ${s.usersInserted} new users, ${s.dealsInserted} new deals, ${s.mediaCopied} media files copied.`);
