"use client";

import type { ChangeEvent } from "react";
import type { ActionProps } from "@/app/(app)/deals/_parts/useDealAction";

import { useEffect, useId, useRef, useState } from "react";

import { FocusAlert } from "@/app/(app)/deals/_parts/kit";
import { ApiError, uploadDraft } from "@/lib/api";
import { checkDraftFile, formatBytes, latestBatch } from "@/lib/dealForms";
import { Button } from "@/lib/ui/form";
import { UPLOAD_LIMITS } from "@/shared/contracts";

type PickedFile = {
	localId: string;
	file: File;
	previewUrl: string;
	status: "uploading" | "ready" | "failed";
	uploadId: string | null;
	error: string | null;
};

const MAX_FILES = 2;

/** Pick one or two MP4s, upload each, then submit the ready ones as a batch. */
export function DraftUploader({ deal, runner }: ActionProps) {
	const id = useId();
	const inputId = `${id}-files`;
	const [picks, setPicks] = useState<PickedFile[]>([]);
	const [pickError, setPickError] = useState<string | null>(null);
	const picksRef = useRef<PickedFile[]>([]);
	const serverError = runner.errorFor("SUBMIT_DRAFTS");
	const feedback =
		deal.status === "REVISION_REQUESTED"
			? (latestBatch(deal)?.changeRequest ?? null)
			: null;
	const limit = formatBytes(UPLOAD_LIMITS.maxBytes);

	picksRef.current = picks;

	useEffect(() => {
		return () => {
			for (const pick of picksRef.current) {
				URL.revokeObjectURL(pick.previewUrl);
			}
		};
	}, []);

	function patch(localId: string, changes: Partial<PickedFile>) {
		setPicks((previous) =>
			previous.map((pick) =>
				pick.localId === localId ? { ...pick, ...changes } : pick
			)
		);
	}

	async function upload(localId: string, file: File) {
		patch(localId, { status: "uploading", error: null });

		try {
			const result = await uploadDraft(deal.id, file);

			patch(localId, { status: "ready", uploadId: result.uploadId });
		} catch (error) {
			patch(localId, {
				status: "failed",
				error:
					error instanceof ApiError
						? error.message
						: "We couldn’t reach the server."
			});
		}
	}

	function handlePick(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []);
		const problems: string[] = [];
		const added: PickedFile[] = [];
		let slots = MAX_FILES - picks.length;

		event.target.value = "";

		for (const file of files) {
			const problem = checkDraftFile(file);

			if (problem !== null) {
				problems.push(problem);
			} else if (slots <= 0) {
				problems.push(
					`You can submit up to ${MAX_FILES} drafts. Remove one to add ${file.name}.`
				);
			} else {
				slots -= 1;
				added.push({
					localId: crypto.randomUUID(),
					file,
					previewUrl: URL.createObjectURL(file),
					status: "uploading",
					uploadId: null,
					error: null
				});
			}
		}

		setPickError(problems.length > 0 ? problems.join(" ") : null);
		setPicks((previous) => [...previous, ...added]);

		for (const pick of added) {
			void upload(pick.localId, pick.file);
		}
	}

	function handleRemove(localId: string) {
		const pick = picks.find((candidate) => candidate.localId === localId);

		if (pick !== undefined) {
			URL.revokeObjectURL(pick.previewUrl);
		}

		setPicks((previous) =>
			previous.filter((candidate) => candidate.localId !== localId)
		);
	}

	const readyIds = picks.flatMap((pick) =>
		pick.uploadId !== null && pick.status === "ready" ? [pick.uploadId] : []
	);
	const isUploading = picks.some((pick) => pick.status === "uploading");

	return (
		<div className="space-y-4">
			<h3 className="font-semibold">
				Upload drafts · Round {deal.draftBatches.length + 1} of{" "}
				{UPLOAD_LIMITS.maxBatches}
			</h3>
			{feedback !== null ? (
				<div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
					<p className="font-medium text-amber-900">
						Feedback from {deal.brand.displayName}
					</p>
					<p className="mt-1 whitespace-pre-line">{feedback}</p>
				</div>
			) : null}

			<div className="space-y-1">
				<label htmlFor={inputId} className="block text-sm font-medium">
					Draft videos
				</label>
				<p id={`${inputId}-hint`} className="text-sm text-zinc-600">
					One or two MP4 options, up to {limit} each.
				</p>
				<input
					id={inputId}
					type="file"
					accept="video/mp4"
					multiple
					onChange={handlePick}
					disabled={picks.length >= MAX_FILES || runner.pending !== null}
					aria-describedby={`${inputId}-hint`}
					className="block w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:font-medium file:text-indigo-800 hover:file:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
				/>
			</div>
			{pickError !== null ? <FocusAlert>{pickError}</FocusAlert> : null}

			{picks.length > 0 ? (
				<ul className="space-y-3">
					{picks.map((pick, index) => (
						<li
							key={pick.localId}
							className="space-y-2 rounded-md border border-zinc-200 p-3"
						>
							<p className="text-sm break-words">
								<span className="font-medium">Option {index + 1}</span> ·{" "}
								{pick.file.name} · {formatBytes(pick.file.size)}
							</p>
							<video
								controls
								playsInline
								preload="metadata"
								src={pick.previewUrl}
								aria-label={`Preview of option ${index + 1}`}
								className="aspect-video w-full rounded bg-black"
							/>
							<p aria-live="polite" className="text-sm">
								{pick.status === "uploading" ? (
									<span className="text-zinc-600">Uploading…</span>
								) : null}
								{pick.status === "ready" ? (
									<span className="font-medium text-emerald-800">
										<span aria-hidden="true">✓ </span>Ready
									</span>
								) : null}
								{pick.status === "failed" ? (
									<span className="font-medium text-red-700">
										Failed — {pick.error}
									</span>
								) : null}
							</p>
							<div className="flex flex-wrap gap-2">
								{pick.status === "failed" ? (
									<Button
										variant="secondary"
										onClick={() => upload(pick.localId, pick.file)}
									>
										Retry<span className="sr-only"> option {index + 1}</span>
									</Button>
								) : null}
								<Button
									variant="secondary"
									onClick={() => handleRemove(pick.localId)}
									disabled={runner.pending !== null}
								>
									Remove<span className="sr-only"> option {index + 1}</span>
								</Button>
							</div>
						</li>
					))}
				</ul>
			) : null}

			{serverError !== null ? (
				<FocusAlert>{serverError.message}</FocusAlert>
			) : null}
			<Button
				onClick={() =>
					runner.run({
						action: "SUBMIT_DRAFTS",
						expectedVersion: deal.version,
						uploadIds: readyIds
					})
				}
				busy={runner.pending === "SUBMIT_DRAFTS"}
				busyLabel="Submitting…"
				disabled={
					readyIds.length === 0 || isUploading || runner.pending !== null
				}
				className="w-full"
			>
				{readyIds.length === 2 ? "Submit 2 drafts" : "Submit draft"}
			</Button>
		</div>
	);
}
