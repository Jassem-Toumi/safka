"use client";

import type { DealActionRunner } from "@/app/(app)/deals/_parts/useDealAction";
import type { Deal, DealAction, Role } from "@/shared/contracts";

import Link from "next/link";
import { useEffect, useRef } from "react";

import {
	AcceptButton,
	ConfirmDeliveryButton,
	DeclineButton,
	WithdrawButton
} from "@/app/(app)/deals/_parts/ActionButtons";
import {
	ApproveDraftForm,
	CounterForm,
	PublicationForm,
	RequestChangesForm
} from "@/app/(app)/deals/_parts/ActionForms";
import { DraftUploader } from "@/app/(app)/deals/_parts/DraftUploader";
import { CARD, LINK } from "@/app/(app)/deals/_parts/kit";
import { orderActions } from "@/lib/dealForms";
import { whoActsNext } from "@/lib/deals";
import { TERMINAL_DEAL_STATUSES } from "@/shared/contracts";

type ActionPanelProps = {
	deal: Deal;
	viewerRole: Role;
	runner: DealActionRunner;
};

/** Actions this panel draws; anything else the server allows is left out. */
const PANEL_ACTIONS: readonly DealAction[] = [
	"ACCEPT",
	"COUNTER",
	"DECLINE",
	"WITHDRAW",
	"SUBMIT_DRAFTS",
	"APPROVE_DRAFT",
	"REQUEST_CHANGES",
	"SUBMIT_PUBLICATION",
	"CONFIRM_DELIVERY"
];

function waitingText(deal: Deal, viewerRole: Role): string {
	if (TERMINAL_DEAL_STATUSES.includes(deal.status)) {
		return "This deal is closed.";
	}

	if (deal.status === "DISPUTED") {
		return "An admin is reviewing the reported issue. Normal actions are paused.";
	}

	return whoActsNext(deal, viewerRole) ?? "Nothing for you to do right now.";
}

function NoticeBox({ deal, viewerRole, runner }: ActionPanelProps) {
	const ref = useRef<HTMLDivElement>(null);
	const { notice } = runner;

	useEffect(() => {
		ref.current?.focus();
	}, [notice]);

	if (notice === null) {
		return null;
	}

	return (
		<div
			ref={ref}
			tabIndex={-1}
			role="alert"
			className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
		>
			<p>{notice.message}</p>
			{notice.kind === "expired" &&
			viewerRole === "BRAND" &&
			deal.campaignId !== null ? (
				<p className="mt-2">
					<Link
						href={`/brand/campaigns/${deal.campaignId}?tab=matches`}
						className={LINK}
					>
						Send a new offer from the campaign
					</Link>
				</p>
			) : null}
		</div>
	);
}

export function ActionPanel({ deal, viewerRole, runner }: ActionPanelProps) {
	const actions = orderActions(
		deal.availableActions.filter((action) => PANEL_ACTIONS.includes(action))
	);
	const props = { deal, runner };

	function renderAction(action: DealAction) {
		switch (action) {
			case "ACCEPT":
				return <AcceptButton {...props} />;

			case "COUNTER":
				return <CounterForm {...props} />;

			case "DECLINE":
				return <DeclineButton {...props} />;

			case "WITHDRAW":
				return <WithdrawButton {...props} />;

			case "SUBMIT_DRAFTS":
				return <DraftUploader {...props} />;

			case "APPROVE_DRAFT":
				return <ApproveDraftForm {...props} />;

			case "REQUEST_CHANGES":
				return <RequestChangesForm {...props} />;

			case "SUBMIT_PUBLICATION":
				return <PublicationForm {...props} />;

			case "CONFIRM_DELIVERY":
				return <ConfirmDeliveryButton {...props} viewerRole={viewerRole} />;

			default:
				return null;
		}
	}

	const isLastRound =
		viewerRole === "BRAND" &&
		deal.status === "DRAFT_REVIEW" &&
		deal.availableActions.includes("APPROVE_DRAFT") &&
		!deal.availableActions.includes("REQUEST_CHANGES");

	return (
		<section
			aria-labelledby="actions-heading"
			className={`${CARD} space-y-4`}
		>
			<h2 id="actions-heading" className="text-lg font-semibold">
				Next step
			</h2>
			<div aria-live="polite">
				{runner.announcement !== "" ? (
					<p className="text-sm font-medium text-success">
						{runner.announcement}
					</p>
				) : null}
			</div>
			<NoticeBox deal={deal} viewerRole={viewerRole} runner={runner} />

			{actions.length === 0 ? (
				<p className="text-fg-secondary">{waitingText(deal, viewerRole)}</p>
			) : null}

			{isLastRound ? (
				<p className="text-sm text-fg-secondary">
					This was the last draft round, so changes can’t be requested again.
					Approve one option to continue.
				</p>
			) : null}

			{actions.length > 0 ? (
				<ul className="divide-y divide-divider">
					{actions.map((action) => (
						<li key={action} className="py-4 first:pt-0 last:pb-0">
							{renderAction(action)}
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}
