import type {
	CreatorCard,
	CreatorDataMode,
	CreatorProfile,
	CreatorProfileInput,
	EnrichmentMode,
	Evidence,
	Label,
	LabelOrigin,
	ProfileVisibility,
	Rate
} from "@/shared/contracts";

import { dollarsToCents, formatCents } from "@/lib/format";
import { splitList } from "@/lib/lists";
import { Format, LIMITS } from "@/shared/contracts";
import {
	normalizeTopic,
	normalizeTopics,
	topicDisplayName
} from "@/shared/topics";

/** What the profile editor holds while the creator types. */
export type ProfileForm = {
	displayName: string;
	bio: string;
	channel: string;
	/** As typed, or slugs from the server; normalized when sent. */
	topics: string[];
	formats: Format[];
	/** Typed USD amounts, e.g. "$250.00". */
	rateMin: string;
	rateMax: string;
	typical7dViews: string;
};

/** Saved values a typed form can differ in. */
export type ProfileField =
	| "displayName"
	| "bio"
	| "channel"
	| "topics"
	| "formats"
	| "rate"
	| "typical7dViews";

/** Controls an error can point at. */
export type FormErrorField =
	| "displayName"
	| "bio"
	| "channel"
	| "topics"
	| "formats"
	| "rateMin"
	| "rateMax"
	| "typical7dViews";

export type FormErrors = Partial<Record<FormErrorField, string>>;

export type FormResult = { input: CreatorProfileInput } | { errors: FormErrors };

export type SuggestionPick = { topics: Label[]; formats: Label[] };

export const FORMAT_OPTIONS: readonly Format[] = Format.options;

export const MAX_TOPIC_LENGTH = 60;

/** Contract `Cents` tops out at $100,000; keep rates inside it. */
const MAX_RATE_CENTS = 10_000_000;

const MAX_SELECTED_EVIDENCE = 20;

const FORMAT_LABELS: Record<Format, string> = {
	REVIEW: "Review",
	DEMO: "Demo",
	TUTORIAL: "Tutorial",
	UNBOXING: "Unboxing",
	COMPARISON: "Comparison",
	STORY: "Story",
	OTHER: "Other"
};

export const FIELD_NAMES: Record<ProfileField, string> = {
	displayName: "Display name",
	bio: "Short bio",
	channel: "YouTube channel",
	topics: "Topics",
	formats: "Formats",
	rate: "Rate",
	typical7dViews: "Typical 7-day views"
};

const BLOCKER_TEXT: Record<string, string> = {
	displayName: "Add a display name",
	bio: "Add a bio",
	channel: "Add your YouTube channel",
	topics: "Add at least one topic",
	formats: "Choose at least one format"
};

const ENRICHMENT_ERRORS: Record<string, string> = {
	TIMEOUT:
		"You.com took too long to answer. Try again in a moment, or fill in your profile by hand.",
	QUOTA_EXCEEDED:
		"The You.com search limit has been reached for now. Try again later, or fill in your profile by hand.",
	AUTH_FAILED:
		"The app couldn’t connect to You.com because of a setup problem on our side. You can still fill in your profile by hand.",
	PROVIDER_ERROR:
		"You.com returned an error. Try again, or fill in your profile by hand.",
	BAD_RESPONSE:
		"You.com sent a response the app couldn’t read. Try again, or fill in your profile by hand."
};

const VISIBILITY_TEXT: Record<ProfileVisibility, string> = {
	DRAFT: "Not listed yet",
	LISTED: "Listed in the brand directory",
	HIDDEN: "Hidden from the brand directory"
};

const ENRICHMENT_ORIGINS: Record<EnrichmentMode, LabelOrigin> = {
	LIVE: "PUBLIC",
	SAMPLE: "SAMPLE"
};

const ORIGIN_RANK: Record<LabelOrigin, number> = {
	PUBLIC: 2,
	SAMPLE: 1,
	CREATOR: 0
};

const viewsFormatter = new Intl.NumberFormat("en-US");

export function emptyForm(): ProfileForm {
	return {
		displayName: "",
		bio: "",
		channel: "",
		topics: [],
		formats: [],
		rateMin: "",
		rateMax: "",
		typical7dViews: ""
	};
}

export function profileToForm(profile: CreatorProfile): ProfileForm {
	const { draft } = profile;

	return {
		displayName: draft.displayName,
		bio: draft.bio,
		channel: draft.channel,
		topics: [...draft.topics],
		formats: [...draft.formats],
		rateMin: draft.rate === null ? "" : formatCents(draft.rate.minCents),
		rateMax: draft.rate === null ? "" : formatCents(draft.rate.maxCents),
		typical7dViews:
			draft.typical7dViews === null
				? ""
				: viewsFormatter.format(draft.typical7dViews)
	};
}

/** Tidies a typed amount on blur ("250" → "$250.00"); leaves unreadable text alone. */
export function formatMoneyInput(text: string): string {
	const cents = dollarsToCents(text);

	return cents === null ? text : formatCents(cents);
}

function parseRate(
	form: ProfileForm,
	errors: FormErrors
): Rate | null | undefined {
	const minText = form.rateMin.trim();
	const maxText = form.rateMax.trim();

	if (minText === "" && maxText === "") {
		return null;
	}

	if (minText === "") {
		errors.rateMin = "Enter a minimum too, or clear the maximum.";

		return undefined;
	}

	if (maxText === "") {
		errors.rateMax = "Enter a maximum too, or clear the minimum.";

		return undefined;
	}

	const minCents = parseAmount(minText, "rateMin", errors);
	const maxCents = parseAmount(maxText, "rateMax", errors);

	if (minCents === null || maxCents === null) {
		return undefined;
	}

	if (minCents > maxCents) {
		errors.rateMax = "The maximum must be at least the minimum.";

		return undefined;
	}

	return { minCents, maxCents };
}

function parseAmount(
	text: string,
	field: "rateMin" | "rateMax",
	errors: FormErrors
): number | null {
	const cents = dollarsToCents(text);

	if (cents === null) {
		errors[field] = "Enter a dollar amount, like 250 or 250.00.";

		return null;
	}

	if (cents <= 0) {
		errors[field] = "Enter an amount above $0.";

		return null;
	}

	if (cents > MAX_RATE_CENTS) {
		errors[field] = `Enter at most ${formatCents(MAX_RATE_CENTS)}.`;

		return null;
	}

	return cents;
}

/** Whole numbers with optional thousands separators; null when empty. */
function parseViews(
	text: string,
	errors: FormErrors
): number | null | undefined {
	const trimmed = text.trim();

	if (trimmed === "") {
		return null;
	}

	if (!/^(\d{1,3}(,\d{3})*|\d+)$/.test(trimmed)) {
		errors.typical7dViews = "Enter a whole number of views, like 12,000.";

		return undefined;
	}

	const views = Number(trimmed.replaceAll(",", ""));

	if (!Number.isSafeInteger(views)) {
		errors.typical7dViews = "That number is too large.";

		return undefined;
	}

	return views;
}

/**
 * Checks the form against the contract limits and builds the PUT body.
 * Topics go out as slugs, which is what the server stores anyway.
 */
export function formToProfileInput(
	form: ProfileForm,
	expectedVersion: number,
	selectedEvidenceIds: readonly string[]
): FormResult {
	const errors: FormErrors = {};
	const displayName = form.displayName.trim();
	const bio = form.bio.trim();
	const channel = form.channel.trim();
	const topics = normalizeTopics(form.topics);
	const formats = [...new Set(form.formats)];
	const selected = [...new Set(selectedEvidenceIds)];

	if (displayName.length > LIMITS.displayName) {
		errors.displayName = `Use at most ${LIMITS.displayName} characters.`;
	}

	if (bio.length > LIMITS.bio) {
		errors.bio = `Use at most ${LIMITS.bio} characters.`;
	}

	if (channel.length > LIMITS.url) {
		errors.channel = "That link is too long.";
	}

	if (topics.length > LIMITS.maxTopics) {
		errors.topics = `Choose at most ${LIMITS.maxTopics} topics.`;
	}

	if (formats.length > LIMITS.maxFormats) {
		errors.formats = `Choose at most ${LIMITS.maxFormats} formats.`;
	}

	const rate = parseRate(form, errors);
	const typical7dViews = parseViews(form.typical7dViews, errors);

	if (
		Object.keys(errors).length > 0 ||
		rate === undefined ||
		typical7dViews === undefined
	) {
		return { errors };
	}

	return {
		input: {
			displayName,
			bio,
			channel,
			topics,
			formats,
			rate,
			typical7dViews,
			selectedEvidenceIds: selected.slice(0, MAX_SELECTED_EVIDENCE),
			expectedVersion
		}
	};
}

/**
 * Adds comma-separated topics typed into the topic box, skipping ones
 * already present (by slug) and stopping at the limit.
 */
export function addTopics(
	topics: readonly string[],
	text: string
): { topics: string[]; error: string | null } {
	const next = [...topics];
	const seen = new Set(topics.map(normalizeTopic));
	let error: string | null = null;

	for (const item of splitList(text)) {
		const slug = normalizeTopic(item);

		if (item.length > MAX_TOPIC_LENGTH) {
			error = `Keep each topic under ${MAX_TOPIC_LENGTH} characters.`;

			continue;
		}

		if (slug === "" || seen.has(slug)) {
			continue;
		}

		if (seen.size >= LIMITS.maxTopics) {
			error = `You can add up to ${LIMITS.maxTopics} topics.`;

			break;
		}

		seen.add(slug);
		next.push(item);
	}

	return { topics: next, error };
}

/**
 * Adds ticked You.com suggestions to the form. `skipped` lists readable names
 * that didn't fit under the topic or format limits.
 */
export function applySuggestions(
	form: ProfileForm,
	picks: SuggestionPick
): { form: ProfileForm; skipped: string[] } {
	const skipped: string[] = [];
	const topics = [...form.topics];
	const topicSlugs = new Set(topics.map(normalizeTopic));
	const formats = [...form.formats];

	for (const { value } of picks.topics) {
		const slug = normalizeTopic(value);

		if (slug === "" || topicSlugs.has(slug)) {
			continue;
		}

		if (topicSlugs.size >= LIMITS.maxTopics) {
			skipped.push(topicDisplayName(slug));

			continue;
		}

		topicSlugs.add(slug);
		topics.push(value);
	}

	for (const { value } of picks.formats) {
		const parsed = Format.safeParse(value);

		if (!parsed.success || formats.includes(parsed.data)) {
			continue;
		}

		if (formats.length >= LIMITS.maxFormats) {
			skipped.push(FORMAT_LABELS[parsed.data]);

			continue;
		}

		formats.push(parsed.data);
	}

	return { form: { ...form, topics, formats }, skipped };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((item, index) => item === b[index]);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
	return sameList([...new Set(a)].sort(), [...new Set(b)].sort());
}

function sameRate(form: ProfileForm, saved: Rate | null): boolean {
	const result = parseRate(form, {});

	if (result === undefined) {
		return false;
	}

	if (result === null || saved === null) {
		return result === saved;
	}

	return (
		result.minCents === saved.minCents && result.maxCents === saved.maxCents
	);
}

/** Saved fields whose value differs from what's typed, in form order. */
export function differingFields(
	form: ProfileForm,
	profile: CreatorProfile
): ProfileField[] {
	const { draft } = profile;
	const fields: ProfileField[] = [];

	if (form.displayName.trim() !== draft.displayName.trim()) {
		fields.push("displayName");
	}

	if (form.bio.trim() !== draft.bio.trim()) {
		fields.push("bio");
	}

	if (form.channel.trim() !== draft.channel.trim()) {
		fields.push("channel");
	}

	if (!sameList(normalizeTopics(form.topics), normalizeTopics(draft.topics))) {
		fields.push("topics");
	}

	if (!sameSet(form.formats, draft.formats)) {
		fields.push("formats");
	}

	if (!sameRate(form, draft.rate)) {
		fields.push("rate");
	}

	if (parseViews(form.typical7dViews, {}) !== draft.typical7dViews) {
		fields.push("typical7dViews");
	}

	return fields;
}

/** True when saving would change something, including the evidence selection. */
export function isDirty(
	form: ProfileForm,
	profile: CreatorProfile,
	selectedEvidenceIds: readonly string[] = profile.draft.selectedEvidenceIds
): boolean {
	return (
		differingFields(form, profile).length > 0 ||
		!sameSet(selectedEvidenceIds, profile.draft.selectedEvidenceIds)
	);
}

/** Maps API `fields` paths ("rate.maxCents", "topics.2") onto form controls. */
export function errorsFromApiFields(
	fields: Record<string, string>
): FormErrors {
	const errors: FormErrors = {};

	for (const [path, message] of Object.entries(fields)) {
		const [head = "", tail] = path.split(".");

		if (head === "rate") {
			errors[tail === "minCents" ? "rateMin" : "rateMax"] = message;
		} else if (
			head === "displayName" ||
			head === "bio" ||
			head === "channel" ||
			head === "topics" ||
			head === "formats" ||
			head === "typical7dViews"
		) {
			errors[head] = message;
		}
	}

	return errors;
}

/** A saved value as the creator would read it, for comparing after a conflict. */
export function savedValueText(
	field: ProfileField,
	profile: CreatorProfile
): string {
	const { draft } = profile;

	switch (field) {
		case "displayName":
		case "bio":
		case "channel":
			return draft[field].trim() === "" ? "Empty" : draft[field];

		case "topics":
			return draft.topics.length === 0
				? "None"
				: draft.topics.map(topicLabel).join(", ");

		case "formats":
			return draft.formats.length === 0
				? "None"
				: draft.formats.map(formatLabel).join(", ");

		case "rate":
			return draft.rate === null
				? "Rate not provided"
				: `${formatCents(draft.rate.minCents)}–${formatCents(draft.rate.maxCents)}`;

		case "typical7dViews":
			return draft.typical7dViews === null
				? "Not provided"
				: viewsFormatter.format(draft.typical7dViews);
	}
}

/** Rows from the latest search first, then older rows for the same channel. */
export function mergeEvidence(
	latest: readonly Evidence[],
	existing: readonly Evidence[]
): Evidence[] {
	const latestIds = new Set(latest.map((row) => row.id));

	return [...latest, ...existing.filter((row) => !latestIds.has(row.id))];
}

/** "bio" → "Add a bio"; unknown blockers still read as a sentence. */
export function blockerText(blocker: string): string {
	const known = BLOCKER_TEXT[blocker];

	if (known !== undefined) {
		return known;
	}

	const words = blocker
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.toLowerCase();

	return `Complete ${words}`;
}

export function enrichmentErrorText(errorCode: string | null): string {
	return (
		(errorCode === null ? undefined : ENRICHMENT_ERRORS[errorCode]) ??
		"The search didn’t finish. Try again, or fill in your profile by hand."
	);
}

export function enrichmentOrigin(mode: EnrichmentMode): LabelOrigin {
	return ENRICHMENT_ORIGINS[mode];
}

export function visibilityText(visibility: ProfileVisibility): string {
	return VISIBILITY_TEXT[visibility];
}

export function formatLabel(format: Format): string {
	return FORMAT_LABELS[format];
}

/** Readable topic name, whether typed ("Desk Setups") or a slug. */
export function topicLabel(topic: string): string {
	return topicDisplayName(normalizeTopic(topic));
}

/**
 * Mirrors the server's label provenance: a label backed by a selected
 * evidence row (via the last search's suggestions) takes that row's origin.
 */
function labelsFor(
	values: readonly string[],
	suggestions: readonly Label[],
	selected: ReadonlySet<string>
): Label[] {
	return values.map((value) => {
		const backing = suggestions.filter(
			(label) =>
				label.value === value &&
				label.evidenceIds.some((id) => selected.has(id))
		);
		const evidenceIds = [
			...new Set(
				backing.flatMap((label) =>
					label.evidenceIds.filter((id) => selected.has(id))
				)
			)
		];
		const origin = backing.reduce<LabelOrigin>(
			(best, label) =>
				ORIGIN_RANK[label.origin] > ORIGIN_RANK[best] ? label.origin : best,
			"CREATOR"
		);

		return { value, origin, evidenceIds };
	});
}

/**
 * A brand's view of the saved draft, close to what publishing would produce.
 * Labels from evidence outside the last search show as creator provided.
 */
export function previewCard(profile: CreatorProfile): CreatorCard {
	const { draft, published, lastEnrichment } = profile;
	const selected = new Set(draft.selectedEvidenceIds);
	const evidence = profile.evidence.filter((row) => selected.has(row.id));
	const suggestions = lastEnrichment?.suggestions ?? {
		topics: [],
		formats: []
	};
	const isSample = published?.dataMode === "SAMPLE";
	let dataMode: CreatorDataMode = "SELF_REPORTED";

	if (isSample) {
		dataMode = "SAMPLE";
	} else if (evidence.some((row) => row.kind === "PUBLIC")) {
		dataMode = "LIVE";
	}

	return {
		id: profile.id,
		displayName: draft.displayName,
		bio: draft.bio,
		profileUrl: profile.canonicalChannelUrl ?? "",
		topics: labelsFor(normalizeTopics(draft.topics), suggestions.topics, selected),
		formats: labelsFor(draft.formats, suggestions.formats, selected),
		rate: draft.rate,
		typical7dViews: draft.typical7dViews,
		publicMetrics: published?.publicMetrics ?? [],
		evidence,
		dataMode,
		expectedClicks: isSample ? (published?.expectedClicks ?? null) : null,
		profileVersion: profile.version
	};
}
