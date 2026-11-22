import type {
  CreatorCard,
  CreatorDataMode,
  CreatorProfileFields,
  Evidence,
  Format,
  Label,
  Metric,
} from "@/shared/contracts";
import { normalizeTopics } from "@/shared/topics";

/** Evidence row with the labels it supports (stored on the evidence table). */
export type EvidenceWithLabels = Evidence & { topics: string[]; formats: Format[] };

/**
 * Attach provenance to each label: a label backed by a selected evidence row inherits that row's
 * kind (PUBLIC / SAMPLE); anything else is CREATOR-provided.
 */
export function labelsFor(values: string[], selected: EvidenceWithLabels[], pick: (e: EvidenceWithLabels) => string[]): Label[] {
  return values.map((value) => {
    const backing = selected.filter((e) => pick(e).includes(value));
    if (backing.length === 0) return { value, origin: "CREATOR" as const, evidenceIds: [] };
    const origin = backing.some((e) => e.kind === "PUBLIC") ? ("PUBLIC" as const) : backing.some((e) => e.kind === "SAMPLE") ? ("SAMPLE" as const) : ("CREATOR" as const);
    return { value, origin, evidenceIds: backing.map((e) => e.id) };
  });
}

export function buildCard(args: {
  profileId: string;
  version: number;
  fields: CreatorProfileFields;
  canonicalUrl: string;
  allEvidence: EvidenceWithLabels[];
  dataMode: CreatorDataMode;
  isSample: boolean;
  publicMetrics?: Metric[];
  sampleExpectedClicks?: { low: number; high: number } | null;
}): CreatorCard {
  const selected = args.allEvidence.filter((e) => args.fields.selectedEvidenceIds.includes(e.id));
  const topics = normalizeTopics(args.fields.topics);
  return {
    id: args.profileId,
    displayName: args.fields.displayName,
    bio: args.fields.bio,
    profileUrl: args.canonicalUrl,
    topics: labelsFor(topics, selected, (e) => e.topics),
    formats: labelsFor(args.fields.formats, selected, (e) => e.formats),
    rate: args.fields.rate,
    typical7dViews: args.fields.typical7dViews,
    publicMetrics: args.publicMetrics ?? [],
    evidence: selected.map(({ topics: _t, formats: _f, ...e }) => e),
    dataMode: args.dataMode,
    // Forecast clicks only ever appear as labeled sample data.
    expectedClicks: args.isSample && args.sampleExpectedClicks ? { ...args.sampleExpectedClicks, isSample: true } : null,
    profileVersion: args.version,
  };
}
