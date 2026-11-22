import { PROPOSAL_TTL_DAYS, type CreateDealInput, type Deal, type Terms } from "@/shared/contracts";
import { campaignBudget } from "../campaigns/budget";
import { ownedCampaignRow } from "../campaigns/campaigns";
import { all, one, run, type Db } from "../db/db";
import { addMs, DAY_MS, nowIso } from "../clock";
import type { SessionUser } from "../http/auth";
import { ApiError, invalidState } from "../http/errors";
import { newId } from "../ids";
import { ownedProductRow } from "../products/products";
import { addEvent } from "./events";
import { checkDates } from "./terms";
import { dealRow, toDealDto, type DealRow } from "./view";

export function expireDeal(db: Db, dealId: string, at: string) {
  const r = run(db, "UPDATE deals SET status = 'EXPIRED', version = version + 1, updated_at = ? WHERE id = ? AND status = 'NEGOTIATING'", at, dealId);
  if (Number(r.changes) > 0) addEvent(db, dealId, null, "SYSTEM", "EXPIRE", at, "Proposal expired after 7 days");
}

/** Write EXPIRED for NEGOTIATING rows in this context whose latest proposal lapsed (keeps the unique index honest, D10). */
export function materializeExpired(db: Db, context: string, at: string) {
  const rows = all<{ id: string }>(
    db,
    `SELECT d.id FROM deals d JOIN proposals p ON p.id = d.latest_proposal_id
      WHERE d.negotiation_context = ? AND d.status = 'NEGOTIATING' AND p.expires_at <= ?`,
    context,
    at,
  );
  for (const r of rows) expireDeal(db, r.id, at);
}

/** POST /deals. Must run inside tx(). */
export function createDealInTx(db: Db, user: SessionUser, input: CreateDealInput): Deal {
  const at = nowIso();
  const profile = one<{ id: string; user_id: string; visibility: string }>(
    db,
    "SELECT id, user_id, visibility FROM creator_profiles WHERE id = ?",
    input.creatorId,
  );
  if (!profile || profile.visibility !== "LISTED") throw new ApiError("PROFILE_UNAVAILABLE", "This creator isn't accepting offers right now.");
  const product = ownedProductRow(db, user.id, input.productId);

  if (input.campaignId) {
    const c = ownedCampaignRow(db, user.id, input.campaignId);
    if (c.status !== "ACTIVE") throw invalidState("Offers can only be sent from an active campaign.");
    if (c.product_id !== product.id) {
      throw new ApiError("VALIDATION_ERROR", "Use the campaign's product.", { productId: "Must be the campaign's current product." });
    }
    const budget = campaignBudget(db, c.id, c.budget_cents)!;
    if (input.terms.amountCents > budget.remainingCents) {
      throw new ApiError(
        "BUDGET_EXCEEDED",
        "This offer is more than the campaign's remaining budget.",
        { "terms.amountCents": "Exceeds remaining budget." },
        { remainingCents: budget.remainingCents },
      );
    }
  }
  checkDates(at, input.terms.draftDueAt, input.terms.publishDueAt);

  const context = `${user.id}|${profile.user_id}|${input.campaignId ? `campaign:${input.campaignId}` : `direct:${product.id}`}`;
  materializeExpired(db, context, at);
  const open = one<{ id: string }>(db, "SELECT id FROM deals WHERE negotiation_context = ? AND status = 'NEGOTIATING'", context);
  if (open) {
    throw new ApiError("ACTIVE_NEGOTIATION_EXISTS", "You already have an open offer with this creator here.", undefined, { dealId: open.id });
  }

  const terms: Terms = {
    ...input.terms,
    currency: "USD",
    platform: "YOUTUBE",
    product: { id: product.id, name: product.name, description: product.description, landingUrl: product.landing_url },
  };
  const dealId = newId();
  const proposalId = newId();
  run(
    db,
    `INSERT INTO deals (id, brand_id, creator_user_id, creator_profile_id, campaign_id, product_id, negotiation_context, status,
       payment_status, version, latest_proposal_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'NEGOTIATING', 'NONE', 1, ?, ?, ?)`,
    dealId,
    user.id,
    profile.user_id,
    profile.id,
    input.campaignId,
    product.id,
    context,
    proposalId,
    at,
    at,
  );
  run(
    db,
    "INSERT INTO proposals (id, deal_id, revision, author_role, terms_json, expires_at, created_at) VALUES (?, ?, 1, 'BRAND', ?, ?, ?)",
    proposalId,
    dealId,
    JSON.stringify(terms),
    addMs(at, PROPOSAL_TTL_DAYS * DAY_MS),
    at,
  );
  addEvent(db, dealId, user.id, "BRAND", "OFFER_SENT", at, `$${(terms.amountCents / 100).toFixed(2)}`);
  return toDealDto(db, dealRow(db, dealId) as DealRow, "BRAND", at);
}
