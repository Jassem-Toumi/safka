"use client";

import type { Campaign } from "@/shared/contracts";
import type { ReactNode } from "react";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import {
	FORMAT_LABELS,
	OBJECTIVE_LABELS,
	topicText
} from "@/app/(app)/brand/_parts/briefLabels";
import {
	CampaignStatusChip,
	LINK_CLASSES,
	LoadFailed,
	LoadingNote,
	SECONDARY_LINK_CLASSES
} from "@/app/(app)/brand/_parts/ui";
import { MatchesTab } from "@/app/(app)/brand/campaigns/[id]/MatchesTab";
import { ReportTab } from "@/app/(app)/brand/campaigns/[id]/ReportTab";
import { getCampaign } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { BudgetBar } from "@/lib/ui/BudgetBar";
import { useLoad } from "@/lib/ui/useLoad";

const TABS = [
	{ id: "brief", label: "Brief" },
	{ id: "matches", label: "Matches" },
	{ id: "deals", label: "Deals" },
	{ id: "report", label: "Report" }
] as const;

type TabId = (typeof TABS)[number]["id"];

function toTab(value: string | null): TabId {
	return TABS.find((tab) => tab.id === value)?.id ?? "brief";
}

function BriefRow({ term, children }: { term: string; children: ReactNode }) {
	return (
		<div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
			<dt className="text-sm text-fg-muted">{term}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

function TextList({ items, empty }: { items: string[]; empty: string }) {
	if (items.length === 0) {
		return <span className="text-fg-subtle">{empty}</span>;
	}

	return (
		<ul className="list-disc space-y-1 pl-5">
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

function countText(count: number | null): ReactNode {
	return count === null ? (
		<span className="text-fg-subtle">Not set</span>
	) : (
		count.toLocaleString("en-US")
	);
}

/** The confirmed brief, read-only. */
function BriefTab({ campaign }: { campaign: Campaign }) {
	const { brief } = campaign;

	if (brief === null) {
		return <p className="text-fg-muted">This campaign has no brief yet.</p>;
	}

	return (
		<dl className="divide-y divide-divider rounded-lg border border-border bg-surface px-4 sm:px-5">
			<BriefRow term="Goal">{brief.goal || "Not set"}</BriefRow>
			<BriefRow term="Objective">
				{brief.objective === null
					? "Not set"
					: OBJECTIVE_LABELS[brief.objective]}
			</BriefRow>
			<BriefRow term="Topics">
				<TextList items={brief.topics.map(topicText)} empty="None" />
			</BriefRow>
			<BriefRow term="Formats">
				{brief.formats.length === 0
					? "Any format"
					: brief.formats.map((format) => FORMAT_LABELS[format]).join(", ")}
			</BriefRow>
			<BriefRow term="Talking points">
				<TextList items={brief.talkingPoints} empty="None" />
			</BriefRow>
			<BriefRow term="Restrictions">
				<TextList items={brief.restrictions} empty="None" />
			</BriefRow>
			<BriefRow term="Preferred max per video">
				{campaign.preferredMaxPerPostCents === null ? (
					<span className="text-fg-subtle">Not set</span>
				) : (
					formatCents(campaign.preferredMaxPerPostCents)
				)}
			</BriefRow>
			<BriefRow term="7-day view target">
				{countText(campaign.defaultViewTarget)}
			</BriefRow>
			<BriefRow term="7-day click target">
				{countText(campaign.defaultClickTarget)}
			</BriefRow>
			{campaign.sourcePrompt !== "" ? (
				<BriefRow term="Your prompt">{campaign.sourcePrompt}</BriefRow>
			) : null}
		</dl>
	);
}

function DealsTab() {
	return (
		<div className="space-y-3 rounded-lg border border-border bg-surface p-4 sm:p-5">
			<p className="text-fg-secondary">
				Offers and deals from this campaign are in your deal list.
			</p>
			<Link href="/brand/deals" className={SECONDARY_LINK_CLASSES}>
				Go to deals
			</Link>
		</div>
	);
}

/** `/brand/campaigns/[id]` with Brief, Matches, Deals and Report in `?tab=`. */
export function CampaignDetail() {
	const params = useParams<{ id: string }>();
	const searchParams = useSearchParams();
	const campaignId = params.id;
	const tab = toTab(searchParams.get("tab"));
	const campaign = useLoad(() => getCampaign(campaignId), [campaignId]);

	if (campaign.status === "failed" && campaign.data === null) {
		return (
			<LoadFailed
				what="this campaign"
				error={campaign.error}
				onRetry={campaign.reload}
			/>
		);
	}

	if (campaign.data === null) {
		return <LoadingNote>Loading campaign…</LoadingNote>;
	}

	const data = campaign.data;
	const title = data.brief?.title || "Untitled campaign";

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<p className="text-sm">
					<Link href="/brand/campaigns" className={LINK_CLASSES}>
						Campaigns
					</Link>
				</p>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-2xl font-semibold tracking-tight break-words">
						{title}
					</h1>
					<CampaignStatusChip status={data.status} />
				</div>
				<div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
					{data.budget === null ? (
						<p className="text-fg-muted">No budget set yet.</p>
					) : (
						<BudgetBar budget={data.budget} />
					)}
				</div>
			</div>

			<nav aria-label="Campaign sections" className="border-b border-border">
				<ul className="-mb-px flex gap-1 overflow-x-auto">
					{TABS.map(({ id, label }) => {
						const isCurrent = id === tab;

						return (
							<li key={id}>
								<Link
									href={`?tab=${id}`}
									scroll={false}
									aria-current={isCurrent ? "page" : undefined}
									className={`inline-flex min-h-11 sm:min-h-9 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
										isCurrent
											? "border-accent text-fg"
											: "border-transparent text-fg-muted hover:border-border-strong hover:text-fg"
									}`}
								>
									{label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			<div>
				<h2 className="sr-only">
					{TABS.find(({ id }) => id === tab)?.label}
				</h2>
				{tab === "brief" ? <BriefTab campaign={data} /> : null}
				{tab === "matches" ? <MatchesTab campaign={data} /> : null}
				{tab === "deals" ? <DealsTab /> : null}
				{tab === "report" ? <ReportTab campaignId={data.id} /> : null}
			</div>
		</div>
	);
}
