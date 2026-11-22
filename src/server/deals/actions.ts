import {
  DISPUTABLE_DEAL_STATUSES,
  PROPOSAL_TTL_DAYS,
  UPLOAD_LIMITS,
  type Deal,
  type DealActionInput,
  type DealStatus,
  type Role,
  type Terms,
} from "@/shared/contracts";
import { campaignBudget } from "../campaigns/budget";
import { all, one, run, type Db } from "../db/db";
import { addMs, DAY_MS, nowIso } from "../clock";
import type { SessionUser } from "../http/auth";
import { ApiError, forbidden, invalidState, notFound } from "../http/errors";
import { newId } from "../ids";
import { expireDeal } from "./create";
import { addEvent } from "./events";
import { checkDates, parseYouTubeVideo } from "./terms";
import { accessibleDeal, batchCount, dealRow, latestProposal, openDispute, toDealDto, type DealRow } from "./view";

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

function requireStatus(d: DealRow, allowed: DealStatus[], what: string) {
  if (!allowed.includes(d.status)) throw invalidState(`${what} isn't possible while the deal is ${d.status.toLowerCase().replace(/_/g, " ")}.`);
}

function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) throw forbidden("This action isn't available to you on this deal.");
}

/**
 * Apply one deal action. Must run inside tx() (after the idempotency replay check). Re-reads the deal, enforces
 * version, expiry, role and state, writes the change + one timeline event, and returns the deal as the actor sees it.
 */
export function applyActionInTx(db: Db, user: SessionUser, dealId: string, input: DealActionInput): Deal {
  const at = nowIso();
  const { row: d, role } = accessibleDeal(db, user, dealId);
  if (d.version !== input.expectedVersion) {
    throw new ApiError("STALE_DEAL", "This deal changed. Refresh to see the latest.", undefined, { version: d.version });
  }

  // Expiry is derived from the server clock and enforced before any negotiation action.
  if (d.status === "NEGOTIATING" && latestProposal(db, d).expires_at <= at) {
    throw new ApiError("PROPOSAL_EXPIRED", "This proposal expired. Send a new offer.");
  }

  const actorRole = role;
  const bump = (sets: string, ...params: (string | number | null)[]) =>
    run(db, `UPDATE deals SET ${sets}, version = version + 1, updated_at = ? WHERE id = ?`, ...params, at, d.id);
  const event = (action: string, note: string | null = null) => addEvent(db, d.id, user.id, actorRole, action, at, note);

  switch (input.action) {
    case "ACCEPT":
    case "DECLINE":
    case "COUNTER": {
      requireStatus(d, ["NEGOTIATING"], "Responding to a proposal");
      const p = latestProposal(db, d);
      requireRole(role, p.author_role === "BRAND" ? ["CREATOR"] : ["BRAND"]);
      if (input.proposalId !== p.id) throw new ApiError("STALE_DEAL", "A newer proposal exists. Refresh to see it.", undefined, { proposalId: p.id });
      const terms = JSON.parse(p.terms_json) as Terms;

      if (input.action === "DECLINE") {
        bump("status = 'DECLINED'");
        event("DECLINE");
        break;
      }
      if (input.action === "COUNTER") {
        checkDates(at, input.draftDueAt, input.publishDueAt);
        const next: Terms = { ...terms, amountCents: input.amountCents, draftDueAt: input.draftDueAt, publishDueAt: input.publishDueAt, angle: input.angle };
        const id = newId();
        run(
          db,
          "INSERT INTO proposals (id, deal_id, revision, author_role, terms_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          id,
          d.id,
          p.revision + 1,
          role,
          JSON.stringify(next),
          addMs(at, PROPOSAL_TTL_DAYS * DAY_MS),
          at,
        );
        bump("latest_proposal_id = ?", id);
        event("COUNTER", usd(input.amountCents));
        break;
      }
      // ACCEPT: dates, campaign status and budget re-checked in this same transaction.
      checkDates(at, terms.draftDueAt, terms.publishDueAt);
      if (d.campaign_id) {
        const c = one<{ status: string; budget_cents: number | null }>(db, "SELECT status, budget_cents FROM campaigns WHERE id = ?", d.campaign_id)!;
        if (c.status !== "ACTIVE") throw invalidState("The campaign is no longer active.");
        const budget = campaignBudget(db, d.campaign_id, c.budget_cents)!;
        if (terms.amountCents > budget.remainingCents) {
          throw new ApiError("BUDGET_EXCEEDED", "Accepting would exceed the campaign's remaining budget.", undefined, { remainingCents: budget.remainingCents });
        }
      }
      bump(
        "status = 'AGREED', accepted_proposal_id = ?, agreed_amount_cents = ?, agreement_json = ?, accepted_at = ?",
        p.id,
        terms.amountCents,
        JSON.stringify(terms),
        at,
      );
      event("ACCEPT", usd(terms.amountCents));
      break;
    }

    case "WITHDRAW":
      requireStatus(d, ["NEGOTIATING"], "Withdrawing");
      requireRole(role, ["BRAND"]);
      bump("status = 'WITHDRAWN'");
      event("WITHDRAW");
      break;

    case "SUBMIT_DRAFTS": {
      requireStatus(d, ["AGREED", "REVISION_REQUESTED"], "Submitting drafts");
      requireRole(role, ["CREATOR"]);
      const round = batchCount(db, d.id) + 1;
      if (round > UPLOAD_LIMITS.maxBatches) throw invalidState("All three draft rounds have been used.");
      const ph = input.uploadIds.map(() => "?").join(",");
      const ups = all<{ id: string }>(
        db,
        `SELECT id FROM uploads WHERE deal_id = ? AND creator_user_id = ? AND status = 'READY' AND id IN (${ph})`,
        d.id,
        user.id,
        ...input.uploadIds,
      );
      if (ups.length !== input.uploadIds.length) {
        throw new ApiError("VALIDATION_ERROR", "Pick ready uploads from this deal.", { uploadIds: "Unknown, already attached, or not yours." });
      }
      const terms = JSON.parse(d.agreement_json!) as Terms;
      const batchId = newId();
      run(db, "INSERT INTO draft_batches (id, deal_id, round, submitted_at, late, change_request) VALUES (?, ?, ?, ?, ?, NULL)", batchId, d.id, round, at, at > terms.draftDueAt ? 1 : 0);
      input.uploadIds.forEach((uid, i) => {
        run(db, "INSERT INTO draft_assets (id, batch_id, upload_id, position, label) VALUES (?, ?, ?, ?, ?)", newId(), batchId, uid, i + 1, `Option ${i + 1}`);
        run(db, "UPDATE uploads SET status = 'ATTACHED' WHERE id = ?", uid);
      });
      bump("status = 'DRAFT_REVIEW'");
      event("SUBMIT_DRAFTS", `Round ${round}: ${input.uploadIds.length} draft(s)${at > terms.draftDueAt ? " (late)" : ""}`);
      break;
    }

    case "REQUEST_CHANGES": {
      requireStatus(d, ["DRAFT_REVIEW"], "Requesting changes");
      requireRole(role, ["BRAND"]);
      if (batchCount(db, d.id) >= UPLOAD_LIMITS.maxBatches) throw invalidState("This was the last draft round. Approve a draft or report an issue.");
      run(db, "UPDATE draft_batches SET change_request = ? WHERE deal_id = ? AND round = ?", input.reason, d.id, batchCount(db, d.id));
      bump("status = 'REVISION_REQUESTED'");
      event("REQUEST_CHANGES", input.reason);
      break;
    }

    case "APPROVE_DRAFT": {
      requireStatus(d, ["DRAFT_REVIEW"], "Approving a draft");
      requireRole(role, ["BRAND"]);
      const asset = one(
        db,
        `SELECT a.id FROM draft_assets a JOIN draft_batches b ON b.id = a.batch_id
          WHERE a.id = ? AND b.deal_id = ? AND b.round = ?`,
        input.assetId,
        d.id,
        batchCount(db, d.id),
      );
      if (!asset) throw new ApiError("VALIDATION_ERROR", "Pick a draft from the latest round.", { assetId: "Not in the latest batch." });
      bump("status = 'READY_TO_PUBLISH', payment_status = 'HELD', approved_asset_id = ?, approved_at = ?", input.assetId, at);
      event("APPROVE_DRAFT", "Simulated payment held");
      break;
    }

    case "SUBMIT_PUBLICATION": {
      requireStatus(d, ["READY_TO_PUBLISH"], "Submitting the post");
      requireRole(role, ["CREATOR"]);
      const v = parseYouTubeVideo(input.url);
      if (!v) throw new ApiError("VALIDATION_ERROR", "Use a YouTube watch, Shorts or youtu.be link.", { url: "Not a YouTube video link with an 11-character ID." });
      if (input.publishedAt < d.approved_at! || input.publishedAt > at) {
        throw new ApiError("VALIDATION_ERROR", "Publication time must be between draft approval and now.", { publishedAt: "Out of range." });
      }
      bump(
        "status = 'PUBLISHED', publication_url = ?, publication_video_id = ?, published_at = ?, publication_submitted_at = ?, ever_published = 1",
        v.url,
        v.videoId,
        input.publishedAt,
        at,
      );
      event("SUBMIT_PUBLICATION", v.url);
      break;
    }

    case "CONFIRM_DELIVERY": {
      requireStatus(d, ["PUBLISHED"], "Confirming delivery");
      requireRole(role, ["BRAND", "CREATOR"]);
      const mine = role === "BRAND" ? d.brand_confirmed_at : d.creator_confirmed_at;
      if (mine) throw invalidState("You already confirmed this deal.");
      const other = role === "BRAND" ? d.creator_confirmed_at : d.brand_confirmed_at;
      const col = role === "BRAND" ? "brand_confirmed_at" : "creator_confirmed_at";
      if (other) {
        bump(`${col} = ?, status = 'COMPLETED', payment_status = 'RELEASED'`, at);
        event("CONFIRM_DELIVERY", "Both confirmed. Simulated payment released");
      } else {
        bump(`${col} = ?`, at);
        event("CONFIRM_DELIVERY");
      }
      break;
    }

    case "REPORT_ISSUE": {
      requireRole(role, ["BRAND", "CREATOR"]);
      if (!DISPUTABLE_DEAL_STATUSES.includes(d.status)) throw invalidState("Issues can be reported on agreed deals before completion.");
      run(
        db,
        `INSERT INTO disputes (id, deal_id, opened_by_id, opened_by_role, code, reason, prior_status, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        d.id,
        user.id,
        role,
        input.code,
        input.reason,
        d.status,
        at,
      );
      bump("status = 'DISPUTED'");
      event("REPORT_ISSUE", input.code);
      break;
    }

    case "RESUME_DEAL":
    case "CANCEL_DEAL":
    case "REFUND_PAYMENT":
    case "RELEASE_PAYMENT": {
      requireRole(role, ["ADMIN"]);
      requireStatus(d, ["DISPUTED"], "Resolving");
      const disp = openDispute(db, d.id);
      if (!disp || disp.id !== input.disputeId) throw notFound("Dispute");
      if (input.action === "RESUME_DEAL") bump("status = ?", disp.prior_status);
      else if (input.action === "CANCEL_DEAL") {
        if (d.payment_status !== "NONE") throw invalidState("Payment is held. Refund or release it instead.");
        bump("status = 'CANCELLED'");
      } else {
        if (d.payment_status !== "HELD") throw invalidState("No held payment to settle.");
        if (input.action === "REFUND_PAYMENT") bump("status = 'REFUNDED', payment_status = 'REFUNDED'");
        else bump("status = 'COMPLETED', payment_status = 'RELEASED'");
      }
      run(
        db,
        "UPDATE disputes SET resolved_at = ?, resolution = ?, resolution_reason = ?, resolved_by_id = ? WHERE id = ?",
        at,
        input.action,
        input.reason,
        user.id,
        disp.id,
      );
      event(input.action, input.action === "RELEASE_PAYMENT" ? `Admin override: ${input.reason}` : input.reason);
      break;
    }
  }
  return toDealDto(db, dealRow(db, d.id)!, role, at);
}

/** Write EXPIRED to a deal whose proposal lapsed, so list/filter views and the unique index stay accurate. */
export function materializeIfExpired(db: Db, d: DealRow, at = nowIso()) {
  if (d.status === "NEGOTIATING" && latestProposal(db, d).expires_at <= at) expireDeal(db, d.id, at);
}
