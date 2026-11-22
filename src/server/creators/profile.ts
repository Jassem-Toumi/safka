import type {
  CreatorCard,
  CreatorDataMode,
  CreatorProfile,
  CreatorProfileFields,
  CreatorProfileInput,
  EnrichmentResult,
  Format,
  ProfileVisibility,
  VisibilityInput,
} from "@/shared/contracts";
import { normalizeTopics } from "@/shared/topics";
import { all, one, run, tx, type Db } from "../db/db";
import { nowIso } from "../clock";
import { ApiError, notFound } from "../http/errors";
import { buildCard, type EvidenceWithLabels } from "./card";
import { normalizeChannel } from "./channel";

export type ProfileRow = {
  id: string;
  user_id: string;
  version: number;
  visibility: ProfileVisibility;
  draft_json: string;
  channel_key: string | null;
  canonical_channel_url: string | null;
  published_json: string | null;
  published_version: number | null;
  listed_channel_key: string | null;
  data_mode: CreatorDataMode;
  is_sample: number;
  last_enrichment_json: string | null;
  created_at: string;
  updated_at: string;
};

/** Stored shape of last_enrichment_json: the result plus the channel it was run for. */
export type StoredEnrichment = { channelKey: string; result: EnrichmentResult };

export function profileByUser(db: Db, userId: string): ProfileRow {
  const row = one<ProfileRow>(db, "SELECT * FROM creator_profiles WHERE user_id = ?", userId);
  if (!row) throw notFound("Creator profile");
  return row;
}

type EvidenceRow = {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  kind: "PUBLIC" | "CREATOR" | "SAMPLE";
  topics_json: string;
  formats_json: string;
  published_at: string | null;
  retrieved_at: string;
};

/** Evidence rows tied to a channel key, newest first. */
export function evidenceFor(db: Db, profileId: string, channelKey: string | null): EvidenceWithLabels[] {
  if (!channelKey) return [];
  return all<EvidenceRow>(
    db,
    `SELECT id, url, title, excerpt, kind, topics_json, formats_json, published_at, retrieved_at
       FROM evidence WHERE creator_id = ? AND channel_key = ? ORDER BY retrieved_at DESC, id`,
    profileId,
    channelKey,
  ).map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    excerpt: r.excerpt,
    kind: r.kind,
    publishedAt: r.published_at,
    retrievedAt: r.retrieved_at,
    topics: JSON.parse(r.topics_json) as string[],
    formats: JSON.parse(r.formats_json) as Format[],
  }));
}

/** Requirements for LISTED (spec §3.1). Field names match CreatorProfileFields. */
export function listingBlockers(fields: CreatorProfileFields, channelValid: boolean): string[] {
  const out: string[] = [];
  if (!fields.displayName.trim()) out.push("displayName");
  if (!fields.bio.trim()) out.push("bio");
  if (!channelValid) out.push("channel");
  if (normalizeTopics(fields.topics).length === 0) out.push("topics");
  if (fields.formats.length === 0) out.push("formats");
  return out;
}

export function toProfileDto(db: Db, row: ProfileRow): CreatorProfile {
  const draft = JSON.parse(row.draft_json) as CreatorProfileFields;
  const evidence = evidenceFor(db, row.id, row.channel_key);
  let lastEnrichment: EnrichmentResult | null = null;
  if (row.last_enrichment_json) {
    const stored = JSON.parse(row.last_enrichment_json) as StoredEnrichment;
    if (stored.channelKey === row.channel_key) lastEnrichment = stored.result;
  }
  return {
    id: row.id,
    version: row.version,
    visibility: row.visibility,
    canonicalChannelUrl: row.canonical_channel_url,
    draft,
    evidence: evidence.map(({ topics: _t, formats: _f, ...e }) => e),
    lastEnrichment,
    published: row.published_json ? (JSON.parse(row.published_json) as CreatorCard) : null,
    publishedVersion: row.published_version,
    hasUnpublishedChanges: row.version !== row.published_version,
    listingBlockers: listingBlockers(draft, !!row.channel_key),
    updatedAt: row.updated_at,
  };
}

export function getProfile(db: Db, userId: string): CreatorProfile {
  return toProfileDto(db, profileByUser(db, userId));
}

/** PUT /creator/profile: save the draft. Does not change what brands see until re-listed. */
export function updateProfile(db: Db, userId: string, input: CreatorProfileInput): CreatorProfile {
  const { expectedVersion, ...fields } = input;
  let channel = null as ReturnType<typeof normalizeChannel>;
  if (fields.channel.trim()) {
    channel = normalizeChannel(fields.channel);
    if (!channel) {
      throw new ApiError("VALIDATION_ERROR", "Enter a YouTube @handle, youtube.com/@handle or youtube.com/channel/UC… URL.", {
        channel: "Not a supported YouTube channel link or handle.",
      });
    }
  }
  return tx(db, () => {
    const row = profileByUser(db, userId);
    if (row.version !== expectedVersion) {
      throw new ApiError("STALE_PROFILE", "Your profile changed in another tab. Reload and try again.", undefined, { version: row.version });
    }
    const channelKey = channel?.key ?? null;
    // Only evidence for the (possibly new) channel can stay selected.
    const available = new Set(evidenceFor(db, row.id, channelKey).map((e) => e.id));
    const saved: CreatorProfileFields = {
      displayName: fields.displayName,
      bio: fields.bio,
      channel: channel ? channel.display : "",
      topics: normalizeTopics(fields.topics),
      formats: [...new Set(fields.formats)],
      rate: fields.rate,
      typical7dViews: fields.typical7dViews,
      selectedEvidenceIds: [...new Set(fields.selectedEvidenceIds)].filter((id) => available.has(id)),
    };
    run(
      db,
      `UPDATE creator_profiles SET version = version + 1, draft_json = ?, channel_key = ?, canonical_channel_url = ?, updated_at = ?
        WHERE id = ?`,
      JSON.stringify(saved),
      channelKey,
      channel?.url ?? null,
      nowIso(),
      row.id,
    );
    return toProfileDto(db, profileByUser(db, userId));
  });
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed: creator_profiles\.listed_channel_key/i.test(e.message);
}

/** POST /creator/profile/visibility. LISTED publishes the current draft; HIDDEN removes it from the directory. */
export function setVisibility(db: Db, userId: string, input: VisibilityInput): CreatorProfile {
  return tx(db, () => {
    const row = profileByUser(db, userId);
    if (row.version !== input.expectedVersion) {
      throw new ApiError("STALE_PROFILE", "Your profile changed in another tab. Reload and try again.", undefined, { version: row.version });
    }
    const ts = nowIso();
    if (input.visibility === "HIDDEN") {
      run(db, "UPDATE creator_profiles SET visibility = 'HIDDEN', listed_channel_key = NULL, updated_at = ? WHERE id = ?", ts, row.id);
      return toProfileDto(db, profileByUser(db, userId));
    }

    const fields = JSON.parse(row.draft_json) as CreatorProfileFields;
    const blockers = listingBlockers(fields, !!row.channel_key);
    if (blockers.length > 0) {
      const f: Record<string, string> = {};
      for (const b of blockers) f[b] = "Required to list your profile.";
      throw new ApiError("VALIDATION_ERROR", "Complete your profile before listing it.", f, { listingBlockers: blockers });
    }
    const evidence = evidenceFor(db, row.id, row.channel_key);
    const selected = evidence.filter((e) => fields.selectedEvidenceIds.includes(e.id));
    const isSample = row.is_sample === 1;
    const dataMode: CreatorDataMode = isSample ? "SAMPLE" : selected.some((e) => e.kind === "PUBLIC") ? "LIVE" : "SELF_REPORTED";
    const prev = row.published_json ? (JSON.parse(row.published_json) as CreatorCard) : null;
    const card = buildCard({
      profileId: row.id,
      version: row.version,
      fields,
      canonicalUrl: row.canonical_channel_url!,
      allEvidence: evidence,
      dataMode,
      isSample,
      sampleExpectedClicks: isSample && prev?.expectedClicks ? { low: prev.expectedClicks.low, high: prev.expectedClicks.high } : null,
    });
    try {
      run(
        db,
        `UPDATE creator_profiles SET visibility = 'LISTED', published_json = ?, published_version = version,
           listed_channel_key = channel_key, data_mode = ?, updated_at = ? WHERE id = ?`,
        JSON.stringify(card),
        dataMode,
        ts,
        row.id,
      );
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ApiError("VALIDATION_ERROR", "Another listed profile already uses this channel.", {
          channel: "This channel is already listed by another creator.",
        });
      }
      throw e;
    }
    return toProfileDto(db, profileByUser(db, userId));
  });
}
