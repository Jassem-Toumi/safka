import type {
	Deal,
	DealAction,
	DealStatus,
	Proposal,
	Terms
} from "@/shared/contracts";

import { describe, expect, it } from "vitest";

import {
	actionLabel,
	currentTerms,
	dealHeadline,
	humanizeEvent,
	paymentLabel,
	statusTone,
	whoActsNext
} from "@/lib/deals";
import { DealAction as DealActionEnum } from "@/shared/contracts";

function terms(amountCents: number): Terms {
	return {
		amountCents,
		format: "REVIEW",
		brief: "Review the keyboard",
		angle: null,
		talkingPoints: [],
		restrictions: [],
		disclosure: "#ad",
		draftDueAt: "2026-12-01T17:00:00Z",
		publishDueAt: "2026-12-08T17:00:00Z",
		viewTarget: null,
		clickTarget: null,
		currency: "USD",
		platform: "YOUTUBE",
		product: {
			id: "product-1",
			name: "Quiet Keyboard",
			description: "A quiet keyboard",
			landingUrl: null
		}
	};
}

function proposal(
	revision: number,
	authorRole: Proposal["authorRole"],
	amountCents = 25000
): Proposal {
	return {
		id: `proposal-${revision}`,
		revision,
		authorRole,
		expiresAt: "2026-11-29T17:00:00Z",
		createdAt: "2026-11-22T17:00:00Z",
		terms: terms(amountCents)
	};
}

function deal(overrides: Partial<Deal> = {}): Deal {
	return {
		id: "deal-1",
		version: 1,
		status: "NEGOTIATING",
		paymentStatus: "NONE",
		brand: { id: "brand-1", displayName: "Acme Keys" },
		creator: { id: "creator-1", displayName: "Sam Types" },
		campaignId: null,
		budget: null,
		latestProposal: proposal(1, "BRAND"),
		agreement: null,
		draftBatches: [],
		approvedAssetId: null,
		publication: null,
		confirmations: [],
		dispute: null,
		nextActionRole: "CREATOR",
		availableActions: [],
		timeline: [],
		sample: false,
		createdAt: "2026-11-22T17:00:00Z",
		updatedAt: "2026-11-22T17:00:00Z",
		isOverdue: false,
		...overrides
	};
}

describe("currentTerms", () => {
	it("uses the latest proposal while negotiating", () => {
		const d = deal({ latestProposal: proposal(2, "CREATOR", 30000) });

		expect(currentTerms(d).amountCents).toBe(30000);
	});

	it("uses the agreement once agreed", () => {
		const d = deal({
			status: "AGREED",
			latestProposal: proposal(2, "CREATOR", 30000),
			agreement: {
				proposalId: "proposal-1",
				acceptedAt: "2026-11-23T17:00:00Z",
				terms: terms(25000)
			}
		});

		expect(currentTerms(d).amountCents).toBe(25000);
	});
});

describe("dealHeadline", () => {
	it("names a first offer by who authored it", () => {
		const d = deal({ latestProposal: proposal(1, "BRAND") });

		expect(dealHeadline(d, "BRAND")).toBe("Offer sent");
		expect(dealHeadline(d, "CREATOR")).toBe("Offer received");
	});

	it("names later revisions as counteroffers", () => {
		const d = deal({ latestProposal: proposal(2, "CREATOR") });

		expect(dealHeadline(d, "CREATOR")).toBe("Counteroffer sent");
		expect(dealHeadline(d, "BRAND")).toBe("Counteroffer received");
	});

	it("never treats an admin as the author", () => {
		expect(dealHeadline(deal(), "ADMIN")).toBe("Offer received");
		expect(
			dealHeadline(deal({ latestProposal: proposal(3, "BRAND") }), "ADMIN")
		).toBe("Counteroffer received");
	});

	it("maps every other status per frontend spec §5", () => {
		const expected: [DealStatus, string][] = [
			["AGREED", "Draft due"],
			["DRAFT_REVIEW", "Drafts ready for review"],
			["REVISION_REQUESTED", "Changes requested"],
			["READY_TO_PUBLISH", "Approved to publish"],
			["PUBLISHED", "Review published post"],
			["DISPUTED", "Under review"],
			["COMPLETED", "Completed"],
			["REFUNDED", "Refunded"],
			["CANCELLED", "Cancelled"],
			["DECLINED", "Declined"],
			["WITHDRAWN", "Withdrawn"],
			["EXPIRED", "Expired"]
		];

		for (const [status, headline] of expected) {
			expect(dealHeadline(deal({ status }), "BRAND")).toBe(headline);
			expect(dealHeadline(deal({ status }), "CREATOR")).toBe(headline);
		}
	});
});

describe("statusTone", () => {
	it("marks in-flight deals as needing action", () => {
		const active: DealStatus[] = [
			"NEGOTIATING",
			"AGREED",
			"DRAFT_REVIEW",
			"REVISION_REQUESTED",
			"READY_TO_PUBLISH",
			"PUBLISHED"
		];

		for (const status of active) {
			expect(statusTone(status)).toBe("action");
		}
	});

	it("marks disputes, completion and closed outcomes", () => {
		expect(statusTone("DISPUTED")).toBe("warning");
		expect(statusTone("COMPLETED")).toBe("success");
		expect(statusTone("REFUNDED")).toBe("neutral");

		for (const status of [
			"CANCELLED",
			"DECLINED",
			"WITHDRAWN",
			"EXPIRED"
		] as const) {
			expect(statusTone(status)).toBe("neutral");
		}
	});
});

describe("paymentLabel", () => {
	it("labels each simulated payment status", () => {
		expect(paymentLabel("NONE")).toBe("No payment");
		expect(paymentLabel("HELD")).toBe("Held");
		expect(paymentLabel("RELEASED")).toBe("Released");
		expect(paymentLabel("REFUNDED")).toBe("Refunded");
	});
});

describe("actionLabel", () => {
	it("labels every deal action", () => {
		const expected: Record<DealAction, string> = {
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

		for (const action of DealActionEnum.options) {
			expect(actionLabel(action)).toBe(expected[action]);
		}
	});
});

describe("humanizeEvent", () => {
	it("describes known actions in the past tense", () => {
		expect(humanizeEvent("OFFER_SENT")).toBe("Sent the offer");
		expect(humanizeEvent("ACCEPT")).toBe("Accepted the offer");
		expect(humanizeEvent("COUNTER")).toBe("Sent a counteroffer");
		expect(humanizeEvent("CONFIRM_DELIVERY")).toBe("Confirmed delivery");
		expect(humanizeEvent("REFUND_PAYMENT")).toBe("Refunded payment");
	});

	it("has a phrase for every deal action", () => {
		for (const action of DealActionEnum.options) {
			expect(humanizeEvent(action)).not.toBe(
				humanizeEvent(`UNKNOWN_${action}`)
			);
			expect(humanizeEvent(action)).not.toMatch(/_/);
		}
	});

	it("sentence-cases unknown actions", () => {
		expect(humanizeEvent("PROPOSAL_EXPIRED")).toBe("Proposal expired");
		expect(humanizeEvent("deal_auto_completed")).toBe("Deal auto completed");
	});
});

describe("whoActsNext", () => {
	it("tells the viewer when it is their turn", () => {
		expect(whoActsNext(deal({ nextActionRole: "CREATOR" }), "CREATOR")).toBe(
			"Your turn"
		);
	});

	it("names the other party", () => {
		expect(whoActsNext(deal({ nextActionRole: "CREATOR" }), "BRAND")).toBe(
			"Waiting on Sam Types"
		);
		expect(whoActsNext(deal({ nextActionRole: "BRAND" }), "CREATOR")).toBe(
			"Waiting on Acme Keys"
		);
		expect(whoActsNext(deal({ nextActionRole: "ADMIN" }), "BRAND")).toBe(
			"Waiting on an admin"
		);
	});

	it("waits on both parties for an unconfirmed publication", () => {
		const d = deal({ status: "PUBLISHED", nextActionRole: null });

		expect(whoActsNext(d, "BRAND")).toBe("Waiting on both to confirm");
	});

	it("returns null when nobody acts", () => {
		expect(
			whoActsNext(
				deal({ status: "COMPLETED", nextActionRole: null }),
				"BRAND"
			)
		).toBeNull();
		expect(
			whoActsNext(
				deal({
					status: "PUBLISHED",
					nextActionRole: null,
					confirmations: [
						{ role: "BRAND", confirmedAt: "2026-12-09T17:00:00Z" }
					]
				}),
				"BRAND"
			)
		).toBeNull();
	});
});
