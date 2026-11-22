"use client";

import type { CreatorCard, Evidence, Label, LabelOrigin } from "@/shared/contracts";
import type { ReactNode } from "react";

import Link from "next/link";

import { formatCents, formatDateTime } from "@/lib/format";
import { topicDisplayName } from "@/shared/topics";

import { Badge, cx, ExternalLink } from "./ui";

export const FORMAT_LABELS: Record<string, string> = {
	REVIEW: "Review",
	DEMO: "Demo",
	TUTORIAL: "Tutorial",
	UNBOXING: "Unboxing",
	COMPARISON: "Comparison",
	STORY: "Story",
	OTHER: "Other"
};

export function originLabel(origin: LabelOrigin): string {
	return origin === "PUBLIC" ? "Sourced by You.com" : origin === "SAMPLE" ? "Sample data" : "Creator provided";
}

export function rateText(rate: CreatorCard["rate"]): string {
	if (rate === null) {
		return "Rate not provided";
	}

	return rate.minCents === rate.maxCents ? formatCents(rate.minCents) : `${formatCents(rate.minCents)}–${formatCents(rate.maxCents)}`;
}

export function compactNumber(n: number): string {
	return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Topic/format chip; the source is in the tooltip and screen-reader text, and public ones get a dot. */
export function LabelChip({ label, kind }: { label: Label; kind: "topic" | "format" }) {
	const text = kind === "format" ? (FORMAT_LABELS[label.value] ?? label.value) : topicDisplayName(label.value);

	return (
		<span
			title={originLabel(label.origin)}
			className={cx(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
				kind === "format" ? "border-ink/15 bg-ink/[0.04]" : "border-line bg-surface"
			)}
		>
			{label.origin === "PUBLIC" ? <span aria-hidden="true" className="size-1.5 rounded-full bg-positive" /> : null}
			{text}
			<span className="sr-only">, {originLabel(label.origin)}</span>
		</span>
	);
}

export function DataModeBadge({ mode }: { mode: CreatorCard["dataMode"] }) {
	if (mode === "SAMPLE") {
		return <Badge tone="warning">Sample profile</Badge>;
	}

	if (mode === "LIVE") {
		return <Badge tone="positive">Public sources via You.com</Badge>;
	}

	return <Badge>Creator provided</Badge>;
}

function initials(name: string): string {
	return name
		.replace(/\(.*?\)/g, "")
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
	return (
		<span
			aria-hidden="true"
			className={cx(
				"grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-accent",
				size === "lg" ? "size-14 text-lg" : "size-10 text-sm"
			)}
		>
			{initials(name) || "?"}
		</span>
	);
}

/** Rate, reach and clicks in the order brands compare them. */
export function CreatorFacts({ card, dense = false }: { card: CreatorCard; dense?: boolean }) {
	const reachSource = card.dataMode === "SAMPLE" ? "Sample data" : "Creator reported";

	return (
		<dl className={cx("grid gap-x-6 gap-y-3", dense ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
			<div>
				<dt className="text-xs text-muted">Rate per post</dt>
				<dd className="mt-0.5 font-semibold tabular">{rateText(card.rate)}</dd>
			</div>
			<div>
				<dt className="text-xs text-muted">Typical 7-day views</dt>
				<dd className="mt-0.5 font-semibold tabular">
					{card.typical7dViews === null ? <span className="font-normal text-muted">Not provided</span> : compactNumber(card.typical7dViews)}
				</dd>
				{card.typical7dViews !== null ? <dd className="text-xs text-muted">{reachSource}</dd> : null}
			</div>
			<div>
				<dt className="text-xs text-muted">Expected clicks</dt>
				<dd className="mt-0.5 font-semibold tabular">
					{card.expectedClicks === null ? (
						<span className="font-normal text-muted">Unavailable</span>
					) : (
						`${compactNumber(card.expectedClicks.low)}–${compactNumber(card.expectedClicks.high)}`
					)}
				</dd>
				{card.expectedClicks !== null ? <dd className="text-xs text-warning">Sample estimate</dd> : null}
			</div>
		</dl>
	);
}

export function EvidenceRow({
	evidence,
	trailing
}: {
	evidence: Evidence;
	trailing?: ReactNode;
}) {
	return (
		<div className="flex gap-3">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<ExternalLink href={evidence.url} className="font-medium">
						{evidence.title}
					</ExternalLink>
					<Badge tone={evidence.kind === "PUBLIC" ? "positive" : evidence.kind === "SAMPLE" ? "warning" : "neutral"}>
						{evidence.kind === "PUBLIC" ? "Sourced by You.com" : evidence.kind === "SAMPLE" ? "Sample data" : "Creator provided"}
					</Badge>
				</div>
				<p className="mt-1 line-clamp-2 text-sm text-muted">{evidence.excerpt}</p>
				<p className="mt-1 text-xs text-faint">
					Found on {formatDateTime(evidence.retrievedAt)} · {hostOf(evidence.url)}
				</p>
			</div>
			{trailing}
		</div>
	);
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** Directory card: the first-viewport facts a brand compares. */
export function CreatorListItem({ card, href }: { card: CreatorCard; href: string }) {
	return (
		<li>
			<Link
				href={href}
				className="group block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:shadow-[0_1px_0_0_var(--color-line-strong)]"
			>
				<div className="flex items-start gap-4">
					<Avatar name={card.displayName} />
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="font-semibold group-hover:underline group-hover:underline-offset-4">{card.displayName}</h3>
							<DataModeBadge mode={card.dataMode} />
						</div>
						<p className="mt-1 line-clamp-2 text-sm text-muted">{card.bio}</p>
						<div className="mt-3 flex flex-wrap gap-1.5">
							{card.formats.map((f) => (
								<LabelChip key={`f-${f.value}`} label={f} kind="format" />
							))}
							{card.topics.map((t) => (
								<LabelChip key={`t-${t.value}`} label={t} kind="topic" />
							))}
						</div>
					</div>
					<div className="hidden shrink-0 text-right sm:block">
						<p className="text-xs text-muted">Rate per post</p>
						<p className="font-semibold tabular">{rateText(card.rate)}</p>
						<p className="mt-2 text-xs text-muted">{card.evidence.length} source{card.evidence.length === 1 ? "" : "s"}</p>
					</div>
				</div>
			</Link>
		</li>
	);
}
