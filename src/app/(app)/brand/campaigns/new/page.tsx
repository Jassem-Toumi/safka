"use client";

import Link from "next/link";

import { listProducts } from "@/lib/api";
import { errorMessage, useLoad } from "@/lib/useLoad";

import { BriefEditor } from "../../../../_components/BriefEditor";
import { Alert, Loading, PageHeader } from "../../../../_components/ui";

export default function NewCampaignPage() {
	const products = useLoad(() => listProducts(), "products");

	return (
		<>
			<Link href="/brand/campaigns" className="mb-6 inline-block text-sm text-muted hover:text-ink">
				← Campaigns
			</Link>
			<PageHeader eyebrow="New campaign" title="Describe it in a sentence" description="We’ll suggest a brief from your words. You review every field before anything goes live." />
			{products.status === "loading" ? <Loading /> : null}
			{products.status === "failed" ? <Alert>{errorMessage(products.error)}</Alert> : null}
			{products.data ? <BriefEditor products={products.data.items} campaign={null} onProductsChanged={() => void products.reload()} /> : null}
		</>
	);
}
