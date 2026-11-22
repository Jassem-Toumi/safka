import { z } from "zod";
import { ActorSummary, Cents, Id, IsoDateTime } from "./common";
import { Budget } from "./campaign";
import { ActorRole, DealAction, DealStatus, Format, IssueCode, PaymentStatus, Role } from "./enums";

const ShortItem = z.string().trim().min(1).max(240);

export const TermsInput = z.object({
  amountCents: Cents,
  format: Format,
  brief: z.string().trim().min(1).max(2000),
  angle: z.string().trim().max(500).nullable(),
  talkingPoints: z.array(ShortItem).max(6),
  restrictions: z.array(ShortItem).max(6),
  disclosure: z.string().trim().min(1).max(500),
  draftDueAt: IsoDateTime,
  publishDueAt: IsoDateTime,
  viewTarget: z.number().int().positive().nullable(),
  clickTarget: z.number().int().positive().nullable(),
});
export type TermsInput = z.infer<typeof TermsInput>;

export const ProductSnapshot = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  landingUrl: z.string().nullable(),
});

export const Terms = TermsInput.extend({
  currency: z.literal("USD"),
  platform: z.literal("YOUTUBE"),
  product: ProductSnapshot,
});
export type Terms = z.infer<typeof Terms>;

/** POST /api/v1/deals body (requires Idempotency-Key header). */
export const CreateDealInput = z.object({
  creatorId: Id,
  productId: Id,
  campaignId: Id.nullable(),
  terms: TermsInput,
});
export type CreateDealInput = z.infer<typeof CreateDealInput>;

const base = { expectedVersion: z.number().int() };
const reason = z.string().trim().min(1).max(1000);

/** POST /api/v1/deals/{id}/actions body (requires Idempotency-Key header). */
export const DealActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACCEPT"), ...base, proposalId: Id }),
  z.object({ action: z.literal("DECLINE"), ...base, proposalId: Id }),
  z.object({
    action: z.literal("COUNTER"),
    ...base,
    proposalId: Id,
    amountCents: Cents,
    draftDueAt: IsoDateTime,
    publishDueAt: IsoDateTime,
    angle: z.string().trim().max(500).nullable(),
  }),
  z.object({ action: z.literal("WITHDRAW"), ...base }),
  z.object({
    action: z.literal("SUBMIT_DRAFTS"),
    ...base,
    uploadIds: z
      .array(Id)
      .min(1)
      .max(2)
      .refine((a) => new Set(a).size === a.length, { message: "uploadIds must be unique" }),
  }),
  z.object({ action: z.literal("REQUEST_CHANGES"), ...base, reason }),
  z.object({ action: z.literal("APPROVE_DRAFT"), ...base, assetId: Id }),
  z.object({
    action: z.literal("SUBMIT_PUBLICATION"),
    ...base,
    url: z.string().trim().min(1).max(2048),
    publishedAt: IsoDateTime,
    attested: z.literal(true),
  }),
  z.object({ action: z.literal("CONFIRM_DELIVERY"), ...base }),
  z.object({ action: z.literal("REPORT_ISSUE"), ...base, code: IssueCode, reason }),
  z.object({ action: z.literal("RESUME_DEAL"), ...base, disputeId: Id, reason }),
  z.object({ action: z.literal("CANCEL_DEAL"), ...base, disputeId: Id, reason }),
  z.object({ action: z.literal("RELEASE_PAYMENT"), ...base, disputeId: Id, reason }),
  z.object({ action: z.literal("REFUND_PAYMENT"), ...base, disputeId: Id, reason }),
]);
export type DealActionInput = z.infer<typeof DealActionInput>;

export const Proposal = z.object({
  id: Id,
  revision: z.number().int(),
  authorRole: z.enum(["BRAND", "CREATOR"]),
  expiresAt: IsoDateTime,
  createdAt: IsoDateTime,
  terms: Terms,
});
export type Proposal = z.infer<typeof Proposal>;

export const Agreement = z.object({ proposalId: Id, acceptedAt: IsoDateTime, terms: Terms });
export type Agreement = z.infer<typeof Agreement>;

export const DraftAsset = z.object({ id: Id, label: z.string(), sizeBytes: z.number().int() });
export const DraftBatch = z.object({
  id: Id,
  round: z.number().int(),
  submittedAt: IsoDateTime,
  /** True when submitted after the agreed draft deadline. */
  late: z.boolean(),
  /** Brand feedback that closed this round, if changes were requested. */
  changeRequest: z.string().nullable(),
  assets: z.array(DraftAsset),
});
export type DraftBatch = z.infer<typeof DraftBatch>;

export const Publication = z.object({
  url: z.string(),
  videoId: z.string(),
  publishedAt: IsoDateTime,
  submittedAt: IsoDateTime,
  late: z.boolean(),
  /** Seeded demo link, not a real sponsored post. */
  sample: z.boolean(),
});
export type Publication = z.infer<typeof Publication>;

export const Confirmation = z.object({ role: z.enum(["BRAND", "CREATOR"]), confirmedAt: IsoDateTime });

export const Dispute = z.object({
  id: Id,
  dealId: Id,
  openedAt: IsoDateTime,
  openedByRole: z.enum(["BRAND", "CREATOR"]),
  code: IssueCode,
  reason: z.string(),
  priorStatus: DealStatus,
  resolvedAt: IsoDateTime.nullable(),
  resolution: z.enum(["RESUME_DEAL", "CANCEL_DEAL", "RELEASE_PAYMENT", "REFUND_PAYMENT"]).nullable(),
  resolutionReason: z.string().nullable(),
});
export type Dispute = z.infer<typeof Dispute>;

export const TimelineEvent = z.object({
  id: Id,
  actorRole: ActorRole,
  action: z.string(),
  createdAt: IsoDateTime,
  note: z.string().nullable(),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const Deal = z.object({
  id: Id,
  version: z.number().int(),
  status: DealStatus,
  paymentStatus: PaymentStatus,
  brand: ActorSummary,
  creator: ActorSummary,
  campaignId: Id.nullable(),
  /** Campaign budget, only for the owning brand on campaign deals. */
  budget: Budget.nullable(),
  latestProposal: Proposal,
  agreement: Agreement.nullable(),
  draftBatches: z.array(DraftBatch),
  approvedAssetId: Id.nullable(),
  publication: Publication.nullable(),
  confirmations: z.array(Confirmation),
  /** Current open dispute, or the most recent one. */
  dispute: Dispute.nullable(),
  /** Who acts next; null when nobody or when both still must confirm. */
  nextActionRole: Role.nullable(),
  /** Actions the viewer may take now (server-authorized). */
  availableActions: z.array(DealAction),
  timeline: z.array(TimelineEvent),
  /** True for clearly labeled seeded sample deals. */
  sample: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  isOverdue: z.boolean(),
});
export type Deal = z.infer<typeof Deal>;

/** GET /api/v1/deals query. */
export const DealListQuery = z.object({
  filter: z.enum(["needs_action", "in_progress", "closed"]).optional(),
  campaignId: Id.optional(),
});

/** POST /api/v1/deals/{id}/uploads response. */
export const UploadResult = z.object({ uploadId: Id, status: z.literal("READY"), sizeBytes: z.number().int() });
export type UploadResult = z.infer<typeof UploadResult>;

/** GET /api/v1/deals/{id}/assets/{assetId}/playback response. */
export const PlaybackResult = z.object({ url: z.string(), expiresAt: z.null() });
export type PlaybackResult = z.infer<typeof PlaybackResult>;

export const UPLOAD_LIMITS = { maxBytes: 20 * 1024 * 1024, maxUnattachedPerDeal: 6, maxBatches: 3 } as const;
export const PROPOSAL_TTL_DAYS = 7;

/** GET /api/v1/admin/disputes item. */
export const AdminDisputeSummary = Dispute.extend({
  brand: ActorSummary,
  creator: ActorSummary,
  paymentStatus: PaymentStatus,
  amountCents: z.number().int(),
});
export type AdminDisputeSummary = z.infer<typeof AdminDisputeSummary>;

/** GET /api/v1/admin/disputes/{id} response. */
export const AdminDisputeDetail = z.object({ dispute: Dispute, deal: Deal, history: z.array(Dispute) });
export type AdminDisputeDetail = z.infer<typeof AdminDisputeDetail>;
