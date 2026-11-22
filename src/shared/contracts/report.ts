import { z } from "zod";
import { Id, IsoDateTime } from "./common";
import { Budget } from "./campaign";
import { DealStatus, ReportMetricSource, ReportMetricStatus } from "./enums";

export const MetricResult = z.object({
  target: z.number().int().nullable(),
  actual: z.number().int().nullable(),
  measuredAt: IsoDateTime.nullable(),
  source: ReportMetricSource.nullable(),
  status: ReportMetricStatus,
  /** Percent below target, round(100 × (target − actual) / target), when BELOW_TARGET. */
  shortfallPct: z.number().int().nullable(),
});
export type MetricResult = z.infer<typeof MetricResult>;

/** GET /api/v1/deals/{id}/report. */
export const DealReport = z.object({
  dealId: Id,
  status: DealStatus,
  windowStart: IsoDateTime.nullable(),
  windowEnd: IsoDateTime.nullable(),
  views: MetricResult,
  clicks: MetricResult,
  sample: z.boolean(),
});
export type DealReport = z.infer<typeof DealReport>;

/** GET /api/v1/campaigns/{id}/report. */
export const CampaignReport = z.object({
  campaignId: Id,
  budget: Budget,
  countsByStatus: z.partialRecord(DealStatus, z.number().int()),
  agreedCount: z.number().int(),
  publishedCount: z.number().int(),
  completedCount: z.number().int(),
  sample: z.boolean(),
  deals: z.object({ items: z.array(DealReport), nextCursor: z.string().nullable() }),
});
export type CampaignReport = z.infer<typeof CampaignReport>;
