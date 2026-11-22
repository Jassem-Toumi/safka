"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import { getCreator, listProducts } from "@/lib/api";
import { errorMessage, isNotFound, useLoad } from "@/lib/useLoad";

import { Avatar, CreatorFacts, DataModeBadge, EvidenceRow, LabelChip, originLabel } from "../../../../_components/creator";
import { OfferComposer } from "../../../../_components/OfferComposer";
import { Alert, Button, ButtonLink, Card, CardHeader, EmptyState, ExternalLink, Loading } from "../../../../_components/ui";
import { NotAvailable } from "../../../AppShell";

export default function CreatorProfilePage() {
	const { id } = useParams<{ id: string }>();
	const back = useSearchParams().get("back");
	const data = useLoad(async () => {
		const [card, products] = await Promise.all([getCreator(id), listProducts()]);

		return { card, products: products.items };
	}, id);
	const [composing, setComposing] = useState(false);

	if (data.status === "loading") return <Loading />;
	if (data.status === "failed" && isNotFound(data.error)) return <NotAvailable home="/brand/creators" />;
	if (data.status === "failed" || data.data === null) return <Alert>{errorMessage(data.error)}</Alert>;

	const { card, products } = data.data;
	const origins = [...new Set([...card.topics, ...card.formats].map((l) => l.origin))];

	return (
		<>
			<Link href={`/brand/creators${back ? `?${back}` : ""}`} className="mb-6 inline-block text-sm text-muted hover:text-ink">
				← All creators
			</Link>

			<div className="mb-8 flex flex-wrap items-start gap-5">
				<Avatar name={card.displayName} size="lg" />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-3xl font-semibold tracking-tight">{card.displayName}</h1>
						<DataModeBadge mode={card.dataMode} />
					</div>
					<p className="mt-2 max-w-2xl text-muted">{card.bio}</p>
					<p className="mt-2 text-sm">
						<ExternalLink href={card.profileUrl}>{card.profileUrl.replace("https://www.", "")}</ExternalLink>
						<span className="ml-2 text-xs text-faint">Channel is self-attested by the creator</span>
					</p>
				</div>
				{products.length > 0 ? (
					<Button onClick={() => setComposing(true)}>Send offer</Button>
				) : (
					<ButtonLink href="/brand/products" variant="secondary">
						Add a product to send offers
					</ButtonLink>
				)}
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
				<div className="space-y-6">
					<Card>
						<CardHeader title="Public evidence" description="Sources the creator approved. Tags inherit the source they came from." />
						<div className="divide-y divide-line">
							{card.evidence.length === 0 ? (
								<div className="p-5">
									<EmptyState title="No sources yet" description="Tags on this profile are creator provided." />
								</div>
							) : (
								card.evidence.map((e) => (
									<div key={e.id} className="p-5">
										<EvidenceRow evidence={e} />
									</div>
								))
							)}
						</div>
					</Card>
				</div>

				<div className="space-y-6">
					<Card className="p-5">
						<h2 className="mb-4 text-[15px] font-semibold">At a glance</h2>
						<CreatorFacts card={card} />
					</Card>
					<Card className="p-5">
						<h2 className="text-[15px] font-semibold">Formats & topics</h2>
						<div className="mt-3 flex flex-wrap gap-1.5">
							{card.formats.map((f) => (
								<LabelChip key={f.value} label={f} kind="format" />
							))}
						</div>
						<div className="mt-2 flex flex-wrap gap-1.5">
							{card.topics.map((t) => (
								<LabelChip key={t.value} label={t} kind="topic" />
							))}
						</div>
						<p className="mt-4 text-xs text-muted">
							{origins.map(originLabel).join(" · ")}
							{origins.includes("PUBLIC") ? " · green dot = backed by a public source" : ""}
						</p>
					</Card>
				</div>
			</div>

			{composing ? <OfferComposer open onClose={() => setComposing(false)} creator={card} products={products} /> : null}
		</>
	);
}
