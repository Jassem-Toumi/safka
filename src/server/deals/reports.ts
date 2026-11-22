import type { CampaignReport, DealReport, DealStatus, MetricResult, Terms } from "@/shared/contracts";
import { campaignBudget } from "../campaigns/budget";
import { ownedCampaignRow } from "../campaigns/campaigns";
import { all, type Db } from "../db/db";
import { addMs, DAY_MS, nowIso } from "../clock";
import type { SessionUser } from "../http/auth";
import { accessibleDeal, effectiveStatus, type DealRow } from "./view";

type SampleMetrics = { views?: { actual: number; measuredAt: string }; clicks?: { actual: number; measuredAt: string } };

function metric(target: number | null, sample: { actual: number; measuredAt: string } | undefined, windowEnd: string | null, at: string): MetricResult {
  if (target === null) return { target: null, actual: sample?.actual ?? null, measuredAt: sample?.measuredAt ?? null, source: sample ? "SAMPLE" : null, status: "NO_TARGET", shortfallPct: null };
  if (sample) {
    const met = sample.actual >= target;
    return {
      target,
      actual: sample.actual,
      measuredAt: sample.measuredAt,
      source: "SAMPLE",
      status: met ? "MET" : "BELOW_TARGET",
      shortfallPct: met ? null : Math.round((100 * (target - sample.actual)) / target),
    };
  }
  // Live outcomes are never collected: PENDING until the 7-day window ends, then INSUFFICIENT_DATA.
  const ended = windowEnd !== null && at >= windowEnd;
  return { target, actual: null, measuredAt: null, source: null, status: ended ? "INSUFFICIENT_DATA" : "PENDING", shortfallPct: null };
}

export function dealReport(db: Db, d: DealRow, at = nowIso()): DealReport {
  const terms = d.agreement_json ? (JSON.parse(d.agreement_json) as Terms) : null;
  const windowStart = d.published_at;
  const windowEnd = windowStart ? addMs(windowStart, 7 * DAY_MS) : null;
  // Sample metrics only ever come from is_sample deals (D13).
  const sample = d.is_sample === 1 && d.sample_metrics_json ? (JSON.parse(d.sample_metrics_json) as SampleMetrics) : {};
  return {
    dealId: d.id,
    status: effectiveStatus(db, d, at),
    windowStart,
    windowEnd,
    views: metric(terms?.viewTarget ?? null, sample.views, windowEnd, at),
    clicks: metric(terms?.clickTarget ?? null, sample.clicks, windowEnd, at),
    sample: d.is_sample === 1,
  };
}

export function dealReportFor(db: Db, user: SessionUser, dealId: string): DealReport {
  const { row } = accessibleDeal(db, user, dealId);
  return dealReport(db, row);
}

export function campaignReport(db: Db, brandId: string, campaignId: string): CampaignReport {
  const c = ownedCampaignRow(db, brandId, campaignId);
  const at = nowIso();
  const rows = all<DealRow>(db, "SELECT * FROM deals WHERE campaign_id = ? ORDER BY created_at, id", campaignId);
  const countsByStatus: Partial<Record<DealStatus, number>> = {};
  for (const r of rows) {
    const s = effectiveStatus(db, r, at);
    countsByStatus[s] = (countsByStatus[s] ?? 0) + 1;
  }
  return {
    campaignId,
    budget: campaignBudget(db, campaignId, c.budget_cents) ?? { budgetCents: 0, committedCents: 0, spentCents: 0, remainingCents: 0 },
    countsByStatus,
    agreedCount: rows.filter((r) => r.accepted_at !== null).length,
    publishedCount: rows.filter((r) => r.ever_published === 1).length,
    completedCount: rows.filter((r) => r.status === "COMPLETED").length,
    sample: c.is_sample === 1,
    deals: { items: rows.filter((r) => r.accepted_at !== null).map((r) => dealReport(db, r, at)), nextCursor: null },
  };
}
