import type { Format, Objective } from "@/shared/contracts";

import {
	Format as FormatSchema,
	Objective as ObjectiveSchema
} from "@/shared/contracts";

export const FORMAT_LABELS: Record<Format, string> = {
	REVIEW: "Review",
	DEMO: "Demo",
	TUTORIAL: "Tutorial",
	UNBOXING: "Unboxing",
	COMPARISON: "Comparison",
	STORY: "Story",
	OTHER: "Other"
};

export const OBJECTIVE_LABELS: Record<Objective, string> = {
	AWARENESS: "Awareness",
	TRAFFIC: "Traffic to your site",
	SALES: "Sales",
	CONTENT: "Content you can reuse"
};

export const FORMATS: readonly Format[] = FormatSchema.options;
export const OBJECTIVES: readonly Objective[] = ObjectiveSchema.options;

/** "desk-setups" → "Desk setups". */
export function topicText(slug: string): string {
	const words = slug.replaceAll("-", " ").trim();

	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Reads a query value as a Format, or null. */
export function toFormat(value: string | null): Format | null {
	const parsed = FormatSchema.safeParse(value);

	return parsed.success ? parsed.data : null;
}
