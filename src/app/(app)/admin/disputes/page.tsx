"use client";

import type { AdminDisputeSummary } from "@/shared/contracts";

import Link from "next/link";

import { listDisputes } from "@/lib/api";
import { ACTION_LABELS, ISSUE_LABELS, paymentLabel, paymentTone, relativeHint, roleLabel } from "@/lib/dealDisplay";
import { formatCents, formatDateTime } from "@/lib/format";
import { errorMessage, useLoad } from "@/lib/useLoad";

import { Alert, Badge, Card, CardHeader, EmptyState, Loading, PageHeader } from "../../../_components/ui";

export default function DisputesPage() {
	const disputes = useLoad(() => listDisputes(), "disputes", { refreshOnFocus: true });
	const items = disputes.data?.items ?? [];
	const open = items.filter((d) => d.resolvedAt === null).sort((a, b) => a.openedAt.localeCompare(b.openedAt));
	const resolved = items.filter((d) => d.resolvedAt !== null);

	return (
		<>
			<PageHeader eyebrow="Moderation" title="Disputes" description="Delivery problems reported by brands or creators. Oldest open cases first." />
			{disputes.status === "loading" ? <Loading /> : null}
			{disputes.status === "failed" ? <Alert>{errorMessage(disputes.error)}</Alert> : null}
			{disputes.data ? (
				<div className="space-y-6">
					<Card>
						<CardHeader title={`Open · ${open.length}`} />
						{open.length === 0 ? (
							<div className="p-5">
								<EmptyState title="No open disputes" />
							</div>
						) : (
							<ul className="divide-y divide-line">{open.map((d) => <DisputeRow key={d.id} d={d} />)}</ul>
						)}
					</Card>
					{resolved.length > 0 ? (
						<Card>
							<CardHeader title="Resolved" />
							<ul className="divide-y divide-line">{resolved.map((d) => <DisputeRow key={d.id} d={d} />)}</ul>
						</Card>
					) : null}
				</div>
			) : null}
		</>
	);
}

function DisputeRow({ d }: { d: AdminDisputeSummary }) {
	return (
		<li>
			<Link href={`/admin/disputes/${d.id}`} className="grid gap-2 px-5 py-4 hover:bg-canvas/60 sm:grid-cols-[1fr_auto] sm:items-center">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium">
							{d.brand.displayName} × {d.creator.displayName}
						</span>
						<Badge tone={d.resolvedAt ? "neutral" : "warning"}>{ISSUE_LABELS[d.code]}</Badge>
					</div>
					<p className="mt-1 line-clamp-1 text-sm text-muted">“{d.reason}”</p>
					<p className="text-xs text-faint">
						Opened by the {roleLabel(d.openedByRole).toLowerCase()} {relativeHint(d.openedAt)} · {formatDateTime(d.openedAt)}
						{d.resolution ? ` · ${ACTION_LABELS[d.resolution]}` : ""}
					</p>
				</div>
				<div className="text-left sm:text-right">
					<p className="font-semibold tabular">{formatCents(d.amountCents)}</p>
					<p className="text-xs text-muted">
						Simulated payment <Badge tone={paymentTone(d.paymentStatus)}>{paymentLabel(d.paymentStatus)}</Badge>
					</p>
				</div>
			</Link>
		</li>
	);
}
