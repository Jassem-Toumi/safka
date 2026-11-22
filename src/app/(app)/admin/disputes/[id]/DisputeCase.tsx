"use client";

import type { FormEvent } from "react";
import type { DealActionRunner } from "@/app/(app)/deals/_parts/useDealAction";
import type { ResolutionAction } from "@/lib/dealForms";
import type { Deal, Dispute } from "@/shared/contracts";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useId, useState } from "react";

import { DealHeader } from "@/app/(app)/deals/_parts/DealHeader";
import { DisputeBlock } from "@/app/(app)/deals/_parts/DisputeBlock";
import { DraftViewer } from "@/app/(app)/deals/_parts/DraftViewer";
import { CARD, FocusAlert, INPUT, LINK } from "@/app/(app)/deals/_parts/kit";
import { PublicationBlock } from "@/app/(app)/deals/_parts/PublicationBlock";
import { TermsSummary } from "@/app/(app)/deals/_parts/TermsSummary";
import { Timeline } from "@/app/(app)/deals/_parts/Timeline";
import { useDealAction } from "@/app/(app)/deals/_parts/useDealAction";
import { ApiError, getDispute } from "@/lib/api";
import {
	RESOLUTION_ACTIONS,
	resolutionEffect,
	validateReason
} from "@/lib/dealForms";
import { actionLabel, dealHeadline, humanizeEvent } from "@/lib/deals";
import { PaymentChip, StatusChip } from "@/lib/ui/Chips";
import { ConfirmDialog } from "@/lib/ui/ConfirmDialog";
import { Button, Field, fieldDescribedBy } from "@/lib/ui/form";
import { useLoad } from "@/lib/ui/useLoad";

type ResolutionFormProps = {
	deal: Deal;
	dispute: Dispute;
	runner: DealActionRunner;
};

function ResolutionForm({ deal, dispute, runner }: ResolutionFormProps) {
	const id = useId();
	const fieldId = `${id}-reason`;
	const [reason, setReason] = useState("");
	const [reasonError, setReasonError] = useState<string | null>(null);
	const [choice, setChoice] = useState<ResolutionAction | null>(null);
	const actions = RESOLUTION_ACTIONS.filter((action) =>
		deal.availableActions.includes(action)
	);
	const serverError = actions
		.map((action) => runner.errorFor(action))
		.find((error) => error !== null) ?? null;
	const shownReasonError = reasonError ?? serverError?.fields.reason ?? null;
	const hint = "Both participants see this reason on the deal.";

	function handleChoose(action: ResolutionAction) {
		const problem = validateReason(reason);

		setReasonError(problem);

		if (problem !== null) {
			document.getElementById(fieldId)?.focus();

			return;
		}

		setChoice(action);
	}

	async function handleConfirm() {
		if (choice === null) {
			return;
		}

		await runner.run({
			action: choice,
			expectedVersion: deal.version,
			disputeId: dispute.id,
			reason: reason.trim()
		});
		setChoice(null);
	}

	if (actions.length === 0) {
		return (
			<p className="text-fg-secondary">
				No resolution is available for this case right now.
			</p>
		);
	}

	return (
		<form
			onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
			noValidate
			className="space-y-4"
		>
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="text-fg-muted">Current:</span>
				<PaymentChip status={deal.paymentStatus} />
			</div>
			<Field
				label="Reason for the decision"
				htmlFor={fieldId}
				hint={hint}
				error={shownReasonError}
			>
				<textarea
					id={fieldId}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					rows={4}
					maxLength={1000}
					aria-invalid={shownReasonError ? true : undefined}
					aria-describedby={fieldDescribedBy(fieldId, {
						hint,
						error: shownReasonError
					})}
					className={INPUT}
				/>
			</Field>
			{serverError !== null ? (
				<FocusAlert>{serverError.message}</FocusAlert>
			) : null}
			<ul className="space-y-3">
				{actions.map((action) => (
					<li key={action} className="space-y-1">
						<Button
							variant={action === "RESUME_DEAL" ? "secondary" : "primary"}
							onClick={() => handleChoose(action)}
							disabled={runner.pending !== null}
							className="w-full"
						>
							{actionLabel(action)}
						</Button>
						<p className="text-sm text-fg-muted">
							{resolutionEffect(action, deal)}
						</p>
					</li>
				))}
			</ul>
			<ConfirmDialog
				open={choice !== null}
				title={choice === null ? "" : `${actionLabel(choice)}?`}
				confirmLabel={choice === null ? "Confirm" : actionLabel(choice)}
				onConfirm={handleConfirm}
				onCancel={() => setChoice(null)}
				busy={runner.pending !== null}
				tone={choice === "REFUND_PAYMENT" || choice === "CANCEL_DEAL" ? "danger" : "default"}
			>
				{choice !== null ? <p>{resolutionEffect(choice, deal)}</p> : null}
				<p className="break-words">
					<span className="font-medium">Reason:</span> {reason.trim()}
				</p>
			</ConfirmDialog>
		</form>
	);
}

/** Admin case view: the deal inline, plus the resolution form. */
export function DisputeCase() {
	const params = useParams<{ id: string }>();
	const disputeId = params.id;
	const load = useLoad(() => getDispute(disputeId), [disputeId], {
		refetchOnFocus: true
	});
	const [acted, setActed] = useState<Deal | null>(null);
	const runner = useDealAction(load.data?.deal.id ?? "", {
		onDeal: (deal) => {
			setActed(deal);
			load.reload();
		},
		reload: load.reload
	});
	const detail = load.data;

	if (detail === null) {
		if (load.status === "failed") {
			const isMissing =
				load.error instanceof ApiError && load.error.code === "NOT_FOUND";

			return (
				<div role="alert" className="space-y-3">
					<h1 className="text-2xl font-semibold tracking-tight">
						{isMissing ? "Case not found" : "We couldn’t load this case"}
					</h1>
					<p className="text-fg-secondary">
						{isMissing ? "This dispute doesn’t exist." : load.error.message}
					</p>
					<div className="flex flex-wrap items-center gap-4">
						{!isMissing ? (
							<Button variant="secondary" onClick={load.reload}>
								Try again
							</Button>
						) : null}
						<Link href="/admin/disputes" className={LINK}>
							Back to disputes
						</Link>
					</div>
				</div>
			);
		}

		return (
			<p className="text-fg-muted" aria-live="polite">
				Loading case…
			</p>
		);
	}

	const deal =
		acted !== null &&
		acted.id === detail.deal.id &&
		acted.version > detail.deal.version
			? acted
			: detail.deal;
	const dispute =
		deal.dispute !== null && deal.dispute.id === detail.dispute.id
			? deal.dispute
			: detail.dispute;
	const isResolved = dispute.resolvedAt !== null;
	const lastEvent = deal.timeline.at(-1);

	return (
		<div className="space-y-6">
			<p>
				<Link href="/admin/disputes" className={`${LINK} text-sm`}>
					<span aria-hidden="true">← </span>Disputes
				</Link>
			</p>
			<DealHeader deal={deal} viewerRole="ADMIN" />

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
				<aside className="min-w-0 lg:col-start-2 lg:row-start-1">
					<section
						aria-labelledby="resolve-heading"
						className={`${CARD} space-y-4 lg:sticky lg:top-6`}
					>
						<h2 id="resolve-heading" className="text-lg font-semibold">
							{isResolved ? "Outcome" : "Resolve this case"}
						</h2>
						<div aria-live="polite">
							{isResolved ? (
								<div className="space-y-2">
									<p className="flex flex-wrap items-center gap-2">
										<span className="text-sm text-fg-muted">Deal is now</span>
										<StatusChip
											status={deal.status}
											label={dealHeadline(deal, "ADMIN")}
										/>
									</p>
									<PaymentChip status={deal.paymentStatus} />
									{dispute.resolutionReason !== null ? (
										<p className="text-sm break-words">
											<span className="font-medium">Reason:</span>{" "}
											{dispute.resolutionReason}
										</p>
									) : null}
									{runner.announcement !== "" && lastEvent !== undefined ? (
										<p className="text-sm text-success">
											Added to the timeline: {humanizeEvent(lastEvent.action)}
											{lastEvent.note !== null ? ` · ${lastEvent.note}` : ""}
										</p>
									) : null}
								</div>
							) : null}
						</div>
						{runner.notice !== null ? (
							<p role="alert" className="text-sm text-warning">
								{runner.notice.message}
							</p>
						) : null}
						{!isResolved ? (
							<ResolutionForm deal={deal} dispute={dispute} runner={runner} />
						) : null}
					</section>
				</aside>
				<div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
					<DisputeBlock deal={deal} dispute={dispute} viewerRole="ADMIN" />
					<DraftViewer deal={deal} />
					<PublicationBlock deal={deal} viewerRole="ADMIN" />
					<TermsSummary deal={deal} />
					<Timeline deal={deal} viewerRole="ADMIN" />
				</div>
			</div>
		</div>
	);
}
