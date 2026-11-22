import type { ReactNode } from "react";
import type { Deal } from "@/shared/contracts";

import { CARD } from "@/app/(app)/deals/_parts/kit";
import { currentTerms } from "@/lib/deals";
import { formatDateTime } from "@/lib/format";
import { ExternalLink } from "@/lib/ui/Evidence";

type TermsSummaryProps = {
	deal: Deal;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function sentenceCase(value: string): string {
	const words = value.replaceAll("_", " ").toLowerCase();

	return words.charAt(0).toUpperCase() + words.slice(1);
}

function Row({ term, children }: { term: string; children: ReactNode }) {
	return (
		<div className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
			<dt className="text-sm text-zinc-600">{term}</dt>
			<dd className="break-words">{children}</dd>
		</div>
	);
}

function ItemList({ items }: { items: string[] }) {
	if (items.length === 0) {
		return <span className="text-zinc-500">None</span>;
	}

	return (
		<ul className="list-disc space-y-0.5 pl-5">
			{items.map((item, index) => (
				<li key={`${index}-${item}`}>{item}</li>
			))}
		</ul>
	);
}

function target(value: number | null, noun: string): string {
	return value === null
		? "No target set"
		: `${numberFormatter.format(value)} ${noun}`;
}

/** The terms in force; while negotiating, the latest proposal and its expiry. */
export function TermsSummary({ deal }: TermsSummaryProps) {
	const terms = currentTerms(deal);
	const proposal = deal.latestProposal;
	const isNegotiating = deal.status === "NEGOTIATING";
	const author =
		proposal.authorRole === "BRAND"
			? deal.brand.displayName
			: deal.creator.displayName;

	return (
		<section aria-labelledby="terms-heading" className={CARD}>
			<h2 id="terms-heading" className="text-lg font-semibold">
				{deal.agreement === null ? "Proposed terms" : "Agreed terms"}
			</h2>
			{isNegotiating ? (
				<p className="mt-1 text-sm text-zinc-600">
					{proposal.revision === 1
						? "Offer"
						: `Counteroffer (proposal ${proposal.revision})`}{" "}
					from {author}. Expires{" "}
					<time dateTime={proposal.expiresAt}>
						{formatDateTime(proposal.expiresAt)}
					</time>
					.
				</p>
			) : null}
			{deal.agreement !== null ? (
				<p className="mt-1 text-sm text-zinc-600">
					Agreed{" "}
					<time dateTime={deal.agreement.acceptedAt}>
						{formatDateTime(deal.agreement.acceptedAt)}
					</time>
				</p>
			) : null}

			<dl className="mt-4 space-y-3">
				<Row term="Product">
					<span className="font-medium">{terms.product.name}</span>
					{terms.product.description ? (
						<span className="block text-sm text-zinc-700">
							{terms.product.description}
						</span>
					) : null}
					{terms.product.landingUrl !== null ? (
						<span className="block text-sm">
							<ExternalLink href={terms.product.landingUrl}>
								Product page
							</ExternalLink>
						</span>
					) : null}
				</Row>
				<Row term="Format">YouTube {sentenceCase(terms.format)}</Row>
				<Row term="Brief">
					<span className="whitespace-pre-line">{terms.brief}</span>
				</Row>
				<Row term="Suggested angle">
					{terms.angle ?? <span className="text-zinc-500">None</span>}
				</Row>
				<Row term="Talking points">
					<ItemList items={terms.talkingPoints} />
				</Row>
				<Row term="Restrictions">
					<ItemList items={terms.restrictions} />
				</Row>
				<Row term="Disclosure">{terms.disclosure}</Row>
				<Row term="Draft due">
					<time dateTime={terms.draftDueAt}>
						{formatDateTime(terms.draftDueAt)}
					</time>
				</Row>
				<Row term="Publish by">
					<time dateTime={terms.publishDueAt}>
						{formatDateTime(terms.publishDueAt)}
					</time>
				</Row>
				<Row term="First 7 days">
					<span className="block">{target(terms.viewTarget, "views")}</span>
					<span className="block">{target(terms.clickTarget, "clicks")}</span>
					<span className="block text-sm text-zinc-500">
						Targets are advisory and don’t affect payment.
					</span>
				</Row>
			</dl>
		</section>
	);
}
