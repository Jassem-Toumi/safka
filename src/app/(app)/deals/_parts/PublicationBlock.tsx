"use client";

import type { Deal, Role } from "@/shared/contracts";

import { CARD, Tag } from "@/app/(app)/deals/_parts/kit";
import { confirmationRows } from "@/lib/dealForms";
import { formatDateTime } from "@/lib/format";
import { ExternalLink } from "@/lib/ui/Evidence";

type PublicationBlockProps = {
	deal: Deal;
	viewerRole: Role;
};

/** The published link, the creator's attestation and both confirmations. */
export function PublicationBlock({ deal, viewerRole }: PublicationBlockProps) {
	const { publication } = deal;

	if (publication === null) {
		return null;
	}

	const rows = confirmationRows(deal);
	const confirmedCount = rows.filter((row) => row.confirmedAt !== null).length;

	return (
		<section aria-labelledby="publication-heading" className={CARD}>
			<div className="flex flex-wrap items-center gap-2">
				<h2 id="publication-heading" className="text-lg font-semibold">
					Published post
				</h2>
				{publication.sample ? <Tag tone="sample">Sample link</Tag> : null}
				{publication.late ? <Tag tone="warning">Published late</Tag> : null}
			</div>

			<p className="mt-3 break-all">
				<ExternalLink href={publication.url}>{publication.url}</ExternalLink>
			</p>
			<dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-zinc-600">Went live</dt>
					<dd>
						<time dateTime={publication.publishedAt}>
							{formatDateTime(publication.publishedAt)}
						</time>
					</dd>
				</div>
				<div>
					<dt className="text-zinc-600">Link submitted</dt>
					<dd>
						<time dateTime={publication.submittedAt}>
							{formatDateTime(publication.submittedAt)}
						</time>
					</dd>
				</div>
			</dl>
			<p className="mt-3 text-sm text-zinc-700">
				{deal.creator.displayName} confirmed they used the approved draft and
				followed the offer requirements.
			</p>

			<h3 className="mt-4 font-semibold">
				Delivery confirmations ({confirmedCount} of 2)
			</h3>
			<ul className="mt-2 space-y-1 text-sm">
				{rows.map(({ role, name, confirmedAt }) => (
					<li key={role} className="flex flex-wrap items-center gap-x-2">
						<span className="font-medium">
							{name}
							{role === viewerRole ? " (you)" : ""}
						</span>
						{confirmedAt !== null ? (
							<span className="text-emerald-800">
								<span aria-hidden="true">✓ </span>Confirmed{" "}
								<time dateTime={confirmedAt}>{formatDateTime(confirmedAt)}</time>
							</span>
						) : (
							<span className="text-zinc-600">Not confirmed yet</span>
						)}
					</li>
				))}
			</ul>
			{confirmedCount < 2 && deal.status === "PUBLISHED" ? (
				<p className="mt-2 text-sm text-zinc-600">
					The simulated payment is released when both have confirmed.
				</p>
			) : null}
		</section>
	);
}
