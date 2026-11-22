import type { EnrichmentResult } from "@/shared/contracts";
import { getProfile, profileByUser, setVisibility, updateProfile } from "../creators/profile";
import type { Db } from "../db/db";
import { runEnrichment } from "../youcom/enrichment";
import { DEMO_CHANNELS } from "./seed";

export type DemoChannelOutcome = { name: string; status: EnrichmentResult["status"] | "SKIPPED"; listed: boolean; evidence: number; note?: string };

/**
 * For each seeded demo channel: one live You.com search, keep every identity-matched source and the tags they support,
 * then list the profile. Only PUBLIC-backed tags are used, so nothing is attributed to the channel without a source.
 * Already-listed channels are skipped unless `force`.
 */
export async function enrichAndListDemoChannels(db: Db, opts: { force?: boolean } = {}): Promise<DemoChannelOutcome[]> {
  const out: DemoChannelOutcome[] = [];
  for (const d of DEMO_CHANNELS) {
    const row = profileByUser(db, d.userId);
    if (row.visibility === "LISTED" && !opts.force) {
      out.push({ name: d.name, status: "SKIPPED", listed: true, evidence: 0, note: "already listed" });
      continue;
    }
    let result: EnrichmentResult;
    try {
      result = await runEnrichment(db, d.userId);
    } catch (e) {
      out.push({ name: d.name, status: "FAILED", listed: false, evidence: 0, note: e instanceof Error ? e.message : "error" });
      continue;
    }
    const topics = result.suggestions.topics.map((t) => t.value).slice(0, 8);
    const formats = result.suggestions.formats.map((f) => f.value as never).slice(0, 4);
    if (result.status !== "READY" || topics.length === 0 || formats.length === 0) {
      out.push({ name: d.name, status: result.status, listed: false, evidence: result.evidence.length, note: result.errorCode ?? "not enough public tags to list" });
      continue;
    }
    const p = getProfile(db, d.userId);
    const saved = updateProfile(db, d.userId, {
      ...p.draft,
      topics,
      formats,
      selectedEvidenceIds: result.evidence.map((e) => e.id).slice(0, 20),
      expectedVersion: p.version,
    });
    setVisibility(db, d.userId, { visibility: "LISTED", expectedVersion: saved.version });
    out.push({ name: d.name, status: "READY", listed: true, evidence: result.evidence.length });
  }
  return out;
}
