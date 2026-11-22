"use client";

import type { Deal } from "@/shared/contracts";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ActionPanel } from "@/app/(app)/deals/_parts/ActionPanel";
import { DealHeader } from "@/app/(app)/deals/_parts/DealHeader";
import { DisputeBlock } from "@/app/(app)/deals/_parts/DisputeBlock";
import { DraftViewer } from "@/app/(app)/deals/_parts/DraftViewer";
import { LINK } from "@/app/(app)/deals/_parts/kit";
import { PublicationBlock } from "@/app/(app)/deals/_parts/PublicationBlock";
import { TermsSummary } from "@/app/(app)/deals/_parts/TermsSummary";
import { Timeline } from "@/app/(app)/deals/_parts/Timeline";
import { useDealAction } from "@/app/(app)/deals/_parts/useDealAction";
import { ApiError, getDeal } from "@/lib/api";
import { homePathFor } from "@/lib/routing";
import { Button } from "@/lib/ui/form";
import { useMe } from "@/lib/ui/me";
import { useLoad } from "@/lib/ui/useLoad";

/** The newer of the loaded deal and the one an action returned. */
function newest(loaded: Deal | null, acted: Deal | null): Deal | null {
	if (acted === null || acted.id !== loaded?.id) {
		return loaded ?? acted;
	}

	return acted.version > loaded.version ? acted : loaded;
}

export function DealWorkspace() {
	const me = useMe();
	const params = useParams<{ id: string }>();
	const dealId = params.id;
	const load = useLoad(() => getDeal(dealId), [dealId], {
		refetchOnFocus: true
	});
	const [acted, setActed] = useState<Deal | null>(null);
	const runner = useDealAction(dealId, {
		onDeal: setActed,
		reload: load.reload
	});
	const deal = newest(load.data, acted);
	const backHref = me.role === "BRAND" ? "/brand/deals" : homePathFor(me);
	const backLabel = me.role === "BRAND" ? "All deals" : "Inbox";

	if (deal === null) {
		if (load.status === "failed") {
			const isMissing =
				load.error instanceof ApiError &&
				(load.error.code === "NOT_FOUND" || load.error.code === "FORBIDDEN");

			return (
				<div role="alert" className="space-y-3">
					<h1 className="text-2xl font-semibold tracking-tight">
						{isMissing ? "Deal not found" : "We couldn’t load this deal"}
					</h1>
					<p className="text-fg-secondary">
						{isMissing
							? "This deal doesn’t exist or isn’t yours to view."
							: load.error.message}
					</p>
					<div className="flex flex-wrap items-center gap-4">
						{!isMissing ? (
							<Button variant="secondary" onClick={load.reload}>
								Try again
							</Button>
						) : null}
						<Link href={backHref} className={LINK}>
							Back to {backLabel.toLowerCase()}
						</Link>
					</div>
				</div>
			);
		}

		return (
			<p className="text-fg-muted" aria-live="polite">
				Loading deal…
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<p>
				<Link href={backHref} className={`${LINK} text-sm`}>
					<span aria-hidden="true">← </span>
					{backLabel}
				</Link>
			</p>
			<DealHeader deal={deal} viewerRole={me.role} />
			{load.status === "failed" ? (
				<p role="alert" className="text-sm text-danger">
					Couldn’t refresh this deal. {load.error.message}
				</p>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
				<aside className="min-w-0 lg:col-start-2 lg:row-start-1">
					<div className="lg:sticky lg:top-6">
						<ActionPanel deal={deal} viewerRole={me.role} runner={runner} />
					</div>
				</aside>
				<div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
					{deal.dispute !== null ? (
						<DisputeBlock
							deal={deal}
							dispute={deal.dispute}
							viewerRole={me.role}
						/>
					) : null}
					<DraftViewer deal={deal} />
					<PublicationBlock deal={deal} viewerRole={me.role} />
					<TermsSummary deal={deal} />
					<Timeline deal={deal} viewerRole={me.role} />
				</div>
			</div>
		</div>
	);
}
