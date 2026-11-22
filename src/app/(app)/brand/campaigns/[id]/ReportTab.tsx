"use client";

import type {
	Deal,
	DealReport,
	MetricResult,
	ReportMetricSource
} from "@/shared/contracts";

import Link from "next/link";

import {
	LINK_CLASSES,
	LoadFailed,
	LoadingNote,
	SampleBanner
} from "@/app/(app)/brand/_parts/ui";
import { getCampaignReport, listDeals } from "@/lib/api";
import { dealHeadline } from "@/lib/deals";
import { formatDateTime } from "@/lib/format";
import { metricText } from "@/lib/labels";
import { BudgetBar } from "@/lib/ui/BudgetBar";
import { StatusChip } from "@/lib/ui/Chips";
import { useLoad } from "@/lib/ui/useLoad";

type ReportTabProps = {
	campaignId: string;
};

const SOURCE_LABELS: Record<ReportMetricSource, string> = {
	SELF_REPORTED: "Self-reported",
	TRACKED: "Tracked",
	SAMPLE: "Sample data"
};

function MetricLine({
	label,
	metric,
	noun
}: {
	label: string;
	metric: MetricResult;
	noun: "views" | "clicks";
}) {
	return (
		<div>
			<dt className="text-sm text-fg-muted">{label}</dt>
			<dd className="font-medium tabular-nums">{metricText(metric, noun)}</dd>
			{metric.source !== null || metric.measuredAt !== null ? (
				<dd className="text-sm text-fg-subtle">
					{metric.source !== null ? SOURCE_LABELS[metric.source] : null}
					{metric.source !== null && metric.measuredAt !== null ? " · " : null}
					{metric.measuredAt !== null ? (
						<>
							Measured{" "}
							<time dateTime={metric.measuredAt}>
								{formatDateTime(metric.measuredAt)}
							</time>
						</>
					) : null}
				</dd>
			) : null}
		</div>
	);
}

function hasComparison(metric: MetricResult): boolean {
	return metric.actual !== null && metric.target !== null;
}

function DealRow({ item, deal }: { item: DealReport; deal: Deal | undefined }) {
	const { windowStart, windowEnd } = item;

	return (
		<li className="space-y-3 rounded-lg border border-border bg-surface p-4">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="font-semibold">
					{deal?.creator.displayName ?? "Deal"}
				</h3>
				{deal !== undefined ? (
					<StatusChip status={deal.status} label={dealHeadline(deal, "BRAND")} />
				) : null}
				{item.sample ? (
					<span className="rounded bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning ring-1 ring-warning-line ring-inset">
						Sample data
					</span>
				) : null}
			</div>
			<p className="text-sm text-fg-muted">
				{windowStart !== null && windowEnd !== null ? (
					<>
						First 7 days:{" "}
						<time dateTime={windowStart}>{formatDateTime(windowStart)}</time>{" "}
						to <time dateTime={windowEnd}>{formatDateTime(windowEnd)}</time>
					</>
				) : (
					"The first 7 days start when the video is published."
				)}
			</p>
			<dl className="grid gap-3 sm:grid-cols-2">
				<MetricLine label="Views" metric={item.views} noun="views" />
				<MetricLine label="Clicks" metric={item.clicks} noun="clicks" />
			</dl>
			{hasComparison(item.views) || hasComparison(item.clicks) ? (
				<p className="text-sm text-fg-secondary">
					Use this result to refine the next brief.
				</p>
			) : null}
			<Link
				href={`/deals/${encodeURIComponent(item.dealId)}`}
				className={`text-sm ${LINK_CLASSES}`}
			>
				Open deal
				{deal !== undefined ? (
					<span className="sr-only"> with {deal.creator.displayName}</span>
				) : null}
			</Link>
		</li>
	);
}

/** Frontend spec §6: budget, deal counts, then per-deal views and clicks. */
export function ReportTab({ campaignId }: ReportTabProps) {
	const report = useLoad(
		() =>
			Promise.all([
				getCampaignReport(campaignId),
				listDeals({ campaignId }).catch(() => null)
			]),
		[campaignId]
	);

	if (report.status === "failed") {
		return (
			<LoadFailed
				what="the report"
				error={report.error}
				onRetry={report.reload}
			/>
		);
	}

	if (report.data === null) {
		return <LoadingNote>Loading the report…</LoadingNote>;
	}

	const [data, deals] = report.data;
	const dealsById = new Map((deals?.items ?? []).map((deal) => [deal.id, deal]));

	return (
		<div className="space-y-6">
			{data.sample ? (
				<SampleBanner>
					Sample report. Seeded demo numbers, kept out of live totals and with
					no effect on payment.
				</SampleBanner>
			) : null}

			<section
				aria-labelledby="report-budget"
				className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
			>
				<h2 id="report-budget" className="text-lg font-semibold">
					Budget and deals
				</h2>
				<BudgetBar budget={data.budget} />
				<dl className="grid grid-cols-3 gap-3 border-t border-divider pt-4">
					<div>
						<dt className="text-sm text-fg-muted">Agreed</dt>
						<dd className="text-lg font-semibold tabular-nums">
							{data.agreedCount}
						</dd>
					</div>
					<div>
						<dt className="text-sm text-fg-muted">Published</dt>
						<dd className="text-lg font-semibold tabular-nums">
							{data.publishedCount}
						</dd>
					</div>
					<div>
						<dt className="text-sm text-fg-muted">Completed</dt>
						<dd className="text-lg font-semibold tabular-nums">
							{data.completedCount}
						</dd>
					</div>
				</dl>
			</section>

			<section aria-labelledby="report-deals" className="space-y-3">
				<h2 id="report-deals" className="text-lg font-semibold">
					Results by deal
				</h2>
				{data.deals.items.length === 0 ? (
					<p className="text-fg-muted">
						No agreed deals yet. Results appear here once a video is published.
					</p>
				) : (
					<ul className="space-y-3">
						{data.deals.items.map((item) => (
							<DealRow
								key={item.dealId}
								item={item}
								deal={dealsById.get(item.dealId)}
							/>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
