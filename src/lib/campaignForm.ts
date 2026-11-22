import type {
	CampaignInput,
	Format,
	Objective,
	ParseResult
} from "@/shared/contracts";

import { dollarsToCents, formatCents } from "@/lib/format";
import { splitList } from "@/lib/lists";

/** The campaign builder's inputs, as the person typed them. */
export type CampaignForm = {
	title: string;
	goal: string;
	objective: Objective | "";

	/** Comma separated. */
	topics: string;
	formats: Format[];

	/** One per line. */
	talkingPoints: string;

	/** One per line. */
	restrictions: string;

	/** USD text, e.g. "$600.00". */
	budget: string;
	preferredMax: string;
	viewTarget: string;
	clickTarget: string;
};

export type CampaignFormField = keyof CampaignForm;

/** `form` holds messages that belong to no single field. */
export type CampaignFormErrors = Partial<
	Record<CampaignFormField | "productId" | "form", string>
>;

export type Parsed<T> = { value: T } | { error: string };

/** Mirrors `Brief` and `Cents` in `@/shared/contracts`. */
const LIMITS = {
	title: 80,
	goal: 1500,
	topics: 8,
	topicLength: 60,
	listItems: 6,
	listItemLength: 240,
	maxCents: 10_000_000
} as const;

/** Splits text into trimmed, non-empty lines; commas stay inside a line. */
export function splitLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line !== "");
}

/** Optional USD amount: blank is null; otherwise positive and within `Cents`. */
export function parseCentsText(text: string): Parsed<number | null> {
	if (text.trim() === "") {
		return { value: null };
	}

	const cents = dollarsToCents(text);

	if (cents === null) {
		return { error: "Enter a dollar amount, like 600 or 600.00." };
	}

	if (cents <= 0) {
		return { error: "Enter an amount above $0." };
	}

	if (cents > LIMITS.maxCents) {
		return { error: `Enter ${formatCents(LIMITS.maxCents)} or less.` };
	}

	return { value: cents };
}

/** Optional whole count such as "20,000": blank is null, else positive. */
export function parseCountText(text: string): Parsed<number | null> {
	const trimmed = text.trim();

	if (trimmed === "") {
		return { value: null };
	}

	if (!/^(\d{1,3}(,\d{3})*|\d+)$/.test(trimmed)) {
		return { error: "Enter a whole number, like 600." };
	}

	const count = Number(trimmed.replaceAll(",", ""));

	if (count <= 0 || !Number.isSafeInteger(count)) {
		return { error: "Enter a number above 0." };
	}

	return { value: count };
}

/** On blur: shows a valid amount as "$600.00"; leaves anything else as typed. */
export function normalizeMoneyText(text: string): string {
	const cents = dollarsToCents(text);

	return cents === null ? text : formatCents(cents);
}

/** A parsed value, or null once its error has been reported. */
export function valueOf<T>(parsed: Parsed<T>): T | null {
	return "value" in parsed ? parsed.value : null;
}

function centsToText(cents: number | null): string {
	return cents === null ? "" : formatCents(cents);
}

function countToText(count: number | null): string {
	return count === null ? "" : String(count);
}

export function emptyCampaignForm(): CampaignForm {
	return {
		title: "",
		goal: "",
		objective: "",
		topics: "",
		formats: [],
		talkingPoints: "",
		restrictions: "",
		budget: "",
		preferredMax: "",
		viewTarget: "",
		clickTarget: ""
	};
}

/**
 * Fills the form from a suggested brief. Topic slugs read as words
 * ("desk setups"); the server turns them back into slugs.
 */
export function parseResultToForm(result: ParseResult): CampaignForm {
	const { brief } = result;

	return {
		title: brief.title,
		goal: brief.goal,
		objective: brief.objective ?? "",
		topics: brief.topics.map((topic) => topic.replaceAll("-", " ")).join(", "),
		formats: brief.formats,
		talkingPoints: brief.talkingPoints.join("\n"),
		restrictions: brief.restrictions.join("\n"),
		budget: centsToText(result.budgetCents),
		preferredMax: centsToText(result.preferredMaxPerPostCents),
		viewTarget: countToText(result.defaultViewTarget),
		clickTarget: countToText(result.defaultClickTarget)
	};
}

function listError(items: string[], noun: string): string | null {
	if (items.length > LIMITS.listItems) {
		return `Keep it to ${LIMITS.listItems} ${noun} or fewer.`;
	}

	if (items.some((item) => item.length > LIMITS.listItemLength)) {
		return `Keep each line under ${LIMITS.listItemLength} characters.`;
	}

	return null;
}

function topicsError(topics: string[]): string | null {
	if (topics.length === 0) {
		return "Add at least one topic.";
	}

	if (topics.length > LIMITS.topics) {
		return `Keep it to ${LIMITS.topics} topics or fewer.`;
	}

	if (topics.some((topic) => topic.length > LIMITS.topicLength)) {
		return `Keep each topic under ${LIMITS.topicLength} characters.`;
	}

	return null;
}

function requiredTextError(
	text: string,
	maxLength: number,
	missing: string
): string | null {
	if (text === "") {
		return missing;
	}

	if (text.length > maxLength) {
		return `Keep it under ${maxLength} characters.`;
	}

	return null;
}

/**
 * Validates the builder with the same rules the server applies on confirm
 * and returns either the `createCampaign` body or per-field messages.
 */
export function formToCampaignInput(
	form: CampaignForm,
	context: { productId: string; sourcePrompt: string }
): { input: CampaignInput } | { errors: CampaignFormErrors } {
	const errors: CampaignFormErrors = {};

	function check(field: keyof CampaignFormErrors, message: string | null) {
		if (message !== null) {
			errors[field] = message;
		}
	}

	check("productId", context.productId === "" ? "Choose a product." : null);

	const title = form.title.trim();
	const goal = form.goal.trim();

	check("title", requiredTextError(title, LIMITS.title, "Add a title."));
	check("goal", requiredTextError(goal, LIMITS.goal, "Describe the goal."));
	check("objective", form.objective === "" ? "Choose an objective." : null);

	const topics = splitList(form.topics);
	const talkingPoints = splitLines(form.talkingPoints);
	const restrictions = splitLines(form.restrictions);

	check("topics", topicsError(topics));
	check("talkingPoints", listError(talkingPoints, "talking points"));
	check("restrictions", listError(restrictions, "restrictions"));

	const budget = parseCentsText(form.budget);
	const preferredMax = parseCentsText(form.preferredMax);
	const viewTarget = parseCountText(form.viewTarget);
	const clickTarget = parseCountText(form.clickTarget);

	if ("error" in budget) {
		check("budget", budget.error);
	} else if (budget.value === null) {
		check("budget", "Set a total budget.");
	}

	if ("error" in preferredMax) {
		check("preferredMax", preferredMax.error);
	} else if (
		"value" in budget &&
		budget.value !== null &&
		preferredMax.value !== null &&
		preferredMax.value > budget.value
	) {
		check("preferredMax", "Keep this at or below the total budget.");
	}

	check("viewTarget", "error" in viewTarget ? viewTarget.error : null);
	check("clickTarget", "error" in clickTarget ? clickTarget.error : null);

	// The objective check repeats only so TypeScript narrows it.
	if (Object.keys(errors).length > 0 || form.objective === "") {
		return { errors };
	}

	return {
		input: {
			productId: context.productId,
			sourcePrompt: context.sourcePrompt,
			brief: {
				title,
				goal,
				objective: form.objective,
				topics,
				formats: form.formats,
				talkingPoints,
				restrictions
			},
			budgetCents: valueOf(budget),
			preferredMaxPerPostCents: valueOf(preferredMax),
			defaultViewTarget: valueOf(viewTarget),
			defaultClickTarget: valueOf(clickTarget),
			confirm: true
		}
	};
}

const SERVER_FIELDS: Record<string, CampaignFormField | "productId"> = {
	"brief.title": "title",
	"brief.goal": "goal",
	"brief.objective": "objective",
	"brief.topics": "topics",
	"brief.formats": "formats",
	"brief.talkingPoints": "talkingPoints",
	"brief.restrictions": "restrictions",
	budgetCents: "budget",
	preferredMaxPerPostCents: "preferredMax",
	defaultViewTarget: "viewTarget",
	defaultClickTarget: "clickTarget",
	productId: "productId"
};

/**
 * Maps a VALIDATION_ERROR's `fields` ("brief.talkingPoints.2", "budgetCents")
 * onto form fields; anything else lands in `form`.
 */
export function campaignErrorsFromServer(
	fields: Record<string, string>
): CampaignFormErrors {
	const errors: CampaignFormErrors = {};

	for (const [path, message] of Object.entries(fields)) {
		const key = path.replace(/\.\d+$/, "");
		const field = SERVER_FIELDS[key] ?? "form";

		errors[field] ??= message;
	}

	return errors;
}
