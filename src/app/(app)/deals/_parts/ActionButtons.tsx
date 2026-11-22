"use client";

import type { ReactNode } from "react";
import type { ActionProps } from "@/app/(app)/deals/_parts/useDealAction";
import type { DealActionInput } from "@/shared/contracts";

import { useState } from "react";

import { FocusAlert } from "@/app/(app)/deals/_parts/kit";
import { actionLabel, currentTerms } from "@/lib/deals";
import { formatCents } from "@/lib/format";
import { ConfirmDialog } from "@/lib/ui/ConfirmDialog";
import { Button } from "@/lib/ui/form";

type ConfirmActionButtonProps = ActionProps & {
	input: DealActionInput;
	variant: "primary" | "secondary";
	title: string;
	confirmLabel: string;
	tone?: "default" | "danger";
	children: ReactNode;
};

/** A one-click action behind a confirmation dialog. */
export function ConfirmActionButton({
	runner,
	input,
	variant,
	title,
	confirmLabel,
	tone = "default",
	children
}: ConfirmActionButtonProps) {
	const [isOpen, setIsOpen] = useState(false);
	const error = runner.errorFor(input.action);
	const isBusy = runner.pending === input.action;

	async function handleConfirm() {
		const succeeded = await runner.run(input);

		if (!succeeded) {
			setIsOpen(false);
		}
	}

	return (
		<div className="space-y-3">
			<Button
				variant={variant}
				onClick={() => setIsOpen(true)}
				disabled={runner.pending !== null}
				className="w-full"
			>
				{actionLabel(input.action)}
			</Button>
			{error !== null ? <FocusAlert>{error.message}</FocusAlert> : null}
			<ConfirmDialog
				open={isOpen}
				title={title}
				confirmLabel={confirmLabel}
				onConfirm={handleConfirm}
				onCancel={() => setIsOpen(false)}
				busy={isBusy}
				tone={tone}
			>
				{children}
			</ConfirmDialog>
		</div>
	);
}

export function AcceptButton({ deal, runner }: ActionProps) {
	const error = runner.errorFor("ACCEPT");
	const amount = formatCents(currentTerms(deal).amountCents);

	return (
		<div className="space-y-3">
			<Button
				onClick={() =>
					runner.run({
						action: "ACCEPT",
						expectedVersion: deal.version,
						proposalId: deal.latestProposal.id
					})
				}
				busy={runner.pending === "ACCEPT"}
				busyLabel="Accepting…"
				disabled={runner.pending !== null}
				className="w-full"
			>
				Accept offer · {amount}
			</Button>
			{error !== null ? <FocusAlert>{error.message}</FocusAlert> : null}
		</div>
	);
}

export function DeclineButton({ deal, runner }: ActionProps) {
	return (
		<ConfirmActionButton
			deal={deal}
			runner={runner}
			input={{
				action: "DECLINE",
				expectedVersion: deal.version,
				proposalId: deal.latestProposal.id
			}}
			variant="secondary"
			title="Decline this offer?"
			confirmLabel="Decline offer"
			tone="danger"
		>
			<p>
				This ends the negotiation. To change the price or dates instead, send
				a counteroffer.
			</p>
		</ConfirmActionButton>
	);
}

export function WithdrawButton({ deal, runner }: ActionProps) {
	return (
		<ConfirmActionButton
			deal={deal}
			runner={runner}
			input={{ action: "WITHDRAW", expectedVersion: deal.version }}
			variant="secondary"
			title="Withdraw this offer?"
			confirmLabel="Withdraw offer"
			tone="danger"
		>
			<p>
				{deal.creator.displayName} can no longer accept or counter it. This
				can’t be undone.
			</p>
		</ConfirmActionButton>
	);
}

export function ConfirmDeliveryButton({
	deal,
	runner,
	viewerRole
}: ActionProps & { viewerRole: "BRAND" | "CREATOR" | "ADMIN" }) {
	const amount = formatCents(currentTerms(deal).amountCents);
	const otherConfirmed = deal.confirmations.some(
		(confirmation) => confirmation.role !== viewerRole
	);
	const otherName =
		viewerRole === "BRAND" ? deal.creator.displayName : deal.brand.displayName;

	return (
		<ConfirmActionButton
			deal={deal}
			runner={runner}
			input={{ action: "CONFIRM_DELIVERY", expectedVersion: deal.version }}
			variant="primary"
			title="Confirm delivery?"
			confirmLabel="Confirm delivery"
		>
			<p>
				You’re confirming the published post meets the agreed requirements.
				{viewerRole === "BRAND" ? " Check the public link first." : ""}
			</p>
			<p>
				{otherConfirmed
					? `${otherName} has already confirmed, so yours is the second confirmation: it completes the deal and releases the simulated payment of ${amount} to ${deal.creator.displayName}.`
					: `The simulated payment of ${amount} is released on the second confirmation, once ${otherName} confirms too.`}
			</p>
		</ConfirmActionButton>
	);
}
