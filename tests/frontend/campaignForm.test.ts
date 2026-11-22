import type { ParseResult } from "@/shared/contracts";

import { describe, expect, it } from "vitest";

import {
	campaignErrorsFromServer,
	emptyCampaignForm,
	formToCampaignInput,
	normalizeMoneyText,
	parseCentsText,
	parseCountText,
	parseResultToForm,
	splitLines
} from "@/lib/campaignForm";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000401";
const PROMPT =
	"Promote our quiet mechanical keyboard to people building shared-office setups. Budget $600.";

const RULES_RESULT: ParseResult = {
	brief: {
		title: "Hushkeys Whisper 75",
		goal: PROMPT,
		objective: null,
		topics: ["mechanical-keyboards", "desk-setups"],
		formats: ["DEMO"],
		talkingPoints: ["Silent linear switches", "Dampening foam"],
		restrictions: []
	},
	budgetCents: 60000,
	preferredMaxPerPostCents: null,
	defaultViewTarget: 20000,
	defaultClickTarget: null,
	mode: "RULES"
};

function validForm() {
	return {
		...parseResultToForm(RULES_RESULT),
		objective: "TRAFFIC" as const
	};
}

describe("parseResultToForm", () => {
	it("turns a suggestion into editable text fields", () => {
		expect(parseResultToForm(RULES_RESULT)).toEqual({
			title: "Hushkeys Whisper 75",
			goal: PROMPT,
			objective: "",
			topics: "mechanical keyboards, desk setups",
			formats: ["DEMO"],
			talkingPoints: "Silent linear switches\nDampening foam",
			restrictions: "",
			budget: "$600.00",
			preferredMax: "",
			viewTarget: "20000",
			clickTarget: ""
		});
	});

	it("keeps a suggested objective", () => {
		const result: ParseResult = {
			...RULES_RESULT,
			brief: { ...RULES_RESULT.brief, objective: "SALES" }
		};

		expect(parseResultToForm(result).objective).toBe("SALES");
	});
});

describe("emptyCampaignForm", () => {
	it("starts blank with no formats", () => {
		const form = emptyCampaignForm();

		expect(form.title).toBe("");
		expect(form.objective).toBe("");
		expect(form.formats).toEqual([]);
	});
});

describe("formToCampaignInput", () => {
	it("builds a confirmed campaign input", () => {
		const result = formToCampaignInput(
			{
				...validForm(),
				preferredMax: "$300",
				clickTarget: "1,200",
				restrictions: "  No competitor names \n\n No discount codes"
			},
			{ productId: PRODUCT_ID, sourcePrompt: PROMPT }
		);

		expect(result).toEqual({
			input: {
				productId: PRODUCT_ID,
				sourcePrompt: PROMPT,
				brief: {
					title: "Hushkeys Whisper 75",
					goal: PROMPT,
					objective: "TRAFFIC",
					topics: ["mechanical keyboards", "desk setups"],
					formats: ["DEMO"],
					talkingPoints: ["Silent linear switches", "Dampening foam"],
					restrictions: ["No competitor names", "No discount codes"]
				},
				budgetCents: 60000,
				preferredMaxPerPostCents: 30000,
				defaultViewTarget: 20000,
				defaultClickTarget: 1200,
				confirm: true
			}
		});
	});

	it("sends null for blank optional fields", () => {
		const result = formToCampaignInput(
			{ ...validForm(), viewTarget: " " },
			{ productId: PRODUCT_ID, sourcePrompt: "" }
		);

		expect("input" in result && result.input.preferredMaxPerPostCents).toBe(
			null
		);
		expect("input" in result && result.input.defaultViewTarget).toBe(null);
		expect("input" in result && result.input.defaultClickTarget).toBe(null);
	});

	it("requires a product, title, goal, objective, topic and budget", () => {
		const result = formToCampaignInput(emptyCampaignForm(), {
			productId: "",
			sourcePrompt: ""
		});

		expect("errors" in result).toBe(true);

		if ("errors" in result) {
			expect(Object.keys(result.errors).sort()).toEqual([
				"budget",
				"goal",
				"objective",
				"productId",
				"title",
				"topics"
			]);
		}
	});

	it("rejects bad money and counts", () => {
		const result = formToCampaignInput(
			{
				...validForm(),
				budget: "six hundred",
				preferredMax: "0",
				viewTarget: "12.5",
				clickTarget: "-3"
			},
			{ productId: PRODUCT_ID, sourcePrompt: "" }
		);

		expect("errors" in result && Object.keys(result.errors).sort()).toEqual([
			"budget",
			"clickTarget",
			"preferredMax",
			"viewTarget"
		]);
	});

	it("keeps the preferred max at or below the budget", () => {
		const result = formToCampaignInput(
			{ ...validForm(), preferredMax: "700" },
			{ productId: PRODUCT_ID, sourcePrompt: "" }
		);

		expect("errors" in result && result.errors.preferredMax).toMatch(
			/budget/i
		);
	});

	it("enforces the brief's list limits", () => {
		const result = formToCampaignInput(
			{
				...validForm(),
				topics: "a, b, c, d, e, f, g, h, i",
				talkingPoints: "1\n2\n3\n4\n5\n6\n7",
				restrictions: "x".repeat(241),
				title: "t".repeat(81)
			},
			{ productId: PRODUCT_ID, sourcePrompt: "" }
		);

		expect("errors" in result && Object.keys(result.errors).sort()).toEqual([
			"restrictions",
			"talkingPoints",
			"title",
			"topics"
		]);
	});
});

describe("campaignErrorsFromServer", () => {
	it("maps server field paths onto form fields", () => {
		expect(
			campaignErrorsFromServer({
				"brief.title": "Required",
				"brief.topics": "Add at least one topic.",
				"brief.talkingPoints.2": "Too long",
				budgetCents: "Set a budget to confirm.",
				defaultClickTarget: "Too small",
				productId: "Unknown product"
			})
		).toEqual({
			title: "Required",
			topics: "Add at least one topic.",
			talkingPoints: "Too long",
			budget: "Set a budget to confirm.",
			clickTarget: "Too small",
			productId: "Unknown product"
		});
	});

	it("collects unknown paths under form", () => {
		expect(campaignErrorsFromServer({ brief: "A brief is required." })).toEqual(
			{ form: "A brief is required." }
		);
	});
});

describe("text helpers", () => {
	it("splitLines keeps commas inside a line", () => {
		expect(splitLines(" Quiet, even on calls \r\n\nSoft landing ")).toEqual([
			"Quiet, even on calls",
			"Soft landing"
		]);
	});

	it("parseCentsText", () => {
		expect(parseCentsText("")).toEqual({ value: null });
		expect(parseCentsText("$1,250.5")).toEqual({ value: 125050 });
		expect("error" in parseCentsText("0")).toBe(true);
		expect("error" in parseCentsText("100000.01")).toBe(true);
		expect(parseCentsText("100000")).toEqual({ value: 10_000_000 });
	});

	it("parseCountText", () => {
		expect(parseCountText("")).toEqual({ value: null });
		expect(parseCountText("20,000")).toEqual({ value: 20000 });
		expect("error" in parseCountText("0")).toBe(true);
		expect("error" in parseCountText("1.5")).toBe(true);
	});

	it("normalizeMoneyText formats valid amounts and leaves the rest", () => {
		expect(normalizeMoneyText("600")).toBe("$600.00");
		expect(normalizeMoneyText(" 1234.5 ")).toBe("$1,234.50");
		expect(normalizeMoneyText("abc")).toBe("abc");
		expect(normalizeMoneyText("")).toBe("");
	});
});
