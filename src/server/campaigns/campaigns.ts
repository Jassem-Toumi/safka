import { z } from "zod";
import { Brief, type BriefDraft, type Campaign, type CampaignInput, type CampaignPatch, type CampaignStatus } from "@/shared/contracts";
import { normalizeTopics } from "@/shared/topics";
import { all, one, run, tx, type Db } from "../db/db";
import { nowIso } from "../clock";
import { ApiError, invalidState, notFound } from "../http/errors";
import { zodToApiError } from "../http/respond";
import { newId } from "../ids";
import { ownedProductRow } from "../products/products";
import { campaignBudget, campaignTotals, openNegotiationCount } from "./budget";

export type CampaignRow = {
  id: string;
  brand_id: string;
  product_id: string;
  status: CampaignStatus;
  version: number;
  source_prompt: string;
  brief_json: string | null;
  budget_cents: number | null;
  preferred_max_cents: number | null;
  default_view_target: number | null;
  default_click_target: number | null;
  is_sample: number;
  created_at: string;
  updated_at: string;
};

type ParsedInput = z.output<typeof import("@/shared/contracts").CampaignInput>;
type ParsedPatch = z.output<typeof import("@/shared/contracts").CampaignPatch>;

export function ownedCampaignRow(db: Db, brandId: string, id: string): CampaignRow {
  const row = one<CampaignRow>(db, "SELECT * FROM campaigns WHERE id = ? AND brand_id = ?", id, brandId);
  if (!row) throw notFound("Campaign");
  return row;
}

export function toCampaignDto(db: Db, r: CampaignRow): Campaign {
  const dealCount = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM deals WHERE campaign_id = ?", r.id)!.n;
  return {
    id: r.id,
    productId: r.product_id,
    sourcePrompt: r.source_prompt,
    version: r.version,
    status: r.status,
    brief: r.brief_json ? (JSON.parse(r.brief_json) as BriefDraft) : null,
    budget: campaignBudget(db, r.id, r.budget_cents),
    preferredMaxPerPostCents: r.preferred_max_cents,
    defaultViewTarget: r.default_view_target,
    defaultClickTarget: r.default_click_target,
    dealCount,
    hasOpenNegotiations: openNegotiationCount(db, r.id) > 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listCampaigns(db: Db, brandId: string): Campaign[] {
  return all<CampaignRow>(db, "SELECT * FROM campaigns WHERE brand_id = ? ORDER BY updated_at DESC, id", brandId).map((r) => toCampaignDto(db, r));
}

export function getCampaign(db: Db, brandId: string, id: string): Campaign {
  return toCampaignDto(db, ownedCampaignRow(db, brandId, id));
}

function normalizeBrief(b: BriefDraft | null): BriefDraft | null {
  if (!b) return null;
  return { ...b, topics: normalizeTopics(b.topics), formats: [...new Set(b.formats)] };
}

/** Activation requires a complete Brief with ≥1 topic and a budget (spec §4). */
function assertActivatable(brief: BriefDraft | null, budgetCents: number | null) {
  const fields: Record<string, string> = {};
  if (!brief) fields.brief = "A reviewed brief is required to confirm.";
  else {
    const r = Brief.safeParse(brief);
    if (!r.success) Object.entries(zodToApiError(r.error).fields ?? {}).forEach(([k, v]) => (fields[`brief.${k}`] = v));
    if (brief.topics.length === 0) fields["brief.topics"] = "Add at least one topic.";
  }
  if (budgetCents === null) fields.budgetCents = "Set a budget to confirm.";
  if (Object.keys(fields).length) throw new ApiError("VALIDATION_ERROR", "Complete the brief before confirming.", fields);
}

export function createCampaign(db: Db, brandId: string, input: ParsedInput): Campaign {
  ownedProductRow(db, brandId, input.productId);
  const brief = normalizeBrief(input.brief);
  if (input.confirm) assertActivatable(brief, input.budgetCents);
  const id = newId();
  const ts = nowIso();
  run(
    db,
    `INSERT INTO campaigns (id, brand_id, product_id, status, version, source_prompt, brief_json, budget_cents, preferred_max_cents,
       default_view_target, default_click_target, is_sample, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    brandId,
    input.productId,
    input.confirm ? "ACTIVE" : "DRAFT",
    input.sourcePrompt,
    brief ? JSON.stringify(brief) : null,
    input.budgetCents,
    input.preferredMaxPerPostCents,
    input.defaultViewTarget,
    input.defaultClickTarget,
    ts,
    ts,
  );
  return getCampaign(db, brandId, id);
}

/**
 * PATCH /campaigns/{id}. Version-checked edit; `confirm: true` activates a DRAFT; `status: "CLOSED"` closes when no
 * unexpired negotiation is open. A budget below committed + spent is rejected with BUDGET_EXCEEDED.
 */
export function updateCampaign(db: Db, brandId: string, id: string, patch: ParsedPatch): Campaign {
  if (patch.productId !== undefined) ownedProductRow(db, brandId, patch.productId);
  return tx(db, () => {
    const row = ownedCampaignRow(db, brandId, id);
    if (row.version !== patch.expectedVersion) {
      throw new ApiError("STALE_CAMPAIGN", "This campaign changed elsewhere. Reload and try again.", undefined, { version: row.version });
    }
    if (row.status === "CLOSED") throw invalidState("This campaign is closed.");
    const ts = nowIso();

    if (patch.status === "CLOSED") {
      if (openNegotiationCount(db, id, ts) > 0) throw invalidState("Resolve or withdraw open negotiations before closing this campaign.");
      run(db, "UPDATE campaigns SET status = 'CLOSED', version = version + 1, updated_at = ? WHERE id = ?", ts, id);
      return toCampaignDto(db, ownedCampaignRow(db, brandId, id));
    }

    const next = {
      productId: patch.productId ?? row.product_id,
      sourcePrompt: patch.sourcePrompt ?? row.source_prompt,
      brief: patch.brief !== undefined ? normalizeBrief(patch.brief) : row.brief_json ? (JSON.parse(row.brief_json) as BriefDraft) : null,
      budgetCents: patch.budgetCents !== undefined ? patch.budgetCents : row.budget_cents,
      preferredMax: patch.preferredMaxPerPostCents !== undefined ? patch.preferredMaxPerPostCents : row.preferred_max_cents,
      viewTarget: patch.defaultViewTarget !== undefined ? patch.defaultViewTarget : row.default_view_target,
      clickTarget: patch.defaultClickTarget !== undefined ? patch.defaultClickTarget : row.default_click_target,
    };
    const status: CampaignStatus = patch.confirm || row.status === "ACTIVE" ? "ACTIVE" : "DRAFT";
    if (status === "ACTIVE") assertActivatable(next.brief, next.budgetCents);

    const { committedCents, spentCents } = campaignTotals(db, id);
    if (committedCents + spentCents > 0 && (next.budgetCents === null || next.budgetCents < committedCents + spentCents)) {
      throw new ApiError("BUDGET_EXCEEDED", "The budget can't go below what is already committed and spent.", { budgetCents: "Below committed + spent." }, {
        committedCents,
        spentCents,
      });
    }
    run(
      db,
      `UPDATE campaigns SET product_id = ?, source_prompt = ?, brief_json = ?, budget_cents = ?, preferred_max_cents = ?,
         default_view_target = ?, default_click_target = ?, status = ?, version = version + 1, updated_at = ? WHERE id = ?`,
      next.productId,
      next.sourcePrompt,
      next.brief ? JSON.stringify(next.brief) : null,
      next.budgetCents,
      next.preferredMax,
      next.viewTarget,
      next.clickTarget,
      status,
      ts,
      id,
    );
    return toCampaignDto(db, ownedCampaignRow(db, brandId, id));
  });
}

export type { CampaignInput, CampaignPatch };
