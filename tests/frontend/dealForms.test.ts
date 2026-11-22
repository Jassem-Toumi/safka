import type {
	AdminDisputeSummary,
	Deal,
	DraftBatch,
	Proposal,
	Terms
} from "@/shared/contracts";

import { describe, expect, it } from "vitest";

import { isoToLocalInput } from "@/lib/dates";
import {
	checkDraftFile,
	confirmationRows,
	earlierBatches,
	formatBytes,
	headerDeadline,
	issueCodeLabel,
	latestBatch,
	orderActions,
	parseDealFilter,
	pickIdempotencyKey,
	resolutionEffect,
	splitDisputes,
	validateCounter,
	validatePublication,
	validateReason
} from "@/lib/dealForms";
import { IssueCode } from "@/shared/contracts";

const NOW = new Date("2026-11-22T12:00:00Z");

function terms(amountCents = 40000): Terms {
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

function proposal(): Proposal {
	return {
		id: "proposal-1",
		revision: 1,
		authorRole: "BRAND",
		expiresAt: "2026-11-29T17:00:00Z",
		createdAt: "2026-11-22T17:00:00Z",
		terms: terms()
	};
}

function batch(round: number, assetIds: string[]): DraftBatch {
	return {
		id: `batch-${round}`,
		round,
		submittedAt: "2026-11-25T17:00:00Z",
		late: false,
		changeRequest: null,
		assets: assetIds.map((id) => ({ id, label: id, sizeBytes: 1000 }))
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
		campaignId: "campaign-1",
		budget: null,
		latestProposal: proposal(),
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

function summary(
	id: string,
	openedAt: string,
	resolvedAt: string | null = null
): AdminDisputeSummary {
	return {
		id,
		dealId: `deal-${id}`,
		openedAt,
		openedByRole: "BRAND",
		code: "OTHER",
		reason: "Something",
		priorStatus: "PUBLISHED",
		resolvedAt,
		resolution: resolvedAt === null ? null : "REFUND_PAYMENT",
		resolutionReason: resolvedAt === null ? null : "Refunded",
		brand: { id: "brand-1", displayName: "Acme Keys" },
		creator: { id: "creator-1", displayName: "Sam Types" },
		paymentStatus: "HELD",
		amountCents: 40000
	};
}

describe("parseDealFilter", () => {
	it("accepts the three filters", () => {
		expect(parseDealFilter("needs_action")).toBe("needs_action");
		expect(parseDealFilter("in_progress")).toBe("in_progress");
		expect(parseDealFilter("closed")).toBe("closed");
	});

	it("defaults to needs_action for missing or unknown values", () => {
		expect(parseDealFilter(null)).toBe("needs_action");
		expect(parseDealFilter("everything")).toBe("needs_action");
	});
});

describe("validateCounter", () => {
	const draftDue = isoToLocalInput("2026-12-01T17:00:00Z");
	const publishDue = isoToLocalInput("2026-12-08T17:00:00Z");

	it("returns cents, UTC dates and a null angle when blank", () => {
		const result = validateCounter(
			{ amount: "$450.50", angle: "  ", draftDue, publishDue },
			NOW
		);

		expect(result).toEqual({
			ok: true,
			value: {
				amountCents: 45050,
				angle: null,
				draftDueAt: "2026-12-01T17:00:00.000Z",
				publishDueAt: "2026-12-08T17:00:00.000Z"
			}
		});
	});

	it("keeps a trimmed angle", () => {
		const result = validateCounter(
			{ amount: "450", angle: " Show the sound ", draftDue, publishDue },
			NOW
		);

		expect(result.ok && result.value.angle).toBe("Show the sound");
	});

	it("rejects unreadable, zero and oversized amounts", () => {
		for (const amount of ["", "abc", "0", "100001"]) {
			const result = validateCounter(
				{ amount, angle: "", draftDue, publishDue },
				NOW
			);

			expect(result.ok).toBe(false);
			expect(!result.ok && result.errors.amount).toBeTruthy();
		}
	});

	it("rejects an angle over 500 characters", () => {
		const result = validateCounter(
			{ amount: "450", angle: "a".repeat(501), draftDue, publishDue },
			NOW
		);

		expect(!result.ok && result.errors.angle).toBeTruthy();
	});

	it("requires the publish date after the draft date", () => {
		const result = validateCounter(
			{ amount: "450", angle: "", draftDue: publishDue, publishDue: draftDue },
			NOW
		);

		expect(!result.ok && result.errors.publishDue).toMatch(/after/);
	});

	it("requires dates and a future draft date", () => {
		const missing = validateCounter(
			{ amount: "450", angle: "", draftDue: "", publishDue: "" },
			NOW
		);
		const past = validateCounter(
			{
				amount: "450",
				angle: "",
				draftDue: isoToLocalInput("2026-11-20T12:00:00Z"),
				publishDue
			},
			NOW
		);

		expect(!missing.ok && missing.errors.draftDue).toBeTruthy();
		expect(!missing.ok && missing.errors.publishDue).toBeTruthy();
		expect(!past.ok && past.errors.draftDue).toMatch(/future/);
	});
});

describe("validateReason", () => {
	it("requires 1 to 1000 characters after trimming", () => {
		expect(validateReason("   ")).toMatch(/reason/i);
		expect(validateReason("x".repeat(1001))).toMatch(/1,000/);
		expect(validateReason(" Late ")).toBeNull();
	});
});

describe("checkDraftFile", () => {
	it("accepts an MP4 within the limit", () => {
		expect(
			checkDraftFile({ name: "a.mp4", type: "video/mp4", size: 1024 })
		).toBeNull();
	});

	it("names the type limit", () => {
		expect(
			checkDraftFile({ name: "a.mov", type: "video/quicktime", size: 1024 })
		).toMatch(/a\.mov.*MP4/);
	});

	it("names the size limit and the file's size", () => {
		const message = checkDraftFile({
			name: "big.mp4",
			type: "video/mp4",
			size: 21 * 1024 * 1024
		});

		expect(message).toMatch(/20 MB/);
		expect(message).toMatch(/21 MB/);
	});
});

describe("formatBytes", () => {
	it("uses KB below a megabyte and MB above", () => {
		expect(formatBytes(512)).toBe("1 KB");
		expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
		expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
	});
});

describe("validatePublication", () => {
	const publishedAt = isoToLocalInput("2026-11-22T11:00:00Z");

	it("returns a trimmed URL and a UTC time", () => {
		const result = validatePublication(
			{ url: " https://youtu.be/abcdefghijk ", publishedAt, attested: true },
			NOW
		);

		expect(result).toEqual({
			ok: true,
			value: {
				url: "https://youtu.be/abcdefghijk",
				publishedAt: "2026-11-22T11:00:00.000Z"
			}
		});
	});

	it("requires a web URL, a past time and the attestation", () => {
		const result = validatePublication(
			{
				url: "youtube",
				publishedAt: isoToLocalInput("2026-11-23T12:00:00Z"),
				attested: false
			},
			NOW
		);

		expect(result.ok).toBe(false);
		expect(!result.ok && result.errors.url).toBeTruthy();
		expect(!result.ok && result.errors.publishedAt).toMatch(/future/);
		expect(!result.ok && result.errors.attested).toBeTruthy();
	});
});

describe("latestBatch and earlierBatches", () => {
	it("picks the highest round and lists the rest newest first", () => {
		const d = deal({
			draftBatches: [batch(1, ["a"]), batch(3, ["c"]), batch(2, ["b"])]
		});

		expect(latestBatch(d)?.round).toBe(3);
		expect(earlierBatches(d).map((b) => b.round)).toEqual([2, 1]);
	});

	it("handles no batches", () => {
		expect(latestBatch(deal())).toBeNull();
		expect(earlierBatches(deal())).toEqual([]);
	});
});

describe("issueCodeLabel", () => {
	it("has a readable label for every code", () => {
		for (const code of IssueCode.options) {
			expect(issueCodeLabel(code)).not.toMatch(/_/);
		}
	});
});

describe("orderActions", () => {
	it("puts the main step first and secondary actions last", () => {
		expect(
			orderActions(["REPORT_ISSUE", "DECLINE", "COUNTER", "ACCEPT"])
		).toEqual(["ACCEPT", "COUNTER", "DECLINE", "REPORT_ISSUE"]);
	});
});

describe("pickIdempotencyKey", () => {
	let counter = 0;

	function makeKey(): string {
		counter += 1;

		return `key-${counter}`;
	}

	it("makes a new key for a first or changed submission", () => {
		expect(pickIdempotencyKey(null, "a", makeKey)).toBe("key-1");
		expect(
			pickIdempotencyKey({ key: "old", fingerprint: "a" }, "b", makeKey)
		).toBe("key-2");
	});

	it("reuses the key when the same payload is retried after a failure", () => {
		expect(
			pickIdempotencyKey({ key: "old", fingerprint: "a" }, "a", makeKey)
		).toBe("old");
	});
});

describe("headerDeadline", () => {
	it("shows the proposal expiry while negotiating", () => {
		expect(headerDeadline(deal())).toEqual({
			label: "Offer expires",
			at: "2026-11-29T17:00:00Z"
		});
	});

	it("shows the draft date before drafts are approved", () => {
		const d = deal({ status: "REVISION_REQUESTED" });

		expect(headerDeadline(d)?.label).toBe("Draft due");
	});

	it("shows the publish date once approved", () => {
		const d = deal({ status: "READY_TO_PUBLISH" });

		expect(headerDeadline(d)).toEqual({
			label: "Publish by",
			at: "2026-12-08T17:00:00Z"
		});
	});

	it("shows nothing for closed deals", () => {
		expect(headerDeadline(deal({ status: "COMPLETED" }))).toBeNull();
	});
});

describe("confirmationRows", () => {
	it("lists brand then creator with their confirmation time", () => {
		const d = deal({
			confirmations: [{ role: "CREATOR", confirmedAt: "2026-11-25T17:00:00Z" }]
		});

		expect(confirmationRows(d)).toEqual([
			{ role: "BRAND", name: "Acme Keys", confirmedAt: null },
			{
				role: "CREATOR",
				name: "Sam Types",
				confirmedAt: "2026-11-25T17:00:00Z"
			}
		]);
	});
});

describe("resolutionEffect", () => {
	const held = deal({ status: "DISPUTED", paymentStatus: "HELD" });

	it("says where a refund goes", () => {
		expect(resolutionEffect("REFUND_PAYMENT", held)).toBe(
			"Refund returns the simulated $400.00 to Acme Keys’s campaign budget and ends the deal as Refunded."
		);
		expect(
			resolutionEffect("REFUND_PAYMENT", { ...held, campaignId: null })
		).toMatch(/to Acme Keys and ends/);
	});

	it("says who a release pays", () => {
		expect(resolutionEffect("RELEASE_PAYMENT", held)).toMatch(
			/pays the simulated \$400\.00 to Sam Types/
		);
	});

	it("describes resume and cancel", () => {
		expect(resolutionEffect("RESUME_DEAL", held)).toMatch(/Resume/);
		expect(resolutionEffect("CANCEL_DEAL", held)).toMatch(/Cancelled/);
	});
});

describe("splitDisputes", () => {
	it("orders open cases oldest first and resolved ones newest first", () => {
		const { open, resolved } = splitDisputes([
			summary("b", "2026-11-20T10:00:00Z"),
			summary("r1", "2026-11-01T10:00:00Z", "2026-11-05T10:00:00Z"),
			summary("a", "2026-11-18T10:00:00Z"),
			summary("r2", "2026-11-02T10:00:00Z", "2026-11-09T10:00:00Z")
		]);

		expect(open.map((d) => d.id)).toEqual(["a", "b"]);
		expect(resolved.map((d) => d.id)).toEqual(["r2", "r1"]);
	});
});

describe("validatePublication with a minute-precision time", () => {
	// The field holds minutes only; the backend needs a time after the draft
	// approval (seconds earlier) and not in the future.
	const now = new Date("2026-11-22T20:26:57.000Z");

	it("sends the exact submit time when the default was left untouched", () => {
		const untouched = isoToLocalInput("2026-11-22T20:20:05.000Z");
		const result = validatePublication(
			{ url: "https://youtu.be/aaaaaaaaaaa", publishedAt: untouched, attested: true },
			now,
			untouched
		);

		expect(result).toEqual({
			ok: true,
			value: { url: "https://youtu.be/aaaaaaaaaaa", publishedAt: now.toISOString() }
		});
	});

	it("sends the exact submit time when the current minute is picked", () => {
		const result = validatePublication(
			{
				url: "https://youtu.be/aaaaaaaaaaa",
				publishedAt: isoToLocalInput(now.toISOString()),
				attested: true
			},
			now
		);

		expect(result.ok && result.value.publishedAt).toBe(now.toISOString());
	});
});
