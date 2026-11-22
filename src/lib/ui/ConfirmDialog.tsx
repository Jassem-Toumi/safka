"use client";

import type { ReactNode, SyntheticEvent } from "react";

import { useEffect, useId, useRef } from "react";

import { Button } from "@/lib/ui/form";

type ConfirmDialogProps = {
	open: boolean;
	title: string;
	children: ReactNode;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
	busy: boolean;
	tone?: "default" | "danger";
};

export function ConfirmDialog({
	open,
	title,
	children,
	confirmLabel,
	onConfirm,
	onCancel,
	busy,
	tone = "default"
}: ConfirmDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const bodyId = useId();

	useEffect(() => {
		const dialog = dialogRef.current;

		if (dialog === null) {
			return;
		}

		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	/** Escape fires `cancel`; the dialog stays open until the parent flips `open`. */
	function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
		event.preventDefault();

		if (!busy) {
			onCancel();
		}
	}

	/**
	 * Browsers may close a modal on a repeated Escape even when `cancel` was
	 * prevented, so resync with `open` here.
	 */
	function handleClose() {
		if (!open) {
			return;
		}

		if (busy) {
			dialogRef.current?.showModal();

			return;
		}

		onCancel();
	}

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			aria-describedby={bodyId}
			onCancel={handleCancel}
			onClose={handleClose}
			className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-zinc-900 shadow-lg backdrop:bg-zinc-950/50"
		>
			<h2 id={titleId} className="text-lg font-semibold">
				{title}
			</h2>
			<div id={bodyId} className="mt-2 space-y-2 text-sm text-zinc-700">
				{children}
			</div>
			<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button variant="secondary" onClick={onCancel} disabled={busy}>
					Cancel
				</Button>
				<Button
					variant={tone === "danger" ? "danger" : "primary"}
					onClick={onConfirm}
					busy={busy}
				>
					{confirmLabel}
				</Button>
			</div>
		</dialog>
	);
}
