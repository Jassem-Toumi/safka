import type {
	Deal,
	DealAction,
	DealStatus,
	PaymentStatus,
	Role,
	Terms
} from "@/shared/contracts";

export type StatusTone =
	| "neutral"
	| "action"
	| "success"
	| "warning"
	| "danger";

/** The terms in force: the agreement once agreed, else the latest proposal. */
export function currentTerms(deal: Deal): Terms {
	return deal.agreement?.terms ?? deal.latestProposal.terms;
}

const STATUS_HEADLINES: Record<Exclude<DealStatus, "NEGOTIATING">, string> = {
	AGREED: "Draft due",
	DRAFT_REVIEW: "Drafts ready for review",
	REVISION_REQUESTED: "Changes requested",
	READY_TO_PUBLISH: "Approved to publish",
	PUBLISHED: "Review published post",
	DISPUTED: "Under review",
	COMPLETED: "Completed",
	REFUNDED: "Refunded",
	CANCELLED: "Cancelled",
	DECLINED: "Declined",
	WITHDRAWN: "Withdrawn",
	EXPIRED: "Expired"
};

/** The user-facing state from frontend spec §5, worded for the viewer. */
export function dealHeadline(deal: Deal, viewerRole: Role): string {
	if (deal.status !== "NEGOTIATING") {
		return STATUS_HEADLINES[deal.status];
	}

	const { revision, authorRole } = deal.latestProposal;
	const noun = revision === 1 ? "Offer" : "Counteroffer";
	const verb = authorRole === viewerRole ? "sent" : "received";

	return `${noun} ${verb}`;
}

/**
 * A refund is a normal, admin-decided outcome rather than a failure the viewer
 * must handle, so REFUNDED reads as neutral like the other closed outcomes.
 */
const STATUS_TONES: Record<DealStatus, StatusTone> = {
	NEGOTIATING: "action",
	AGREED: "action",
	DRAFT_REVIEW: "action",
	REVISION_REQUESTED: "action",
	READY_TO_PUBLISH: "action",
	PUBLISHED: "action",
	DISPUTED: "warning",
	COMPLETED: "success",
	REFUNDED: "neutral",
	CANCELLED: "neutral",
	DECLINED: "neutral",
	WITHDRAWN: "neutral",
	EXPIRED: "neutral"
};

export function statusTone(status: DealStatus): StatusTone {
	return STATUS_TONES[status];
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
	NONE: "No payment",
	HELD: "Held",
	RELEASED: "Released",
	REFUNDED: "Refunded"
};

export function paymentLabel(status: PaymentStatus): string {
	return PAYMENT_LABELS[status];
}

const ACTION_LABELS: Record<DealAction, string> = {
	ACCEPT: "Accept",
	DECLINE: "Decline",
	COUNTER: "Counter",
	WITHDRAW: "Withdraw offer",
	SUBMIT_DRAFTS: "Submit drafts",
	REQUEST_CHANGES: "Request changes",
	APPROVE_DRAFT: "Approve draft",
	SUBMIT_PUBLICATION: "Submit published link",
	CONFIRM_DELIVERY: "Confirm delivery",
	REPORT_ISSUE: "Report an issue",
	RESUME_DEAL: "Resume deal",
	CANCEL_DEAL: "Cancel deal",
	RELEASE_PAYMENT: "Release payment",
	REFUND_PAYMENT: "Refund payment"
};

export function actionLabel(action: DealAction): string {
	return ACTION_LABELS[action];
}

const EVENT_PHRASES: Record<DealAction | "OFFER_SENT", string> = {
	OFFER_SENT: "Sent the offer",
	ACCEPT: "Accepted the offer",
	DECLINE: "Declined the offer",
	COUNTER: "Sent a counteroffer",
	WITHDRAW: "Withdrew the offer",
	SUBMIT_DRAFTS: "Submitted drafts",
	REQUEST_CHANGES: "Requested changes",
	APPROVE_DRAFT: "Approved a draft",
	SUBMIT_PUBLICATION: "Submitted the published link",
	CONFIRM_DELIVERY: "Confirmed delivery",
	REPORT_ISSUE: "Reported an issue",
	RESUME_DEAL: "Resumed the deal",
	CANCEL_DEAL: "Cancelled the deal",
	RELEASE_PAYMENT: "Released payment",
	REFUND_PAYMENT: "Refunded payment"
};

function isKnownEvent(action: string): action is keyof typeof EVENT_PHRASES {
	return Object.hasOwn(EVENT_PHRASES, action);
}

/**
 * Timeline actions are free strings; known ones get a past-tense phrase and
 * anything else is sentence-cased, e.g. "PROPOSAL_EXPIRED" → "Proposal
 * expired".
 */
export function humanizeEvent(action: string): string {
	if (isKnownEvent(action)) {
		return EVENT_PHRASES[action];
	}

	const words = action.replaceAll("_", " ").trim().toLowerCase();

	return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The server sends a null next role both when nobody acts and when both
 * parties still have to confirm a publication; this tells those apart.
 */
export function whoActsNext(deal: Deal, viewerRole: Role): string | null {
	const next = deal.nextActionRole;

	if (next === viewerRole) {
		return "Your turn";
	}

	if (next === "ADMIN") {
		return "Waiting on an admin";
	}

	if (next === "BRAND") {
		return `Waiting on ${deal.brand.displayName}`;
	}

	if (next === "CREATOR") {
		return `Waiting on ${deal.creator.displayName}`;
	}

	if (deal.status === "PUBLISHED" && deal.confirmations.length === 0) {
		return "Waiting on both to confirm";
	}

	return null;
}
