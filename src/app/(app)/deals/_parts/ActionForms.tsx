"use client";

import type { FormEvent } from "react";
import type { ActionProps } from "@/app/(app)/deals/_parts/useDealAction";
import type { CounterField, PublicationField } from "@/lib/dealForms";

import { useId, useRef, useState } from "react";

import {
	FocusAlert,
	focusFirstInvalid,
	INPUT
} from "@/app/(app)/deals/_parts/kit";
import { isoToLocalInput, timeZoneLabel } from "@/lib/dates";
import {
	latestBatch,
	validateCounter,
	validatePublication,
	validateReason
} from "@/lib/dealForms";
import { currentTerms } from "@/lib/deals";
import { formatCents, formatDateTime } from "@/lib/format";
import { ConfirmDialog } from "@/lib/ui/ConfirmDialog";
import { Button, Field, fieldDescribedBy } from "@/lib/ui/form";
import { UPLOAD_LIMITS } from "@/shared/contracts";

const COUNTER_SERVER_FIELDS: Record<string, CounterField> = {
	amountCents: "amount",
	angle: "angle",
	draftDueAt: "draftDue",
	publishDueAt: "publishDue"
};

export function CounterForm({ deal, runner }: ActionProps) {
	const id = useId();
	const formRef = useRef<HTMLFormElement>(null);
	const terms = currentTerms(deal);
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState({
		amount: (terms.amountCents / 100).toFixed(2),
		angle: terms.angle ?? "",
		draftDue: isoToLocalInput(terms.draftDueAt),
		publishDue: isoToLocalInput(terms.publishDueAt)
	});
	const [errors, setErrors] = useState<Partial<Record<CounterField, string>>>(
		{}
	);
	const serverError = runner.errorFor("COUNTER");
	const zone = timeZoneLabel();
	const allErrors: Partial<Record<CounterField, string>> = { ...errors };

	for (const [name, message] of Object.entries(serverError?.fields ?? {})) {
		const field = COUNTER_SERVER_FIELDS[name];

		if (field !== undefined) {
			allErrors[field] = message;
		}
	}

	function update(field: CounterField, value: string) {
		setInput((previous) => ({ ...previous, [field]: value }));
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const result = validateCounter(input, new Date());

		if (!result.ok) {
			setErrors(result.errors);
			focusFirstInvalid(formRef.current);

			return;
		}

		setErrors({});
		await runner.run({
			action: "COUNTER",
			expectedVersion: deal.version,
			proposalId: deal.latestProposal.id,
			...result.value
		});
	}

	if (!isOpen) {
		return (
			<Button
				variant="secondary"
				onClick={() => setIsOpen(true)}
				disabled={runner.pending !== null}
				aria-expanded={false}
				className="w-full"
			>
				Counter
			</Button>
		);
	}

	const fields: {
		name: CounterField;
		label: string;
		type: "text" | "datetime-local";
		hint?: string;
	}[] = [
		{ name: "amount", label: "Amount (USD)", type: "text" },
		{ name: "draftDue", label: `Draft due (${zone})`, type: "datetime-local" },
		{
			name: "publishDue",
			label: `Publish by (${zone})`,
			type: "datetime-local"
		}
	];

	return (
		<form
			ref={formRef}
			onSubmit={handleSubmit}
			noValidate
			className="space-y-4"
			aria-label="Counteroffer"
		>
			<h3 className="font-semibold">Counteroffer</h3>
			{fields.map(({ name, label, type }) => {
				const fieldId = `${id}-${name}`;
				const error = allErrors[name];

				return (
					<Field key={name} label={label} htmlFor={fieldId} error={error}>
						<input
							id={fieldId}
							type={type}
							inputMode={name === "amount" ? "decimal" : undefined}
							value={input[name]}
							onChange={(event) => update(name, event.target.value)}
							aria-invalid={error ? true : undefined}
							aria-describedby={fieldDescribedBy(fieldId, { error })}
							className={INPUT}
						/>
					</Field>
				);
			})}
			<Field
				label="Suggested angle (optional)"
				htmlFor={`${id}-angle`}
				error={allErrors.angle}
			>
				<textarea
					id={`${id}-angle`}
					value={input.angle}
					onChange={(event) => update("angle", event.target.value)}
					rows={3}
					maxLength={500}
					aria-invalid={allErrors.angle ? true : undefined}
					aria-describedby={fieldDescribedBy(`${id}-angle`, {
						error: allErrors.angle
					})}
					className={INPUT}
				/>
			</Field>
			{serverError !== null ? (
				<FocusAlert>{serverError.message}</FocusAlert>
			) : null}
			<div className="flex flex-col gap-2 sm:flex-row">
				<Button
					type="submit"
					busy={runner.pending === "COUNTER"}
					busyLabel="Sending…"
					disabled={runner.pending !== null}
				>
					Send counteroffer
				</Button>
				<Button
					variant="secondary"
					onClick={() => setIsOpen(false)}
					disabled={runner.pending !== null}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}

export function ApproveDraftForm({ deal, runner }: ActionProps) {
	const id = useId();
	const batch = latestBatch(deal);
	const assets = batch?.assets ?? [];
	const [selected, setSelected] = useState<string | null>(
		assets.length === 1 ? (assets[0]?.id ?? null) : null
	);
	const [choiceError, setChoiceError] = useState<string | null>(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const serverError = runner.errorFor("APPROVE_DRAFT");
	const amount = formatCents(currentTerms(deal).amountCents);
	const selectedIndex = assets.findIndex((asset) => asset.id === selected);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (selected === null) {
			setChoiceError("Choose the option to approve.");

			return;
		}

		setChoiceError(null);
		setIsConfirming(true);
	}

	async function handleConfirm() {
		if (selected === null) {
			return;
		}

		const succeeded = await runner.run({
			action: "APPROVE_DRAFT",
			expectedVersion: deal.version,
			assetId: selected
		});

		if (!succeeded) {
			setIsConfirming(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} noValidate className="space-y-3">
			<fieldset
				className="space-y-2"
				aria-describedby={choiceError ? `${id}-error` : undefined}
			>
				<legend className="font-semibold">Approve a draft</legend>
				<p className="text-sm text-fg-muted">
					<a href="#drafts" className="underline underline-offset-4">
						Watch the drafts
					</a>{" "}
					before choosing.
				</p>
				{assets.map((asset, index) => (
					<label
						key={asset.id}
						className="flex min-h-11 sm:min-h-9 cursor-pointer items-center gap-3 rounded-md border border-border-strong px-3 py-2 has-checked:border-accent has-checked:bg-accent-soft"
					>
						<input
							type="radio"
							name={`${id}-asset`}
							value={asset.id}
							checked={selected === asset.id}
							onChange={() => setSelected(asset.id)}
							className="size-4 accent-accent"
						/>
						<span className="min-w-0 break-words">
							<span className="font-medium">Option {index + 1}</span>
							<span className="text-sm text-fg-muted"> · {asset.label}</span>
						</span>
					</label>
				))}
				{choiceError ? (
					<p
						id={`${id}-error`}
						role="alert"
						className="text-sm font-medium text-danger"
					>
						{choiceError}
					</p>
				) : null}
			</fieldset>
			{serverError !== null ? (
				<FocusAlert>{serverError.message}</FocusAlert>
			) : null}
			<Button
				type="submit"
				disabled={runner.pending !== null}
				className="w-full"
			>
				Approve draft
			</Button>
			<ConfirmDialog
				open={isConfirming}
				title={`Approve Option ${selectedIndex + 1}?`}
				confirmLabel="Approve and hold payment"
				onConfirm={handleConfirm}
				onCancel={() => setIsConfirming(false)}
				busy={runner.pending === "APPROVE_DRAFT"}
			>
				<p>Approving holds the simulated payment of {amount}.</p>
				<p>
					{deal.creator.displayName} then publishes this version. The other
					option can’t be approved afterwards.
				</p>
			</ConfirmDialog>
		</form>
	);
}

export function RequestChangesForm({ deal, runner }: ActionProps) {
	const id = useId();
	const fieldId = `${id}-reason`;
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);
	const serverError = runner.errorFor("REQUEST_CHANGES");
	const shownError = error ?? serverError?.fields.reason ?? null;
	const roundsLeft = UPLOAD_LIMITS.maxBatches - deal.draftBatches.length;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const problem = validateReason(reason);

		setError(problem);

		if (problem !== null) {
			document.getElementById(fieldId)?.focus();

			return;
		}

		await runner.run({
			action: "REQUEST_CHANGES",
			expectedVersion: deal.version,
			reason: reason.trim()
		});
	}

	const hint = `${deal.creator.displayName} can submit ${roundsLeft} more ${roundsLeft === 1 ? "round" : "rounds"}.`;

	return (
		<form onSubmit={handleSubmit} noValidate className="space-y-3">
			<Field
				label="What should change?"
				htmlFor={fieldId}
				hint={hint}
				error={shownError}
			>
				<textarea
					id={fieldId}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					rows={4}
					maxLength={1000}
					aria-invalid={shownError ? true : undefined}
					aria-describedby={fieldDescribedBy(fieldId, {
						hint,
						error: shownError
					})}
					className={INPUT}
				/>
			</Field>
			{serverError !== null ? (
				<FocusAlert>{serverError.message}</FocusAlert>
			) : null}
			<Button
				type="submit"
				variant="secondary"
				busy={runner.pending === "REQUEST_CHANGES"}
				busyLabel="Sending…"
				disabled={runner.pending !== null}
				className="w-full"
			>
				Request changes
			</Button>
		</form>
	);
}

export function PublicationForm({ deal, runner }: ActionProps) {
	const id = useId();
	const formRef = useRef<HTMLFormElement>(null);
	const [input, setInput] = useState(() => ({
		url: "",
		publishedAt: isoToLocalInput(new Date().toISOString()),
		attested: false
	}));
	const [errors, setErrors] = useState<
		Partial<Record<PublicationField, string>>
	>({});
	const [confirmed, setConfirmed] = useState<{
		url: string;
		publishedAt: string;
	} | null>(null);
	const serverError = runner.errorFor("SUBMIT_PUBLICATION");
	const allErrors: Partial<Record<PublicationField, string>> = {
		...errors,
		...(serverError?.fields.url ? { url: serverError.fields.url } : {}),
		...(serverError?.fields.publishedAt
			? { publishedAt: serverError.fields.publishedAt }
			: {})
	};
	const zone = timeZoneLabel();
	const urlHint =
		"A youtube.com/watch, youtube.com/shorts or youtu.be link to the video.";
	const trimmedUrl = input.url.trim();

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const result = validatePublication(input, new Date());

		if (!result.ok) {
			setErrors(result.errors);
			focusFirstInvalid(formRef.current);

			return;
		}

		setErrors({});
		setConfirmed(result.value);
	}

	async function handleConfirm() {
		if (confirmed === null) {
			return;
		}

		const succeeded = await runner.run({
			action: "SUBMIT_PUBLICATION",
			expectedVersion: deal.version,
			url: confirmed.url,
			publishedAt: confirmed.publishedAt,
			attested: true
		});

		if (!succeeded) {
			setConfirmed(null);
			focusFirstInvalid(formRef.current);
		}
	}

	return (
		<form
			ref={formRef}
			onSubmit={handleSubmit}
			noValidate
			className="space-y-4"
			aria-label="Submit published link"
		>
			<h3 className="font-semibold">Submit your published video</h3>
			<Field
				label="YouTube link"
				htmlFor={`${id}-url`}
				hint={urlHint}
				error={allErrors.url}
			>
				<input
					id={`${id}-url`}
					type="url"
					inputMode="url"
					autoComplete="off"
					value={input.url}
					onChange={(event) =>
						setInput((previous) => ({ ...previous, url: event.target.value }))
					}
					aria-invalid={allErrors.url ? true : undefined}
					aria-describedby={fieldDescribedBy(`${id}-url`, {
						hint: urlHint,
						error: allErrors.url
					})}
					className={INPUT}
				/>
			</Field>
			{trimmedUrl !== "" ? (
				<p className="text-sm break-all text-fg-secondary">
					<span className="font-medium">Link preview:</span> {trimmedUrl}
				</p>
			) : null}
			<Field
				label={`When it went live (${zone})`}
				htmlFor={`${id}-at`}
				error={allErrors.publishedAt}
			>
				<input
					id={`${id}-at`}
					type="datetime-local"
					value={input.publishedAt}
					onChange={(event) =>
						setInput((previous) => ({
							...previous,
							publishedAt: event.target.value
						}))
					}
					aria-invalid={allErrors.publishedAt ? true : undefined}
					aria-describedby={fieldDescribedBy(`${id}-at`, {
						error: allErrors.publishedAt
					})}
					className={INPUT}
				/>
			</Field>
			<div className="space-y-1">
				<label className="flex min-h-11 sm:min-h-9 items-start gap-3">
					<input
						type="checkbox"
						checked={input.attested}
						onChange={(event) =>
							setInput((previous) => ({
								...previous,
								attested: event.target.checked
							}))
						}
						aria-invalid={allErrors.attested ? true : undefined}
						aria-describedby={
							allErrors.attested ? `${id}-attested-error` : undefined
						}
						className="mt-1 size-4 accent-accent"
					/>
					<span>
						I used the approved draft and followed the offer requirements
					</span>
				</label>
				{allErrors.attested ? (
					<p
						id={`${id}-attested-error`}
						role="alert"
						className="text-sm font-medium text-danger"
					>
						{allErrors.attested}
					</p>
				) : null}
			</div>
			{serverError !== null ? (
				<FocusAlert>{serverError.message}</FocusAlert>
			) : null}
			<Button
				type="submit"
				disabled={runner.pending !== null}
				className="w-full"
			>
				Submit published link
			</Button>
			<ConfirmDialog
				open={confirmed !== null}
				title="Submit this link?"
				confirmLabel="Submit link"
				onConfirm={handleConfirm}
				onCancel={() => setConfirmed(null)}
				busy={runner.pending === "SUBMIT_PUBLICATION"}
			>
				<p className="break-all font-medium">{confirmed?.url}</p>
				{confirmed !== null ? (
					<p>Went live {formatDateTime(confirmed.publishedAt)}</p>
				) : null}
				<p>
					{deal.brand.displayName} reviews the public link, then you both
					confirm delivery.
				</p>
			</ConfirmDialog>
		</form>
	);
}
