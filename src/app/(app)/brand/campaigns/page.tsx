"use client";

import Link from "next/link";

import { listCampaigns, listProducts } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { errorMessage, useLoad } from "@/lib/useLoad";

import { BudgetBar } from "../../../_components/budget";
import { Alert, Badge, ButtonLink, EmptyState, Loading, PageHeader } from "../../../_components/ui";

export default function CampaignsPage() {
	const data = useLoad(async () => {
		const [campaigns, products] = await Promise.all([listCampaigns(), listProducts()]);

		return { campaigns: campaigns.items, products: products.items };
	}, "campaigns");

	return (
		<>
			<PageHeader
				eyebrow="Spend"
				title="Campaigns"
				description="Each campaign has a hard budget cap. Only accepted offers reserve budget."
				actions={<ButtonLink href="/brand/campaigns/new">New campaign</ButtonLink>}
			/>

			{data.status === "loading" ? <Loading /> : null}
			{data.status === "failed" ? <Alert>{errorMessage(data.error)}</Alert> : null}
			{data.data?.campaigns.length === 0 ? (
				<EmptyState title="No campaigns yet" description="Describe what you want to promote and we’ll draft a brief." action={<ButtonLink href="/brand/campaigns/new">New campaign</ButtonLink>} />
			) : null}

			{data.data && data.data.campaigns.length > 0 ? (
				<div className="overflow-hidden rounded-2xl border border-line bg-surface">
					<table className="w-full text-sm">
						<thead className="border-b border-line text-left text-xs text-muted">
							<tr>
								<th className="px-5 py-3 font-medium">Campaign</th>
								<th className="hidden px-5 py-3 font-medium md:table-cell">Status</th>
								<th className="hidden px-5 py-3 font-medium sm:table-cell">Budget</th>
								<th className="px-5 py-3 text-right font-medium">Deals</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{data.data.campaigns.map((c) => {
								const product = data.data!.products.find((p) => p.id === c.productId);

								return (
									<tr key={c.id} className="hover:bg-canvas/60">
										<td className="px-5 py-4">
											<Link href={c.status === "DRAFT" ? `/brand/campaigns/${c.id}?tab=brief` : `/brand/campaigns/${c.id}`} className="font-medium hover:underline hover:underline-offset-4">
												{c.brief?.title || "Untitled draft"}
											</Link>
											<p className="text-xs text-muted">
												{product?.name ?? "Product"} · Updated {formatDateTime(c.updatedAt)}
											</p>
											<span className="mt-1 inline-block md:hidden">
												<StatusBadge status={c.status} />
											</span>
										</td>
										<td className="hidden px-5 py-4 md:table-cell">
											<StatusBadge status={c.status} />
										</td>
										<td className="hidden w-64 px-5 py-4 sm:table-cell">
											{c.budget ? <BudgetBar budget={c.budget} compact /> : <span className="text-muted">Not set</span>}
										</td>
										<td className="px-5 py-4 text-right tabular">{c.dealCount}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : null}
		</>
	);
}

function StatusBadge({ status }: { status: "DRAFT" | "ACTIVE" | "CLOSED" }) {
	return status === "ACTIVE" ? <Badge tone="positive">Active</Badge> : status === "DRAFT" ? <Badge tone="info">Draft</Badge> : <Badge>Closed</Badge>;
}
