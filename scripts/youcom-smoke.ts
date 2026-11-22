/**
 * Smoke-test the live You.com MCP endpoint with a GENERIC public query (never a real creator's channel).
 * Usage: npm run youcom:smoke   (uses YDC_API_KEY from the environment if set, else the keyless endpoint)
 */
import { existsSync } from "node:fs";
import { endpointInfo, youSearch } from "../src/server/youcom/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const query = process.argv[2] || "mechanical keyboard sound test";
const { url, authenticated } = endpointInfo();
const started = Date.now();
try {
  const hits = await youSearch(query, 3);
  console.log(`OK ${hits.length} results in ${Date.now() - started} ms from ${new URL(url).pathname} (authenticated: ${authenticated})`);
  for (const h of hits) console.log(`- ${h.title.slice(0, 80)} | ${h.url} | snippet ${h.snippet.length} chars`);
} catch (e) {
  console.log(`FAILED ${(e as { code?: string }).code ?? "UNKNOWN"} after ${Date.now() - started} ms`);
  process.exitCode = 1;
}
