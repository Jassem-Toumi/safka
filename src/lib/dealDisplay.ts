import type {
	Deal,
	DealAction,
	DealStatus,
	IssueCode,
	PaymentStatus,
	ReportMetricStatus,
	Role
} from "@/shared/contracts";

export type DisplayTone = "neutral" | "positive" | "warning" | "danger" | "info" | "accent";

/** User-facing state for a deal status, from the viewer's side (frontend spec §5). */
export function dealStateLabel(deal: Pick<Deal, "status" | "latestProposal">, viewer: Role): string {
	switch (deal.status) {
		case "NEGOTIATING":
			if (viewer === "ADMIN") {
				return "Negotiating";
			}

			return deal.latestProposal.authorRole === viewer
				? deal.latestProposal.revision === 1
					? "Offer sent"
					: "Counteroffer sent"
				: deal.latestProposal.revision === 1
					? "Offer received"
					: "Counteroffer received";

		case "AGREED":
			return "Draft due";

		case "DRAFT_REVIEW":
			return "Drafts ready for review";

		case "REVISION_REQUESTED":
			return "Changes requested";

		case "READY_TO_PUBLISH":
			return "Approved to publish";

		case "PUBLISHED":
			return "Review published post";

		case "DISPUTED":
			return "Under review";

		case "COMPLETED":
			return "Completed";

		case "REFUNDED":
			return "Refunded";

		case "CANCELLED":
			return "Cancelled";

		case "DECLINED":
			return "Declined";

		case "WITHDRAWN":
			return "Withdrawn";

		case "EXPIRED":
			return "Expired";
	}
}

export function dealStatusTone(status: DealStatus): DisplayTone {
	switch (status) {
		case "NEGOTIATING":
			return "info";

		case "AGREED":
		case "DRAFT_REVIEW":
		case "REVISION_REQUESTED":
		case "READY_TO_PUBLISH":
		case "PUBLISHED":
			return "accent";

		case "DISPUTED":
			return "warning";

		case "COMPLETED":
			return "positive";

		case "REFUNDED":
		case "CANCELLED":
		case "DECLINED":
		case "WITHDRAWN":
		case "EXPIRED":
			return "neutral";
	}
}

export function paymentLabel(status: PaymentStatus): string {
	switch (status) {
		case "NONE":
			return "No payment";

		case "HELD":
			return "Held";

		case "RELEASED":
			return "Released";

		case "REFUNDED":
			return "Refunded";
	}
}

export function paymentTone(status: PaymentStatus): DisplayTone {
	switch (status) {
		case "NONE":
			return "neutral";

		case "HELD":
			return "warning";

		case "RELEASED":
			return "positive";

		case "REFUNDED":
			return "info";
	}
}

export const ACTION_LABELS: Record<DealAction, string> = {
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

export const ISSUE_LABELS: Record<IssueCode, string> = {
	MISSED_DEADLINE: "Missed deadline",
	CONTENT_MISMATCH: "Wrong or missing content",
	MISSING_DISCLOSURE: "Missing disclosure or link",
	INVALID_PUBLICATION: "Invalid publication link",
	UNRESPONSIVE_PARTY: "Unresponsive party",
	OTHER: "Other"
};

export function roleLabel(role: Role | "SYSTEM"): string {
	switch (role) {
		case "BRAND":
			return "Brand";

		case "CREATOR":
			return "Creator";

		case "ADMIN":
			return "Admin";

		case "SYSTEM":
			return "Safka";
	}
}

/** "Waiting on the creator", "Your move", or null when nobody acts next. */
export function nextActionText(deal: Pick<Deal, "nextActionRole" | "status" | "confirmations">, viewer: Role): string | null {
	if (deal.status === "PUBLISHED" && deal.nextActionRole === null) {
		return "Both parties can confirm delivery";
	}

	if (deal.nextActionRole === null) {
		return null;
	}

	if (deal.nextActionRole === viewer) {
		return "Your move";
	}

	return deal.nextActionRole === "ADMIN" ? "Waiting on admin review" : `Waiting on the ${roleLabel(deal.nextActionRole).toLowerCase()}`;
}

export function metricStatusLabel(status: ReportMetricStatus): string {
	switch (status) {
		case "NO_TARGET":
			return "No target set";

		case "PENDING":
			return "Measuring";

		case "INSUFFICIENT_DATA":
			return "Insufficient data";

		case "MET":
			return "Target met";

		case "BELOW_TARGET":
			return "Below target";
	}
}

export function metricTone(status: ReportMetricStatus): DisplayTone {
	return status === "MET" ? "positive" : status === "BELOW_TARGET" ? "warning" : "neutral";
}

/** Final statuses show no workflow actions. */
export function isFinalStatus(status: DealStatus): boolean {
	return ["COMPLETED", "REFUNDED", "CANCELLED", "DECLINED", "WITHDRAWN", "EXPIRED"].includes(status);
}

/** Converts a `datetime-local` value (viewer's zone) to UTC ISO, or null. */
export function localInputToIso(value: string): string | null {
	if (!value) {
		return null;
	}

	const date = new Date(value);

	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO → `datetime-local` value in the viewer's zone. */
export function isoToLocalInput(iso: string): string {
	const date = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, "0");

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Short relative hint like "in 3 days" or "2 hours ago". */
export function relativeHint(iso: string, now: Date = new Date()): string {
	const diff = new Date(iso).getTime() - now.getTime();
	const abs = Math.abs(diff);
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		["day", 86_400_000],
		["hour", 3_600_000],
		["minute", 60_000]
	];
	const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

	for (const [unit, ms] of units) {
		if (abs >= ms || unit === "minute") {
			return rtf.format(Math.round(diff / ms), unit);
		}
	}

	return "";
}

/** The local timezone's short name, e.g. "EST". */
export function localZoneName(): string {
	return (
		new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
			.formatToParts(new Date())
			.find((part) => part.type === "timeZoneName")?.value ?? "local time"
	);
}
