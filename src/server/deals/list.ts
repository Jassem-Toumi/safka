import type { AdminDisputeDetail, AdminDisputeSummary, Deal, DealListFilter } from "@/shared/contracts";
import { ownedCampaignRow } from "../campaigns/campaigns";
import { all, one, type Db } from "../db/db";
import { nowIso } from "../clock";
import type { SessionUser } from "../http/auth";
import { notFound } from "../http/errors";
import { disputesFor, isTerminal, toDealDto, toDispute, viewerRole, visibleDealRows } from "./view";

/** Secondary actions don't put a deal in "needs action" (a brand waiting on a reply can withdraw, but is waiting). */
const SECONDARY = new Set(["REPORT_ISSUE", "WITHDRAW"]);
const needsAction = (d: Deal) => d.availableActions.some((a) => !SECONDARY.has(a));

/** GET /deals inbox: filter by caller capabilities, needed-action first, then most recently updated. */
export function listDeals(db: Db, user: SessionUser, q: { filter?: DealListFilter; campaignId?: string }): Deal[] {
  if (q.campaignId && user.role === "BRAND") ownedCampaignRow(db, user.id, q.campaignId);
  const at = nowIso();
  const deals = visibleDealRows(db, user, q.campaignId)
    .map((r) => {
      const role = viewerRole(db, r, user);
      return role ? toDealDto(db, r, role, at) : null;
    })
    .filter((d): d is Deal => d !== null)
    .filter((d) => {
      if (!q.filter) return true;
      if (q.filter === "closed") return isTerminal(d.status);
      if (isTerminal(d.status)) return false;
      return q.filter === "needs_action" ? needsAction(d) : !needsAction(d);
    });
  return deals.sort((a, b) => Number(needsAction(b)) - Number(needsAction(a)) || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

type DisputeJoin = {
  id: string;
  deal_id: string;
  opened_by_role: "BRAND" | "CREATOR";
  code: AdminDisputeSummary["code"];
  reason: string;
  prior_status: AdminDisputeSummary["priorStatus"];
  opened_at: string;
  resolved_at: string | null;
  resolution: AdminDisputeSummary["resolution"];
  resolution_reason: string | null;
  brand_id: string;
  brand_name: string;
  creator_profile_id: string;
  creator_name: string;
  payment_status: AdminDisputeSummary["paymentStatus"];
  amount: number | null;
};

const DISPUTE_SQL = `SELECT x.*, d.brand_id, b.display_name AS brand_name, d.creator_profile_id, c.display_name AS creator_name,
    d.payment_status, d.agreed_amount_cents AS amount
  FROM disputes x JOIN deals d ON d.id = x.deal_id JOIN users b ON b.id = d.brand_id JOIN users c ON c.id = d.creator_user_id`;

/** GET /admin/disputes: open first, newest first. */
export function listDisputes(db: Db): AdminDisputeSummary[] {
  return all<DisputeJoin>(db, `${DISPUTE_SQL} ORDER BY (x.resolved_at IS NULL) DESC, x.opened_at DESC, x.id`).map((r) => ({
    ...toDispute(r),
    brand: { id: r.brand_id, displayName: r.brand_name },
    creator: { id: r.creator_profile_id, displayName: r.creator_name },
    paymentStatus: r.payment_status,
    amountCents: r.amount ?? 0,
  }));
}

export function disputeDetail(db: Db, disputeId: string): AdminDisputeDetail {
  const r = one<DisputeJoin>(db, `${DISPUTE_SQL} WHERE x.id = ?`, disputeId);
  if (!r) throw notFound("Dispute");
  const deal = one(db, "SELECT * FROM deals WHERE id = ?", r.deal_id) as Parameters<typeof toDealDto>[1];
  return { dispute: toDispute(r), deal: toDealDto(db, deal, "ADMIN"), history: disputesFor(db, r.deal_id) };
}
