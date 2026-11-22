import {
  DISPUTABLE_DEAL_STATUSES,
  TERMINAL_DEAL_STATUSES,
  type Deal,
  type DealAction,
  type DealStatus,
  type Dispute,
  type DraftBatch,
  type PaymentStatus,
  type Proposal,
  type Role,
  type Terms,
} from "@/shared/contracts";
import { campaignBudget } from "../campaigns/budget";
import { all, one, type Db } from "../db/db";
import { nowIso } from "../clock";
import type { SessionUser } from "../http/auth";
import { notFound } from "../http/errors";

export type DealRow = {
  id: string;
  brand_id: string;
  creator_user_id: string;
  creator_profile_id: string;
  campaign_id: string | null;
  product_id: string;
  negotiation_context: string;
  status: DealStatus;
  payment_status: PaymentStatus;
  version: number;
  latest_proposal_id: string | null;
  accepted_proposal_id: string | null;
  agreed_amount_cents: number | null;
  agreement_json: string | null;
  accepted_at: string | null;
  approved_asset_id: string | null;
  approved_at: string | null;
  publication_url: string | null;
  publication_video_id: string | null;
  published_at: string | null;
  publication_submitted_at: string | null;
  publication_sample: number;
  brand_confirmed_at: string | null;
  creator_confirmed_at: string | null;
  ever_published: number;
  is_sample: number;
  sample_metrics_json: string | null;
  created_at: string;
  updated_at: string;
};

type ProposalRow = { id: string; revision: number; author_role: "BRAND" | "CREATOR"; terms_json: string; expires_at: string; created_at: string };
type DisputeRow = {
  id: string;
  deal_id: string;
  opened_by_role: "BRAND" | "CREATOR";
  code: Dispute["code"];
  reason: string;
  prior_status: DealStatus;
  opened_at: string;
  resolved_at: string | null;
  resolution: Dispute["resolution"];
  resolution_reason: string | null;
};

export function dealRow(db: Db, id: string): DealRow | undefined {
  return one<DealRow>(db, "SELECT * FROM deals WHERE id = ?", id);
}

export function latestProposal(db: Db, d: DealRow): ProposalRow {
  return one<ProposalRow>(db, "SELECT * FROM proposals WHERE id = ?", d.latest_proposal_id ?? "")!;
}

/** Status as of the server clock: an unanswered proposal past its expiry reads as EXPIRED (no scheduler). */
export function effectiveStatus(db: Db, d: DealRow, at = nowIso()): DealStatus {
  if (d.status !== "NEGOTIATING") return d.status;
  return latestProposal(db, d).expires_at <= at ? "EXPIRED" : "NEGOTIATING";
}

export function hasAnyDispute(db: Db, dealId: string): boolean {
  return !!one(db, "SELECT 1 FROM disputes WHERE deal_id = ? LIMIT 1", dealId);
}

/** Viewer's role on this deal, or null when the deal is inaccessible (→ 404). Admins only see deals with a dispute. */
export function viewerRole(db: Db, d: DealRow, user: SessionUser): Role | null {
  if (user.role === "BRAND" && d.brand_id === user.id) return "BRAND";
  if (user.role === "CREATOR" && d.creator_user_id === user.id) return "CREATOR";
  if (user.role === "ADMIN" && hasAnyDispute(db, d.id)) return "ADMIN";
  return null;
}

export function accessibleDeal(db: Db, user: SessionUser, id: string): { row: DealRow; role: Role } {
  const row = dealRow(db, id);
  const role = row ? viewerRole(db, row, user) : null;
  if (!row || !role) throw notFound("Deal");
  return { row, role };
}

export function batchCount(db: Db, dealId: string): number {
  return one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM draft_batches WHERE deal_id = ?", dealId)!.n;
}

export function openDispute(db: Db, dealId: string): DisputeRow | undefined {
  return one<DisputeRow>(db, "SELECT * FROM disputes WHERE deal_id = ? AND resolved_at IS NULL", dealId);
}

/** Server-authorized actions for this viewer right now. */
export function availableActions(db: Db, d: DealRow, role: Role, at = nowIso()): DealAction[] {
  const status = effectiveStatus(db, d, at);
  const out: DealAction[] = [];
  switch (status) {
    case "NEGOTIATING": {
      const p = latestProposal(db, d);
      if (role !== "ADMIN" && role !== p.author_role) out.push("ACCEPT", "COUNTER", "DECLINE");
      if (role === "BRAND") out.push("WITHDRAW");
      break;
    }
    case "AGREED":
    case "REVISION_REQUESTED":
      if (role === "CREATOR") out.push("SUBMIT_DRAFTS");
      break;
    case "DRAFT_REVIEW":
      if (role === "BRAND") {
        out.push("APPROVE_DRAFT");
        if (batchCount(db, d.id) < 3) out.push("REQUEST_CHANGES");
      }
      break;
    case "READY_TO_PUBLISH":
      if (role === "CREATOR") out.push("SUBMIT_PUBLICATION");
      break;
    case "PUBLISHED":
      if ((role === "BRAND" && !d.brand_confirmed_at) || (role === "CREATOR" && !d.creator_confirmed_at)) out.push("CONFIRM_DELIVERY");
      break;
    case "DISPUTED":
      if (role === "ADMIN") {
        out.push("RESUME_DEAL");
        if (d.payment_status === "NONE") out.push("CANCEL_DEAL");
        if (d.payment_status === "HELD") out.push("REFUND_PAYMENT", "RELEASE_PAYMENT");
      }
      break;
    default:
      break;
  }
  if (role !== "ADMIN" && DISPUTABLE_DEAL_STATUSES.includes(status)) out.push("REPORT_ISSUE");
  return out;
}

export function nextActionRole(db: Db, d: DealRow, at = nowIso()): Role | null {
  switch (effectiveStatus(db, d, at)) {
    case "NEGOTIATING":
      return latestProposal(db, d).author_role === "BRAND" ? "CREATOR" : "BRAND";
    case "AGREED":
    case "REVISION_REQUESTED":
    case "READY_TO_PUBLISH":
      return "CREATOR";
    case "DRAFT_REVIEW":
      return "BRAND";
    case "PUBLISHED":
      if (d.brand_confirmed_at && !d.creator_confirmed_at) return "CREATOR";
      if (!d.brand_confirmed_at && d.creator_confirmed_at) return "BRAND";
      return null;
    case "DISPUTED":
      return "ADMIN";
    default:
      return null;
  }
}

export const isTerminal = (s: DealStatus) => TERMINAL_DEAL_STATUSES.includes(s);

function toProposal(p: ProposalRow): Proposal {
  return { id: p.id, revision: p.revision, authorRole: p.author_role, expiresAt: p.expires_at, createdAt: p.created_at, terms: JSON.parse(p.terms_json) as Terms };
}

export function toDispute(r: DisputeRow): Dispute {
  return {
    id: r.id,
    dealId: r.deal_id,
    openedAt: r.opened_at,
    openedByRole: r.opened_by_role,
    code: r.code,
    reason: r.reason,
    priorStatus: r.prior_status,
    resolvedAt: r.resolved_at,
    resolution: r.resolution,
    resolutionReason: r.resolution_reason,
  };
}

export function disputesFor(db: Db, dealId: string): Dispute[] {
  return all<DisputeRow>(db, "SELECT * FROM disputes WHERE deal_id = ? ORDER BY opened_at DESC, id", dealId).map(toDispute);
}

function batches(db: Db, dealId: string): DraftBatch[] {
  const rows = all<{ id: string; round: number; submitted_at: string; late: number; change_request: string | null }>(
    db,
    "SELECT id, round, submitted_at, late, change_request FROM draft_batches WHERE deal_id = ? ORDER BY round",
    dealId,
  );
  return rows.map((b) => ({
    id: b.id,
    round: b.round,
    submittedAt: b.submitted_at,
    late: b.late === 1,
    changeRequest: b.change_request,
    assets: all<{ id: string; label: string; size_bytes: number }>(
      db,
      "SELECT a.id, a.label, u.size_bytes FROM draft_assets a JOIN uploads u ON u.id = a.upload_id WHERE a.batch_id = ? ORDER BY a.position",
      b.id,
    ).map((a) => ({ id: a.id, label: a.label, sizeBytes: a.size_bytes })),
  }));
}

const name = (db: Db, userId: string) => one<{ display_name: string }>(db, "SELECT display_name FROM users WHERE id = ?", userId)?.display_name ?? "";

export function isOverdue(d: DealRow, status: DealStatus, at = nowIso()): boolean {
  if (!d.agreement_json) return false;
  const t = JSON.parse(d.agreement_json) as Terms;
  if (status === "AGREED" || status === "REVISION_REQUESTED") return at > t.draftDueAt;
  if (status === "DRAFT_REVIEW" || status === "READY_TO_PUBLISH") return at > t.publishDueAt;
  return false;
}

export function toDealDto(db: Db, d: DealRow, role: Role, at = nowIso()): Deal {
  const status = effectiveStatus(db, d, at);
  const agreementTerms = d.agreement_json ? (JSON.parse(d.agreement_json) as Terms) : null;
  const confirmations: Deal["confirmations"] = [];
  if (d.creator_confirmed_at) confirmations.push({ role: "CREATOR", confirmedAt: d.creator_confirmed_at });
  if (d.brand_confirmed_at) confirmations.push({ role: "BRAND", confirmedAt: d.brand_confirmed_at });
  const disputes = disputesFor(db, d.id);
  const open = disputes.find((x) => x.resolvedAt === null);
  return {
    id: d.id,
    version: d.version,
    status,
    paymentStatus: d.payment_status,
    brand: { id: d.brand_id, displayName: name(db, d.brand_id) },
    // Creator is identified by profile ID (same as directory cards and CreateDealInput.creatorId).
    creator: { id: d.creator_profile_id, displayName: name(db, d.creator_user_id) },
    campaignId: d.campaign_id,
    budget:
      role === "BRAND" && d.campaign_id
        ? campaignBudget(db, d.campaign_id, one<{ b: number | null }>(db, "SELECT budget_cents AS b FROM campaigns WHERE id = ?", d.campaign_id)?.b ?? null)
        : null,
    latestProposal: toProposal(latestProposal(db, d)),
    agreement: agreementTerms && d.accepted_proposal_id && d.accepted_at ? { proposalId: d.accepted_proposal_id, acceptedAt: d.accepted_at, terms: agreementTerms } : null,
    draftBatches: batches(db, d.id),
    approvedAssetId: d.approved_asset_id,
    publication:
      d.publication_url && d.publication_video_id && d.published_at
        ? {
            url: d.publication_url,
            videoId: d.publication_video_id,
            publishedAt: d.published_at,
            submittedAt: d.publication_submitted_at ?? d.published_at,
            late: !!agreementTerms && d.published_at > agreementTerms.publishDueAt,
            sample: d.publication_sample === 1,
          }
        : null,
    confirmations,
    dispute: open ?? disputes[0] ?? null,
    nextActionRole: nextActionRole(db, d, at),
    availableActions: availableActions(db, d, role, at),
    timeline: all<{ id: string; actor_role: Deal["timeline"][number]["actorRole"]; action: string; created_at: string; note: string | null }>(
      db,
      "SELECT id, actor_role, action, created_at, note FROM deal_events WHERE deal_id = ? ORDER BY seq",
      d.id,
    ).map((e) => ({ id: e.id, actorRole: e.actor_role, action: e.action, createdAt: e.created_at, note: e.note })),
    sample: d.is_sample === 1,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    isOverdue: isOverdue(d, status, at),
  };
}

/** Deals visible to this user in list views. */
export function visibleDealRows(db: Db, user: SessionUser, campaignId?: string): DealRow[] {
  const campaignClause = campaignId ? " AND campaign_id = ?" : "";
  const extra = campaignId ? [campaignId] : [];
  if (user.role === "BRAND") return all<DealRow>(db, `SELECT * FROM deals WHERE brand_id = ?${campaignClause}`, user.id, ...extra);
  if (user.role === "CREATOR") return all<DealRow>(db, `SELECT * FROM deals WHERE creator_user_id = ?${campaignClause}`, user.id, ...extra);
  return all<DealRow>(db, `SELECT * FROM deals WHERE id IN (SELECT deal_id FROM disputes)${campaignClause}`, ...extra);
}
