"use client";

import type { Deal, DealListFilter, Role } from "@/shared/contracts";

import type { ReactNode } from "react";

import Link from "next/link";

import { listDeals } from "@/lib/api";
import { dealStateLabel, dealStatusTone, nextActionText, relativeHint } from "@/lib/dealDisplay";
import { formatCents, formatDateTime } from "@/lib/format";
import { errorMessage, useLoad } from "@/lib/useLoad";

import { Alert, Badge, EmptyState, Loading, Tabs } from "./ui";

const FILTERS: readonly { value: DealListFilter; label: string }[] = [
	{ value: "needs_action", label: "Needs action" },
	{ value: "in_progress", label: "In progress" },
	{ value: "closed", label: "Closed" }
];

/** Inbox for either side, with server-side filters (frontend spec §2). */
export function DealList({
	viewer,
	filter,
	onFilterChange,
	campaignId,
	empty
}: {
	viewer: Role;
	filter: DealListFilter;
	onFilterChange: (f: DealListFilter) => void;
	campaignId?: string;
	empty?: ReactNode;
}) {
	const deals = useLoad(() => listDeals({ filter, campaignId }), `${filter}|${campaignId ?? ""}`, { refreshOnFocus: true });

	return (
		<div>
			<Tabs label="Deal filters" tabs={FILTERS} value={filter} onChange={onFilterChange} />
			{deals.status === "loading" ? <Loading label="Loading deals…" /> : null}
			{deals.status === "failed" ? <Alert>{errorMessage(deals.error)}</Alert> : null}
			{deals.data?.items.length === 0 ? (
				empty ?? <EmptyState title={filter === "needs_action" ? "You’re all caught up" : filter === "in_progress" ? "Nothing in progress" : "No closed deals yet"} />
			) : null}
			{deals.data && deals.data.items.length > 0 ? (
				<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
					{deals.data.items.map((deal) => (
						<DealRow key={deal.id} deal={deal} viewer={viewer} />
					))}
				</ul>
			) : null}
		</div>
	);
}

function DealRow({ deal, viewer }: { deal: Deal; viewer: Role }) {
	const terms = deal.agreement?.terms ?? deal.latestProposal.terms;
	const other = viewer === "CREATOR" ? deal.brand.displayName : deal.creator.displayName;
	const next = nextActionText(deal, viewer);
	const yourMove = deal.nextActionRole === viewer;

	return (
		<li>
			<Link href={`/deals/${deal.id}`} className="grid gap-2 px-5 py-4 transition-colors hover:bg-canvas/60 sm:grid-cols-[1fr_auto] sm:items-center">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium">{other}</span>
						<Badge tone={dealStatusTone(deal.status)}>{dealStateLabel(deal, viewer)}</Badge>
						{deal.sample ? <Badge tone="warning">Sample</Badge> : null}
						{deal.isOverdue ? <Badge tone="danger">Overdue</Badge> : null}
					</div>
					<p className="mt-1 truncate text-sm text-muted">
						{terms.product.name}
						{viewer === "BRAND" && deal.campaignId ? " · Campaign offer" : viewer === "BRAND" ? " · Direct offer" : ""}
					</p>
				</div>
				<div className="flex items-center justify-between gap-6 sm:justify-end">
					<div className="text-left sm:text-right">
						<p className="font-semibold tabular">{formatCents(terms.amountCents)}</p>
						<p className="text-xs text-muted">{deal.agreement ? "Agreed" : `Proposal r${deal.latestProposal.revision}`}</p>
					</div>
					<div className="w-40 text-right">
						{next ? <p className={yourMove ? "text-sm font-medium text-ink" : "text-sm text-muted"}>{yourMove ? "● " : ""}{next}</p> : null}
						<p className="text-xs text-faint" title={formatDateTime(deal.updatedAt)}>
							Updated {relativeHint(deal.updatedAt)}
						</p>
					</div>
				</div>
			</Link>
		</li>
	);
}
