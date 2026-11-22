"use client";

import type { AdminDisputeSummary } from "@/shared/contracts";

import Link from "next/link";

import { CARD } from "@/app/(app)/deals/_parts/kit";
import { listDisputes } from "@/lib/api";
import { issueCodeLabel, splitDisputes } from "@/lib/dealForms";
import { actionLabel } from "@/lib/deals";
import { formatCents, formatDateTime } from "@/lib/format";
import { PaymentChip } from "@/lib/ui/Chips";
import { Button } from "@/lib/ui/form";
import { useLoad } from "@/lib/ui/useLoad";

function DisputeRow({ dispute }: { dispute: AdminDisputeSummary }) {
	return (
		<li className={`${CARD} relative hover:border-zinc-300 hover:bg-zinc-50`}>
			<div className="flex flex-wrap items-baseline justify-between gap-x-3">
				<h3 className="font-semibold break-words">
					<Link
						href={`/admin/disputes/${dispute.id}`}
						className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-indigo-600"
					>
						{dispute.brand.displayName}
						<span aria-hidden="true"> · </span>
						<span className="sr-only"> and </span>
						{dispute.creator.displayName}
					</Link>
				</h3>
				<p className="font-medium tabular-nums">
					<span className="sr-only">Amount: </span>
					{formatCents(dispute.amountCents)}
				</p>
			</div>
			<p className="mt-1 text-zinc-700">{issueCodeLabel(dispute.code)}</p>
			<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
				<PaymentChip status={dispute.paymentStatus} />
				<span className="text-zinc-500">
					Opened{" "}
					<time dateTime={dispute.openedAt}>
						{formatDateTime(dispute.openedAt)}
					</time>
				</span>
				{dispute.resolvedAt !== null ? (
					<span className="text-zinc-700">
						{dispute.resolution === null
							? "Resolved"
							: actionLabel(dispute.resolution)}{" "}
						<time dateTime={dispute.resolvedAt}>
							{formatDateTime(dispute.resolvedAt)}
						</time>
					</span>
				) : null}
			</div>
		</li>
	);
}

/** Open cases oldest first, then resolved history (frontend spec §2). */
export function DisputeQueue() {
	const { status, data, error, reload } = useLoad(() => listDisputes(), [], {
		refetchOnFocus: true
	});
	const groups = data === null ? null : splitDisputes(data.items);

	return (
		<div className="space-y-8">
			<h1 className="text-2xl font-semibold tracking-tight">Disputes</h1>

			{status === "failed" ? (
				<div role="alert" className="space-y-3">
					<p>We couldn’t load disputes. {error.message}</p>
					<Button variant="secondary" onClick={reload}>
						Try again
					</Button>
				</div>
			) : null}

			{groups === null && status === "loading" ? (
				<p className="text-zinc-600" aria-live="polite">
					Loading disputes…
				</p>
			) : null}

			{groups !== null ? (
				<>
					<section aria-labelledby="open-heading" className="space-y-3">
						<h2 id="open-heading" className="text-lg font-semibold">
							Open cases ({groups.open.length})
						</h2>
						{groups.open.length === 0 ? (
							<p className="text-zinc-600">No open cases.</p>
						) : (
							<ul className="space-y-3">
								{groups.open.map((dispute) => (
									<DisputeRow key={dispute.id} dispute={dispute} />
								))}
							</ul>
						)}
					</section>
					<section aria-labelledby="resolved-heading" className="space-y-3">
						<h2 id="resolved-heading" className="text-lg font-semibold">
							Resolved ({groups.resolved.length})
						</h2>
						{groups.resolved.length === 0 ? (
							<p className="text-zinc-600">No resolved cases yet.</p>
						) : (
							<ul className="space-y-3">
								{groups.resolved.map((dispute) => (
									<DisputeRow key={dispute.id} dispute={dispute} />
								))}
							</ul>
						)}
					</section>
				</>
			) : null}
		</div>
	);
}
