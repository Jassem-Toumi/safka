"use client";

import type { Deal, Role } from "@/shared/contracts";

import Link from "next/link";

import { CARD, LINK, Tag } from "@/app/(app)/deals/_parts/kit";
import { headerDeadline } from "@/lib/dealForms";
import { currentTerms, dealHeadline, whoActsNext } from "@/lib/deals";
import { formatCents, formatDateTime } from "@/lib/format";
import { BudgetBar } from "@/lib/ui/BudgetBar";
import { PaymentChip, StatusChip } from "@/lib/ui/Chips";
import { TERMINAL_DEAL_STATUSES } from "@/shared/contracts";

type DealHeaderProps = {
	deal: Deal;
	viewerRole: Role;
};

/** Product, parties, amount, deadline and state (frontend spec §5). */
export function DealHeader({ deal, viewerRole }: DealHeaderProps) {
	const terms = currentTerms(deal);
	const deadline = headerDeadline(deal);
	const next = whoActsNext(deal, viewerRole);
	const isClosed = TERMINAL_DEAL_STATUSES.includes(deal.status);

	return (
		<header className={`${CARD} space-y-4`}>
			<div className="space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-2xl font-semibold tracking-tight break-words">
						{terms.product.name}
					</h1>
					{deal.sample ? <Tag tone="sample">Sample deal</Tag> : null}
				</div>
				<p className="text-fg-secondary">
					<span className="sr-only">Brand: </span>
					{deal.brand.displayName}
					<span aria-hidden="true"> · </span>
					<span className="sr-only">Creator: </span>
					{deal.creator.displayName}
				</p>
			</div>

			<dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<dt className="text-sm text-fg-muted">
						{deal.agreement === null ? "Offered amount" : "Agreed amount"}
					</dt>
					<dd className="text-lg font-semibold tabular-nums">
						{formatCents(terms.amountCents)}
					</dd>
				</div>
				{deadline !== null ? (
					<div>
						<dt className="text-sm text-fg-muted">{deadline.label}</dt>
						<dd className="font-medium">
							<time dateTime={deadline.at}>{formatDateTime(deadline.at)}</time>
						</dd>
					</div>
				) : null}
				{isClosed ? (
					<div>
						<dt className="text-sm text-fg-muted">Closed</dt>
						<dd className="font-medium">
							<time dateTime={deal.updatedAt}>
								{formatDateTime(deal.updatedAt)}
							</time>
						</dd>
					</div>
				) : null}
				<div>
					<dt className="text-sm text-fg-muted">Status</dt>
					<dd className="mt-0.5 flex flex-wrap items-center gap-2">
						<StatusChip
							status={deal.status}
							label={dealHeadline(deal, viewerRole)}
						/>
						{next !== null ? (
							<span
								className={`text-sm ${next === "Your turn" ? "font-medium text-accent-text" : "text-fg-muted"}`}
							>
								{next}
							</span>
						) : null}
					</dd>
				</div>
				<div>
					<dt className="text-sm text-fg-muted">Payment</dt>
					<dd className="mt-0.5">
						<PaymentChip status={deal.paymentStatus} />
					</dd>
				</div>
			</dl>

			{deal.isOverdue ? (
				<p className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning">
					<span className="font-medium">Overdue.</span> An agreed deadline has
					passed. Late drafts and posts can still be submitted, and either
					party can report the delay.
				</p>
			) : null}

			{viewerRole === "BRAND" && deal.campaignId !== null ? (
				<p className="text-sm">
					<Link href={`/brand/campaigns/${deal.campaignId}`} className={LINK}>
						View campaign
					</Link>
				</p>
			) : null}

			{deal.budget !== null ? (
				<section
					aria-label="Campaign budget"
					className="border-t border-divider pt-4"
				>
					<h2 className="mb-2 text-sm font-semibold text-fg-secondary">
						Campaign remaining
					</h2>
					<BudgetBar budget={deal.budget} />
				</section>
			) : null}
		</header>
	);
}
