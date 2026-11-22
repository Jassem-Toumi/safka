"use client";

import { useEffect, useRef, useState } from "react";

import { uploadDraft } from "@/lib/api";
import { errorMessage } from "@/lib/useLoad";
import { UPLOAD_LIMITS } from "@/shared/contracts";

import { Button, cx, Spinner } from "../ui";

type Item = { key: string; file: File; preview: string; status: "uploading" | "ready" | "failed"; uploadId?: string; error?: string };

const MAX_MB = UPLOAD_LIMITS.maxBytes / 1024 / 1024;

/** Pick one or two MP4s, upload each, preview locally, then submit as one batch. */
export function DraftUploader({ dealId, onSubmit, submitting }: { dealId: string; onSubmit: (uploadIds: string[]) => void; submitting: boolean }) {
	const [items, setItems] = useState<Item[]>([]);
	const [pickError, setPickError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const itemsRef = useRef(items);

	itemsRef.current = items;
	useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

	async function upload(item: Item) {
		setItems((list) => list.map((i) => (i.key === item.key ? { ...i, status: "uploading", error: undefined } : i)));

		try {
			const r = await uploadDraft(dealId, item.file);

			setItems((list) => list.map((i) => (i.key === item.key ? { ...i, status: "ready", uploadId: r.uploadId } : i)));
		} catch (e) {
			setItems((list) => list.map((i) => (i.key === item.key ? { ...i, status: "failed", error: errorMessage(e) } : i)));
		}
	}

	function pick(files: FileList | null) {
		setPickError(null);
		const room = 2 - items.length;

		for (const file of Array.from(files ?? []).slice(0, room)) {
			const isMp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");

			if (!isMp4) {
				setPickError(`${file.name} isn’t an MP4. Use .mp4 files up to ${MAX_MB} MB.`);
				continue;
			}

			if (file.size > UPLOAD_LIMITS.maxBytes) {
				setPickError(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_MB} MB per video.`);
				continue;
			}

			const item: Item = { key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: "uploading" };

			setItems((list) => [...list, item]);
			void upload(item);
		}

		if (inputRef.current) inputRef.current.value = "";
	}

	function remove(key: string) {
		setItems((list) => {
			const gone = list.find((i) => i.key === key);

			if (gone) URL.revokeObjectURL(gone.preview);

			return list.filter((i) => i.key !== key);
		});
	}

	const ready = items.filter((i) => i.status === "ready" && i.uploadId).map((i) => i.uploadId!);
	const busy = items.some((i) => i.status === "uploading");

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2">
				{items.map((item, idx) => (
					<div key={item.key} className="overflow-hidden rounded-xl border border-line">
						<video src={item.preview} controls preload="metadata" className="aspect-video w-full bg-ink" aria-label={`Preview of option ${idx + 1}`} />
						<div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
							<span className="min-w-0 truncate">
								<span className="font-medium">Option {idx + 1}</span> · {item.file.name}
							</span>
							<span aria-live="polite" className={cx("flex shrink-0 items-center gap-1", item.status === "failed" ? "text-danger" : "text-muted")}>
								{item.status === "uploading" ? (
									<>
										<Spinner /> Uploading
									</>
								) : item.status === "ready" ? (
									"Ready"
								) : (
									"Failed"
								)}
							</span>
						</div>
						{item.status === "failed" ? <p className="px-3 pb-2 text-xs text-danger">{item.error}</p> : null}
						<div className="flex gap-2 border-t border-line px-3 py-2">
							{item.status === "failed" ? (
								<Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => void upload(item)}>
									Retry
								</Button>
							) : null}
							<Button variant="ghost" className="min-h-8 px-3 text-xs" onClick={() => remove(item.key)} disabled={submitting}>
								Remove
							</Button>
						</div>
					</div>
				))}
				{items.length < 2 ? (
					<label className="grid aspect-video cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong bg-canvas/50 text-center text-sm hover:bg-canvas">
						<span>
							<span className="font-medium">Add a draft video</span>
							<span className="mt-1 block text-xs text-muted">MP4, up to {MAX_MB} MB · {2 - items.length} more allowed</span>
						</span>
						<input ref={inputRef} type="file" accept="video/mp4,.mp4" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
					</label>
				) : null}
			</div>
			{pickError ? (
				<p role="alert" className="text-sm text-danger">
					{pickError}
				</p>
			) : null}
			<Button onClick={() => onSubmit(ready)} busy={submitting} disabled={ready.length === 0 || busy}>
				Submit {ready.length === 2 ? "2 drafts" : "draft"} for review
			</Button>
		</div>
	);
}
