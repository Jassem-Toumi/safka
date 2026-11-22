"use client";

import { useEffect, useState } from "react";

import { getPlayback } from "@/lib/api";
import { errorMessage } from "@/lib/useLoad";

import { Spinner } from "../ui";

function formatBytes(n: number): string {
	return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Authenticated same-origin playback with seeking (Range) and a visible error state. */
export function DraftVideo({ dealId, assetId, label, sizeBytes }: { dealId: string; assetId: string; label: string; sizeBytes: number }) {
	const [url, setUrl] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [duration, setDuration] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;

		getPlayback(dealId, assetId)
			.then((r) => !cancelled && setUrl(r.url))
			.catch((e: unknown) => !cancelled && setFailure(errorMessage(e)));

		return () => {
			cancelled = true;
		};
	}, [dealId, assetId]);

	return (
		<figure className="overflow-hidden rounded-xl border border-line bg-ink">
			<div className="grid aspect-video place-items-center">
				{failure ? (
					<p role="alert" className="px-4 text-center text-sm text-white/80">
						This video can’t play here. {failure}
					</p>
				) : url ? (
					<video
						src={url}
						controls
						preload="metadata"
						className="h-full w-full"
						aria-label={`${label} draft video`}
						onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
						onError={() => setFailure("Your browser couldn’t play this file.")}
					/>
				) : (
					<Spinner className="text-white/70" />
				)}
			</div>
			<figcaption className="flex items-center justify-between bg-surface px-3 py-2 text-xs text-muted">
				<span className="font-medium text-ink">{label}</span>
				<span className="tabular">
					{duration && Number.isFinite(duration) ? `${Math.round(duration)}s · ` : ""}
					{formatBytes(sizeBytes)}
				</span>
			</figcaption>
		</figure>
	);
}
