"use client";

import type { CampaignReport, DealReport, MetricResult } from "@/shared/contracts";

import Link from "next/link";

import { metricStatusLabel, metricTone } from "@/lib/dealDisplay";
import { formatDateTime } from "@/lib/format";

import { BudgetBar } from "./budget";
import { Badge, Card, CardHeader, EmptyState, Stat } from "./ui";

const n = (v: number) => v.toLocaleString("en-US");

/** One metric, never rendering a missing value as zero (frontend spec §6). */
export function MetricCell({ metric, unit, windowEnd }: { metric: MetricResult; unit: string; windowEnd: string | null }) {
	return (
		<div>
			<div className="flex flex-wrap items-center gap-2">
				<Badge tone={metricTone(metric.status)}>{metricStatusLabel(metric.status)}</Badge>
				{metric.source === "SAMPLE" ? <Badge tone="warning">Sample data</Badge> : null}
			</div>
			<p className="mt-1.5 text-sm tabular">
				{metric.actual !== null ? <span className="font-semibold">{n(metric.actual)}</span> : <span className="text-muted">No observation</span>}
				{metric.target !== null ? <span className="text-muted"> / {n(metric.target)} {unit}</span> : <span className="text-muted"> {unit}</span>}
				{metric.status === "BELOW_TARGET" && metric.shortfallPct !== null ? <span className="font-medium text-warning"> · {metric.shortfallPct}% below target</span> : null}
			</p>
			<p className="text-xs text-faint">
				{metric.status === "PENDING" && windowEnd ? `Measuring through ${formatDateTime(windowEnd)}` : null}
				{metric.status === "INSUFFICIENT_DATA" ? "No live outcome collected in this prototype" : null}
				{metric.measuredAt ? `Measured ${formatDateTime(metric.measuredAt)}` : null}
			</p>
		</div>
	);
}

export function DealReportPanel({ report }: { report: DealReport }) {
	return (
		<Card>
			<CardHeader
				title="Performance · first 7 days"
				description={
					report.windowStart && report.windowEnd
						? `${formatDateTime(report.windowStart)} – ${formatDateTime(report.windowEnd)}`
						: "Starts when the post is published."
				}
				action={report.sample ? <Badge tone="warning">Sample report</Badge> : null}
			/>
			<div className="grid gap-6 p-5 sm:grid-cols-2">
				<MetricCell metric={report.views} unit="views" windowEnd={report.windowEnd} />
				<MetricCell metric={report.clicks} unit="tracked clicks" windowEnd={report.windowEnd} />
			</div>
			<p className="border-t border-line px-5 py-3 text-xs text-muted">Informational only. Targets never affect delivery or the simulated payment.</p>
		</Card>
	);
}

/** `showBudget` off where the page already shows the campaign budget. */
export function CampaignReportView({ report, showBudget = false }: { report: CampaignReport; showBudget?: boolean }) {
	return (
		<div className="space-y-6">
			{report.sample ? (
				<div className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
					<span className="font-medium">Sample report.</span> These numbers are seeded demo data, kept separate from live totals.
				</div>
			) : null}
			<Card className="p-5">
				<dl className="grid grid-cols-3 gap-4">
					<Stat label="Agreed" value={report.agreedCount} />
					<Stat label="Published" value={report.publishedCount} />
					<Stat label="Completed" value={report.completedCount} />
				</dl>
				{showBudget ? (
					<div className="mt-6">
						<BudgetBar budget={report.budget} />
					</div>
				) : null}
			</Card>
			<Card>
				<CardHeader title="Deals" description="Views and tracked clicks, first 7 days after publication." />
				{report.deals.items.length === 0 ? (
					<div className="p-5">
						<EmptyState title="No agreed deals yet" description="Results appear once an offer is accepted." />
					</div>
				) : (
					<ul className="divide-y divide-line">
						{report.deals.items.map((d) => (
							<li key={d.dealId} className="grid gap-4 px-5 py-4 sm:grid-cols-[140px_1fr_1fr]">
								<Link href={`/deals/${d.dealId}`} className="text-sm font-medium underline underline-offset-4">
									Open deal
								</Link>
								<MetricCell metric={d.views} unit="views" windowEnd={d.windowEnd} />
								<MetricCell metric={d.clicks} unit="tracked clicks" windowEnd={d.windowEnd} />
							</li>
						))}
					</ul>
				)}
			</Card>
		</div>
	);
}
