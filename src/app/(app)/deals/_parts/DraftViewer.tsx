"use client";

import type { Deal, DraftBatch } from "@/shared/contracts";

import { useState } from "react";

import { CARD, Tag } from "@/app/(app)/deals/_parts/kit";
import { ApiError, getPlayback } from "@/lib/api";
import { earlierBatches, formatBytes, latestBatch } from "@/lib/dealForms";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/lib/ui/form";
import { UPLOAD_LIMITS } from "@/shared/contracts";

type DraftViewerProps = {
	deal: Deal;
};

type PlayerState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; url: string }
	| { status: "failed"; message: string };

type AssetPlayerProps = {
	dealId: string;
	assetId: string;
	optionLabel: string;
	fileLabel: string;
	sizeBytes: number;
	isApproved: boolean;
};

function formatDuration(totalSec: number): string {
	const rounded = Math.round(totalSec);
	const minutes = Math.floor(rounded / 60);
	const seconds = String(rounded % 60).padStart(2, "0");

	return `${minutes}:${seconds}`;
}

/** Fetches a playback URL on demand, so nothing streams until asked. */
function AssetPlayer({
	dealId,
	assetId,
	optionLabel,
	fileLabel,
	sizeBytes,
	isApproved
}: AssetPlayerProps) {
	const [player, setPlayer] = useState<PlayerState>({ status: "idle" });
	const [durationSec, setDurationSec] = useState<number | null>(null);

	async function handlePlay() {
		setPlayer({ status: "loading" });

		try {
			const { url } = await getPlayback(dealId, assetId);

			setPlayer({ status: "ready", url });
		} catch (error) {
			setPlayer({
				status: "failed",
				message:
					error instanceof ApiError
						? error.message
						: "We couldn’t reach the server."
			});
		}
	}

	return (
		<li
			className={`min-w-0 space-y-2 rounded-lg border p-3 ${
				isApproved ? "border-emerald-400 ring-1 ring-emerald-400" : "border-zinc-200"
			}`}
		>
			<div className="flex flex-wrap items-center gap-2">
				<h4 className="font-semibold">{optionLabel}</h4>
				{isApproved ? <Tag tone="success">Approved</Tag> : null}
			</div>
			<p className="text-sm break-words text-zinc-600">
				{fileLabel} · {formatBytes(sizeBytes)}
				{durationSec !== null ? ` · ${formatDuration(durationSec)}` : ""}
			</p>

			{player.status === "ready" ? (
				<video
					controls
					autoPlay
					playsInline
					preload="metadata"
					src={player.url}
					aria-label={`${optionLabel}: ${fileLabel}`}
					onLoadedMetadata={(event) => {
						const { duration } = event.currentTarget;

						setDurationSec(Number.isFinite(duration) ? duration : null);
					}}
					onError={() =>
						setPlayer({
							status: "failed",
							message: "Your browser couldn’t play this video."
						})
					}
					className="aspect-video w-full rounded-md bg-black"
				/>
			) : (
				<Button
					variant="secondary"
					onClick={handlePlay}
					busy={player.status === "loading"}
					busyLabel="Loading video…"
					className="w-full sm:w-auto"
				>
					{player.status === "failed" ? "Try again" : "Play"}
					<span className="sr-only"> {optionLabel}</span>
				</Button>
			)}

			<div aria-live="polite">
				{player.status === "failed" ? (
					<p className="text-sm font-medium text-red-700">{player.message}</p>
				) : null}
			</div>
		</li>
	);
}

function BatchView({
	deal,
	batch,
	isLatest
}: {
	deal: Deal;
	batch: DraftBatch;
	isLatest: boolean;
}) {
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h3 className="font-semibold">
					{isLatest ? "Latest drafts" : "Drafts"} · Round {batch.round} of{" "}
					{UPLOAD_LIMITS.maxBatches}
				</h3>
				{batch.late ? <Tag tone="warning">Submitted late</Tag> : null}
			</div>
			<p className="text-sm text-zinc-600">
				Submitted{" "}
				<time dateTime={batch.submittedAt}>
					{formatDateTime(batch.submittedAt)}
				</time>
			</p>
			{batch.changeRequest !== null ? (
				<div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
					<p className="font-medium text-amber-900">
						Changes requested by {deal.brand.displayName}
					</p>
					<p className="mt-1 whitespace-pre-line text-zinc-800">
						{batch.changeRequest}
					</p>
				</div>
			) : null}
			<ul className="grid gap-3 sm:grid-cols-2">
				{batch.assets.map((asset, index) => (
					<AssetPlayer
						key={asset.id}
						dealId={deal.id}
						assetId={asset.id}
						optionLabel={`Option ${index + 1}`}
						fileLabel={asset.label}
						sizeBytes={asset.sizeBytes}
						isApproved={asset.id === deal.approvedAssetId}
					/>
				))}
			</ul>
		</div>
	);
}

/** Latest batch as Option 1/2; earlier rounds collapsed (frontend spec §5). */
export function DraftViewer({ deal }: DraftViewerProps) {
	const latest = latestBatch(deal);
	const earlier = earlierBatches(deal);

	if (latest === null) {
		return null;
	}

	return (
		<section
			id="drafts"
			aria-labelledby="drafts-heading"
			className={`${CARD} scroll-mt-6 space-y-4`}
		>
			<h2 id="drafts-heading" className="text-lg font-semibold">
				Drafts
			</h2>
			<BatchView deal={deal} batch={latest} isLatest />
			{earlier.length > 0 ? (
				<details className="group rounded-md border border-zinc-200">
					<summary className="flex min-h-11 cursor-pointer items-center px-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
						Earlier rounds ({earlier.length})
					</summary>
					<div className="space-y-6 border-t border-zinc-200 p-3">
						{earlier.map((batch) => (
							<BatchView
								key={batch.id}
								deal={deal}
								batch={batch}
								isLatest={false}
							/>
						))}
					</div>
				</details>
			) : null}
		</section>
	);
}
