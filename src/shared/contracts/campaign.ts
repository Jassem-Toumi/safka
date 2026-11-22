import { z } from "zod";
import { Cents, Id, IsoDateTime } from "./common";
import { CreatorCard } from "./creator";
import { BriefMode, CampaignStatus, Format, Objective, RateFit } from "./enums";

const ShortItem = z.string().trim().min(1).max(240);

export const Brief = z.object({
  title: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(1500),
  objective: Objective,
  /** Normalized slugs server-side. At least one required to activate. */
  topics: z.array(z.string().trim().min(1).max(60)).max(8),
  /** Empty = open to any format. */
  formats: z.array(Format).max(7),
  talkingPoints: z.array(ShortItem).max(6),
  restrictions: z.array(ShortItem).max(6),
});
export type Brief = z.infer<typeof Brief>;

/** Looser brief accepted for drafts and returned from /parse (fields may be blank for review). */
export const BriefDraft = Brief.extend({
  title: z.string().trim().max(80),
  goal: z.string().trim().max(1500),
  objective: Objective.nullable(),
});
export type BriefDraft = z.infer<typeof BriefDraft>;

export const Budget = z.object({
  budgetCents: z.number().int(),
  committedCents: z.number().int(),
  spentCents: z.number().int(),
  remainingCents: z.number().int(),
});
export type Budget = z.infer<typeof Budget>;

/** POST /api/v1/campaigns/parse body. */
export const ParseInput = z.object({ productId: Id, prompt: z.string().trim().min(1).max(3000) });
export type ParseInput = z.infer<typeof ParseInput>;

/** POST /api/v1/campaigns/parse response. Label in UI as "Suggested brief". */
export const ParseResult = z.object({
  brief: BriefDraft,
  budgetCents: z.number().int().positive().nullable(),
  preferredMaxPerPostCents: z.number().int().positive().nullable(),
  defaultViewTarget: z.number().int().positive().nullable(),
  defaultClickTarget: z.number().int().positive().nullable(),
  mode: BriefMode,
});
export type ParseResult = z.infer<typeof ParseResult>;

/**
 * POST /api/v1/campaigns (create) and PATCH /api/v1/campaigns/{id} (edit) body.
 * Without `confirm`, saves a DRAFT. `confirm: true` requires a complete Brief and budget and activates.
 * PATCH requires `expectedVersion`. Close with { status: "CLOSED", expectedVersion }.
 */
export const CampaignInput = z.object({
  productId: Id,
  sourcePrompt: z.string().max(3000).default(""),
  brief: BriefDraft.nullable(),
  budgetCents: Cents.nullable(),
  preferredMaxPerPostCents: Cents.nullable(),
  defaultViewTarget: z.number().int().positive().nullable(),
  defaultClickTarget: z.number().int().positive().nullable(),
  confirm: z.boolean().optional(),
});
export type CampaignInput = z.input<typeof CampaignInput>;

export const CampaignPatch = CampaignInput.partial().extend({
  expectedVersion: z.number().int(),
  status: z.literal("CLOSED").optional(),
});
export type CampaignPatch = z.input<typeof CampaignPatch>;

export const Campaign = z.object({
  id: Id,
  productId: Id,
  sourcePrompt: z.string(),
  version: z.number().int(),
  status: CampaignStatus,
  brief: BriefDraft.nullable(),
  budget: Budget.nullable(),
  preferredMaxPerPostCents: z.number().int().nullable(),
  defaultViewTarget: z.number().int().nullable(),
  defaultClickTarget: z.number().int().nullable(),
  dealCount: z.number().int(),
  /** True when there is a NEGOTIATING, unexpired deal (campaign cannot close). */
  hasOpenNegotiations: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Campaign = z.infer<typeof Campaign>;

export const MatchReason = z.object({ text: z.string(), evidenceIds: z.array(Id) });

/** GET /api/v1/campaigns/{id}/matches item. */
export const MatchCard = z.object({
  creator: CreatorCard,
  topicMatchPct: z.number().int().min(0).max(100),
  formatMatch: z.boolean(),
  rateFit: RateFit,
  reasons: z.array(MatchReason),
  /** Suggested video angle (editable in the offer composer). */
  angle: z.string().nullable(),
  campaignVersion: z.number().int(),
});
export type MatchCard = z.infer<typeof MatchCard>;
