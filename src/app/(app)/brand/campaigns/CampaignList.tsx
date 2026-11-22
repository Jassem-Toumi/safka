"use client";

import Link from "next/link";

import {
	CampaignStatusChip,
	LINK_CLASSES,
	LoadFailed,
	LoadingNote,
	PRIMARY_LINK_CLASSES
} from "@/app/(app)/brand/_parts/ui";
import { listCampaigns } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { useLoad } from "@/lib/ui/useLoad";

/** `/brand/campaigns`: each campaign with its remaining budget and deals. */
export function CampaignList() {
	const campaigns = useLoad(() => listCampaigns(), []);
	const items = campaigns.data?.items ?? [];

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
				<Link href="/brand/campaigns/new" className={PRIMARY_LINK_CLASSES}>
					New campaign
				</Link>
			</div>

			{campaigns.status === "failed" ? (
				<LoadFailed
					what="your campaigns"
					error={campaigns.error}
					onRetry={campaigns.reload}
				/>
			) : null}

			{campaigns.data === null && campaigns.status === "loading" ? (
				<LoadingNote>Loading campaigns…</LoadingNote>
			) : null}

			{campaigns.status === "ready" && items.length === 0 ? (
				<p className="rounded-lg border border-dashed border-border-strong bg-surface p-6 text-center text-fg-secondary">
					No campaigns yet. Start one to find matching creators.
				</p>
			) : null}

			{items.length > 0 ? (
				<ul className="space-y-3">
					{items.map((campaign) => (
						<li
							key={campaign.id}
							className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-panel"
						>
							<div className="min-w-0 space-y-1">
								<div className="flex flex-wrap items-center gap-2">
									<Link
										href={`/brand/campaigns/${encodeURIComponent(campaign.id)}`}
										className={`break-words ${LINK_CLASSES}`}
									>
										{campaign.brief?.title || "Untitled campaign"}
									</Link>
									<CampaignStatusChip status={campaign.status} />
								</div>
								<p className="text-sm text-fg-muted">
									{campaign.budget === null
										? "No budget set"
										: `${formatCents(campaign.budget.remainingCents)} of ${formatCents(campaign.budget.budgetCents)} remaining`}
									{" · "}
									{campaign.dealCount}{" "}
									{campaign.dealCount === 1 ? "deal" : "deals"}
								</p>
							</div>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
