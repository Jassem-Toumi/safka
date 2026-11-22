import type {
	CampaignInput,
	CampaignPatch,
	CreateDealInput,
	CreatorDirectoryQuery,
	CreatorProfileInput,
	DealActionInput,
	DealListFilter,
	ParseInput,
	ProductInput,
	ProductPatch,
	VisibilityInput
} from "@/shared/contracts";

import { z } from "zod";

import { request } from "@/lib/api/client";
import {
	AdminDisputeDetail,
	AdminDisputeSummary,
	Campaign,
	CampaignReport,
	CreatorCard,
	CreatorProfile,
	Deal,
	DealReport,
	DemoAccount,
	EnrichmentResult,
	listOf,
	MatchCard,
	Me,
	ParseResult,
	PlaybackResult,
	Product,
	UploadResult
} from "@/shared/contracts";

// One function per route in final backend spec §7, typed by the backend's
// own contracts. Inputs are not re-validated here; the backend does that.

const encode = encodeURIComponent;

export function listDemoAccounts() {
	return request(listOf(DemoAccount), "/demo/accounts");
}

export function signIn(accountId: string) {
	return request(Me, "/demo/session", {
		method: "POST",
		body: { accountId }
	});
}

export function signOut() {
	return request(z.object({ ok: z.literal(true) }), "/demo/session", {
		method: "DELETE"
	});
}

export function getMe() {
	return request(Me, "/me");
}

export function listCreators(query: CreatorDirectoryQuery = {}) {
	return request(listOf(CreatorCard), "/creators", { query });
}

export function getCreator(creatorId: string) {
	return request(CreatorCard, `/creators/${encode(creatorId)}`);
}

export function getCreatorProfile() {
	return request(CreatorProfile, "/creator/profile");
}

export function saveCreatorProfile(input: CreatorProfileInput) {
	return request(CreatorProfile, "/creator/profile", {
		method: "PUT",
		body: input
	});
}

export function setProfileVisibility(input: VisibilityInput) {
	return request(CreatorProfile, "/creator/profile/visibility", {
		method: "POST",
		body: input
	});
}

/** Synchronous: resolves with a terminal READY, EMPTY or FAILED result. */
export function runEnrichment() {
	return request(EnrichmentResult, "/creator/enrichment", { method: "POST" });
}

export function listProducts() {
	return request(listOf(Product), "/products");
}

export function createProduct(input: ProductInput) {
	return request(Product, "/products", { method: "POST", body: input });
}

export function updateProduct(productId: string, patch: ProductPatch) {
	return request(Product, `/products/${encode(productId)}`, {
		method: "PATCH",
		body: patch
	});
}

export function parseCampaign(input: ParseInput) {
	return request(ParseResult, "/campaigns/parse", {
		method: "POST",
		body: input
	});
}

export function listCampaigns() {
	return request(listOf(Campaign), "/campaigns");
}

export function createCampaign(input: CampaignInput) {
	return request(Campaign, "/campaigns", { method: "POST", body: input });
}

export function getCampaign(campaignId: string) {
	return request(Campaign, `/campaigns/${encode(campaignId)}`);
}

export function updateCampaign(campaignId: string, patch: CampaignPatch) {
	return request(Campaign, `/campaigns/${encode(campaignId)}`, {
		method: "PATCH",
		body: patch
	});
}

export function listMatches(campaignId: string) {
	return request(listOf(MatchCard), `/campaigns/${encode(campaignId)}/matches`);
}

export function getCampaignReport(campaignId: string) {
	return request(CampaignReport, `/campaigns/${encode(campaignId)}/report`);
}

export function createDeal(input: CreateDealInput, idempotencyKey: string) {
	return request(Deal, "/deals", {
		method: "POST",
		body: input,
		idempotencyKey
	});
}

export function listDeals(
	query: { filter?: DealListFilter; campaignId?: string } = {}
) {
	return request(listOf(Deal), "/deals", { query });
}

export function getDeal(dealId: string) {
	return request(Deal, `/deals/${encode(dealId)}`);
}

/**
 * Performs a deal action. `action` carries `expectedVersion`, the version the
 * viewer last saw; send one idempotency key per intentional submission.
 */
export function actOnDeal(
	dealId: string,
	action: DealActionInput,
	idempotencyKey: string
) {
	return request(Deal, `/deals/${encode(dealId)}/actions`, {
		method: "POST",
		body: action,
		idempotencyKey
	});
}

/** Uploads one MP4 (multipart field `file`, up to 20 MiB). */
export function uploadDraft(dealId: string, file: File) {
	const body = new FormData();

	body.set("file", file);

	return request(UploadResult, `/deals/${encode(dealId)}/uploads`, {
		method: "POST",
		body
	});
}

export function getPlayback(dealId: string, assetId: string) {
	return request(
		PlaybackResult,
		`/deals/${encode(dealId)}/assets/${encode(assetId)}/playback`
	);
}

export function getDealReport(dealId: string) {
	return request(DealReport, `/deals/${encode(dealId)}/report`);
}

export function listDisputes() {
	return request(listOf(AdminDisputeSummary), "/admin/disputes");
}

export function getDispute(disputeId: string) {
	return request(AdminDisputeDetail, `/admin/disputes/${encode(disputeId)}`);
}
