"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { getDispute } from "@/lib/api";
import { ACTION_LABELS, ISSUE_LABELS, roleLabel } from "@/lib/dealDisplay";
import { formatDateTime } from "@/lib/format";
import { errorMessage, isNotFound, useLoad } from "@/lib/useLoad";

import { DealRoom } from "../../../../_components/deal/DealRoom";
import { Alert, Card, CardHeader, Loading } from "../../../../_components/ui";
import { NotAvailable } from "../../../AppShell";

export default function DisputeDetailPage() {
	const { id } = useParams<{ id: string }>();
	const detail = useLoad(() => getDispute(id), id);

	if (detail.status === "loading") return <Loading />;
	if (detail.status === "failed" && isNotFound(detail.error)) return <NotAvailable home="/admin/disputes" />;
	if (detail.data === null) return <Alert>{errorMessage(detail.error)}</Alert>;

	const { deal, history } = detail.data;

	return (
		<>
			<Link href="/admin/disputes" className="mb-6 inline-block text-sm text-muted hover:text-ink">
				← Disputes
			</Link>
			<DealRoom
				deal={deal}
				viewer="ADMIN"
				onDeal={(d) => {
					detail.setData({ ...detail.data!, deal: d });
					void detail.reload();
				}}
				reload={detail.reload}
			/>
			{history.length > 1 ? (
				<Card className="mt-6">
					<CardHeader title="Issue history" />
					<ul className="divide-y divide-line text-sm">
						{history.map((h) => (
							<li key={h.id} className="px-5 py-3">
								<span className="font-medium">{ISSUE_LABELS[h.code]}</span> · opened by the {roleLabel(h.openedByRole).toLowerCase()} {formatDateTime(h.openedAt)}
								{h.resolution ? <span className="text-muted"> · {ACTION_LABELS[h.resolution]}: “{h.resolutionReason}”</span> : <span className="text-warning"> · open</span>}
							</li>
						))}
					</ul>
				</Card>
			) : null}
		</>
	);
}
