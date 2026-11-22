import { describe, expect, it } from "vitest";

import {
	dealStateLabel,
	isoToLocalInput,
	localInputToIso,
	metricStatusLabel,
	nextActionText,
	paymentLabel,
	relativeHint
} from "@/lib/dealDisplay";

const proposal = (authorRole: "BRAND" | "CREATOR", revision: number) =>
	({ authorRole, revision }) as Parameters<typeof dealStateLabel>[0]["latestProposal"];

describe("dealStateLabel", () => {
	it("describes negotiation from each side", () => {
		expect(dealStateLabel({ status: "NEGOTIATING", latestProposal: proposal("BRAND", 1) }, "BRAND")).toBe("Offer sent");
		expect(dealStateLabel({ status: "NEGOTIATING", latestProposal: proposal("BRAND", 1) }, "CREATOR")).toBe("Offer received");
		expect(dealStateLabel({ status: "NEGOTIATING", latestProposal: proposal("CREATOR", 2) }, "BRAND")).toBe("Counteroffer received");
		expect(dealStateLabel({ status: "NEGOTIATING", latestProposal: proposal("CREATOR", 2) }, "CREATOR")).toBe("Counteroffer sent");
	});

	it("uses the spec's state names", () => {
		const p = proposal("BRAND", 1);

		expect(dealStateLabel({ status: "AGREED", latestProposal: p }, "CREATOR")).toBe("Draft due");
		expect(dealStateLabel({ status: "READY_TO_PUBLISH", latestProposal: p }, "BRAND")).toBe("Approved to publish");
		expect(dealStateLabel({ status: "DISPUTED", latestProposal: p }, "ADMIN")).toBe("Under review");
	});
});

describe("labels", () => {
	it("maps payment and metric statuses", () => {
		expect(paymentLabel("NONE")).toBe("No payment");
		expect(paymentLabel("HELD")).toBe("Held");
		expect(metricStatusLabel("BELOW_TARGET")).toBe("Below target");
		expect(metricStatusLabel("NO_TARGET")).toBe("No target set");
	});

	it("says who acts next", () => {
		expect(nextActionText({ nextActionRole: "BRAND", status: "DRAFT_REVIEW", confirmations: [] }, "BRAND")).toBe("Your move");
		expect(nextActionText({ nextActionRole: "CREATOR", status: "AGREED", confirmations: [] }, "BRAND")).toBe("Waiting on the creator");
		expect(nextActionText({ nextActionRole: "ADMIN", status: "DISPUTED", confirmations: [] }, "CREATOR")).toBe("Waiting on admin review");
		expect(nextActionText({ nextActionRole: null, status: "PUBLISHED", confirmations: [] }, "CREATOR")).toBe("Both parties can confirm delivery");
		expect(nextActionText({ nextActionRole: null, status: "COMPLETED", confirmations: [] }, "CREATOR")).toBeNull();
	});
});

describe("dates", () => {
	it("round-trips datetime-local values through UTC", () => {
		const iso = "2026-12-01T15:30:00.000Z";

		expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
		expect(localInputToIso("")).toBeNull();
		expect(localInputToIso("not a date")).toBeNull();
	});

	it("gives a relative hint", () => {
		const now = new Date("2026-11-22T12:00:00Z");

		expect(relativeHint("2026-11-25T12:00:00Z", now)).toBe("in 3 days");
		expect(relativeHint("2026-11-22T10:00:00Z", now)).toBe("2 hours ago");
	});
});
