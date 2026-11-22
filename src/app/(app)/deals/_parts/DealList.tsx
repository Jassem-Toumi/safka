"use client";

import type { Deal, DealListFilter, Me } from "@/shared/contracts";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { CARD, LINK, Tag } from "@/app/(app)/deals/_parts/kit";
import { listDeals } from "@/lib/api";
import { DEAL_FILTERS, parseDealFilter } from "@/lib/dealForms";
import { currentTerms, dealHeadline, whoActsNext } from "@/lib/deals";
import { formatCents, formatDateTime } from "@/lib/format";
import { Avatar } from "@/lib/ui/Avatar";
import { StatusChip } from "@/lib/ui/Chips";
import { Button } from "@/lib/ui/form";
import { useMe } from "@/lib/ui/me";
import { useLoad } from "@/lib/ui/useLoad";

type DealListProps = {
	heading: string;
};

const EMPTY_TEXT: Record<DealListFilter, string> = {
	needs_action: "Nothing needs your attention right now.",
	in_progress: "No deals are waiting on someone else.",
	closed: "No closed deals yet."
};

function EmptyState({ me, filter }: { me: Me; filter: DealListFilter }) {
	if (me.role === "CREATOR" && !me.profileReady) {
		return (
			<div className={CARD}>
				<p className="font-medium">{EMPTY_TEXT[filter]}</p>
				<p className="mt-1 text-zinc-600">
					Brands can find you and send offers once your profile is listed.
				</p>
				<p className="mt-3">
					<Link href="/creator/onboarding" className={LINK}>
						Finish profile
					</Link>
				</p>
			</div>
		);
	}

	return (
		<div className={CARD}>
			<p className="font-medium">{EMPTY_TEXT[filter]}</p>
			{me.role === "BRAND" && filter === "needs_action" ? (
				<p className="mt-3">
					<Link href="/brand/creators" className={LINK}>
						Find creators to send an offer
					</Link>
				</p>
			) : null}
		</div>
	);
}

function DealRow({ deal, me }: { deal: Deal; me: Me }) {
	const isBrand = me.role === "BRAND";
	const other = isBrand ? deal.creator : deal.brand;
	const terms = currentTerms(deal);
	const next = whoActsNext(deal, me.role);

	return (
		<li
			className={`${CARD} relative hover:border-zinc-300 hover:bg-zinc-50`}
		>
			<div className="flex items-start gap-3">
				<Avatar name={other.displayName} seed={other.id} />
				<div className="min-w-0 flex-1 space-y-1.5">
					<div className="flex flex-wrap items-baseline justify-between gap-x-3">
						<h2 className="font-semibold break-words">
							<Link
								href={`/deals/${deal.id}`}
								className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-indigo-600"
							>
								{other.displayName}
							</Link>
						</h2>
						<p className="font-medium tabular-nums">
							<span className="sr-only">Amount: </span>
							{formatCents(terms.amountCents)}
						</p>
					</div>
					<p className="break-words text-zinc-700">{terms.product.name}</p>
					<div className="flex flex-wrap items-center gap-2">
						<StatusChip
							status={deal.status}
							label={dealHeadline(deal, me.role)}
						/>
						{next !== null ? (
							<span
								className={`text-sm ${next === "Your turn" ? "font-medium text-indigo-800" : "text-zinc-600"}`}
							>
								{next}
							</span>
						) : null}
						{deal.isOverdue ? <Tag tone="warning">Overdue</Tag> : null}
						{deal.sample ? <Tag tone="sample">Sample</Tag> : null}
					</div>
					<p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
						<span>
							Updated{" "}
							<time dateTime={deal.updatedAt}>
								{formatDateTime(deal.updatedAt)}
							</time>
						</span>
						{isBrand && deal.campaignId !== null ? (
							<Link
								href={`/brand/campaigns/${deal.campaignId}`}
								className={`${LINK} relative z-10 inline-flex min-h-6 items-center`}
							>
								View campaign
							</Link>
						) : null}
					</p>
				</div>
			</div>
		</li>
	);
}

/** Brand deals and creator inbox (frontend spec §2), filtered by `?filter=`. */
export function DealList({ heading }: DealListProps) {
	const me = useMe();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const filter = parseDealFilter(searchParams.get("filter"));
	const { status, data, error, reload } = useLoad(
		async () => ({ filter, items: (await listDeals({ filter })).items }),
		[filter],
		{ refetchOnFocus: true }
	);

	// A reload keeps the previous data; don't show one tab's deals on another.
	const deals = data?.filter === filter ? data.items : null;

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>

			<nav aria-label="Filter deals">
				<ul className="flex gap-1 overflow-x-auto border-b border-zinc-200">
					{DEAL_FILTERS.map(({ value, label }) => {
						const isCurrent = value === filter;

						return (
							<li key={value} className="shrink-0">
								<Link
									href={`${pathname}?filter=${value}`}
									replace
									scroll={false}
									aria-current={isCurrent ? "page" : undefined}
									className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
										isCurrent
											? "border-indigo-600 text-zinc-900"
											: "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
									}`}
								>
									{label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			<div aria-live="polite" className="sr-only">
				{status === "loading" ? "Loading deals…" : ""}
				{status === "ready" && deals !== null
					? `${deals.length} ${deals.length === 1 ? "deal" : "deals"}`
					: ""}
			</div>

			{status === "failed" ? (
				<div role="alert" className="space-y-3">
					<p>We couldn’t load your deals. {error.message}</p>
					<Button variant="secondary" onClick={reload}>
						Try again
					</Button>
				</div>
			) : null}

			{deals === null && status === "loading" ? (
				<p className="text-zinc-600">Loading deals…</p>
			) : null}

			{deals !== null && deals.length === 0 && status !== "failed" ? (
				<EmptyState me={me} filter={filter} />
			) : null}

			{deals !== null && deals.length > 0 ? (
				<ul className="space-y-3" aria-busy={status === "loading"}>
					{deals.map((deal) => (
						<DealRow key={deal.id} deal={deal} me={me} />
					))}
				</ul>
			) : null}
		</div>
	);
}
