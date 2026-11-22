"use client";

import type { Campaign, DealListFilter, MatchCard, Product } from "@/shared/contracts";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { getCampaign, getCampaignReport, listMatches, listProducts } from "@/lib/api";
import { errorMessage, isNotFound, useLoad } from "@/lib/useLoad";

import { BriefEditor } from "../../../../_components/BriefEditor";
import { BudgetBar } from "../../../../_components/budget";
import { Avatar, DataModeBadge, LabelChip, rateText } from "../../../../_components/creator";
import { DealList } from "../../../../_components/DealList";
import { OfferComposer } from "../../../../_components/OfferComposer";
import { CampaignReportView } from "../../../../_components/Report";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, ExternalLink, Loading, PageHeader, Tabs } from "../../../../_components/ui";
import { NotAvailable } from "../../../AppShell";

type Tab = "brief" | "matches" | "deals" | "report";

export default function CampaignDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const data = useLoad(async () => {
		const [campaign, products] = await Promise.all([getCampaign(id), listProducts()]);

		return { campaign, products: products.items };
	}, id);

	if (data.status === "loading") return <Loading />;
	if (data.status === "failed" && isNotFound(data.error)) return <NotAvailable home="/brand/campaigns" />;
	if (data.data === null) return <Alert>{errorMessage(data.error)}</Alert>;

	const { campaign, products } = data.data;
	const requested = (params.get("tab") ?? "") as Tab;
	const tab: Tab = campaign.status === "DRAFT" ? "brief" : ["brief", "matches", "deals", "report"].includes(requested) ? requested : "matches";
	const product = products.find((p) => p.id === campaign.productId);
	const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

	return (
		<>
			<Link href="/brand/campaigns" className="mb-6 inline-block text-sm text-muted hover:text-ink">
				← Campaigns
			</Link>
			<PageHeader
				eyebrow={product?.name ?? "Campaign"}
				title={campaign.brief?.title || "Untitled draft"}
				actions={
					campaign.status === "ACTIVE" ? <Badge tone="positive">Active</Badge> : campaign.status === "DRAFT" ? <Badge tone="info">Draft</Badge> : <Badge>Closed</Badge>
				}
			/>

			{campaign.budget && campaign.status !== "DRAFT" ? (
				<Card className="mb-8 p-5">
					<BudgetBar budget={campaign.budget} />
					<p className="mt-3 text-xs text-muted">Agreed deals reserve budget. Released payments count as spent.</p>
				</Card>
			) : null}

			{campaign.status !== "DRAFT" ? (
				<Tabs
					label="Campaign views"
					value={tab}
					onChange={setTab}
					tabs={[
						{ value: "matches", label: "Matches" },
						{ value: "brief", label: "Brief" },
						{ value: "deals", label: `Deals · ${campaign.dealCount}` },
						{ value: "report", label: "Report" }
					]}
				/>
			) : null}

			{tab === "brief" ? (
				<BriefEditor key={campaign.version} products={products} campaign={campaign} onSaved={(c) => data.setData({ campaign: c, products })} onProductsChanged={() => void data.reload()} />
			) : null}
			{tab === "matches" ? <Matches campaign={campaign} products={products} onEditBrief={() => setTab("brief")} /> : null}
			{tab === "deals" ? <CampaignDeals campaignId={campaign.id} /> : null}
			{tab === "report" ? <CampaignReportTab campaignId={campaign.id} /> : null}
		</>
	);
}

function CampaignDeals({ campaignId }: { campaignId: string }) {
	const [filter, setFilter] = useState<DealListFilter>("needs_action");

	return <DealList viewer="BRAND" filter={filter} onFilterChange={setFilter} campaignId={campaignId} />;
}

function CampaignReportTab({ campaignId }: { campaignId: string }) {
	const report = useLoad(() => getCampaignReport(campaignId), campaignId);

	if (report.status === "loading") return <Loading />;
	if (report.data === null) return <Alert>{errorMessage(report.error)}</Alert>;

	return <CampaignReportView report={report.data} />;
}

function Matches({ campaign, products, onEditBrief }: { campaign: Campaign; products: Product[]; onEditBrief: () => void }) {
	const matches = useLoad(() => listMatches(campaign.id), `${campaign.id}|${campaign.version}`);
	const [composing, setComposing] = useState<MatchCard | null>(null);

	if (campaign.status === "CLOSED") return <EmptyState title="This campaign is closed" description="Matches are shown for active campaigns." />;
	if (matches.status === "loading") return <Loading label="Ranking listed creators…" />;
	if (matches.data === null) return <Alert>{errorMessage(matches.error)}</Alert>;

	const items = matches.data.items;
	const stale = items.some((m) => m.campaignVersion !== campaign.version);

	if (items.length === 0) {
		return (
			<EmptyState
				title="No listed creators cover these topics yet"
				description="Broaden the topics in the brief, or browse the directory."
				action={
					<>
						<Button variant="secondary" onClick={onEditBrief}>
							Edit brief
						</Button>
						<ButtonLink href="/brand/creators">Browse creators</ButtonLink>
					</>
				}
			/>
		);
	}

	return (
		<>
			{stale ? (
				<div className="mb-4">
					<Alert tone="info">
						The brief changed.{" "}
						<button type="button" className="font-medium underline" onClick={() => void matches.reload()}>
							Refresh matches
						</button>
					</Alert>
				</div>
			) : null}
			<p className="mb-4 text-sm text-muted">Ranked by topic fit, then format, rate fit and reach. Every tag links back to its source.</p>
			<ol className="space-y-4">
				{items.map((m, i) => (
					<MatchItem key={m.creator.id} match={m} rank={i + 1} onOffer={() => setComposing(m)} />
				))}
			</ol>
			{composing ? (
				<OfferComposer open onClose={() => setComposing(null)} creator={composing.creator} products={products} campaign={campaign} angle={composing.angle} />
			) : null}
		</>
	);
}

const RATE_FIT: Record<MatchCard["rateFit"], { label: string; tone: "positive" | "neutral" | "warning" }> = {
	WITHIN_PREFERENCE: { label: "Rate fits", tone: "positive" },
	UNKNOWN: { label: "Rate unknown", tone: "neutral" },
	ABOVE_PREFERENCE: { label: "Rate above budget", tone: "warning" }
};

function MatchItem({ match, rank, onOffer }: { match: MatchCard; rank: number; onOffer: () => void }) {
	const { creator } = match;
	const evidence = new Map(creator.evidence.map((e) => [e.id, e]));
	const fit = RATE_FIT[match.rateFit];

	return (
		<li>
			<Card as="article" className="overflow-hidden">
				<div className="flex flex-wrap items-start gap-4 p-5">
					<span className="w-6 pt-2 text-sm font-semibold text-faint tabular">{rank}</span>
					<Avatar name={creator.displayName} />
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<Link href={`/brand/creators/${creator.id}`} className="font-semibold hover:underline hover:underline-offset-4">
								{creator.displayName}
							</Link>
							<DataModeBadge mode={creator.dataMode} />
						</div>
						<div className="mt-2 flex flex-wrap gap-1.5">
							{creator.formats.map((f) => (
								<LabelChip key={f.value} label={f} kind="format" />
							))}
							{creator.topics.map((t) => (
								<LabelChip key={t.value} label={t} kind="topic" />
							))}
						</div>
					</div>
					<div className="flex items-center gap-5">
						<div className="text-right">
							<p className="text-2xl font-semibold tracking-tight tabular">{match.topicMatchPct}%</p>
							<p className="text-xs text-muted">topic match</p>
						</div>
						<Button onClick={onOffer} aria-label={`Send offer to ${creator.displayName}`}>
							Send offer
						</Button>
					</div>
				</div>

				<div className="grid gap-5 border-t border-line bg-canvas/50 p-5 md:grid-cols-[1fr_320px]">
					<div>
						<h3 className="text-xs font-medium tracking-wide text-muted uppercase">Why this creator</h3>
						<ul className="mt-2 space-y-2 text-sm">
							{match.reasons.map((r) => (
								<li key={r.text} className="flex gap-2">
									<span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink" />
									<span>
										{r.text}
										{r.evidenceIds.map((eid, i) => {
											const e = evidence.get(eid);
											const n = r.evidenceIds.length > 1 ? ` ${i + 1}` : "";

											return e ? (
												<span key={eid} className="ml-2 text-xs whitespace-nowrap">
													<ExternalLink href={e.url}>{e.kind === "PUBLIC" ? `Source${n}` : `Sample source${n}`}</ExternalLink>
												</span>
											) : null;
										})}
									</span>
								</li>
							))}
						</ul>
						<div className="mt-3 flex flex-wrap gap-2">
							<Badge tone={fit.tone}>{fit.label}</Badge>
							<Badge>{rateText(creator.rate)}</Badge>
							{match.formatMatch ? <Badge tone="positive">Format match</Badge> : <Badge>Different format</Badge>}
						</div>
					</div>
					{match.angle ? (
						<div className="rounded-xl border border-line bg-surface p-4">
							<h3 className="text-xs font-medium tracking-wide text-muted uppercase">Suggested video angle</h3>
							<p className="mt-2 text-sm">{match.angle}</p>
							<p className="mt-2 text-xs text-faint">A suggestion for the creator. Editable in the offer.</p>
						</div>
					) : null}
				</div>
			</Card>
		</li>
	);
}
