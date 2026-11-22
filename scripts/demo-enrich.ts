/**
 * Live You.com enrichment for the seeded demo channels, then list them. Needs YDC_API_KEY (or keyless quota).
 * Usage: npm run demo:enrich [-- --force]
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
process.env.YDC_MODE = "live"; // this script exists to fetch real public sources
const { getDb } = await import("../src/server/db/db");
const { enrichAndListDemoChannels } = await import("../src/server/seed/demoChannels");

const results = await enrichAndListDemoChannels(getDb(), { force: process.argv.includes("--force") });
for (const r of results) console.log(`${r.listed ? "LISTED " : "draft  "} ${r.name}: ${r.status}, ${r.evidence} sources${r.note ? ` (${r.note})` : ""}`);
