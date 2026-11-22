import { z } from "zod";
import { Id, IsoDateTime } from "./common";
import {
  CreatorDataMode,
  EnrichmentMode,
  EnrichmentStatus,
  EvidenceKind,
  Format,
  LabelOrigin,
  MetricSource,
  ProfileVisibility,
} from "./enums";

export const LIMITS = {
  displayName: 80,
  bio: 600,
  url: 2048,
  maxTopics: 8,
  maxFormats: 4,
} as const;

export const Evidence = z.object({
  id: Id,
  url: z.string(),
  title: z.string(),
  excerpt: z.string(),
  retrievedAt: IsoDateTime,
  publishedAt: IsoDateTime.nullable(),
  kind: EvidenceKind,
});
export type Evidence = z.infer<typeof Evidence>;

export const Label = z.object({
  value: z.string(),
  origin: LabelOrigin,
  evidenceIds: z.array(Id),
});
export type Label = z.infer<typeof Label>;

export const Rate = z
  .object({ minCents: z.number().int().positive(), maxCents: z.number().int().positive() })
  .refine((r) => r.minCents <= r.maxCents, { message: "minCents must be <= maxCents", path: ["maxCents"] });
export type Rate = z.infer<typeof Rate>;

export const Metric = z.object({
  label: z.string(),
  value: z.number(),
  approximate: z.boolean(),
  subject: z.string(),
  measuredAt: IsoDateTime.nullable(),
  evidenceId: Id.nullable(),
  source: MetricSource,
});
export type Metric = z.infer<typeof Metric>;

export const ExpectedClicks = z.object({ low: z.number().int(), high: z.number().int(), isSample: z.literal(true) });

/** Brand-facing card built from the creator's PUBLISHED snapshot. */
export const CreatorCard = z.object({
  id: Id,
  displayName: z.string(),
  bio: z.string(),
  profileUrl: z.string(),
  topics: z.array(Label),
  formats: z.array(Label),
  rate: Rate.nullable(),
  typical7dViews: z.number().int().nonnegative().nullable(),
  publicMetrics: z.array(Metric),
  evidence: z.array(Evidence),
  dataMode: CreatorDataMode,
  expectedClicks: ExpectedClicks.nullable(),
  profileVersion: z.number().int(),
});
export type CreatorCard = z.infer<typeof CreatorCard>;

/** Editable fields. Topics are free text, normalized to slugs server-side. */
export const CreatorProfileFields = z.object({
  displayName: z.string().trim().max(LIMITS.displayName),
  bio: z.string().trim().max(LIMITS.bio),
  /** @handle, youtube.com/@handle, or youtube.com/channel/UC… */
  channel: z.string().trim().max(LIMITS.url),
  topics: z.array(z.string().trim().min(1).max(60)).max(LIMITS.maxTopics),
  formats: z.array(Format).max(LIMITS.maxFormats),
  rate: Rate.nullable(),
  typical7dViews: z.number().int().nonnegative().nullable(),
  /** Evidence rows (from the latest enrichment) the creator chose to keep. */
  selectedEvidenceIds: z.array(Id).max(20),
});
export type CreatorProfileFields = z.infer<typeof CreatorProfileFields>;

/** PUT /api/v1/creator/profile body. */
export const CreatorProfileInput = CreatorProfileFields.extend({ expectedVersion: z.number().int() });
export type CreatorProfileInput = z.infer<typeof CreatorProfileInput>;

/** POST /api/v1/creator/profile/visibility body. */
export const VisibilityInput = z.object({
  visibility: z.enum(["LISTED", "HIDDEN"]),
  expectedVersion: z.number().int(),
});
export type VisibilityInput = z.infer<typeof VisibilityInput>;

export const EnrichmentSuggestions = z.object({ topics: z.array(Label), formats: z.array(Label) });

/** POST /api/v1/creator/enrichment response (synchronous, terminal). */
export const EnrichmentResult = z.object({
  status: EnrichmentStatus,
  mode: EnrichmentMode,
  evidence: z.array(Evidence),
  suggestions: EnrichmentSuggestions,
  retrievedAt: IsoDateTime,
  errorCode: z.string().nullable(),
  /** Profile version the result was applied against. */
  profileVersion: z.number().int(),
});
export type EnrichmentResult = z.infer<typeof EnrichmentResult>;

/** GET/PUT /api/v1/creator/profile response. */
export const CreatorProfile = z.object({
  id: Id,
  version: z.number().int(),
  visibility: ProfileVisibility,
  /** Canonical https://www.youtube.com/@handle or /channel/UC… or null if unset/invalid. */
  canonicalChannelUrl: z.string().nullable(),
  draft: CreatorProfileFields,
  /** Evidence available for selection (tied to the current channel). */
  evidence: z.array(Evidence),
  /** Latest enrichment result for the current channel, if any. */
  lastEnrichment: EnrichmentResult.nullable(),
  /** What brands currently see. Null until first listed. */
  published: CreatorCard.nullable(),
  publishedVersion: z.number().int().nullable(),
  hasUnpublishedChanges: z.boolean(),
  /** Missing requirements for LISTED, e.g. ["bio", "topics"]. Empty when listable. */
  listingBlockers: z.array(z.string()),
  updatedAt: IsoDateTime,
});
export type CreatorProfile = z.infer<typeof CreatorProfile>;

/** GET /api/v1/creators query. */
export const CreatorDirectoryQuery = z.object({
  q: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(60).optional(),
  format: Format.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type CreatorDirectoryQuery = z.infer<typeof CreatorDirectoryQuery>;
