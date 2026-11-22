"use client";

import type { Campaign, MatchCard } from "@/shared/contracts";

import Link from "next/link";
import { useState } from "react";

import { OfferComposer } from "@/app/(app)/brand/_parts/OfferComposer";
import {
	LoadFailed,
	LoadingNote,
	SECONDARY_LINK_CLASSES
} from "@/app/(app)/brand/_parts/ui";
import { listMatches } from "@/lib/api";
import { rateFitLabel } from "@/lib/labels";
import { OriginLabel } from "@/lib/ui/Chips";
import { CreatorCardView } from "@/lib/ui/CreatorCardView";
import { EvidenceRow } from "@/lib/ui/Evidence";
import { Button } from "@/lib/ui/form";
import { useLoad } from "@/lib/ui/useLoad";

type MatchesTabProps = {
	campaign: Campaign;
};

type MatchItemProps = {
	match: MatchCard;
	rank: number;
	campaign: Campaign;
	isComposerOpen: boolean;
	onToggle: () => void;
};

function MatchItem({
	match,
	rank,
	campaign,
	isComposerOpen,
	onToggle
}: MatchItemProps) {
	const { creator } = match;
	const evidenceById = new Map(
		creator.evidence.map((evidence) => [evidence.id, evidence])
	);
	const composerId = `offer-${creator.id}`;
	const canOffer = campaign.status === "ACTIVE";

	return (
		<li className="space-y-3 rounded-lg border border-border bg-bg p-2 sm:p-3">
			<p className="px-2 text-sm font-medium text-fg-secondary">
				Match {rank} · {match.topicMatchPct}% topic match ·{" "}
				{rateFitLabel(match.rateFit)}
				{match.formatMatch ? " · Makes a requested format" : ""}
			</p>

			<CreatorCardView creator={creator} headingLevel={3} />

			<section
				aria-label={`Why ${creator.displayName}`}
				className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
			>
				<div>
					<h4 className="font-semibold">Why this creator</h4>
					{match.reasons.length === 0 ? (
						<p className="mt-1 text-sm text-fg-muted">No reasons given.</p>
					) : (
						<ul className="mt-2 space-y-3">
							{match.reasons.map((reason, index) => {
								const sources = reason.evidenceIds.flatMap((evidenceId) => {
									const evidence = evidenceById.get(evidenceId);

									return evidence === undefined ? [] : [evidence];
								});

								return (
									<li key={`${reason.text}-${index}`} className="space-y-2">
										<p className="flex flex-wrap items-center gap-x-2 gap-y-1">
											<span>{reason.text}</span>
											{sources.length === 0 ? (
												<OriginLabel origin="CREATOR" />
											) : null}
										</p>
										{sources.length > 0 ? (
											<ul className="space-y-2 border-l-2 border-border pl-3">
												{sources.map((evidence) => (
													<li key={evidence.id}>
														<EvidenceRow evidence={evidence} />
													</li>
												))}
											</ul>
										) : null}
									</li>
								);
							})}
						</ul>
					)}
				</div>

				<div>
					<h4 className="font-semibold">Suggested video angle</h4>
					<p className="text-sm text-fg-muted">
						A suggestion for the creator. You can edit it in the offer.
					</p>
					<p className="mt-1">
						{match.angle ?? (
							<span className="text-fg-subtle">
								None suggested. You can write one in the offer.
							</span>
						)}
					</p>
				</div>

				<div className="border-t border-divider pt-4">
					<Button
						onClick={onToggle}
						disabled={!canOffer}
						aria-expanded={isComposerOpen}
						aria-controls={isComposerOpen ? composerId : undefined}
					>
						{isComposerOpen ? "Hide offer" : "Send offer"}
						<span className="sr-only"> to {creator.displayName}</span>
					</Button>
					{!canOffer ? (
						<p className="mt-2 text-sm text-fg-muted">
							Offers can only be sent from an active campaign.
						</p>
					) : null}
				</div>
			</section>

			{isComposerOpen ? (
				<div id={composerId}>
					<OfferComposer
						recipient={match}
						campaign={campaign}
						onClose={onToggle}
					/>
				</div>
			) : null}
		</li>
	);
}

/** Ranked creators for the confirmed brief (frontend spec §4 step 4). */
export function MatchesTab({ campaign }: MatchesTabProps) {
	// Keyed on the version so an edited brief re-ranks.
	const matches = useLoad(
		() => listMatches(campaign.id),
		[campaign.id, campaign.version]
	);
	const [openCreatorId, setOpenCreatorId] = useState<string | null>(null);

	if (matches.status === "failed") {
		return (
			<LoadFailed
				what="matches"
				error={matches.error}
				onRetry={matches.reload}
			/>
		);
	}

	if (matches.data === null) {
		return <LoadingNote>Finding creators for this brief…</LoadingNote>;
	}

	const { items } = matches.data;

	if (items.length === 0) {
		return (
			<div className="space-y-3 rounded-lg border border-dashed border-border-strong bg-surface p-6 text-center">
				<p className="font-medium">No listed creators match this brief yet.</p>
				<p className="text-sm text-fg-muted">
					Try broader topics, or browse the directory.
				</p>
				<div className="flex flex-wrap justify-center gap-2">
					<Link href="?tab=brief" className={SECONDARY_LINK_CLASSES}>
						Edit brief
					</Link>
					<Link href="/brand/creators" className={SECONDARY_LINK_CLASSES}>
						Browse creators
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<p className="text-sm text-fg-muted" aria-live="polite">
				{items.length} {items.length === 1 ? "creator" : "creators"}, best
				match first.
			</p>
			<ol className="space-y-6">
				{items.map((match, index) => (
					<MatchItem
						key={match.creator.id}
						match={match}
						rank={index + 1}
						campaign={campaign}
						isComposerOpen={openCreatorId === match.creator.id}
						onToggle={() =>
							setOpenCreatorId((current) =>
								current === match.creator.id ? null : match.creator.id
							)
						}
					/>
				))}
			</ol>
		</div>
	);
}
