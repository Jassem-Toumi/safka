import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// API_MODE is read when the client module loads, so each test stubs the env
// and imports a fresh copy of the module graph.

async function loadApi(mode: "fixture" | "auto") {
	vi.resetModules();
	vi.stubEnv("NEXT_PUBLIC_API_MODE", mode);

	return import("@/lib/api");
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
