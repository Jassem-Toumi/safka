import type { EnrichmentResult, EnrichmentMode, Evidence, Format, Label } from "@/shared/contracts";
import { normalizeChannel, type ChannelIdentity } from "../creators/channel";
import { profileByUser, type StoredEnrichment } from "../creators/profile";
import { one, run, tx, type Db } from "../db/db";
import { nowIso } from "../clock";
import { ApiError } from "../http/errors";
import { newId } from "../ids";
import { youSearch, YouSearchError, type SearchHit } from "./client";
import { extract, searchQuery, type ExtractedHit } from "./extract";
import { fixtureSearch } from "./fixture";

export type SearchProvider = (query: string, count: number) => Promise<SearchHit[]>;

let providerOverride: SearchProvider | null = null;
/** Tests: replace the live network call. */
export function setSearchProviderForTests(p: SearchProvider | null) {
  providerOverride = p;
}

export function enrichmentMode(): EnrichmentMode {
  return (process.env.YDC_MODE || "fixture").trim().toLowerCase() === "live" ? "LIVE" : "SAMPLE";
}

/**
 * POST /creator/enrichment. The network call runs outside any transaction; results are applied in a short
 * transaction only if the profile version and channel are unchanged. Live failures return FAILED (never fixtures).
 */
export async function runEnrichment(db: Db, userId: string): Promise<EnrichmentResult> {
  const before = profileByUser(db, userId);
  const channel = before.channel_key ? normalizeChannelFromRow(before.draft_json) : null;
  if (!channel || channel.key !== before.channel_key) {
    throw new ApiError("VALIDATION_ERROR", "Save a YouTube channel on your profile before searching.", { channel: "Save a valid channel first." });
  }
  const mode = enrichmentMode();
  const started = Date.now();
  let hits: ExtractedHit[] = [];
  let errorCode: string | null = null;
  try {
    const raw = mode === "LIVE" ? await (providerOverride ?? youSearch)(searchQuery(channel), 6) : fixtureSearch(channel);
    hits = extract(raw, channel);
  } catch (e) {
    errorCode = e instanceof YouSearchError ? e.code : "PROVIDER_ERROR";
  }
  const elapsed = Date.now() - started;
  const status = errorCode ? "FAILED" : hits.length > 0 ? "READY" : "EMPTY";

  const outcome = tx(db, () => {
    const now = profileByUser(db, userId);
    const runId = newId();
    const ts = nowIso();
    const stale = now.version !== before.version || now.channel_key !== before.channel_key;
    run(
      db,
      `INSERT INTO enrichment_runs (id, creator_id, channel_key, profile_version, status, mode, error_code, elapsed_ms, result_count, applied, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      runId,
      before.id,
      channel.key,
      before.version,
      status,
      mode,
      errorCode,
      elapsed,
      hits.length,
      stale ? 0 : 1,
      ts,
    );
    if (stale) return { stale: true as const, version: now.version };

    const kind = mode === "LIVE" ? "PUBLIC" : "SAMPLE";
    const evidence: (Evidence & { topics: string[]; formats: Format[] })[] = [];
    for (const h of hits) {
      const existing = one<{ id: string }>(db, "SELECT id FROM evidence WHERE creator_id = ? AND channel_key = ? AND url = ?", before.id, channel.key, h.url);
      const id = existing?.id ?? newId();
      if (existing) {
        run(
          db,
          `UPDATE evidence SET run_id = ?, title = ?, excerpt = ?, kind = ?, topics_json = ?, formats_json = ?, published_at = ?, retrieved_at = ? WHERE id = ?`,
          runId, h.title, h.excerpt, kind, JSON.stringify(h.topics), JSON.stringify(h.formats), h.publishedAt, ts, id,
        );
      } else {
        run(
          db,
          `INSERT INTO evidence (id, creator_id, run_id, channel_key, url, title, excerpt, kind, topics_json, formats_json, published_at, retrieved_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id, before.id, runId, channel.key, h.url, h.title, h.excerpt, kind, JSON.stringify(h.topics), JSON.stringify(h.formats), h.publishedAt, ts, ts,
        );
      }
      evidence.push({ id, url: h.url, title: h.title, excerpt: h.excerpt, retrievedAt: ts, publishedAt: h.publishedAt, kind, topics: h.topics, formats: h.formats });
    }
    const result: EnrichmentResult = {
      status,
      mode,
      evidence: evidence.map(({ topics: _t, formats: _f, ...e }) => e),
      suggestions: {
        topics: suggest(evidence, (e) => e.topics, kind),
        formats: suggest(evidence, (e) => e.formats, kind),
      },
      retrievedAt: ts,
      errorCode,
      profileVersion: before.version,
    };
    const stored: StoredEnrichment = { channelKey: channel.key, result };
    run(db, "UPDATE creator_profiles SET last_enrichment_json = ? WHERE id = ?", JSON.stringify(stored), before.id);
    return { stale: false as const, result };
  });

  if (outcome.stale) {
    throw new ApiError("STALE_PROFILE", "Your profile changed while searching. Run the search again.", undefined, { version: outcome.version });
  }
  return outcome.result;
}

function normalizeChannelFromRow(draftJson: string): ChannelIdentity | null {
  const draft = JSON.parse(draftJson) as { channel?: string };
  return draft.channel ? normalizeChannel(draft.channel) : null;
}

function suggest<E extends { id: string }>(evidence: E[], pick: (e: E) => string[], kind: "PUBLIC" | "SAMPLE"): Label[] {
  const map = new Map<string, string[]>();
  for (const e of evidence) for (const v of pick(e)) map.set(v, [...(map.get(v) ?? []), e.id]);
  return [...map.entries()].map(([value, evidenceIds]) => ({ value, origin: kind, evidenceIds }));
}
