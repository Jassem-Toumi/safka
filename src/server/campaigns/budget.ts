import type { Budget } from "@/shared/contracts";
import { one, type Db } from "../db/db";
import { nowIso } from "../clock";

/**
 * Agreed states whose amount counts as committed while payment is NONE or HELD (spec §5).
 * DISPUTED is included: an open dispute keeps its commitment until an admin resolves it.
 */
export const COMMITTED_STATUSES = ["AGREED", "DRAFT_REVIEW", "REVISION_REQUESTED", "READY_TO_PUBLISH", "PUBLISHED", "DISPUTED"] as const;
const IN_LIST = COMMITTED_STATUSES.map((s) => `'${s}'`).join(",");

/**
 * Campaign totals derived from deal rows. Call inside the same transaction as any budget-changing write
 * (Session 3 accept/cancel/refund) so the balance is re-read after BEGIN IMMEDIATE.
 *   committed = agreed amounts with payment NONE/HELD in an active agreed state
 *   spent     = agreed amounts with payment RELEASED
 *   remaining = budget − committed − spent (cancel/refund free the amount by leaving both sets)
 */
export function campaignTotals(db: Db, campaignId: string): { committedCents: number; spentCents: number } {
  const r = one<{ committed: number | null; spent: number | null }>(
    db,
    `SELECT
       SUM(CASE WHEN status IN (${IN_LIST}) AND payment_status IN ('NONE','HELD') THEN agreed_amount_cents ELSE 0 END) AS committed,
       SUM(CASE WHEN payment_status = 'RELEASED' THEN agreed_amount_cents ELSE 0 END) AS spent
     FROM deals WHERE campaign_id = ? AND agreed_amount_cents IS NOT NULL`,
    campaignId,
  );
  return { committedCents: r?.committed ?? 0, spentCents: r?.spent ?? 0 };
}

export function campaignBudget(db: Db, campaignId: string, budgetCents: number | null): Budget | null {
  if (budgetCents === null) return null;
  const { committedCents, spentCents } = campaignTotals(db, campaignId);
  return { budgetCents, committedCents, spentCents, remainingCents: budgetCents - committedCents - spentCents };
}

/** NEGOTIATING deals whose latest proposal has not expired by the server clock. */
export function openNegotiationCount(db: Db, campaignId: string, at = nowIso()): number {
  const r = one<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM deals d JOIN proposals p ON p.id = d.latest_proposal_id
      WHERE d.campaign_id = ? AND d.status = 'NEGOTIATING' AND p.expires_at > ?`,
    campaignId,
    at,
  );
  return r?.n ?? 0;
}
