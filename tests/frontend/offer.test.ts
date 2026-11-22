import type {
	Campaign,
	CreatorCard,
	Label,
	Product
} from "@/shared/contracts";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
	DEFAULT_DISCLOSURE,
	offerErrorsFromServer,
	offerFormToInput,
	prefillOffer
} from "@/lib/offer";

const originalTz = process.env.TZ;

beforeAll(() => {
	process.env.TZ = "America/Los_Angeles";
});

afterAll(() => {
	process.env.TZ = originalTz;
});

// 2026-11-22 10:20 in Los Angeles.
const NOW = new Date("2026-11-22T18:20:00Z");

function label(value: string): Label {
	return { value, origin: "CREATOR", evidenceIds: [] };
}

const CREATOR: CreatorCard = {
	id: "creator-1",
	displayName: "Clack Lab (sample)",
	bio: "Keyboard sound tests.",
	profileUrl: "https://www.youtube.com/@clacklab",
	topics: [label("mechanical-keyboards")],
	formats: [label("COMPARISON"), label("DEMO")],
	rate: { minCents: 20000, maxCents: 35000 },
	typical7dViews: 18000,
	publicMetrics: [],
	evidence: [],
	dataMode: "SAMPLE",
	expectedClicks: null,
	profileVersion: 1
};

const CAMPAIGN: Campaign = {
	id: "campaign-1",
	productId: "product-1",
	sourcePrompt: "",
	version: 2,
	status: "ACTIVE",
	brief: {
		title: "Whisper 75 launch",
		goal: "Show how quiet the Whisper 75 is in a shared office.",
		objective: "TRAFFIC",
		topics: ["mechanical-keyboards"],
		formats: ["REVIEW", "DEMO", "COMPARISON"],
		talkingPoints: ["Silent linear switches", "Dampening foam"],
		restrictions: ["No competitor names"]
	},
	budget: {
		budgetCents: 60000,
		committedCents: 0,
		spentCents: 0,
		remainingCents: 60000
	},
	preferredMaxPerPostCents: null,
	defaultViewTarget: 20000,
	defaultClickTarget: 600,
	dealCount: 0,
	hasOpenNegotiations: false,
	createdAt: "2026-11-20T00:00:00Z",
	updatedAt: "2026-11-20T00:00:00Z"
};

const PRODUCT: Product = {
	id: "product-1",
	name: "Hushkeys Whisper 75",
	description: "A quiet 75% mechanical keyboard.",
	landingUrl: null,
	createdAt: "2026-11-20T00:00:00Z",
	updatedAt: "2026-11-20T00:00:00Z"
};

const ANGLE = "Let viewers hear the difference between stock and upgraded.";

describe("prefillOffer", () => {
	it("prefills a campaign offer from the brief and the match", () => {
		expect(
			prefillOffer(CAMPAIGN, { creator: CREATOR, angle: ANGLE }, PRODUCT, NOW)
		).toEqual({
			price: "",

			// First campaign format the creator makes, in campaign order.
			format: "DEMO",
			brief: CAMPAIGN.brief?.goal,
			angle: ANGLE,
			talkingPoints: "Silent linear switches\nDampening foam",
			restrictions: "No competitor names",
			disclosure: DEFAULT_DISCLOSURE,
			draftDue: "2026-11-29T11:00",
			publishDue: "2026-12-06T11:00",
			viewTarget: "20000",
			clickTarget: "600"
		});
	});

	it("falls back to the creator's first format when nothing overlaps", () => {
		const campaign: Campaign = {
			...CAMPAIGN,
			brief: CAMPAIGN.brief && { ...CAMPAIGN.brief, formats: ["UNBOXING"] }
		};

		expect(
			prefillOffer(campaign, { creator: CREATOR, angle: null }, PRODUCT, NOW)
				.format
		).toBe("COMPARISON");
	});

	it("uses the creator's first format when the campaign is open to any", () => {
		const campaign: Campaign = {
			...CAMPAIGN,
			brief: CAMPAIGN.brief && { ...CAMPAIGN.brief, formats: [] }
		};

		expect(
			prefillOffer(campaign, { creator: CREATOR, angle: null }, PRODUCT, NOW)
				.format
		).toBe("COMPARISON");
	});

	it("prefills a direct offer from the product", () => {
		const form = prefillOffer(
			null,
			{ creator: { ...CREATOR, formats: [] }, angle: null },
			PRODUCT,
			NOW
		);

		expect(form.brief).toBe(PRODUCT.description);
		expect(form.format).toBe("");
		expect(form.angle).toBe("");
		expect(form.talkingPoints).toBe("");
		expect(form.viewTarget).toBe("");
		expect(form.disclosure).toBe(DEFAULT_DISCLOSURE);
	});
});

describe("offerFormToInput", () => {
	function filled() {
		return {
			...prefillOffer(
				CAMPAIGN,
				{ creator: CREATOR, angle: ANGLE },
				PRODUCT,
				NOW
			),
			price: "250"
		};
	}

	it("builds terms with UTC due dates", () => {
		expect(
			offerFormToInput(filled(), { now: NOW, remainingCents: 60000 })
		).toEqual({
			terms: {
				amountCents: 25000,
				format: "DEMO",
				brief: CAMPAIGN.brief?.goal,
				angle: ANGLE,
				talkingPoints: ["Silent linear switches", "Dampening foam"],
				restrictions: ["No competitor names"],
				disclosure: DEFAULT_DISCLOSURE,
				draftDueAt: "2026-11-29T19:00:00.000Z",
				publishDueAt: "2026-12-06T19:00:00.000Z",
				viewTarget: 20000,
				clickTarget: 600
			}
		});
	});

	it("sends null for a blank angle and targets", () => {
		const result = offerFormToInput(
			{ ...filled(), angle: "  ", viewTarget: "", clickTarget: "" },
			{ now: NOW, remainingCents: null }
		);

		expect("terms" in result && result.terms.angle).toBe(null);
		expect("terms" in result && result.terms.viewTarget).toBe(null);
		expect("terms" in result && result.terms.clickTarget).toBe(null);
	});

	it("requires price, format, brief, disclosure and both dates", () => {
		const result = offerFormToInput(
			{
				...filled(),
				price: "",
				format: "",
				brief: " ",
				disclosure: "",
				draftDue: "",
				publishDue: ""
			},
			{ now: NOW, remainingCents: null }
		);

		expect("errors" in result && Object.keys(result.errors).sort()).toEqual([
			"brief",
			"disclosure",
			"draftDue",
			"format",
			"price",
			"publishDue"
		]);
	});

	it("rejects a price above the campaign's remaining budget", () => {
		const result = offerFormToInput(
			{ ...filled(), price: "600.01" },
			{ now: NOW, remainingCents: 60000 }
		);

		expect("errors" in result && result.errors.price).toMatch(/\$600\.00/);
	});

	it("allows any price on a direct offer", () => {
		const result = offerFormToInput(
			{ ...filled(), price: "5,000" },
			{ now: NOW, remainingCents: null }
		);

		expect("terms" in result && result.terms.amountCents).toBe(500000);
	});

	it("needs a future draft date before the publish date", () => {
		const past = offerFormToInput(
			{ ...filled(), draftDue: "2026-11-22T10:00" },
			{ now: NOW, remainingCents: null }
		);
		const inverted = offerFormToInput(
			{
				...filled(),
				draftDue: "2026-12-06T11:00",
				publishDue: "2026-12-06T11:00"
			},
			{ now: NOW, remainingCents: null }
		);

		expect("errors" in past && Object.keys(past.errors)).toEqual([
			"draftDue"
		]);
		expect("errors" in inverted && Object.keys(inverted.errors)).toEqual([
			"publishDue"
		]);
	});

	it("enforces list and length limits", () => {
		const result = offerFormToInput(
			{
				...filled(),
				talkingPoints: "1\n2\n3\n4\n5\n6\n7",
				angle: "a".repeat(501),
				viewTarget: "lots"
			},
			{ now: NOW, remainingCents: null }
		);

		expect("errors" in result && Object.keys(result.errors).sort()).toEqual([
			"angle",
			"talkingPoints",
			"viewTarget"
		]);
	});
});

describe("offerErrorsFromServer", () => {
	it("maps body and terms paths onto form fields", () => {
		expect(
			offerErrorsFromServer({
				"terms.amountCents": "Too big",
				draftDueAt: "Draft due date must be in the future.",
				"terms.talkingPoints.1": "Too long",
				productId: "Must be the campaign's current product."
			})
		).toEqual({
			price: "Too big",
			draftDue: "Draft due date must be in the future.",
			talkingPoints: "Too long",
			form: "Must be the campaign's current product."
		});
	});
});
