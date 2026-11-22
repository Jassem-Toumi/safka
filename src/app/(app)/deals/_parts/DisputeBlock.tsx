"use client";

import type { Deal, Dispute, Role } from "@/shared/contracts";

import { actorName, CARD } from "@/app/(app)/deals/_parts/kit";
import { issueCodeLabel } from "@/lib/dealForms";
import { actionLabel, dealHeadline } from "@/lib/deals";
import { formatDateTime } from "@/lib/format";
import { PaymentChip } from "@/lib/ui/Chips";

type DisputeBlockProps = {
	deal: Deal;
	dispute: Dispute;
	viewerRole: Role;
	heading?: string;
	/** Shows the payment chip; history entries leave it out. */
	showPayment?: boolean;
};

export function DisputeBlock({
	deal,
	dispute,
	viewerRole,
	heading,
	showPayment = true
}: DisputeBlockProps) {
	const isResolved = dispute.resolvedAt !== null;
	const headingId = `dispute-${dispute.id}`;
	const pausedAt = dealHeadline(
		{ ...deal, status: dispute.priorStatus },
		viewerRole
	);

	return (
		<section
			aria-labelledby={headingId}
			className={`${CARD} ${isResolved ? "" : "border-warning-line"}`}
		>
			<h2 id={headingId} className="text-lg font-semibold">
				{heading ?? (isResolved ? "Reported issue · Resolved" : "Reported issue · Under review")}
			</h2>
			{!isResolved ? (
				<p className="mt-1 text-sm text-fg-secondary">
					An admin is reviewing this. Normal deal actions are paused.
				</p>
			) : null}

			<dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-fg-muted">Reported by</dt>
					<dd className="font-medium">
						{actorName(deal, dispute.openedByRole, viewerRole)}
					</dd>
				</div>
				<div>
					<dt className="text-fg-muted">Reported</dt>
					<dd>
						<time dateTime={dispute.openedAt}>
							{formatDateTime(dispute.openedAt)}
						</time>
					</dd>
				</div>
				<div>
					<dt className="text-fg-muted">Issue</dt>
					<dd className="font-medium">{issueCodeLabel(dispute.code)}</dd>
				</div>
				<div>
					<dt className="text-fg-muted">Paused at</dt>
					<dd>{pausedAt}</dd>
				</div>
				<div className="sm:col-span-2">
					<dt className="text-fg-muted">Reason</dt>
					<dd className="break-words whitespace-pre-line">{dispute.reason}</dd>
				</div>
				{showPayment ? (
					<div className="sm:col-span-2">
						<dt className="text-fg-muted">Payment</dt>
						<dd className="mt-0.5">
							<PaymentChip status={deal.paymentStatus} />
						</dd>
					</div>
				) : null}
			</dl>

			{isResolved ? (
				<div className="mt-4 rounded-md border border-border bg-bg p-3 text-sm">
					<p className="font-medium">
						Resolution: {dispute.resolution === null ? "Resolved" : actionLabel(dispute.resolution)}
						{dispute.resolvedAt !== null ? (
							<>
								{" · "}
								<time dateTime={dispute.resolvedAt}>
									{formatDateTime(dispute.resolvedAt)}
								</time>
							</>
						) : null}
					</p>
					{dispute.resolutionReason !== null ? (
						<p className="mt-1 break-words whitespace-pre-line text-fg">
							{dispute.resolutionReason}
						</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
