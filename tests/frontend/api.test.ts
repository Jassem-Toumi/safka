import type { CampaignInput, TermsInput } from "@/shared/contracts";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// API_MODE is read when the client module loads, so each test stubs the env
// and imports a fresh copy of the module graph.

async function loadApi(mode: "fixture" | "auto") {
	vi.resetModules();
	vi.stubEnv("NEXT_PUBLIC_API_MODE", mode);

	return import("@/lib/api");
}

const SEED_CAMPAIGN_ID = "fixture-campaign-quiet-office";
const DAY_MS = 86_400_000;

function completeCampaign(productId: string): CampaignInput {
	return {
		productId,
		sourcePrompt: "Quiet keyboards for streamers. Budget $500.",
		brief: {
			title: "Quiet keyboards for streamers",
			goal: "Show that a keyboard can be quiet on stream.",
			objective: "AWARENESS",
			topics: ["Mechanical Keyboards"],
			formats: ["DEMO"],
			talkingPoints: [],
			restrictions: []
		},
		budgetCents: 50000,
		preferredMaxPerPostCents: null,
		defaultViewTarget: null,
		defaultClickTarget: 400
	};
}

function termsInput(amountCents: number): TermsInput {
	return {
		amountCents,
		format: "DEMO",
		brief: "Type on the keyboard during a stream.",
		angle: null,
		talkingPoints: [],
		restrictions: [],
		disclosure: "Say it is sponsored and tag #ad.",
		draftDueAt: new Date(Date.now() + 7 * DAY_MS).toISOString(),
		publishDueAt: new Date(Date.now() + 14 * DAY_MS).toISOString(),
		viewTarget: null,
		clickTarget: 400
	};
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("fixtures satisfy the shared contract", () => {
	// Every call goes through the same envelope and schema validation as a
	// live call, so a fixture that drifts from src/shared/contracts fails here.

	it("serves every read endpoint", async () => {
		const api = await loadApi("fixture");

		await api.listDemoAccounts();
		await api.getMe();
		await api.listCreators();
		await api.getCreatorProfile();
		await api.runEnrichment();
		await api.listProducts();
		await api.listCampaigns();
		await api.listDisputes();

		const { items: campaigns } = await api.listCampaigns();
		const campaignId = campaigns[0]?.id ?? "";

		await api.getCampaign(campaignId);
		await api.listMatches(campaignId);
		await api.getCampaignReport(campaignId);

		const { items: creators } = await api.listCreators();

		await api.getCreator(creators[0]?.id ?? "");

		const { items: disputes } = await api.listDisputes();

		await api.getDispute(disputes[0]?.id ?? "");
	});

	it("has a deal in each state the deal screen must render", async () => {
		const api = await loadApi("fixture");

		api.setFixtureRole("BRAND");

		const { items } = await api.listDeals();
		const statuses = new Set(items.map((deal) => deal.status));

		for (const status of [
			"NEGOTIATING",
			"DRAFT_REVIEW",
			"PUBLISHED",
			"DISPUTED",
			"COMPLETED"
		] as const) {
			expect(statuses).toContain(status);
		}
	});
});

describe("fixture deal flow", () => {
	it("walks an offer from counter to released payment", async () => {
		const api = await loadApi("fixture");

		api.setFixtureRole("CREATOR");

		let deal = await api.getDeal("fixture-deal-offer");

		deal = await api.actOnDeal(
			deal.id,
			{
				action: "COUNTER",
				expectedVersion: deal.version,
				proposalId: deal.latestProposal.id,
				amountCents: 30000,
				draftDueAt: deal.latestProposal.terms.draftDueAt,
				publishDueAt: deal.latestProposal.terms.publishDueAt,
				angle: null
			},
			api.newIdempotencyKey()
		);

		expect(deal.latestProposal.terms.amountCents).toBe(30000);
		expect(deal.availableActions).not.toContain("ACCEPT");

		api.setFixtureRole("BRAND");
		deal = await api.getDeal(deal.id);
		deal = await api.actOnDeal(
			deal.id,
			{
				action: "ACCEPT",
				expectedVersion: deal.version,
				proposalId: deal.latestProposal.id
			},
			api.newIdempotencyKey()
		);

		expect(deal.status).toBe("AGREED");
		expect(deal.paymentStatus).toBe("NONE");

		api.setFixtureRole("CREATOR");

		const upload = await api.uploadDraft(
			deal.id,
			new File(["x"], "draft.mp4", { type: "video/mp4" })
		);

		deal = await api.actOnDeal(
			deal.id,
			{
				action: "SUBMIT_DRAFTS",
				expectedVersion: deal.version,
				uploadIds: [upload.uploadId]
			},
			api.newIdempotencyKey()
		);

		api.setFixtureRole("BRAND");
		deal = await api.actOnDeal(
			deal.id,
			{
				action: "APPROVE_DRAFT",
				expectedVersion: deal.version,
				assetId: upload.uploadId
			},
			api.newIdempotencyKey()
		);

		expect(deal.paymentStatus).toBe("HELD");

		api.setFixtureRole("CREATOR");
		deal = await api.actOnDeal(
			deal.id,
			{
				action: "SUBMIT_PUBLICATION",
				expectedVersion: deal.version,
				url: "https://youtu.be/bbbbbbbbbbb",
				publishedAt: new Date().toISOString(),
				attested: true
			},
			api.newIdempotencyKey()
		);
		deal = await api.actOnDeal(
			deal.id,
			{ action: "CONFIRM_DELIVERY", expectedVersion: deal.version },
			api.newIdempotencyKey()
		);

		expect(deal.paymentStatus).toBe("HELD");

		api.setFixtureRole("BRAND");
		deal = await api.actOnDeal(
			deal.id,
			{ action: "CONFIRM_DELIVERY", expectedVersion: deal.version },
			api.newIdempotencyKey()
		);

		expect(deal.status).toBe("COMPLETED");
		expect(deal.paymentStatus).toBe("RELEASED");
	});

	it("rejects a stale version with STALE_DEAL", async () => {
		const api = await loadApi("fixture");

		api.setFixtureRole("BRAND");

		const deal = await api.getDeal("fixture-deal-published");

		await expect(
			api.actOnDeal(
				deal.id,
				{ action: "CONFIRM_DELIVERY", expectedVersion: deal.version - 1 },
				api.newIdempotencyKey()
			)
		).rejects.toMatchObject({ code: "STALE_DEAL", status: 409 });
	});
});

describe("fixture campaigns and products", () => {
	it("creates a draft, activates a campaign and reads it back", async () => {
		const api = await loadApi("fixture");
		const { items: products } = await api.listProducts();
		const productId = products[0]?.id ?? "";
		const draft = await api.createCampaign({
			productId,
			brief: null,
			budgetCents: null,
			preferredMaxPerPostCents: null,
			defaultViewTarget: null,
			defaultClickTarget: null
		});

		expect(draft.status).toBe("DRAFT");
		expect(draft.budget).toBeNull();

		const campaign = await api.createCampaign({
			...completeCampaign(productId),
			confirm: true
		});

		expect(campaign.status).toBe("ACTIVE");
		expect(campaign.brief?.topics).toEqual(["mechanical-keyboards"]);
		expect(campaign.budget).toEqual({
			budgetCents: 50000,
			committedCents: 0,
			spentCents: 0,
			remainingCents: 50000
		});
		await expect(api.getCampaign(campaign.id)).resolves.toEqual(campaign);

		const { items: matches } = await api.listMatches(campaign.id);

		expect(matches.length).toBeGreaterThan(0);
		expect(
			matches.every((match) => match.campaignVersion === campaign.version)
		).toBe(true);
	});

	it("rejects activating an incomplete brief with field errors", async () => {
		const api = await loadApi("fixture");
		const input = completeCampaign("any-product");

		await expect(
			api.createCampaign({
				...input,
				brief: input.brief && { ...input.brief, objective: null, topics: [] },
				budgetCents: null,
				confirm: true
			})
		).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
			status: 400,
			fields: {
				"brief.objective": expect.any(String),
				"brief.topics": expect.any(String),
				budgetCents: expect.any(String)
			}
		});
	});

	it("edits with the current version only, then closes", async () => {
		const api = await loadApi("fixture");
		const input = completeCampaign("any-product");
		const draft = await api.createCampaign({ ...input, budgetCents: null });

		await expect(
			api.updateCampaign(draft.id, {
				expectedVersion: draft.version - 1,
				budgetCents: 40000
			})
		).rejects.toMatchObject({ code: "STALE_CAMPAIGN", status: 409 });

		const active = await api.updateCampaign(draft.id, {
			expectedVersion: draft.version,
			budgetCents: 40000,
			confirm: true
		});

		expect(active.status).toBe("ACTIVE");
		expect(active.version).toBe(draft.version + 1);
		expect(active.sourcePrompt).toBe(input.sourcePrompt);
		expect(active.budget?.remainingCents).toBe(40000);

		const closed = await api.updateCampaign(draft.id, {
			expectedVersion: active.version,
			status: "CLOSED"
		});

		expect(closed.status).toBe("CLOSED");
	});

	it("refuses to close a campaign with an open negotiation", async () => {
		const api = await loadApi("fixture");
		const campaign = await api.getCampaign(SEED_CAMPAIGN_ID);

		expect(campaign.hasOpenNegotiations).toBe(true);
		await expect(
			api.updateCampaign(campaign.id, {
				expectedVersion: campaign.version,
				status: "CLOSED"
			})
		).rejects.toMatchObject({ code: "INVALID_STATE" });
	});

	it("404s matches for an unknown campaign", async () => {
		const api = await loadApi("fixture");

		await expect(api.listMatches("no-such-campaign")).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404
		});
	});

	it("creates and edits a product", async () => {
		const api = await loadApi("fixture");
		const created = await api.createProduct({
			name: "Hush Pad",
			description: "A felt desk pad.",
			landingUrl: ""
		});

		expect(created.landingUrl).toBeNull();

		const updated = await api.updateProduct(created.id, {
			name: "Hush Pad XL"
		});

		expect(updated).toMatchObject({
			id: created.id,
			name: "Hush Pad XL",
			description: "A felt desk pad."
		});

		const { items } = await api.listProducts();

		expect(items).toContainEqual(updated);
	});
});

describe("fixture deal reports", () => {
	it("serves the labeled sample report for the completed deal", async () => {
		const api = await loadApi("fixture");
		const report = await api.getDealReport("fixture-deal-completed");

		expect(report.sample).toBe(true);
		expect(report.status).toBe("COMPLETED");
		expect(report.clicks).toMatchObject({
			target: 600,
			actual: 420,
			source: "SAMPLE",
			status: "BELOW_TARGET",
			shortfallPct: 30
		});
		expect(report.views).toMatchObject({
			target: 20000,
			actual: 21500,
			status: "MET",
			shortfallPct: null
		});
	});

	it("reports PENDING with no actuals inside the window", async () => {
		const api = await loadApi("fixture");
		const report = await api.getDealReport("fixture-deal-published");

		expect(report.sample).toBe(false);
		expect(report.status).toBe("PUBLISHED");
		expect(report.windowStart).not.toBeNull();
		expect(report.views).toMatchObject({
			target: 10000,
			actual: null,
			source: null,
			status: "PENDING"
		});
		expect(report.clicks).toMatchObject({ actual: null, status: "PENDING" });
	});
});

describe("fixture campaign budget", () => {
	it("rejects an initial offer over the remaining budget", async () => {
		const api = await loadApi("fixture");
		const campaign = await api.getCampaign(SEED_CAMPAIGN_ID);
		const remaining = campaign.budget?.remainingCents ?? 0;

		await expect(
			api.createDeal(
				{
					creatorId: "a-live-profile-id",
					productId: campaign.productId,
					campaignId: campaign.id,
					terms: termsInput(remaining + 100)
				},
				api.newIdempotencyKey()
			)
		).rejects.toMatchObject({ code: "BUDGET_EXCEEDED", status: 409 });
	});

	it("accepts an offer to a creator it doesn't know", async () => {
		const api = await loadApi("fixture");
		const deal = await api.createDeal(
			{
				creatorId: "a-live-profile-id",
				productId: "any-product",
				campaignId: null,
				terms: termsInput(20000)
			},
			api.newIdempotencyKey()
		);

		expect(deal.creator).toEqual({
			id: "a-live-profile-id",
			displayName: "Creator"
		});
		expect(deal.budget).toBeNull();
	});

	it("blocks an acceptance that no longer fits, keeping the negotiation", async () => {
		const api = await loadApi("fixture");
		const campaign = await api.getCampaign(SEED_CAMPAIGN_ID);
		const remaining = campaign.budget?.remainingCents ?? 0;

		api.setFixtureRole("CREATOR");

		let deal = await api.getDeal("fixture-deal-offer");

		deal = await api.actOnDeal(
			deal.id,
			{
				action: "COUNTER",
				expectedVersion: deal.version,
				proposalId: deal.latestProposal.id,
				amountCents: remaining + 100,
				draftDueAt: deal.latestProposal.terms.draftDueAt,
				publishDueAt: deal.latestProposal.terms.publishDueAt,
				angle: null
			},
			api.newIdempotencyKey()
		);

		api.setFixtureRole("BRAND");
		await expect(
			api.actOnDeal(
				deal.id,
				{
					action: "ACCEPT",
					expectedVersion: deal.version,
					proposalId: deal.latestProposal.id
				},
				api.newIdempotencyKey()
			)
		).rejects.toMatchObject({ code: "BUDGET_EXCEEDED", status: 409 });

		const after = await api.getDeal(deal.id);

		expect(after.status).toBe("NEGOTIATING");
		expect(after.version).toBe(deal.version);
	});

	it("commits the amount on accept and frees exactly that on refund", async () => {
		const api = await loadApi("fixture");
		const before = await api.getCampaign(SEED_CAMPAIGN_ID);
		const budget = before.budget;

		expect(budget).not.toBeNull();
		expect(budget?.remainingCents).toBe(
			(budget?.budgetCents ?? 0) -
				(budget?.committedCents ?? 0) -
				(budget?.spentCents ?? 0)
		);

		api.setFixtureRole("CREATOR");

		let deal = await api.getDeal("fixture-deal-offer");
		const amount = deal.latestProposal.terms.amountCents;

		deal = await api.actOnDeal(
			deal.id,
			{
				action: "ACCEPT",
				expectedVersion: deal.version,
				proposalId: deal.latestProposal.id
			},
			api.newIdempotencyKey()
		);

		expect(deal.budget).toBeNull();

		api.setFixtureRole("BRAND");
		deal = await api.getDeal(deal.id);

		expect(deal.budget).toEqual({
			budgetCents: budget?.budgetCents,
			committedCents: (budget?.committedCents ?? 0) + amount,
			spentCents: budget?.spentCents,
			remainingCents: (budget?.remainingCents ?? 0) - amount
		});
		await expect(api.getCampaign(SEED_CAMPAIGN_ID)).resolves.toMatchObject({
			budget: deal.budget
		});

		api.setFixtureRole("CREATOR");

		const upload = await api.uploadDraft(
			deal.id,
			new File(["x"], "draft.mp4", { type: "video/mp4" })
		);

		deal = await api.actOnDeal(
			deal.id,
			{
				action: "SUBMIT_DRAFTS",
				expectedVersion: deal.version,
				uploadIds: [upload.uploadId]
			},
			api.newIdempotencyKey()
		);

		api.setFixtureRole("BRAND");
		deal = await api.actOnDeal(
			deal.id,
			{
				action: "APPROVE_DRAFT",
				expectedVersion: deal.version,
				assetId: upload.uploadId
			},
			api.newIdempotencyKey()
		);
		deal = await api.actOnDeal(
			deal.id,
			{
				action: "REPORT_ISSUE",
				expectedVersion: deal.version,
				code: "UNRESPONSIVE_PARTY",
				reason: "No publication yet."
			},
			api.newIdempotencyKey()
		);

		api.setFixtureRole("ADMIN");
		deal = await api.actOnDeal(
			deal.id,
			{
				action: "REFUND_PAYMENT",
				expectedVersion: deal.version,
				disputeId: deal.dispute?.id ?? "",
				reason: "Creator stopped responding."
			},
			api.newIdempotencyKey()
		);

		expect(deal.status).toBe("REFUNDED");

		api.setFixtureRole("BRAND");

		const after = await api.getCampaign(SEED_CAMPAIGN_ID);

		expect(after.budget).toEqual(budget);
	});
});

describe("auto mode", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", undefined);
	});

	it("falls back to fixtures when Next has no such route", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response("<html>404</html>", {
						status: 404,
						headers: { "Content-Type": "text/html" }
					})
			)
		);

		const api = await loadApi("auto");
		const { items } = await api.listProducts();

		expect(items.length).toBeGreaterThan(0);
	});

	it("surfaces the backend's own NOT_FOUND without falling back", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: { code: "NOT_FOUND", message: "Not found." }
						}),
						{ status: 404, headers: { "Content-Type": "application/json" } }
					)
			)
		);

		const api = await loadApi("auto");

		await expect(api.getCreator("anyone")).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404
		});
	});

	it("sends the idempotency key and JSON body on deal actions", async () => {
		const fetchMock = vi.fn(
			async (_url: string, _init?: RequestInit) =>
				new Response(JSON.stringify({ error: { code: "STALE_DEAL", message: "" } }), {
					status: 409,
					headers: { "Content-Type": "application/json" }
				})
		);

		vi.stubGlobal("fetch", fetchMock);

		const api = await loadApi("auto");

		await expect(
			api.actOnDeal(
				"deal-1",
				{ action: "WITHDRAW", expectedVersion: 4 },
				"key-1"
			)
		).rejects.toMatchObject({ code: "STALE_DEAL" });

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		const headers = new Headers(init?.headers);

		expect(url).toBe("/api/v1/deals/deal-1/actions");
		expect(headers.get("Idempotency-Key")).toBe("key-1");
		expect(JSON.parse(String(init?.body))).toEqual({
			action: "WITHDRAW",
			expectedVersion: 4
		});
	});
});
