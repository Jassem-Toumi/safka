import type { CreatorProfile, EnrichmentResult } from "@/shared/contracts";

import { describe, expect, it } from "vitest";

import {
	addTopics,
	applySuggestions,
	blockerText,
	differingFields,
	emptyForm,
	enrichmentErrorText,
	errorsFromApiFields,
	formatLabel,
	formatMoneyInput,
	formToProfileInput,
	isDirty,
	mergeEvidence,
	previewCard,
	profileToForm,
	savedValueText,
	topicLabel
} from "@/lib/profileForm";

const EVIDENCE_A = "00000000-0000-4000-8000-00000000aaaa";
const EVIDENCE_B = "00000000-0000-4000-8000-00000000bbbb";

function makeProfile(overrides: Partial<CreatorProfile> = {}): CreatorProfile {
	return {
		id: "00000000-0000-4000-8000-000000000211",
		version: 3,
		visibility: "DRAFT",
		canonicalChannelUrl: "https://www.youtube.com/@ClackLab",
		draft: {
			displayName: "Clack Lab",
			bio: "Keyboard sound tests.",
			channel: "@ClackLab",
			topics: ["mechanical-keyboards", "keyboard-sound-tests"],
			formats: ["COMPARISON", "DEMO"],
			rate: { minCents: 20000, maxCents: 35000 },
			typical7dViews: 18000,
			selectedEvidenceIds: [EVIDENCE_A]
		},
		evidence: [
			{
				id: EVIDENCE_A,
				url: "https://example.com/a",
				title: "Sound test",
				excerpt: "A sound test.",
				retrievedAt: "2026-11-20T19:44:36.006Z",
				publishedAt: null,
				kind: "PUBLIC"
			},
			{
				id: EVIDENCE_B,
				url: "https://example.com/b",
				title: "Foam mod",
				excerpt: "A foam mod.",
				retrievedAt: "2026-11-20T19:44:36.006Z",
				publishedAt: null,
				kind: "PUBLIC"
			}
		],
		lastEnrichment: null,
		published: null,
		publishedVersion: null,
		hasUnpublishedChanges: true,
		listingBlockers: [],
		updatedAt: "2026-11-20T19:44:36.006Z",
		...overrides
	};
}

function makeEnrichment(
	overrides: Partial<EnrichmentResult> = {}
): EnrichmentResult {
	return {
		status: "READY",
		mode: "LIVE",
		evidence: [],
		suggestions: {
			topics: [
				{
					value: "mechanical-keyboards",
					origin: "PUBLIC",
					evidenceIds: [EVIDENCE_A]
				}
			],
			formats: [
				{ value: "COMPARISON", origin: "PUBLIC", evidenceIds: [EVIDENCE_B] }
			]
		},
		retrievedAt: "2026-11-20T19:44:36.006Z",
		errorCode: null,
		profileVersion: 3,
		...overrides
	};
}

function expectInput(result: ReturnType<typeof formToProfileInput>) {
	if (!("input" in result)) {
		throw new Error(`Expected input, got ${JSON.stringify(result.errors)}`);
	}

	return result.input;
}

function expectErrors(result: ReturnType<typeof formToProfileInput>) {
	if (!("errors" in result)) {
		throw new Error("Expected errors");
	}

	return result.errors;
}

describe("profileToForm", () => {
	it("copies the saved draft into editable text", () => {
		expect(profileToForm(makeProfile())).toEqual({
			displayName: "Clack Lab",
			bio: "Keyboard sound tests.",
			channel: "@ClackLab",
			topics: ["mechanical-keyboards", "keyboard-sound-tests"],
			formats: ["COMPARISON", "DEMO"],
			rateMin: "$200.00",
			rateMax: "$350.00",
			typical7dViews: "18,000"
		});
	});

	it("leaves optional values empty", () => {
		const profile = makeProfile();

		profile.draft.rate = null;
		profile.draft.typical7dViews = null;

		const form = profileToForm(profile);

		expect(form.rateMin).toBe("");
		expect(form.rateMax).toBe("");
		expect(form.typical7dViews).toBe("");
	});
});

describe("formToProfileInput", () => {
	it("round-trips a saved draft", () => {
		const profile = makeProfile();
		const input = expectInput(
			formToProfileInput(profileToForm(profile), 3, [EVIDENCE_A])
		);

		expect(input).toEqual({ ...profile.draft, expectedVersion: 3 });
	});

	it("trims text and normalizes topics", () => {
		const form = {
			...emptyForm(),
			displayName: "  Clack  ",
			topics: ["Desk Setups", "desk-setups", "ASMR"]
		};
		const input = expectInput(formToProfileInput(form, 1, []));

		expect(input.displayName).toBe("Clack");
		expect(input.topics).toEqual(["desk-setups", "asmr"]);
	});

	it("sends rate as integer cents and empty rate as null", () => {
		const withRate = expectInput(
			formToProfileInput(
				{ ...emptyForm(), rateMin: "250", rateMax: "$1,000.5" },
				1,
				[]
			)
		);

		expect(withRate.rate).toEqual({ minCents: 25000, maxCents: 100050 });

		const without = expectInput(formToProfileInput(emptyForm(), 1, []));

		expect(without.rate).toBeNull();
		expect(without.typical7dViews).toBeNull();
	});

	it("rejects a rate whose minimum exceeds its maximum", () => {
		const errors = expectErrors(
			formToProfileInput(
				{ ...emptyForm(), rateMin: "500", rateMax: "200" },
				1,
				[]
			)
		);

		expect(errors.rateMax).toMatch(/at least the minimum/);
	});

	it("rejects half a rate, unreadable amounts and zero", () => {
		expect(
			expectErrors(formToProfileInput({ ...emptyForm(), rateMin: "200" }, 1, []))
				.rateMax
		).toBeTruthy();
		expect(
			expectErrors(formToProfileInput({ ...emptyForm(), rateMax: "200" }, 1, []))
				.rateMin
		).toBeTruthy();
		expect(
			expectErrors(
				formToProfileInput(
					{ ...emptyForm(), rateMin: "abc", rateMax: "200" },
					1,
					[]
				)
			).rateMin
		).toBeTruthy();
		expect(
			expectErrors(
				formToProfileInput({ ...emptyForm(), rateMin: "0", rateMax: "0" }, 1, [])
			).rateMin
		).toBeTruthy();
	});

	it("parses typical views with separators and rejects other text", () => {
		expect(
			expectInput(
				formToProfileInput({ ...emptyForm(), typical7dViews: "12,500" }, 1, [])
			).typical7dViews
		).toBe(12500);
		expect(
			expectErrors(
				formToProfileInput({ ...emptyForm(), typical7dViews: "lots" }, 1, [])
			).typical7dViews
		).toBeTruthy();
		expect(
			expectErrors(
				formToProfileInput({ ...emptyForm(), typical7dViews: "1.5" }, 1, [])
			).typical7dViews
		).toBeTruthy();
	});

	it("enforces length and count limits", () => {
		const errors = expectErrors(
			formToProfileInput(
				{
					...emptyForm(),
					displayName: "x".repeat(81),
					bio: "y".repeat(601),
					topics: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
					formats: ["REVIEW", "DEMO", "TUTORIAL", "UNBOXING", "STORY"]
				},
				1,
				[]
			)
		);

		expect(Object.keys(errors).sort()).toEqual([
			"bio",
			"displayName",
			"formats",
			"topics"
		]);
	});

	it("de-duplicates selected evidence", () => {
		const input = expectInput(
			formToProfileInput(emptyForm(), 1, [EVIDENCE_A, EVIDENCE_A, EVIDENCE_B])
		);

		expect(input.selectedEvidenceIds).toEqual([EVIDENCE_A, EVIDENCE_B]);
	});
});

describe("addTopics", () => {
	it("adds comma-separated topics, skipping repeats", () => {
		expect(addTopics(["mechanical-keyboards"], "Mechanical keyboards, ASMR")).toEqual({
			topics: ["mechanical-keyboards", "ASMR"],
			error: null
		});
	});

	it("refuses to go past the limit", () => {
		const result = addTopics(["a", "b", "c", "d", "e", "f", "g"], "h, i");

		expect(result.topics).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
		expect(result.error).toMatch(/8 topics/);
	});

	it("rejects topics longer than 60 characters", () => {
		const result = addTopics([], "x".repeat(61));

		expect(result.topics).toEqual([]);
		expect(result.error).toMatch(/60 characters/);
	});
});

describe("applySuggestions", () => {
	it("adds ticked topics and formats without repeats", () => {
		const form = { ...emptyForm(), topics: ["Mechanical keyboards"], formats: ["DEMO" as const] };
		const { form: next, skipped } = applySuggestions(form, {
			topics: [
				{ value: "mechanical-keyboards", origin: "PUBLIC", evidenceIds: [] },
				{ value: "desk-setups", origin: "PUBLIC", evidenceIds: [] }
			],
			formats: [
				{ value: "DEMO", origin: "PUBLIC", evidenceIds: [] },
				{ value: "REVIEW", origin: "PUBLIC", evidenceIds: [] },
				{ value: "NOT_A_FORMAT", origin: "PUBLIC", evidenceIds: [] }
			]
		});

		expect(next.topics).toEqual(["Mechanical keyboards", "desk-setups"]);
		expect(next.formats).toEqual(["DEMO", "REVIEW"]);
		expect(skipped).toEqual([]);
	});

	it("reports what didn't fit", () => {
		const form = {
			...emptyForm(),
			formats: ["DEMO" as const, "REVIEW" as const, "STORY" as const, "OTHER" as const]
		};
		const { form: next, skipped } = applySuggestions(form, {
			topics: [],
			formats: [{ value: "UNBOXING", origin: "PUBLIC", evidenceIds: [] }]
		});

		expect(next.formats).toHaveLength(4);
		expect(skipped).toEqual(["Unboxing"]);
	});
});

describe("isDirty and differingFields", () => {
	it("is clean right after loading", () => {
		const profile = makeProfile();

		expect(isDirty(profileToForm(profile), profile)).toBe(false);
	});

	it("ignores surrounding spaces, topic spelling and format order", () => {
		const profile = makeProfile();
		const form = {
			...profileToForm(profile),
			bio: "  Keyboard sound tests. ",
			topics: ["Mechanical Keyboards", "keyboard sound tests"],
			formats: ["DEMO" as const, "COMPARISON" as const],
			rateMin: "200"
		};

		expect(isDirty(form, profile)).toBe(false);
	});

	it("notices edited fields and evidence selection", () => {
		const profile = makeProfile();
		const form = { ...profileToForm(profile), bio: "New bio", rateMax: "" };

		expect(differingFields(form, profile)).toEqual(["bio", "rate"]);
		expect(isDirty(profileToForm(profile), profile, [EVIDENCE_B])).toBe(true);
		expect(isDirty(profileToForm(profile), profile, [EVIDENCE_A])).toBe(false);
	});
});

describe("formatMoneyInput", () => {
	it("formats readable amounts and leaves the rest", () => {
		expect(formatMoneyInput("250")).toBe("$250.00");
		expect(formatMoneyInput(" 1000.5 ")).toBe("$1,000.50");
		expect(formatMoneyInput("abc")).toBe("abc");
		expect(formatMoneyInput("")).toBe("");
	});
});

describe("errorsFromApiFields", () => {
	it("maps server field paths onto form fields", () => {
		expect(
			errorsFromApiFields({
				displayName: "Too long",
				"rate.maxCents": "minCents must be <= maxCents",
				"topics.2": "Too long",
				channel: "Already listed"
			})
		).toEqual({
			displayName: "Too long",
			rateMax: "minCents must be <= maxCents",
			topics: "Too long",
			channel: "Already listed"
		});
	});
});

describe("text helpers", () => {
	it("explains listing blockers", () => {
		expect(blockerText("bio")).toBe("Add a bio");
		expect(blockerText("topics")).toBe("Add at least one topic");
		expect(blockerText("somethingNew")).toBe("Complete something new");
	});

	it("explains each enrichment failure", () => {
		for (const code of [
			"TIMEOUT",
			"QUOTA_EXCEEDED",
			"AUTH_FAILED",
			"PROVIDER_ERROR",
			"BAD_RESPONSE",
			null
		]) {
			expect(enrichmentErrorText(code).length).toBeGreaterThan(10);
		}

		expect(enrichmentErrorText("TIMEOUT")).not.toBe(
			enrichmentErrorText("QUOTA_EXCEEDED")
		);
	});

	it("names formats and topics", () => {
		expect(formatLabel("UNBOXING")).toBe("Unboxing");
		expect(topicLabel("desk-setups")).toBe("Desk setups");
		expect(topicLabel("Desk Setups")).toBe("Desk setups");
	});
});

describe("previewCard", () => {
	it("builds a brand view of the saved draft with label origins", () => {
		const profile = makeProfile({ lastEnrichment: makeEnrichment() });
		const card = previewCard(profile);

		expect(card.displayName).toBe("Clack Lab");
		expect(card.profileUrl).toBe("https://www.youtube.com/@ClackLab");
		expect(card.topics).toEqual([
			{ value: "mechanical-keyboards", origin: "PUBLIC", evidenceIds: [EVIDENCE_A] },
			{ value: "keyboard-sound-tests", origin: "CREATOR", evidenceIds: [] }
		]);
		// Evidence B backs COMPARISON but isn't selected.
		expect(card.formats.map((label) => label.origin)).toEqual([
			"CREATOR",
			"CREATOR"
		]);
		expect(card.evidence.map((evidence) => evidence.id)).toEqual([EVIDENCE_A]);
		expect(card.dataMode).toBe("LIVE");
		expect(card.expectedClicks).toBeNull();
	});

	it("keeps sample labeling from the published card", () => {
		const published = previewCard(makeProfile());

		published.dataMode = "SAMPLE";
		published.expectedClicks = { low: 1, high: 2, isSample: true };

		const card = previewCard(makeProfile({ published }));

		expect(card.dataMode).toBe("SAMPLE");
		expect(card.expectedClicks).toEqual({ low: 1, high: 2, isSample: true });
	});
});

describe("savedValueText", () => {
	it("describes saved values readably", () => {
		const profile = makeProfile();

		expect(savedValueText("topics", profile)).toBe(
			"Mechanical keyboards, Keyboard sound tests"
		);
		expect(savedValueText("formats", profile)).toBe("Comparison, Demo");
		expect(savedValueText("rate", profile)).toBe("$200.00–$350.00");
		expect(savedValueText("typical7dViews", profile)).toBe("18,000");

		profile.draft.rate = null;
		profile.draft.bio = "";

		expect(savedValueText("rate", profile)).toBe("Rate not provided");
		expect(savedValueText("bio", profile)).toBe("Empty");
	});
});

describe("mergeEvidence", () => {
	it("puts the latest rows first and keeps older ones", () => {
		const [first, second] = makeProfile().evidence;

		if (first === undefined || second === undefined) {
			throw new Error("Expected two evidence rows");
		}

		const updated = { ...second, title: "Foam mod (updated)" };

		expect(mergeEvidence([updated], [first, second])).toEqual([
			updated,
			first
		]);
	});
});
