"use client";

import type { ReactNode } from "react";
import type {
	CreatorCard,
	Evidence,
	Label,
	LabelOrigin,
	Metric,
	MetricSource,
	Rate
} from "@/shared/contracts";

import { useId } from "react";

import { formatCents } from "@/lib/format";
import { Avatar } from "@/lib/ui/Avatar";
import { OriginLabel } from "@/lib/ui/Chips";
import { ExternalLink } from "@/lib/ui/Evidence";

type CreatorCardViewProps = {
	creator: CreatorCard;
	/** Buttons or links shown at the bottom of the card. */
	actions?: ReactNode;
	headingLevel?: 2 | 3 | 4;
};

type LabelGroup = {
	origin: LabelOrigin;
	values: string[];
};

const ORIGIN_ORDER: readonly LabelOrigin[] = ["CREATOR", "PUBLIC", "SAMPLE"];

const METRIC_ORIGINS: Record<MetricSource, LabelOrigin> = {
	PUBLIC: "PUBLIC",
	SELF_REPORTED: "CREATOR",
	SAMPLE: "SAMPLE"
};

const numberFormatter = new Intl.NumberFormat("en-US");

/** Topics arrive as slugs ("desk-setups") and formats as enums ("UNBOXING"). */
function humanize(value: string): string {
	const words = value.replace(/[-_]+/g, " ").trim().toLowerCase();

	return words.charAt(0).toUpperCase() + words.slice(1);
}

function rateText(rate: Rate | null): string {
	if (rate === null) {
		return "Rate not provided";
	}

	if (rate.minCents === rate.maxCents) {
		return formatCents(rate.minCents);
	}

	return `${formatCents(rate.minCents)}–${formatCents(rate.maxCents)}`;
}

/** One row per origin keeps every label's origin visible without a tag on each. */
function groupByOrigin(labels: Label[]): LabelGroup[] {
	return ORIGIN_ORDER.map((origin) => ({
		origin,
		values: labels
			.filter((label) => label.origin === origin)
			.map((label) => humanize(label.value))
	})).filter((group) => group.values.length > 0);
}

function renderLabels(labels: Label[]): ReactNode {
	if (labels.length === 0) {
		return <span className="text-zinc-500">None listed</span>;
	}

	return (
		<ul className="space-y-1">
			{groupByOrigin(labels).map(({ origin, values }) => (
				<li
					key={origin}
					className="flex flex-wrap items-center gap-x-2 gap-y-1"
				>
					<span>{values.join(", ")}</span>
					<OriginLabel origin={origin} />
				</li>
			))}
		</ul>
	);
}

function renderMetric(
	metric: Metric,
	source: Evidence | undefined,
	key: string
): ReactNode {
	return (
		<li key={key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
			<span className="font-medium tabular-nums">
				{metric.approximate ? (
					<>
						<span aria-hidden="true">~</span>
						<span className="sr-only">About </span>
					</>
				) : null}
				{numberFormatter.format(metric.value)}
			</span>
			<span className="text-zinc-700">
				{metric.label} on {metric.subject}
			</span>
			<OriginLabel origin={METRIC_ORIGINS[metric.source]} />
			{source ? (
				<ExternalLink href={source.url}>
					Source<span className="sr-only">: {source.title}</span>
				</ExternalLink>
			) : null}
		</li>
	);
}

export function CreatorCardView({
	creator,
	actions,
	headingLevel = 2
}: CreatorCardViewProps) {
	const headingId = useId();
	const Heading = `h${headingLevel}` as const;
	const evidenceById = new Map(
		creator.evidence.map((evidence) => [evidence.id, evidence])
	);
	const { expectedClicks } = creator;

	return (
		<article
			aria-labelledby={headingId}
			className="card min-w-0 p-4 transition-shadow hover:shadow-md sm:p-5"
		>
			<div className="flex items-start gap-3">
				<Avatar name={creator.displayName} seed={creator.id} size={48} />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<Heading
							id={headingId}
							className="text-lg font-semibold tracking-tight break-words"
						>
							{creator.displayName}
						</Heading>
						{creator.dataMode === "SAMPLE" ? (
							<span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-300 ring-inset">
								Sample data
							</span>
						) : null}
					</div>
					<p className="font-medium text-indigo-700 tabular-nums">
						<span className="sr-only">Rate: </span>
						{rateText(creator.rate)}
					</p>
				</div>
			</div>

			{creator.bio ? (
				<p className="mt-3 text-sm break-words text-zinc-700">{creator.bio}</p>
			) : null}

			<dl className="mt-4 space-y-3 text-sm">
				<div>
					<dt className="text-zinc-500">Topics</dt>
					<dd className="mt-0.5">{renderLabels(creator.topics)}</dd>
				</div>
				<div>
					<dt className="text-zinc-500">Formats</dt>
					<dd className="mt-0.5">{renderLabels(creator.formats)}</dd>
				</div>
				{creator.typical7dViews !== null ? (
					<div>
						<dt className="text-zinc-500">
							Typical 7-day views · Creator reported
						</dt>
						<dd className="mt-0.5 font-medium tabular-nums">
							{numberFormatter.format(creator.typical7dViews)}
						</dd>
					</div>
				) : null}
				{creator.publicMetrics.length > 0 ? (
					<div>
						<dt className="text-zinc-500">Public metrics</dt>
						<dd className="mt-0.5">
							<ul className="space-y-1">
								{creator.publicMetrics.map((metric, index) =>
									renderMetric(
										metric,
										metric.evidenceId === null
											? undefined
											: evidenceById.get(metric.evidenceId),
										`${metric.label}-${metric.subject}-${index}`
									)
								)}
							</ul>
						</dd>
					</div>
				) : null}
				<div>
					<dt className="text-zinc-500">Expected clicks</dt>
					<dd className="mt-0.5 tabular-nums">
						{expectedClicks === null
							? "Unavailable"
							: `${numberFormatter.format(expectedClicks.low)}–${numberFormatter.format(expectedClicks.high)} · Sample estimate`}
					</dd>
				</div>
			</dl>

			<p className="mt-4 text-sm">
				<ExternalLink href={creator.profileUrl}>YouTube channel</ExternalLink>
			</p>

			{actions ? (
				<div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
					{actions}
				</div>
			) : null}
		</article>
	);
}
