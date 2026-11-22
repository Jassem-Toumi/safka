import type { ZodError } from "zod";
import type {
	BriefDraft,
	Budget,
	Campaign,
	CampaignReport,
	CreatorProfile,
	Deal,
	DealAction,
	DealListFilter,
	DealReport,
	ErrorCode,
	Me,
	MetricResult,
	Product,
	Role
} from "@/shared/contracts";

import {
	ADMIN,
	BRAND,
	CREATOR,
	campaigns as seedCampaigns,
	creators,
	deals as seedDeals,
	demoAccounts,
	disputeSummary,
	makeTerms,
	matches,
	products as seedProducts,
	SAMPLE_REPORT_DEAL_ID
} from "@/lib/api/fixtures/data";
import {
	Brief,
	CampaignInput,
	CampaignPatch,
	CreateDealInput,
	CreatorProfileInput,
	DealActionInput,
	DemoSessionInput,
	ERROR_STATUS,
	ParseInput,
	ProductInput,
	ProductPatch,
	TERMINAL_DEAL_STATUSES,
	VisibilityInput
} from "@/shared/contracts";
import { normalizeTopics } from "@/shared/topics";

// Fixture mode: an in-memory stand-in for routes the backend has not built
// yet, enough to build every screen and click through the deal flow. It is
// not the backend: it validates bodies against the contracts and enforces
// campaign budgets, but skips uploads, idempotency, ownership and duplicate
// negotiations. Switch the viewer with setFixtureRole("CREATOR") in the
// browser console, then reload; in auto mode a live /me sets it for you.

const ROLE_STORAGE_KEY = "safka.fixtureRole";

let memoryRole: Role | undefined;

export function getFixtureRole(): Role {
	try {
		const stored = globalThis.localStorage?.getItem(ROLE_STORAGE_KEY);

		if (stored === "BRAND" || stored === "CREATOR" || stored === "ADMIN") {
			return stored;
		}
	} catch {
		// Storage can be blocked; fall back to memory.
	}

	return memoryRole ?? "BRAND";
}

export function setFixtureRole(role: Role): void {
	memoryRole = role;

	try {
		globalThis.localStorage?.setItem(ROLE_STORAGE_KEY, role);
	} catch {
		// Storage can be blocked; the in-memory role still applies.
	}
}

if (typeof window !== "undefined") {
	Object.assign(window, { setFixtureRole });
}

const deals = new Map(
	seedDeals.map((deal) => [deal.id, structuredClone(deal)])
);
const campaigns = new Map(
	seedCampaigns.map((campaign) => [campaign.id, structuredClone(campaign)])
);
const products = new Map(
	seedProducts.map((product) => [product.id, structuredClone(product)])
);

const REPORT_WINDOW_MS = 7 * 86_400_000;

/** Seeded actuals for the one labeled sample report (final spec §6). */
const SAMPLE_ACTUALS = { views: 21500, clicks: 420 };

let profile: CreatorProfile = buildProfile();

function buildProfile(): CreatorProfile {
	const [card] = creators;
	const nowIso = new Date().toISOString();

	if (card === undefined) {
		throw new Error("Fixture creators are empty.");
	}

	return {
		id: card.id,
		version: 3,
		visibility: "LISTED",
		canonicalChannelUrl: card.profileUrl,
		draft: {
			displayName: card.displayName,
			bio: card.bio,
			channel: "@ClackLabSample",
			topics: card.topics.map((label) => label.value),
			formats: ["COMPARISON", "DEMO"],
			rate: card.rate,
			typical7dViews: card.typical7dViews,
			selectedEvidenceIds: card.evidence.map((evidence) => evidence.id)
		},
		evidence: card.evidence,
		lastEnrichment: null,
		published: card,
		publishedVersion: 3,
		hasUnpublishedChanges: false,
		listingBlockers: [],
		updatedAt: nowIso
	};
}

function respond(status: number, payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "Content-Type": "application/json", "x-fixture": "1" }
	});
}

function ok(data: unknown, status = 200): Response {
	return respond(status, { data });
}

function fail(
	code: ErrorCode,
	message: string,
	fields?: Record<string, string>
): Response {
	return respond(ERROR_STATUS[code], { error: { code, message, fields } });
}

function list(items: unknown[]): Response {
	return ok({ items, nextCursor: null });
}

function notFound(): Response {
	return fail("NOT_FOUND", "Not found.");
}

/** Zod issues as `fields`, keyed by dotted path like the backend's. */
function issueFields(error: ZodError, prefix = ""): Record<string, string> {
	const fields: Record<string, string> = {};

	for (const issue of error.issues) {
		const key = [prefix, ...issue.path.map(String)].filter(Boolean).join(".");

		fields[key || "_"] ??= issue.message;
	}

	return fields;
}

function invalid(error: ZodError): Response {
	return fail(
		"VALIDATION_ERROR",
		"Some fields are invalid.",
		issueFields(error)
	);
}

/** True when the raw JSON body sent `key`, even if its value is null. */
function hasField(body: unknown, key: string): boolean {
	return typeof body === "object" && body !== null && key in body;
}

/** A PATCH value when one was sent, else the current value. */
function patched<T>(value: T | undefined, current: T): T {
	return value === undefined ? current : value;
}

function baseBudget(budgetCents: number | null): Budget | null {
	if (budgetCents === null) {
		return null;
	}

	return {
		budgetCents,
		committedCents: 0,
		spentCents: 0,
		remainingCents: budgetCents
	};
}

/**
 * Recomputes totals from the campaign's deals, as the backend does on every
 * acceptance (final spec §5): agreements with pending or held payment are
 * committed, released payments are spent, cancelled and refunded deals free
 * their amount.
 */
function budgetFor(campaign: Campaign): Budget | null {
	if (campaign.budget === null) {
		return null;
	}

	let committedCents = 0;
	let spentCents = 0;

	for (const deal of deals.values()) {
		if (deal.campaignId !== campaign.id || deal.agreement === null) {
			continue;
		}

		const amount = deal.agreement.terms.amountCents;

		if (deal.paymentStatus === "RELEASED") {
			spentCents += amount;
		} else if (
			deal.paymentStatus !== "REFUNDED" &&
			deal.status !== "CANCELLED"
		) {
			committedCents += amount;
		}
	}

	const { budgetCents } = campaign.budget;

	return {
		budgetCents,
		committedCents,
		spentCents,
		remainingCents: budgetCents - committedCents - spentCents
	};
}

function campaignFor(deal: Deal): Campaign | undefined {
	return deal.campaignId === null ? undefined : campaigns.get(deal.campaignId);
}

/** True when a fixture campaign can't cover `amountCents`. */
function exceedsBudget(
	campaignId: string | null,
	amountCents: number
): boolean {
	const campaign = campaignId === null ? undefined : campaigns.get(campaignId);
	const budget = campaign === undefined ? null : budgetFor(campaign);

	return budget !== null && amountCents > budget.remainingCents;
}

function isOpenNegotiation(deal: Deal): boolean {
	return (
		deal.status === "NEGOTIATING" &&
		Date.parse(deal.latestProposal.expiresAt) > Date.now()
	);
}

function withTotals(campaign: Campaign): Campaign {
	const campaignDeals = [...deals.values()].filter(
		(deal) => deal.campaignId === campaign.id
	);

	return {
		...campaign,
		budget: budgetFor(campaign),
		dealCount: campaignDeals.length,
		hasOpenNegotiations: campaignDeals.some(isOpenNegotiation)
	};
}

function normalizeBrief(brief: BriefDraft | null): BriefDraft | null {
	return brief === null
		? null
		: { ...brief, topics: normalizeTopics(brief.topics) };
}

/** Field errors that block activation (final spec §4), or null if none. */
function activationErrors(
	brief: BriefDraft | null,
	budgetCents: number | null
): Record<string, string> | null {
	const fields: Record<string, string> = {};

	if (brief === null) {
		fields.brief = "Add a brief before activating.";
	} else {
		const parsed = Brief.safeParse(brief);

		if (!parsed.success) {
			Object.assign(fields, issueFields(parsed.error, "brief"));
		}

		if (brief.topics.length === 0) {
			fields["brief.topics"] = "Add at least one topic.";
		}
	}

	if (budgetCents === null) {
		fields.budgetCents = "Set a budget before activating.";
	}

	return Object.keys(fields).length === 0 ? null : fields;
}

function isTerminal(deal: Deal): boolean {
	return TERMINAL_DEAL_STATUSES.includes(deal.status);
}

/** What the viewer may do next, mirroring final backend spec §5. */
function actionsFor(deal: Deal, role: Role): DealAction[] {
	const isBrand = role === "BRAND";
	const isCreator = role === "CREATOR";
	const report: DealAction[] = role === "ADMIN" ? [] : ["REPORT_ISSUE"];

	switch (deal.status) {
		case "NEGOTIATING": {
			const isRecipient =
				role !== "ADMIN" && role !== deal.latestProposal.authorRole;
			const replies: DealAction[] = isRecipient
				? ["ACCEPT", "DECLINE", "COUNTER"]
				: [];

			return isBrand ? [...replies, "WITHDRAW"] : replies;
		}

		case "AGREED":
		case "REVISION_REQUESTED":
			return isCreator ? ["SUBMIT_DRAFTS", ...report] : report;

		case "DRAFT_REVIEW":
			return isBrand
				? ["APPROVE_DRAFT", "REQUEST_CHANGES", ...report]
				: report;

		case "READY_TO_PUBLISH":
			return isCreator ? ["SUBMIT_PUBLICATION", ...report] : report;

		case "PUBLISHED": {
			const confirmed = deal.confirmations.some(
				(confirmation) => confirmation.role === role
			);

			return confirmed || role === "ADMIN"
				? report
				: ["CONFIRM_DELIVERY", ...report];
		}

		case "DISPUTED":
			if (role !== "ADMIN") {
				return [];
			}

			return deal.paymentStatus === "HELD"
				? ["RESUME_DEAL", "RELEASE_PAYMENT", "REFUND_PAYMENT"]
				: ["RESUME_DEAL", "CANCEL_DEAL"];

		default:
			return [];
	}
}

function nextActionRole(deal: Deal): Role | null {
	switch (deal.status) {
		case "NEGOTIATING":
			return deal.latestProposal.authorRole === "BRAND" ? "CREATOR" : "BRAND";

		case "AGREED":
		case "REVISION_REQUESTED":
		case "READY_TO_PUBLISH":
			return "CREATOR";

		case "DRAFT_REVIEW":
			return "BRAND";

		case "PUBLISHED": {
			// Null until exactly one confirmation remains.
			const [only] = deal.confirmations;

			if (deal.confirmations.length !== 1 || only === undefined) {
				return null;
			}

			return only.role === "BRAND" ? "CREATOR" : "BRAND";
		}

		case "DISPUTED":
			return "ADMIN";

		default:
			return null;
	}
}

function forViewer(deal: Deal, role: Role): Deal {
	const campaign = campaignFor(deal);

	return {
		...deal,
		// The campaign budget is only for the owning brand (final spec §7).
		budget:
			role === "BRAND" && campaign !== undefined ? budgetFor(campaign) : null,
		availableActions: actionsFor(deal, role),
		nextActionRole: nextActionRole(deal)
	};
}

function canView(deal: Deal, role: Role): boolean {
	return role !== "ADMIN" || deal.dispute !== null;
}

function needsAction(deal: Deal): boolean {
	return deal.availableActions.some((action) => action !== "REPORT_ISSUE");
}

function matchesFilter(deal: Deal, filter: DealListFilter | null): boolean {
	switch (filter) {
		case "closed":
			return isTerminal(deal);

		case "needs_action":
			return needsAction(deal);

		case "in_progress":
			return !isTerminal(deal) && !needsAction(deal);

		case null:
			return true;
	}
}

function me(role: Role): Me {
	const account = { BRAND, CREATOR, ADMIN }[role];

	return { ...account, role, profileReady: true };
}

/** Applies a validated action. Returns an error response, or null. */
function applyAction(
	deal: Deal,
	input: DealActionInput,
	role: Role
): Response | null {
	const nowIso = new Date().toISOString();

	switch (input.action) {
		case "ACCEPT":
			if (input.proposalId !== deal.latestProposal.id) {
				return fail("INVALID_STATE", "Not the latest proposal.");
			}

			// Checked before any change, so a blocked acceptance stays open.
			if (
				exceedsBudget(deal.campaignId, deal.latestProposal.terms.amountCents)
			) {
				return fail(
					"BUDGET_EXCEEDED",
					"This offer is more than the campaign's remaining budget."
				);
			}

			deal.status = "AGREED";
			deal.agreement = {
				proposalId: deal.latestProposal.id,
				acceptedAt: nowIso,
				terms: deal.latestProposal.terms
			};
			break;

		case "DECLINE":
			deal.status = "DECLINED";
			break;

		case "WITHDRAW":
			deal.status = "WITHDRAWN";
			break;

		case "COUNTER": {
			const previous = deal.latestProposal;

			if (role === "ADMIN") {
				return fail("FORBIDDEN", "Participants counter.");
			}

			const { amountCents, draftDueAt, publishDueAt, angle } = input;

			deal.latestProposal = {
				id: `${deal.id}-proposal-${previous.revision + 1}`,
				revision: previous.revision + 1,
				authorRole: role,
				expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
				createdAt: nowIso,
				terms: {
					...previous.terms,
					amountCents,
					draftDueAt,
					publishDueAt,
					angle
				}
			};
			break;
		}

		case "SUBMIT_DRAFTS": {
			const round = deal.draftBatches.length + 1;

			deal.status = "DRAFT_REVIEW";
			deal.draftBatches.push({
				id: `${deal.id}-batch-${round}`,
				round,
				submittedAt: nowIso,
				late: false,
				changeRequest: null,
				assets: input.uploadIds.map((uploadId, index) => ({
					id: uploadId,
					label: `Option ${index + 1}`,
					sizeBytes: 15_000_000
				}))
			});
			break;
		}

		case "REQUEST_CHANGES": {
			const latest = deal.draftBatches.at(-1);

			if (latest !== undefined) {
				latest.changeRequest = input.reason;
			}

			deal.status = "REVISION_REQUESTED";
			break;
		}

		case "APPROVE_DRAFT":
			deal.status = "READY_TO_PUBLISH";
			deal.paymentStatus = "HELD";
			deal.approvedAssetId = input.assetId;
			break;

		case "SUBMIT_PUBLICATION": {
			const videoId =
				/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/.exec(input.url)?.[1] ?? null;

			if (videoId === null) {
				return fail("VALIDATION_ERROR", "Not a supported YouTube URL.", {
					url: "Use a youtube.com/watch, /shorts or youtu.be link."
				});
			}

			deal.status = "PUBLISHED";
			deal.publication = {
				url: input.url,
				videoId,
				publishedAt: input.publishedAt,
				submittedAt: nowIso,
				late: false,
				sample: false
			};
			break;
		}

		case "CONFIRM_DELIVERY":
			if (role === "ADMIN") {
				return fail("FORBIDDEN", "Participants confirm delivery.");
			}

			deal.confirmations.push({ role, confirmedAt: nowIso });

			if (deal.confirmations.length === 2) {
				deal.status = "COMPLETED";
				deal.paymentStatus = "RELEASED";
			}

			break;

		case "REPORT_ISSUE":
			if (role === "ADMIN") {
				return fail("FORBIDDEN", "Participants report issues.");
			}

			deal.dispute = {
				id: `${deal.id}-dispute`,
				dealId: deal.id,
				openedAt: nowIso,
				openedByRole: role,
				code: input.code,
				reason: input.reason,
				priorStatus: deal.status,
				resolvedAt: null,
				resolution: null,
				resolutionReason: null
			};
			deal.status = "DISPUTED";
			break;

		case "RESUME_DEAL":
		case "CANCEL_DEAL":
		case "RELEASE_PAYMENT":
		case "REFUND_PAYMENT": {
			const { dispute } = deal;

			if (dispute === null) {
				return fail("INVALID_STATE", "No open dispute.");
			}

			const outcomes = {
				RESUME_DEAL: [dispute.priorStatus, deal.paymentStatus],
				CANCEL_DEAL: ["CANCELLED", "NONE"],
				RELEASE_PAYMENT: ["COMPLETED", "RELEASED"],
				REFUND_PAYMENT: ["REFUNDED", "REFUNDED"]
			} as const;
			const [status, paymentStatus] = outcomes[input.action];

			deal.status = status;
			deal.paymentStatus = paymentStatus;
			deal.dispute = {
				...dispute,
				resolvedAt: nowIso,
				resolution: input.action,
				resolutionReason: input.reason
			};
			break;
		}
	}

	deal.version += 1;
	deal.updatedAt = nowIso;
	deal.timeline.push({
		id: `${deal.id}-event-${deal.timeline.length + 1}`,
		actorRole: role,
		action: input.action,
		createdAt: nowIso,
		note: null
	});

	return null;
}

function handleDealAction(dealId: string, body: unknown, role: Role) {
	const deal = deals.get(dealId);

	if (deal === undefined || !canView(deal, role)) {
		return notFound();
	}

	const parsed = DealActionInput.safeParse(body);

	if (!parsed.success) {
		return invalid(parsed.error);
	}

	if (parsed.data.expectedVersion !== deal.version) {
		return fail("STALE_DEAL", "This deal changed since you loaded it.");
	}

	if (!actionsFor(deal, role).includes(parsed.data.action)) {
		return fail(
			"INVALID_STATE",
			`${parsed.data.action} is not available to ${role} now.`
		);
	}

	return applyAction(deal, parsed.data, role) ?? ok(forViewer(deal, role));
}

function handleCreateDeal(body: unknown, role: Role): Response {
	const parsed = CreateDealInput.safeParse(body);

	if (role !== "BRAND") {
		return fail("FORBIDDEN", "Brands send offers.");
	}

	if (!parsed.success) {
		return invalid(parsed.error);
	}

	const { creatorId, productId, campaignId, terms } = parsed.data;
	// Live directory IDs are profile IDs the fixtures don't know; accept them.
	const creator = creators.find((card) => card.id === creatorId);
	const campaign = campaignId === null ? undefined : campaigns.get(campaignId);

	if (campaign !== undefined && campaign.status !== "ACTIVE") {
		return fail("INVALID_STATE", "Offers need an active campaign.");
	}

	if (campaign !== undefined && campaign.productId !== productId) {
		return fail("VALIDATION_ERROR", "Use the campaign's product.", {
			productId: "Must be the campaign's product."
		});
	}

	if (exceedsBudget(campaignId, terms.amountCents)) {
		return fail(
			"BUDGET_EXCEEDED",
			"This offer is more than the campaign's remaining budget."
		);
	}

	const product = products.get(productId);
	const baseTerms = makeTerms(terms.amountCents);
	const nowIso = new Date().toISOString();
	const id = `fixture-deal-${crypto.randomUUID()}`;
	const deal: Deal = {
		id,
		version: 1,
		status: "NEGOTIATING",
		paymentStatus: "NONE",
		brand: BRAND,
		creator: { id: creatorId, displayName: creator?.displayName ?? "Creator" },
		campaignId,
		budget: null,
		latestProposal: {
			id: `${id}-proposal-1`,
			revision: 1,
			authorRole: "BRAND",
			expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
			createdAt: nowIso,
			terms: {
				...baseTerms,
				...terms,
				product:
					product === undefined
						? baseTerms.product
						: {
								id: product.id,
								name: product.name,
								description: product.description,
								landingUrl: product.landingUrl
							}
			}
		},
		agreement: null,
		draftBatches: [],
		approvedAssetId: null,
		publication: null,
		confirmations: [],
		dispute: null,
		nextActionRole: "CREATOR",
		availableActions: [],
		timeline: [
			{
				id: `${id}-event-1`,
				actorRole: "BRAND",
				action: "OFFER_SENT",
				createdAt: nowIso,
				note: null
			}
		],
		sample: false,
		createdAt: nowIso,
		updatedAt: nowIso,
		isOverdue: false
	};

	deals.set(id, deal);

	return ok(forViewer(deal, role), 201);
}

function handleParse(body: unknown): Response {
	const parsed = ParseInput.safeParse(body);

	if (!parsed.success) {
		return invalid(parsed.error);
	}

	const { productId, prompt } = parsed.data;
	const dollars = /\$\s?(\d[\d,]*)/.exec(prompt)?.[1];
	const knownTopics = ["mechanical-keyboards", "desk-setups"].filter(
		(topic) => prompt.toLowerCase().includes(topic.split("-")[0] ?? topic)
	);

	return ok({
		brief: {
			title: products.get(productId)?.name ?? "",
			goal: prompt,
			objective: null,
			topics: knownTopics,
			formats: [],
			talkingPoints: [],
			restrictions: []
		},
		budgetCents:
			dollars === undefined ? null : Number(dollars.replaceAll(",", "")) * 100,
		preferredMaxPerPostCents: null,
		defaultViewTarget: null,
		defaultClickTarget: null,
		mode: "RULES"
	});
}

function handleCreateProduct(body: unknown, role: Role): Response {
	if (role !== "BRAND") {
		return fail("FORBIDDEN", "Brands manage products.");
	}

	const parsed = ProductInput.safeParse(body);

	if (!parsed.success) {
		return invalid(parsed.error);
	}

	const nowIso = new Date().toISOString();
	const product: Product = {
		id: `fixture-product-${crypto.randomUUID()}`,
		...parsed.data,
		createdAt: nowIso,
		updatedAt: nowIso
	};

	products.set(product.id, product);

	return ok(product, 201);
}

function handleUpdateProduct(
	productId: string,
	body: unknown,
	role: Role
): Response {
	if (role !== "BRAND") {
		return fail("FORBIDDEN", "Brands manage products.");
	}

	const product = products.get(productId);

	if (product === undefined) {
		return notFound();
	}

	const parsed = ProductPatch.safeParse(body);

	if (!parsed.success) {
		return invalid(parsed.error);
	}

	const { name, description, landingUrl } = parsed.data;
	const next: Product = {
		...product,
		name: patched(name, product.name),
		description: patched(description, product.description),
		landingUrl: patched(landingUrl, product.landingUrl),
		updatedAt: new Date().toISOString()
	};

	products.set(next.id, next);

	return ok(next);
}

function handleCreateCampaign(body: unknown, role: Role): Response {
	if (role !== "BRAND") {
		return fail("FORBIDDEN", "Brands create campaigns.");
	}

	const parsed = CampaignInput.safeParse(body);

	if (!parsed.success) {
		return invalid(parsed.error);
	}

	const { confirm, brief, budgetCents, ...fields } = parsed.data;
	const normalized = normalizeBrief(brief);
	const blockers =
		confirm === true ? activationErrors(normalized, budgetCents) : null;

	if (blockers !== null) {
		return fail(
			"VALIDATION_ERROR",
			"Complete the brief and budget to activate.",
			blockers
		);
	}

	const nowIso = new Date().toISOString();
	const campaign: Campaign = {
		...fields,
		id: `fixture-campaign-${crypto.randomUUID()}`,
		version: 1,
		status: confirm === true ? "ACTIVE" : "DRAFT",
		brief: normalized,
		budget: baseBudget(budgetCents),
		dealCount: 0,
		hasOpenNegotiations: false,
		createdAt: nowIso,
		updatedAt: nowIso
	};

	campaigns.set(campaign.id, campaign);

	return ok(withTotals(campaign), 201);
}

/** Applies a validated edit, activation or close. Returns the new campaign or an error. */
function editCampaign(
	campaign: Campaign,
	body: unknown,
	role: Role
): Campaign | Response {
	if (role !== "BRAND") {
		return fail("FORBIDDEN", "Brands edit campaigns.");
	}

	const parsed = CampaignPatch.safeParse(body);

	if (!parsed.success) {
		return invalid(parsed.error);
	}

	const { expectedVersion, status, confirm, ...patch } = parsed.data;

	if (expectedVersion !== campaign.version) {
		return fail("STALE_CAMPAIGN", "This campaign changed since you loaded it.");
	}

	if (campaign.status === "CLOSED") {
		return fail("INVALID_STATE", "This campaign is closed.");
	}

	const totals = withTotals(campaign);

	if (status === "CLOSED") {
		if (totals.hasOpenNegotiations) {
			return fail(
				"INVALID_STATE",
				"Finish or withdraw open negotiations before closing."
			);
		}

		return { ...campaign, status: "CLOSED" };
	}

	const next: Campaign = {
		...campaign,
		productId: patched(patch.productId, campaign.productId),
		// The contract defaults a missing sourcePrompt to "", so check the body.
		sourcePrompt: hasField(body, "sourcePrompt")
			? patched(patch.sourcePrompt, campaign.sourcePrompt)
			: campaign.sourcePrompt,
		brief:
			patch.brief === undefined ? campaign.brief : normalizeBrief(patch.brief),
		budget:
			patch.budgetCents === undefined
				? campaign.budget
				: baseBudget(patch.budgetCents),
		preferredMaxPerPostCents: patched(
			patch.preferredMaxPerPostCents,
			campaign.preferredMaxPerPostCents
		),
		defaultViewTarget: patched(
			patch.defaultViewTarget,
			campaign.defaultViewTarget
		),
		defaultClickTarget: patched(
			patch.defaultClickTarget,
			campaign.defaultClickTarget
		)
	};

	// An active campaign must stay complete, whether or not this edit confirms.
	const isActive = confirm === true || campaign.status === "ACTIVE";
	const blockers = isActive
		? activationErrors(next.brief, next.budget?.budgetCents ?? null)
		: null;

	if (blockers !== null) {
		return fail(
			"VALIDATION_ERROR",
			"Complete the brief and budget to activate.",
			blockers
		);
	}

	const used =
		(totals.budget?.committedCents ?? 0) + (totals.budget?.spentCents ?? 0);

	if (next.budget !== null && next.budget.budgetCents < used) {
		return fail("VALIDATION_ERROR", "The budget is below what's committed.", {
			budgetCents: "Can't be less than committed plus spent."
		});
	}

	return { ...next, status: isActive ? "ACTIVE" : campaign.status };
}

function handleUpdateCampaign(
	campaignId: string,
	body: unknown,
	role: Role
): Response {
	const campaign = campaigns.get(campaignId);

	if (campaign === undefined) {
		return notFound();
	}

	const edited = editCampaign(campaign, body, role);

	if (edited instanceof Response) {
		return edited;
	}

	const next: Campaign = {
		...edited,
		version: campaign.version + 1,
		updatedAt: new Date().toISOString()
	};

	campaigns.set(next.id, next);

	return ok(withTotals(next));
}

/** A labeled sample metric: status and shortfall follow from the numbers. */
function sampleMetric(
	target: number | null,
	actual: number,
	measuredAt: string | null
): MetricResult {
	const base = { target, actual, measuredAt, source: "SAMPLE" as const };

	if (target === null) {
		return { ...base, status: "NO_TARGET", shortfallPct: null };
	}

	if (actual >= target) {
		return { ...base, status: "MET", shortfallPct: null };
	}

	return {
		...base,
		status: "BELOW_TARGET",
		shortfallPct: Math.round((100 * (target - actual)) / target)
	};
}

/** A metric with no actuals: nothing is measured outside the sample. */
function unmeasuredMetric(
	target: number | null,
	isWindowClosed: boolean
): MetricResult {
	let status: MetricResult["status"] = "PENDING";

	if (target === null) {
		status = "NO_TARGET";
	} else if (isWindowClosed) {
		status = "INSUFFICIENT_DATA";
	}

	return {
		target,
		actual: null,
		measuredAt: null,
		source: null,
		status,
		shortfallPct: null
	};
}

/**
 * The deal's 7-day report (final spec §6). Only the seeded sample deal has
 * actuals; every other deal reports NO_TARGET, PENDING while its window is
 * open (or not yet started), and INSUFFICIENT_DATA afterwards.
 */
function dealReport(deal: Deal): DealReport {
	const { viewTarget, clickTarget } = (deal.agreement ?? deal.latestProposal)
		.terms;
	const windowStart = deal.publication?.publishedAt ?? null;
	const windowEnd =
		windowStart === null
			? null
			: new Date(Date.parse(windowStart) + REPORT_WINDOW_MS).toISOString();
	const report = {
		dealId: deal.id,
		status: deal.status,
		windowStart,
		windowEnd
	};

	if (deal.id === SAMPLE_REPORT_DEAL_ID) {
		return {
			...report,
			views: sampleMetric(viewTarget, SAMPLE_ACTUALS.views, windowEnd),
			clicks: sampleMetric(clickTarget, SAMPLE_ACTUALS.clicks, windowEnd),
			sample: true
		};
	}

	const isWindowClosed =
		windowEnd === null ? isTerminal(deal) : Date.parse(windowEnd) <= Date.now();

	return {
		...report,
		views: unmeasuredMetric(viewTarget, isWindowClosed),
		clicks: unmeasuredMetric(clickTarget, isWindowClosed),
		sample: false
	};
}

function sampleCampaignReport(campaign: Campaign): CampaignReport {
	const sampleDeal = deals.get(SAMPLE_REPORT_DEAL_ID);

	return {
		campaignId: campaign.id,
		budget: budgetFor(campaign) ?? {
			budgetCents: 0,
			committedCents: 0,
			spentCents: 0,
			remainingCents: 0
		},
		countsByStatus: { COMPLETED: 1, PUBLISHED: 1, DRAFT_REVIEW: 1 },
		agreedCount: 3,
		publishedCount: 2,
		completedCount: 1,
		sample: true,
		deals: {
			items: sampleDeal === undefined ? [] : [dealReport(sampleDeal)],
			nextCursor: null
		}
	};
}

/** Answers a request the way the backend would, from in-memory fixtures. */
export async function handleFixtureRequest(
	method: string,
	pathWithQuery: string,
	body: unknown
): Promise<Response> {
	// Long enough to see loading states, short enough not to slow work down.
	await new Promise((resolve) => setTimeout(resolve, 150));

	const url = new URL(pathWithQuery, "http://fixture.local");
	const segments = url.pathname.split("/").filter(Boolean);
	const role = getFixtureRole();

	// Resource paths alternate name/ID ("/deals/:id/actions"); "/admin" is a
	// prefix before that pattern. Paths under /demo, /creator and
	// /campaigns/parse are fixed.
	const offset = segments[0] === "admin" ? 1 : 0;
	const firstId = segments[offset + 1] ?? "";
	const isFixedPath =
		segments[0] === "demo" ||
		segments[0] === "creator" ||
		url.pathname === "/campaigns/parse";
	const pattern = segments
		.map((segment, index) =>
			index >= offset && (index - offset) % 2 === 1 ? ":id" : segment
		)
		.join("/");
	const route = `${method} ${isFixedPath ? url.pathname : `/${pattern}`}`;

	switch (route) {
		case "GET /demo/accounts":
			return list(demoAccounts);

		case "POST /demo/session": {
			const parsed = DemoSessionInput.safeParse(body);
			const account = demoAccounts.find(
				(candidate) => candidate.id === parsed.data?.accountId
			);

			if (account === undefined) {
				return fail("NOT_FOUND", "Demo account not found.");
			}

			setFixtureRole(account.role);

			return ok(me(account.role));
		}

		case "DELETE /demo/session":
			return ok({ ok: true });

		case "GET /me":
			return ok(me(role));

		case "GET /creators": {
			const query = (url.searchParams.get("q") ?? "").toLowerCase();
			const topic = url.searchParams.get("topic");
			const format = url.searchParams.get("format");

			return list(
				creators.filter(
					(creator) =>
						(creator.displayName.toLowerCase().includes(query) ||
							creator.bio.toLowerCase().includes(query)) &&
						(topic === null ||
							creator.topics.some((label) => label.value === topic)) &&
						(format === null ||
							creator.formats.some((label) => label.value === format))
				)
			);
		}

		case "GET /creators/:id": {
			const creator = creators.find((card) => card.id === firstId);

			return creator === undefined ? notFound() : ok(creator);
		}

		case "GET /creator/profile":
			return ok(profile);

		case "PUT /creator/profile": {
			const parsed = CreatorProfileInput.safeParse(body);

			if (!parsed.success) {
				return invalid(parsed.error);
			}

			const { expectedVersion, ...draft } = parsed.data;

			if (expectedVersion !== profile.version) {
				return fail("STALE_PROFILE", "Your profile changed elsewhere.");
			}

			profile = {
				...profile,
				draft,
				version: profile.version + 1,
				hasUnpublishedChanges: true,
				updatedAt: new Date().toISOString()
			};

			return ok(profile);
		}

		case "POST /creator/profile/visibility": {
			const parsed = VisibilityInput.safeParse(body);

			if (!parsed.success) {
				return invalid(parsed.error);
			}

			if (parsed.data.expectedVersion !== profile.version) {
				return fail("STALE_PROFILE", "Your profile changed elsewhere.");
			}

			const isListing = parsed.data.visibility === "LISTED";

			profile = {
				...profile,
				visibility: parsed.data.visibility,
				version: profile.version + 1,
				publishedVersion: isListing ? profile.version + 1 : profile.publishedVersion,
				hasUnpublishedChanges: isListing ? false : profile.hasUnpublishedChanges,
				updatedAt: new Date().toISOString()
			};

			return ok(profile);
		}

		case "POST /creator/enrichment":
			return ok({
				status: "READY",
				mode: "SAMPLE",
				evidence: profile.evidence,
				suggestions: {
					topics: creators[0]?.topics ?? [],
					formats: creators[0]?.formats ?? []
				},
				retrievedAt: new Date().toISOString(),
				errorCode: null,
				profileVersion: profile.version
			});

		case "GET /products":
			return list([...products.values()]);

		case "POST /products":
			return handleCreateProduct(body, role);

		case "PATCH /products/:id":
			return handleUpdateProduct(firstId, body, role);

		case "POST /campaigns/parse":
			return handleParse(body);

		case "GET /campaigns":
			return list([...campaigns.values()].map(withTotals));

		case "POST /campaigns":
			return handleCreateCampaign(body, role);

		case "GET /campaigns/:id": {
			const campaign = campaigns.get(firstId);

			return campaign === undefined ? notFound() : ok(withTotals(campaign));
		}

		case "PATCH /campaigns/:id":
			return handleUpdateCampaign(firstId, body, role);

		case "GET /campaigns/:id/matches": {
			const campaign = campaigns.get(firstId);

			return campaign === undefined
				? notFound()
				: list(
						matches.map((match) => ({
							...match,
							campaignVersion: campaign.version
						}))
					);
		}

		case "GET /campaigns/:id/report": {
			const campaign = campaigns.get(firstId);

			return campaign === undefined
				? notFound()
				: ok(sampleCampaignReport(campaign));
		}

		case "POST /deals":
			return handleCreateDeal(body, role);

		case "GET /deals": {
			const filter = url.searchParams.get("filter");
			const campaignId = url.searchParams.get("campaignId");
			const parsedFilter =
				filter === "needs_action" ||
				filter === "in_progress" ||
				filter === "closed"
					? filter
					: null;

			return list(
				[...deals.values()]
					.filter((deal) => canView(deal, role))
					.map((deal) => forViewer(deal, role))
					.filter(
						(deal) =>
							matchesFilter(deal, parsedFilter) &&
							(campaignId === null || deal.campaignId === campaignId)
					)
					.toSorted(
						(a, b) =>
							Number(needsAction(b)) - Number(needsAction(a)) ||
							b.updatedAt.localeCompare(a.updatedAt)
					)
			);
		}

		case "GET /deals/:id": {
			const deal = deals.get(firstId);

			return deal === undefined || !canView(deal, role)
				? notFound()
				: ok(forViewer(deal, role));
		}

		case "POST /deals/:id/actions":
			return handleDealAction(firstId, body, role);

		case "GET /deals/:id/report": {
			const deal = deals.get(firstId);

			return deal === undefined || !canView(deal, role)
				? notFound()
				: ok(dealReport(deal));
		}

		case "POST /deals/:id/uploads":
			return ok({
				uploadId: `fixture-upload-${crypto.randomUUID()}`,
				status: "READY",
				sizeBytes: 15_000_000
			});

		case "GET /deals/:id/assets/:id/playback":
			// A short public sample video, so the player has something to play.
			return ok({
				url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
				expiresAt: null
			});

		case "GET /admin/disputes":
			return list(
				[...deals.values()]
					.map(disputeSummary)
					.filter((summary) => summary !== null)
			);

		case "GET /admin/disputes/:id": {
			const deal = [...deals.values()].find(
				(candidate) => candidate.dispute?.id === firstId
			);

			return deal?.dispute === undefined || deal.dispute === null
				? notFound()
				: ok({
						dispute: deal.dispute,
						deal: forViewer(deal, "ADMIN"),
						history: [deal.dispute]
					});
		}

		default:
			return fail(
				"NOT_FOUND",
				`No fixture for ${method} ${url.pathname}. Add one in src/lib/api/fixtures.`
			);
	}
}
