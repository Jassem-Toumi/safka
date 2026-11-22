import type { LabelOrigin, MetricResult, RateFit } from "@/shared/contracts";

import { shortfallPct } from "@/lib/format";

const ORIGIN_LABELS: Record<LabelOrigin, string> = {
	PUBLIC: "Sourced by You.com",
	CREATOR: "Creator provided",
	SAMPLE: "Sample data"
};

export function originLabel(origin: LabelOrigin): string {
	return ORIGIN_LABELS[origin];
}

const RATE_FIT_LABELS: Record<RateFit, string> = {
	WITHIN_PREFERENCE: "Within your price",
	UNKNOWN: "Rate not provided",
	ABOVE_PREFERENCE: "Above your price"
};

export function rateFitLabel(fit: RateFit): string {
	return RATE_FIT_LABELS[fit];
}

function count(n: number): string {
	return n.toLocaleString("en-US");
}

/**
 * One line for a report metric (frontend spec §6, final backend spec §6),
 * e.g. "420 / 600 clicks · 30% below target". A null count is never shown as
 * zero; a status whose numbers are missing falls back to its plain label.
 */
export function metricText(
	metric: MetricResult,
	noun: "views" | "clicks"
): string {
	const { status, actual, target } = metric;

	if (status === "NO_TARGET") {
		return actual === null
			? "No target set"
			: `${count(actual)} ${noun} · No target set`;
	}

	if (status === "PENDING") {
		return actual === null
			? "Measuring"
			: `Measuring · ${count(actual)} so far (provisional)`;
	}

	if (status === "INSUFFICIENT_DATA" || actual === null || target === null) {
		return "Insufficient data";
	}

	const ratio = `${count(actual)} / ${count(target)} ${noun}`;

	if (status === "MET") {
		return `${ratio} · Target met`;
	}

	const pct = metric.shortfallPct ?? shortfallPct(target, actual);

	return `${ratio} · ${pct}% below target`;
}
