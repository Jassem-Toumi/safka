import type {
	Campaign,
	CreatorCard,
	Format,
	Product,
	TermsInput
} from "@/shared/contracts";

import {
	parseCentsText,
	parseCountText,
	splitLines,
	valueOf
} from "@/lib/campaignForm";
import { isoToLocalInput, localInputToIso } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { Format as FormatSchema } from "@/shared/contracts";

/** The offer composer's inputs, as the person typed them. */
export type OfferForm = {
	/** USD text. */
	price: string;
	format: Format | "";
	brief: string;
	angle: string;

	/** One per line. */
	talkingPoints: string;

	/** One per line. */
	restrictions: string;
	disclosure: string;

	/** `datetime-local` values in the viewer's time zone. */
	draftDue: string;
	publishDue: string;
	viewTarget: string;
	clickTarget: string;
};

export type OfferField = keyof OfferForm;

/** `form` holds messages that belong to no single field. */
export type OfferErrors = Partial<Record<OfferField | "form", string>>;

/** Who the offer goes to; a `MatchCard` fits, as does a directory card. */
export type OfferRecipient = {
	creator: CreatorCard;
	angle: string | null;
};

export const DEFAULT_DISCLOSURE =
	"Say it is sponsored in the first 30 seconds and use YouTube's paid promotion label.";

/** Mirrors `TermsInput` in `@/shared/contracts`. */
const LIMITS = {
	brief: 2000,
	angle: 500,
	disclosure: 500,
	listItems: 6,
	listItemLength: 240
} as const;

const DRAFT_DUE_DAYS = 7;
const PUBLISH_DUE_DAYS = 14;

/** `days` from `now`, rounded up to the next whole hour, as a local input. */
function dueInput(now: Date, days: number): string {
	const due = new Date(now.getTime());

	due.setDate(due.getDate() + days);
	due.setMinutes(0, 0, 0);
	due.setHours(due.getHours() + 1);

	return isoToLocalInput(due.toISOString());
}

function creatorFormats(creator: CreatorCard): Format[] {
	const formats: Format[] = [];

	for (const label of creator.formats) {
		const parsed = FormatSchema.safeParse(label.value);

		if (parsed.success) {
			formats.push(parsed.data);
		}
	}

	return formats;
}

/**
 * The first campaign format the creator makes, else the creator's first
 * format, else the campaign's, else none.
 */
function pickFormat(campaignFormats: Format[], creator: CreatorCard): Format | "" {
	const offered = creatorFormats(creator);
	const overlap = campaignFormats.find((format) => offered.includes(format));

	return overlap ?? offered[0] ?? campaignFormats[0] ?? "";
}

/**
 * Composer defaults (frontend spec §4 "Offer composer"): the campaign's goal,
 * talking points, restrictions and targets, the match's suggested angle, a
 * sponsorship disclosure, and due dates 7 and 14 days out. A direct offer
 * (no campaign) starts from the product description.
 */
export function prefillOffer(
	campaign: Campaign | null,
	recipient: OfferRecipient,
	product: Product | null,
	now: Date = new Date()
): OfferForm {
	const brief = campaign?.brief ?? null;
	const targetText = (target: number | null | undefined) =>
		target === null || target === undefined ? "" : String(target);

	return {
		price: "",
		format: pickFormat(brief?.formats ?? [], recipient.creator),
		brief: brief?.goal ?? product?.description ?? "",
		angle: recipient.angle ?? "",
		talkingPoints: brief?.talkingPoints.join("\n") ?? "",
		restrictions: brief?.restrictions.join("\n") ?? "",
		disclosure: DEFAULT_DISCLOSURE,
		draftDue: dueInput(now, DRAFT_DUE_DAYS),
		publishDue: dueInput(now, PUBLISH_DUE_DAYS),
		viewTarget: targetText(campaign?.defaultViewTarget),
		clickTarget: targetText(campaign?.defaultClickTarget)
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

function lengthError(text: string, maxLength: number): string | null {
	return text.length > maxLength
		? `Keep it under ${maxLength} characters.`
		: null;
}

/**
 * Validates the composer and returns either `CreateDealInput.terms` or
 * per-field messages. `remainingCents` is the campaign's latest remaining
 * budget, or null for a direct offer.
 */
export function offerFormToInput(
	form: OfferForm,
	context: { now: Date; remainingCents: number | null }
): { terms: TermsInput } | { errors: OfferErrors } {
	const errors: OfferErrors = {};

	function check(field: keyof OfferErrors, message: string | null) {
		if (message !== null) {
			errors[field] = message;
		}
	}

	const price = parseCentsText(form.price);
	const { remainingCents } = context;

	if ("error" in price) {
		check("price", price.error);
	} else if (price.value === null) {
		check("price", "Enter the price you're offering.");
	} else if (remainingCents !== null && price.value > remainingCents) {
		check(
			"price",
			`This is more than the campaign's remaining ${formatCents(remainingCents)}.`
		);
	}

	check("format", form.format === "" ? "Choose a format." : null);

	const brief = form.brief.trim();
	const angle = form.angle.trim();
	const disclosure = form.disclosure.trim();

	check(
		"brief",
		brief === "" ? "Describe the video." : lengthError(brief, LIMITS.brief)
	);
	check("angle", lengthError(angle, LIMITS.angle));
	check(
		"disclosure",
		disclosure === ""
			? "Say how the creator should disclose the sponsorship."
			: lengthError(disclosure, LIMITS.disclosure)
	);

	const talkingPoints = splitLines(form.talkingPoints);
	const restrictions = splitLines(form.restrictions);

	check("talkingPoints", listError(talkingPoints, "talking points"));
	check("restrictions", listError(restrictions, "restrictions"));

	const draftDueAt = localInputToIso(form.draftDue);
	const publishDueAt = localInputToIso(form.publishDue);

	if (draftDueAt === null) {
		check("draftDue", "Choose when the draft is due.");
	} else if (new Date(draftDueAt) <= context.now) {
		check("draftDue", "Choose a time in the future.");
	}

	if (publishDueAt === null) {
		check("publishDue", "Choose when the video should go live.");
	} else if (draftDueAt !== null && publishDueAt <= draftDueAt) {
		check("publishDue", "Choose a time after the draft is due.");
	}

	const viewTarget = parseCountText(form.viewTarget);
	const clickTarget = parseCountText(form.clickTarget);

	check("viewTarget", "error" in viewTarget ? viewTarget.error : null);
	check("clickTarget", "error" in clickTarget ? clickTarget.error : null);

	const amountCents = valueOf(price);

	// The repeated checks only let TypeScript narrow the values.
	if (
		Object.keys(errors).length > 0 ||
		amountCents === null ||
		form.format === "" ||
		draftDueAt === null ||
		publishDueAt === null
	) {
		return { errors };
	}

	return {
		terms: {
			amountCents,
			format: form.format,
			brief,
			angle: angle === "" ? null : angle,
			talkingPoints,
			restrictions,
			disclosure,
			draftDueAt,
			publishDueAt,
			viewTarget: valueOf(viewTarget),
			clickTarget: valueOf(clickTarget)
		}
	};
}

const SERVER_FIELDS: Record<string, OfferField> = {
	amountCents: "price",
	format: "format",
	brief: "brief",
	angle: "angle",
	talkingPoints: "talkingPoints",
	restrictions: "restrictions",
	disclosure: "disclosure",
	draftDueAt: "draftDue",
	publishDueAt: "publishDue",
	viewTarget: "viewTarget",
	clickTarget: "clickTarget"
};

/**
 * Maps a VALIDATION_ERROR's `fields` ("terms.amountCents", "draftDueAt")
 * onto composer fields; anything else lands in `form`.
 */
export function offerErrorsFromServer(
	fields: Record<string, string>
): OfferErrors {
	const errors: OfferErrors = {};

	for (const [path, message] of Object.entries(fields)) {
		const key = path.replace(/^terms\./, "").replace(/\.\d+$/, "");
		const field = SERVER_FIELDS[key] ?? "form";

		errors[field] ??= message;
	}

	return errors;
}
