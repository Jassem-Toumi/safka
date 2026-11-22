import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { SEED } from "@/server/seed/ids";

// Runs the frontend's API client against a running backend, so every
// response the pages read is validated by the same contract code the pages
// use. Opt-in, read-only (sessions aside):
//
//   npm run demo:seed && npm run dev   # in another terminal
//   SAFKA_LIVE_URL=http://127.0.0.1:3000 npx vitest run tests/frontend/live.test.ts

const baseUrl = process.env.SAFKA_LIVE_URL;

let cookie = "";

async function loadLiveApi() {
	vi.resetModules();
	vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");

	return import("@/lib/api");
}

describe.skipIf(baseUrl === undefined)("frontend client against the live backend", () => {
	beforeAll(() => {
		const realFetch = globalThis.fetch;

		// Browser stand-in: absolute URL, same-origin Origin, a cookie jar.
		vi.stubGlobal(
			"fetch",
			async (input: string, init: RequestInit = {}) => {
				const headers = new Headers(init.headers);

				headers.set("Origin", baseUrl ?? "");

				if (cookie !== "") {
					headers.set("Cookie", cookie);
				}

				const response = await realFetch(`${baseUrl}${input}`, {
					...init,
					headers
				});
				const setCookie = response.headers.get("set-cookie");

				if (setCookie !== null) {
					cookie = setCookie.split(";")[0] ?? "";
				}

				return response;
			}
		);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it("reads everything a brand sees", async () => {
		const api = await loadLiveApi();

		await api.signIn(SEED.users.brandHushkeys);

		const me = await api.getMe();
		const { items: creators } = await api.listCreators();
		const { items: campaigns } = await api.listCampaigns();
		const { items: deals } = await api.listDeals();

		expect(me.role).toBe("BRAND");
		expect(creators.length).toBeGreaterThan(0);

		await api.getCreator(creators[0]?.id ?? "");
		await api.listProducts();
		await api.listDeals({ filter: "needs_action" });

		for (const campaign of campaigns) {
			await api.getCampaign(campaign.id);

			if (campaign.status === "ACTIVE") {
				await api.listMatches(campaign.id);
			}

			await api.getCampaignReport(campaign.id);
		}

		for (const deal of deals) {
			await api.getDeal(deal.id);
			await api.getDealReport(deal.id);
		}
	});

	it("reads everything a creator sees", async () => {
		const api = await loadLiveApi();

		await api.signIn(SEED.users.creatorClackLab);

		const profile = await api.getCreatorProfile();
		const { items: deals } = await api.listDeals();

		expect(profile.id).toBeTruthy();

		for (const deal of deals) {
			await api.getDeal(deal.id);
		}
	});

	it("reads everything an admin sees", async () => {
		const api = await loadLiveApi();

		await api.signIn(SEED.users.admin);

		const { items: disputes } = await api.listDisputes();

		expect(disputes.length).toBeGreaterThan(0);

		for (const dispute of disputes) {
			const detail = await api.getDispute(dispute.id);

			for (const asset of detail.deal.draftBatches.flatMap((b) => b.assets)) {
				await api.getPlayback(detail.deal.id, asset.id);
			}
		}
	});
});
