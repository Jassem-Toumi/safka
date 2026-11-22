import { z } from "zod";

/** Stable API enum strings. Frontend imports these; never hand-copy them. */

export const Role = z.enum(["BRAND", "CREATOR", "ADMIN"]);
export type Role = z.infer<typeof Role>;

export const ProfileVisibility = z.enum(["DRAFT", "LISTED", "HIDDEN"]);
export type ProfileVisibility = z.infer<typeof ProfileVisibility>;

export const Objective = z.enum(["AWARENESS", "TRAFFIC", "SALES", "CONTENT"]);
export type Objective = z.infer<typeof Objective>;

export const Format = z.enum(["REVIEW", "DEMO", "TUTORIAL", "UNBOXING", "COMPARISON", "STORY", "OTHER"]);
export type Format = z.infer<typeof Format>;

export const CampaignStatus = z.enum(["DRAFT", "ACTIVE", "CLOSED"]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const DealStatus = z.enum([
  "NEGOTIATING",
  "AGREED",
  "DRAFT_REVIEW",
  "REVISION_REQUESTED",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "DISPUTED",
  "COMPLETED",
  "REFUNDED",
  "CANCELLED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
]);
export type DealStatus = z.infer<typeof DealStatus>;

export const TERMINAL_DEAL_STATUSES: readonly DealStatus[] = [
  "COMPLETED",
  "REFUNDED",
  "CANCELLED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
];

/** Agreed states from which REPORT_ISSUE is allowed. */
export const DISPUTABLE_DEAL_STATUSES: readonly DealStatus[] = [
  "AGREED",
  "DRAFT_REVIEW",
  "REVISION_REQUESTED",
  "READY_TO_PUBLISH",
  "PUBLISHED",
];

export const PaymentStatus = z.enum(["NONE", "HELD", "RELEASED", "REFUNDED"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const DealAction = z.enum([
  "ACCEPT",
  "DECLINE",
  "COUNTER",
  "WITHDRAW",
  "SUBMIT_DRAFTS",
  "REQUEST_CHANGES",
  "APPROVE_DRAFT",
  "SUBMIT_PUBLICATION",
  "CONFIRM_DELIVERY",
  "REPORT_ISSUE",
  "RESUME_DEAL",
  "CANCEL_DEAL",
  "RELEASE_PAYMENT",
  "REFUND_PAYMENT",
]);
export type DealAction = z.infer<typeof DealAction>;

export const IssueCode = z.enum([
  "MISSED_DEADLINE",
  "CONTENT_MISMATCH",
  "MISSING_DISCLOSURE",
  "INVALID_PUBLICATION",
  "UNRESPONSIVE_PARTY",
  "OTHER",
]);
export type IssueCode = z.infer<typeof IssueCode>;

export const LabelOrigin = z.enum(["PUBLIC", "CREATOR", "SAMPLE"]);
export type LabelOrigin = z.infer<typeof LabelOrigin>;

export const EvidenceKind = z.enum(["PUBLIC", "CREATOR", "SAMPLE"]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

export const CreatorDataMode = z.enum(["LIVE", "SELF_REPORTED", "SAMPLE"]);
export type CreatorDataMode = z.infer<typeof CreatorDataMode>;

export const MetricSource = z.enum(["PUBLIC", "SELF_REPORTED", "SAMPLE"]);
export type MetricSource = z.infer<typeof MetricSource>;

export const EnrichmentStatus = z.enum(["READY", "EMPTY", "FAILED"]);
export type EnrichmentStatus = z.infer<typeof EnrichmentStatus>;

export const EnrichmentMode = z.enum(["LIVE", "SAMPLE"]);
export type EnrichmentMode = z.infer<typeof EnrichmentMode>;

export const BriefMode = z.enum(["RULES", "AI"]);
export type BriefMode = z.infer<typeof BriefMode>;

export const RateFit = z.enum(["WITHIN_PREFERENCE", "UNKNOWN", "ABOVE_PREFERENCE"]);
export type RateFit = z.infer<typeof RateFit>;

export const ReportMetricStatus = z.enum(["NO_TARGET", "PENDING", "INSUFFICIENT_DATA", "MET", "BELOW_TARGET"]);
export type ReportMetricStatus = z.infer<typeof ReportMetricStatus>;

export const ReportMetricSource = z.enum(["SELF_REPORTED", "TRACKED", "SAMPLE"]);
export type ReportMetricSource = z.infer<typeof ReportMetricSource>;

export const DealListFilter = z.enum(["needs_action", "in_progress", "closed"]);
export type DealListFilter = z.infer<typeof DealListFilter>;

export const ActorRole = z.enum(["BRAND", "CREATOR", "ADMIN", "SYSTEM"]);
export type ActorRole = z.infer<typeof ActorRole>;

export const ErrorCode = z.enum([
  "VALIDATION_ERROR",
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "STALE_DEAL",
  "STALE_PROFILE",
  "STALE_CAMPAIGN",
  "BUDGET_EXCEEDED",
  "INVALID_STATE",
  "PROPOSAL_EXPIRED",
  "ACTIVE_NEGOTIATION_EXISTS",
  "PROFILE_UNAVAILABLE",
  "IDEMPOTENCY_CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "RETRY_LATER",
  "PROVIDER_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
