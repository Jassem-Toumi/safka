import type {
	AdminDisputeSummary,
	Campaign,
	CreatorCard,
	Deal,
	DemoAccount,
	DraftBatch,
	MatchCard,
	Product,
	Publication,
	Terms
} from "@/shared/contracts";

import { SEED } from "@/server/seed/ids";

// Seed data for fixture mode, following the demo story in the specs: a
// quiet-keyboard brand, a sound-test creator, a $1,200 campaign. IDs reuse the
// backend's stable seed IDs where the record exists there. Every value must
// satisfy src/shared/contracts (tests/frontend/api.test.ts checks it).

const startMs = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): string {
	return new Date(startMs + days * DAY_MS).toISOString();
}

export const BRAND = {
	id: SEED.users.brandHushkeys,
	displayName: "Hushkeys"
};
export const CREATOR = {
	id: SEED.users.creatorClackLab,
	displayName: "Clack Lab (sample)"
};
export const ADMIN = { id: SEED.users.admin, displayName: "Admin" };

export const demoAccounts: DemoAccount[] = [
	{ ...BRAND, role: "BRAND" },
	{ ...CREATOR, role: "CREATOR" },
	{ ...ADMIN, role: "ADMIN" }
];

const product: Product = {
	id: SEED.products.whisper75,
	name: "Whisper 75",
	description: "A 75% mechanical keyboard tuned for shared offices.",
	landingUrl: "https://example.com/whisper-75",
	createdAt: daysFromNow(-10),
	updatedAt: daysFromNow(-10)
};

export const products: Product[] = [product];

export const creators: CreatorCard[] = [
	{
		id: CREATOR.id,
		displayName: CREATOR.displayName,
		bio: "Fictitious sample creator. Side-by-side keyboard sound tests.",
		profileUrl: "https://www.youtube.com/@ClackLabSample",
		topics: [
			{
				value: "mechanical-keyboards",
				origin: "SAMPLE",
				evidenceIds: ["evidence-clack-1"]
			},
			{
				value: "keyboard-sound-tests",
				origin: "SAMPLE",
				evidenceIds: ["evidence-clack-1"]
			}
		],
		formats: [
			{
				value: "COMPARISON",
				origin: "SAMPLE",
				evidenceIds: ["evidence-clack-1"]
			},
			{ value: "DEMO", origin: "CREATOR", evidenceIds: [] }
		],
		rate: { minCents: 20000, maxCents: 35000 },
		typical7dViews: 18000,
		publicMetrics: [],
		evidence: [
			{
				id: "evidence-clack-1",
				url: "https://example.com/clack-quiet-sound-test",
				title: "Quiet switches sound test: stock vs. lubed (sample)",
				excerpt: "A side-by-side sound test of stock and lubed linear switches.",
				retrievedAt: daysFromNow(-2),
				publishedAt: daysFromNow(-12),
				kind: "SAMPLE"
			}
		],
		dataMode: "SAMPLE",
		expectedClicks: { low: 250, high: 600, isSample: true },
		profileVersion: 3
	},
	{
		id: SEED.users.creatorDeskSetup,
		displayName: "Desk Setup Daily (sample)",
		bio: "Fictitious sample creator. Home office tours and desk gear.",
		profileUrl: "https://www.youtube.com/@DeskSetupDailySample",
		topics: [{ value: "desk-setups", origin: "CREATOR", evidenceIds: [] }],
		formats: [{ value: "STORY", origin: "CREATOR", evidenceIds: [] }],
		rate: { minCents: 50000, maxCents: 90000 },
		typical7dViews: 60000,
		publicMetrics: [],
		evidence: [],
		dataMode: "SELF_REPORTED",
		expectedClicks: null,
		profileVersion: 1
	},
	{
		id: SEED.users.creatorThock,
		displayName: "Thock & Type (sample)",
		bio: "Fictitious sample creator. Custom keyboard builds.",
		profileUrl: "https://www.youtube.com/@ThockTypeSample",
		topics: [
			{ value: "mechanical-keyboards", origin: "CREATOR", evidenceIds: [] }
		],
		formats: [{ value: "TUTORIAL", origin: "CREATOR", evidenceIds: [] }],
		rate: null,
		typical7dViews: null,
		publicMetrics: [],
		evidence: [],
		dataMode: "SELF_REPORTED",
		expectedClicks: null,
		profileVersion: 1
	}
];

export const campaigns: Campaign[] = [
	{
		id: "fixture-campaign-quiet-office",
		productId: product.id,
		sourcePrompt:
			"Promote our quiet mechanical keyboard to people building shared-office setups. Budget $1,200.",
		version: 2,
		status: "ACTIVE",
		brief: {
			title: "Quiet keyboards for shared offices",
			goal: "Show that a mechanical keyboard can be quiet enough to share a room.",
			objective: "AWARENESS",
			topics: ["mechanical-keyboards", "desk-setups"],
			formats: ["COMPARISON", "REVIEW"],
			talkingPoints: ["Dampened case", "Silent linear switches"],
			restrictions: ["No competitor names in the title"]
		},
		// Three agreed seeded deals at $300 commit $900 of $1,200 (the fixture
		// handler recomputes these from the deals on every read).
		budget: {
			budgetCents: 120000,
			committedCents: 90000,
			spentCents: 0,
			remainingCents: 30000
		},
		preferredMaxPerPostCents: 35000,
		defaultViewTarget: 10000,
		defaultClickTarget: 600,
		dealCount: 4,
		hasOpenNegotiations: true,
		createdAt: daysFromNow(-3),
		updatedAt: daysFromNow(-1)
	}
];

const [clackLab, deskSetup, thock] = creators;

export const matches: MatchCard[] = [
	...(clackLab === undefined
		? []
		: [
				{
					creator: clackLab,
					topicMatchPct: 50,
					formatMatch: true,
					rateFit: "WITHIN_PREFERENCE" as const,
					reasons: [
						{
							text: "Publishes keyboard sound tests",
							evidenceIds: ["evidence-clack-1"]
						}
					],
					angle:
						"Let viewers hear the difference between the stock and upgraded build.",
					campaignVersion: 2
				}
			]),
	...(thock === undefined
		? []
		: [
				{
					creator: thock,
					topicMatchPct: 50,
					formatMatch: false,
					rateFit: "UNKNOWN" as const,
					reasons: [
						{
							text: "Covers mechanical keyboards (creator provided)",
							evidenceIds: []
						}
					],
					angle: "Walk through the build and finish with a typing test.",
					campaignVersion: 2
				}
			]),
	...(deskSetup === undefined
		? []
		: [
				{
					creator: deskSetup,
					topicMatchPct: 50,
					formatMatch: false,
					rateFit: "ABOVE_PREFERENCE" as const,
					reasons: [{ text: "Covers desk setups (creator provided)", evidenceIds: [] }],
					angle: "Show the keyboard in a full shared-office desk tour.",
					campaignVersion: 2
				}
			])
];

export function makeTerms(amountCents: number): Terms {
	return {
		amountCents,
		format: "COMPARISON",
		brief: "A sound-focused comparison of the Whisper 75 in a shared office.",
		angle: "Stock vs. upgraded: let viewers hear it.",
		talkingPoints: ["Dampened case", "Silent linear switches"],
		restrictions: ["No competitor names in the title"],
		disclosure: "Say it is sponsored in the first 30 seconds and tag #ad.",
		draftDueAt: daysFromNow(7),
		publishDueAt: daysFromNow(14),
		viewTarget: 10000,
		clickTarget: 600,
		currency: "USD",
		platform: "YOUTUBE",
		product: {
			id: product.id,
			name: product.name,
			description: product.description,
			landingUrl: product.landingUrl
		}
	};
}

function baseDeal(id: string, terms: Terms): Deal {
	return {
		id,
		version: 1,
		status: "NEGOTIATING",
		paymentStatus: "NONE",
		brand: BRAND,
		creator: CREATOR,
		campaignId: "fixture-campaign-quiet-office",
		budget: null,
		latestProposal: {
			id: `${id}-proposal-1`,
			revision: 1,
			authorRole: "BRAND",
			expiresAt: daysFromNow(7),
			createdAt: daysFromNow(-1),
			terms
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
				createdAt: daysFromNow(-1),
				note: null
			}
		],
		sample: true,
		createdAt: daysFromNow(-1),
		updatedAt: daysFromNow(-1),
		isOverdue: false
	};
}

function agreed(deal: Deal): Deal {
	return {
		...deal,
		agreement: {
			proposalId: deal.latestProposal.id,
			acceptedAt: daysFromNow(-1),
			terms: deal.latestProposal.terms
		}
	};
}

const draftBatch: DraftBatch = {
	id: "fixture-batch-1",
	round: 1,
	submittedAt: daysFromNow(-0.5),
	late: false,
	changeRequest: null,
	assets: [
		{ id: "fixture-asset-1", label: "Option 1", sizeBytes: 14_000_000 },
		{ id: "fixture-asset-2", label: "Option 2", sizeBytes: 16_500_000 }
	]
};

const publication: Publication = {
	url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
	videoId: "aaaaaaaaaaa",
	publishedAt: daysFromNow(-0.2),
	submittedAt: daysFromNow(-0.2),
	late: false,
	sample: true
};

/** The completed deal whose report shows the labeled sample metrics. */
export const SAMPLE_REPORT_DEAL_ID = "fixture-deal-completed";

/** One deal per significant UI state (frontend spec §7). */
export const deals: Deal[] = [
	baseDeal("fixture-deal-offer", makeTerms(25000)),
	{
		...agreed(baseDeal("fixture-deal-drafts", makeTerms(30000))),
		status: "DRAFT_REVIEW",
		draftBatches: [draftBatch]
	},
	{
		...agreed(baseDeal("fixture-deal-published", makeTerms(30000))),
		status: "PUBLISHED",
		paymentStatus: "HELD",
		draftBatches: [draftBatch],
		approvedAssetId: "fixture-asset-1",
		publication,
		confirmations: [{ role: "CREATOR", confirmedAt: daysFromNow(-0.1) }]
	},
	{
		...agreed(baseDeal("fixture-deal-disputed", makeTerms(30000))),
		status: "DISPUTED",
		paymentStatus: "HELD",
		draftBatches: [draftBatch],
		approvedAssetId: "fixture-asset-2",
		publication,
		dispute: {
			id: "fixture-dispute-1",
			dealId: "fixture-deal-disputed",
			openedAt: daysFromNow(-0.1),
			openedByRole: "BRAND",
			code: "MISSING_DISCLOSURE",
			reason: "The video does not say it is sponsored.",
			priorStatus: "PUBLISHED",
			resolvedAt: null,
			resolution: null,
			resolutionReason: null
		}
	},
	{
		...agreed(
			baseDeal(SAMPLE_REPORT_DEAL_ID, {
				...makeTerms(30000),
				viewTarget: 20000
			})
		),
		campaignId: null,
		status: "COMPLETED",
		paymentStatus: "RELEASED",
		draftBatches: [draftBatch],
		approvedAssetId: "fixture-asset-1",
		// Published long enough ago that its 7-day window has closed.
		publication: {
			...publication,
			publishedAt: daysFromNow(-9),
			submittedAt: daysFromNow(-9)
		},
		confirmations: [
			{ role: "CREATOR", confirmedAt: daysFromNow(-8) },
			{ role: "BRAND", confirmedAt: daysFromNow(-8) }
		]
	}
];

export function disputeSummary(deal: Deal): AdminDisputeSummary | null {
	if (deal.dispute === null) {
		return null;
	}

	return {
		...deal.dispute,
		brand: deal.brand,
		creator: deal.creator,
		paymentStatus: deal.paymentStatus,
		amountCents: deal.latestProposal.terms.amountCents
	};
}
