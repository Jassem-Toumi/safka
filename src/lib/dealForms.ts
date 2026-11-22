import type {
	AdminDisputeSummary,
	Deal,
	DealAction,
	DealListFilter,
	DraftBatch,
	IssueCode
} from "@/shared/contracts";

import { localInputToIso } from "@/lib/dates";
import { dollarsToCents, formatCents } from "@/lib/format";
import { UPLOAD_LIMITS } from "@/shared/contracts";

export type FormResult<T, F extends string> =
	| { ok: true; value: T }
	| { ok: false; errors: Partial<Record<F, string>> };

export const DEAL_FILTERS: readonly { value: DealListFilter; label: string }[] =
	[
		{ value: "needs_action", label: "Needs action" },
		{ value: "in_progress", label: "In progress" },
		{ value: "closed", label: "Closed" }
	];

/** The `?filter=` value, defaulting to "needs_action". */
export function parseDealFilter(value: string | null): DealListFilter {
	const match = DEAL_FILTERS.find((filter) => filter.value === value);

	return match?.value ?? "needs_action";
}

/** The contract's `Cents` ceiling: $100,000. */
const MAX_CENTS = 10_000_000;
const MAX_ANGLE_LENGTH = 500;
const MAX_REASON_LENGTH = 1000;

export type CounterInput = {
	amount: string;
	angle: string;
	draftDue: string;
	publishDue: string;
};

export type CounterValue = {
	amountCents: number;
	angle: string | null;
	draftDueAt: string;
	publishDueAt: string;
};

export type CounterField = keyof CounterInput;

export function validateCounter(
	input: CounterInput,
	now: Date
): FormResult<CounterValue, CounterField> {
	const errors: Partial<Record<CounterField, string>> = {};
	const amountCents = dollarsToCents(input.amount);

	if (amountCents === null) {
		errors.amount = "Enter an amount in dollars, like 450 or 450.00.";
	} else if (amountCents <= 0) {
		errors.amount = "Enter an amount above $0.";
	} else if (amountCents > MAX_CENTS) {
		errors.amount = `Keep the amount at or under ${formatCents(MAX_CENTS)}.`;
	}

	const angle = input.angle.trim();

	if (angle.length > MAX_ANGLE_LENGTH) {
		errors.angle = `Keep the angle under ${MAX_ANGLE_LENGTH} characters.`;
	}

	const draftDueAt = localInputToIso(input.draftDue);
	const publishDueAt = localInputToIso(input.publishDue);

	if (draftDueAt === null) {
		errors.draftDue = "Pick a date and time for the draft.";
	} else if (new Date(draftDueAt) <= now) {
		errors.draftDue = "Pick a draft due date in the future.";
	}

	if (publishDueAt === null) {
		errors.publishDue = "Pick a date and time to publish by.";
	} else if (draftDueAt !== null && publishDueAt <= draftDueAt) {
		errors.publishDue = "The publish date must be after the draft due date.";
	}

	if (
		Object.keys(errors).length > 0 ||
		amountCents === null ||
		draftDueAt === null ||
		publishDueAt === null
	) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		value: {
			amountCents,
			angle: angle === "" ? null : angle,
			draftDueAt,
			publishDueAt
		}
	};
}

/** Error text for a required 1–1000 character reason, or null when valid. */
export function validateReason(text: string): string | null {
	const reason = text.trim();

	if (reason === "") {
		return "Enter a reason.";
	}

	if (reason.length > MAX_REASON_LENGTH) {
		return "Keep the reason under 1,000 characters.";
	}

	return null;
}

const KB = 1024;
const MB = 1024 * 1024;

/** Binary sizes with short labels, e.g. "1.5 MB", for upload limits. */
export function formatBytes(bytes: number): string {
	if (bytes < MB) {
		return `${Math.max(1, Math.round(bytes / KB))} KB`;
	}

	const megabytes = Math.round((bytes / MB) * 10) / 10;

	return `${megabytes} MB`;
}

/** Error text for a draft video the backend would refuse, or null. */
export function checkDraftFile(file: {
	name: string;
	type: string;
	size: number;
}): string | null {
	const limit = formatBytes(UPLOAD_LIMITS.maxBytes);

	if (file.type !== "video/mp4") {
		return `${file.name} isn’t an MP4. Drafts must be MP4 videos up to ${limit} each.`;
	}

	if (file.size > UPLOAD_LIMITS.maxBytes) {
		return `${file.name} is ${formatBytes(file.size)}. Each draft can be up to ${limit}.`;
	}

	return null;
}

export type PublicationInput = {
	url: string;
	publishedAt: string;
	attested: boolean;
};

export type PublicationField = keyof PublicationInput;

/** Allows for a clock a little ahead of the server's. */
const FUTURE_SLACK_MS = 60_000;

function isWebUrl(value: string): boolean {
	try {
		const { protocol } = new URL(value);

		return protocol === "https:" || protocol === "http:";
	} catch {
		return false;
	}
}

/** The backend checks the link is a YouTube video; this catches typos early. */
export function validatePublication(
	input: PublicationInput,
	now: Date
): FormResult<{ url: string; publishedAt: string }, PublicationField> {
	const errors: Partial<Record<PublicationField, string>> = {};
	const url = input.url.trim();

	if (url === "") {
		errors.url = "Paste the link to your YouTube video.";
	} else if (!isWebUrl(url)) {
		errors.url =
			"Paste a full YouTube link, like https://youtu.be/… or https://www.youtube.com/watch?v=…";
	}

	const publishedAt = localInputToIso(input.publishedAt);

	if (publishedAt === null) {
		errors.publishedAt = "Pick when the video went live.";
	} else if (
		new Date(publishedAt).getTime() > now.getTime() + FUTURE_SLACK_MS
	) {
		errors.publishedAt = "The publish time can’t be in the future.";
	}

	if (!input.attested) {
		errors.attested =
			"Confirm you used the approved draft and followed the offer requirements.";
	}

	if (Object.keys(errors).length > 0 || publishedAt === null) {
		return { ok: false, errors };
	}

	return { ok: true, value: { url, publishedAt } };
}

function byRoundDescending(a: DraftBatch, b: DraftBatch): number {
	return b.round - a.round;
}

export function latestBatch(deal: Deal): DraftBatch | null {
	return deal.draftBatches.toSorted(byRoundDescending)[0] ?? null;
}

/** Batches before the latest, newest first. */
export function earlierBatches(deal: Deal): DraftBatch[] {
	return deal.draftBatches.toSorted(byRoundDescending).slice(1);
}

const ISSUE_CODE_LABELS: Record<IssueCode, string> = {
	MISSED_DEADLINE: "Missed deadline",
	CONTENT_MISMATCH: "Wrong or missing content",
	MISSING_DISCLOSURE: "Missing disclosure",
	INVALID_PUBLICATION: "Published link doesn’t work or doesn’t match",
	UNRESPONSIVE_PARTY: "The other party isn’t responding",
	OTHER: "Something else"
};

export function issueCodeLabel(code: IssueCode): string {
	return ISSUE_CODE_LABELS[code];
}

/** Lower comes first: the step that moves the deal forward, then the rest. */
const ACTION_ORDER: Record<DealAction, number> = {
	ACCEPT: 0,
	SUBMIT_DRAFTS: 0,
	APPROVE_DRAFT: 0,
	SUBMIT_PUBLICATION: 0,
	CONFIRM_DELIVERY: 0,
	RESUME_DEAL: 0,
	COUNTER: 1,
	REQUEST_CHANGES: 1,
	RELEASE_PAYMENT: 1,
	REFUND_PAYMENT: 1,
	CANCEL_DEAL: 1,
	DECLINE: 2,
	WITHDRAW: 2,
	REPORT_ISSUE: 3
};

export function orderActions(actions: readonly DealAction[]): DealAction[] {
	return actions.toSorted((a, b) => ACTION_ORDER[a] - ACTION_ORDER[b]);
}

export type PendingSubmission = { key: string; fingerprint: string };

/**
 * One key per intentional submission, but a retry of the same payload after
 * a failure reuses the failed attempt's key so the server can deduplicate it.
 * `previous` is the last submission that didn't succeed, if any.
 */
export function pickIdempotencyKey(
	previous: PendingSubmission | null,
	fingerprint: string,
	makeKey: () => string
): string {
	if (previous !== null && previous.fingerprint === fingerprint) {
		return previous.key;
	}

	return makeKey();
}

/** The date the header highlights for the deal's current step. */
export function headerDeadline(
	deal: Deal
): { label: string; at: string } | null {
	const terms = deal.agreement?.terms ?? deal.latestProposal.terms;

	switch (deal.status) {
		case "NEGOTIATING":
			return { label: "Offer expires", at: deal.latestProposal.expiresAt };

		case "AGREED":
		case "DRAFT_REVIEW":
		case "REVISION_REQUESTED":
			return { label: "Draft due", at: terms.draftDueAt };

		case "READY_TO_PUBLISH":
		case "PUBLISHED":
		case "DISPUTED":
			return { label: "Publish by", at: terms.publishDueAt };

		default:
			return null;
	}
}

export type ConfirmationRow = {
	role: "BRAND" | "CREATOR";
	name: string;
	confirmedAt: string | null;
};

export function confirmationRows(deal: Deal): ConfirmationRow[] {
	const rows: { role: "BRAND" | "CREATOR"; name: string }[] = [
		{ role: "BRAND", name: deal.brand.displayName },
		{ role: "CREATOR", name: deal.creator.displayName }
	];

	return rows.map(({ role, name }) => ({
		role,
		name,
		confirmedAt:
			deal.confirmations.find((confirmation) => confirmation.role === role)
				?.confirmedAt ?? null
	}));
}

export type ResolutionAction =
	| "RESUME_DEAL"
	| "CANCEL_DEAL"
	| "RELEASE_PAYMENT"
	| "REFUND_PAYMENT";

export const RESOLUTION_ACTIONS: readonly ResolutionAction[] = [
	"RESUME_DEAL",
	"RELEASE_PAYMENT",
	"REFUND_PAYMENT",
	"CANCEL_DEAL"
];

export function isResolutionAction(
	action: DealAction
): action is ResolutionAction {
	return RESOLUTION_ACTIONS.some((resolution) => resolution === action);
}

/** What an admin resolution does, stated before they confirm it. */
export function resolutionEffect(action: ResolutionAction, deal: Deal): string {
	const terms = deal.agreement?.terms ?? deal.latestProposal.terms;
	const amount = formatCents(terms.amountCents);
	const brand = deal.brand.displayName;

	switch (action) {
		case "RESUME_DEAL":
			return "Resume returns the deal to where it was before the issue was reported. The simulated payment stays as it is.";

		case "CANCEL_DEAL":
			return "Cancel ends the deal as Cancelled. No simulated payment was held, and any campaign budget it reserved is freed.";

		case "RELEASE_PAYMENT":
			return `Release pays the simulated ${amount} to ${deal.creator.displayName} and ends the deal as Completed.`;

		case "REFUND_PAYMENT":
			return deal.campaignId === null
				? `Refund returns the simulated ${amount} to ${brand} and ends the deal as Refunded.`
				: `Refund returns the simulated ${amount} to ${brand}’s campaign budget and ends the deal as Refunded.`;
	}
}

/** Open cases oldest first (frontend spec §2); resolved ones newest first. */
export function splitDisputes(items: readonly AdminDisputeSummary[]): {
	open: AdminDisputeSummary[];
	resolved: AdminDisputeSummary[];
} {
	const open = items
		.filter((item) => item.resolvedAt === null)
		.toSorted((a, b) => a.openedAt.localeCompare(b.openedAt));
	const resolved = items
		.filter((item) => item.resolvedAt !== null)
		.toSorted((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));

	return { open, resolved };
}
