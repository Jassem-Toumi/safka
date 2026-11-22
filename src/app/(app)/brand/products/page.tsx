"use client";

import type { Product } from "@/shared/contracts";

import { useState } from "react";

import { listProducts } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { errorMessage, useLoad } from "@/lib/useLoad";

import { ProductDialog } from "../../../_components/ProductDialog";
import { Alert, Button, Card, EmptyState, ExternalLink, Loading, PageHeader } from "../../../_components/ui";

export default function ProductsPage() {
	const products = useLoad(() => listProducts(), "products");
	const [editing, setEditing] = useState<Product | "new" | null>(null);

	return (
		<>
			<PageHeader
				eyebrow="Catalog"
				title="Products"
				description="What your sponsorships promote. Offers snapshot the product, so edits never change agreed deals."
				actions={<Button onClick={() => setEditing("new")}>New product</Button>}
			/>

			{products.status === "loading" ? <Loading /> : null}
			{products.status === "failed" ? <Alert>{errorMessage(products.error)}</Alert> : null}
			{products.data?.items.length === 0 ? (
				<EmptyState title="No products yet" description="Add one to start a campaign or send an offer." action={<Button onClick={() => setEditing("new")}>New product</Button>} />
			) : null}

			{products.data && products.data.items.length > 0 ? (
				<Card>
					<ul className="divide-y divide-line">
						{products.data.items.map((p) => (
							<li key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
								<div className="min-w-0 flex-1">
									<p className="font-medium">{p.name}</p>
									<p className="mt-0.5 line-clamp-1 text-sm text-muted">{p.description}</p>
									<p className="mt-1 text-xs text-faint">
										{p.landingUrl ? <ExternalLink href={p.landingUrl}>{p.landingUrl}</ExternalLink> : "No product URL"} · Updated {formatDateTime(p.updatedAt)}
									</p>
								</div>
								<Button variant="secondary" onClick={() => setEditing(p)}>
									Edit
								</Button>
							</li>
						))}
					</ul>
				</Card>
			) : null}

			{editing !== null ? (
				<ProductDialog
					product={editing === "new" ? null : editing}
					onClose={() => setEditing(null)}
					onSaved={() => {
						setEditing(null);
						void products.reload();
					}}
				/>
			) : null}
		</>
	);
}
