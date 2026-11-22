"use client";

import type { OfferErrors, OfferForm, OfferRecipient } from "@/lib/offer";
import type { Campaign, Product, TermsInput } from "@/shared/contracts";
import type { FormEvent, ReactNode } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
	FORMAT_LABELS,
	toFormat
} from "@/app/(app)/brand/_parts/briefLabels";
import {
	errorMessage,
	INPUT_CLASSES,
	LINK_CLASSES,
	LoadFailed,
	LoadingNote
} from "@/app/(app)/brand/_parts/ui";
import {
	ApiError,
	createDeal,
	getCampaign,
	listProducts,
	newIdempotencyKey
} from "@/lib/api";
import {
	normalizeMoneyText,
	parseCentsText,
	valueOf
} from "@/lib/campaignForm";
import { localInputToIso, timeZoneLabel } from "@/lib/dates";
import { formatCents, formatDateTime } from "@/lib/format";
import {
	offerErrorsFromServer,
	offerFormToInput,
	prefillOffer
} from "@/lib/offer";
import { Button, ErrorNote, Field, fieldDescribedBy } from "@/lib/ui/form";
import { useLoad } from "@/lib/ui/useLoad";
import { PROPOSAL_TTL_DAYS } from "@/shared/contracts";

type OfferComposerProps = {
	recipient: OfferRecipient;

	/** The campaign as last loaded, or null for a direct offer. */
	campaign: Campaign | null;
	onClose: () => void;
};

type Review = {
	terms: TermsInput;
	product: Product;

	/** One key per intentional submission; reused if the same send is retried. */
	idempotencyKey: string;
};

/** Where an ACTIVE_NEGOTIATION_EXISTS error points. */
type ExistingOffer = { href: string; label: string };

function zoneFor(localValue: string): string {
	const iso = localInputToIso(localValue);

	return timeZoneLabel(iso === null ? new Date() : new Date(iso));
}

function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
	return (
		<div className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
			<dt className="text-sm text-fg-muted">{term}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

function SummaryList({ items }: { items: string[] }) {
	if (items.length === 0) {
		return <span className="text-fg-subtle">None</span>;
	}

	return (
		<ul className="list-disc space-y-1 pl-5">
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

/**
 * Frontend spec §4 "Offer composer", used inline under a campaign match and
 * on a creator profile (direct offer, product picker, no campaign budget).
 */
export function OfferComposer({
	recipient,
	campaign,
	onClose
}: OfferComposerProps) {
	const router = useRouter();
	const id = useId();
	const { creator } = recipient;

	const products = useLoad(() => listProducts(), []);

	// The budget check uses the latest campaign, not the copy on screen.
	const latestCampaign = useLoad(
		() =>
			campaign === null ? Promise.resolve(null) : getCampaign(campaign.id),
		[campaign?.id]
	);

	const [form, setForm] = useState<OfferForm>(() =>
		prefillOffer(campaign, recipient, null)
	);
	const [productId, setProductId] = useState(campaign?.productId ?? "");
	const [errors, setErrors] = useState<OfferErrors>({});
	const [existingOffer, setExistingOffer] = useState<ExistingOffer | null>(
		null
	);
	const [review, setReview] = useState<Review | null>(null);
	const [isSending, setIsSending] = useState(false);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const summaryHeadingRef = useRef<HTMLHeadingElement>(null);

	const productList = products.data?.items ?? [];
	const product = productList.find((item) => item.id === productId) ?? null;
	const current = latestCampaign.data ?? campaign;
	const remainingCents = current?.budget?.remainingCents ?? null;
	const isDirect = campaign === null;

	useEffect(() => {
		headingRef.current?.focus();
	}, []);

	useEffect(() => {
		if (review !== null) {
			summaryHeadingRef.current?.focus();
		}
	}, [review]);

	// A direct offer starts from the first product and its description.
	useEffect(() => {
		const first = products.data?.items[0];

		if (isDirect && productId === "" && first !== undefined) {
			setProductId(first.id);
			setForm((previous) =>
				previous.brief === ""
					? { ...previous, brief: first.description }
					: previous
			);
		}
	}, [isDirect, products.data, productId]);

	function set<K extends keyof OfferForm>(name: K, value: OfferForm[K]) {
		setForm((previous) => ({ ...previous, [name]: value }));
	}

	function handleReview(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setExistingOffer(null);

		const now = new Date();
		const result = offerFormToInput(form, { now, remainingCents });

		if (product === null) {
			setErrors({
				...("errors" in result ? result.errors : {}),
				form: isDirect
					? "Choose a product."
					: "This campaign’s product couldn’t be loaded. Try again."
			});

			return;
		}

		if ("errors" in result) {
			setErrors(result.errors);

			return;
		}

		setErrors({});
		setReview({
			terms: result.terms,
			product,
			idempotencyKey: newIdempotencyKey()
		});
	}

	function handleEdit() {
		setReview(null);
		requestAnimationFrame(() => headingRef.current?.focus());
	}

	async function handleSend() {
		if (review === null) {
			return;
		}

		setIsSending(true);
		setErrors({});
		setExistingOffer(null);

		try {
			const deal = await createDeal(
				{
					creatorId: creator.id,
					productId: review.product.id,
					campaignId: campaign?.id ?? null,
					terms: review.terms
				},
				review.idempotencyKey
			);

			router.push(`/deals/${encodeURIComponent(deal.id)}`);
		} catch (error) {
			setIsSending(false);
			handleSendError(error);
		}
	}

	function handleSendError(error: unknown) {
		if (!(error instanceof ApiError)) {
			// Network trouble: stay on the summary; Send again reuses the key.
			setErrors({ form: `Couldn’t send the offer. ${errorMessage(error)}` });

			return;
		}

		if (error.code === "ACTIVE_NEGOTIATION_EXISTS") {
			const dealId = error.details.dealId;

			setExistingOffer(
				typeof dealId === "string"
					? {
							href: `/deals/${encodeURIComponent(dealId)}`,
							label: "Open the existing offer"
						}
					: {
							href: "/brand/deals?filter=in_progress",
							label: "See your open deals"
						}
			);

			return;
		}

		setReview(null);

		if (error.code === "BUDGET_EXCEEDED") {
			latestCampaign.reload();
			setErrors({ price: error.message });

			return;
		}

		if (error.code === "VALIDATION_ERROR") {
			setErrors({ form: error.message, ...offerErrorsFromServer(error.fields) });

			return;
		}

		setErrors({ form: error.message });
	}

	const fieldIds = {
		product: `${id}-product`,
		price: `${id}-price`,
		format: `${id}-format`,
		brief: `${id}-brief`,
		angle: `${id}-angle`,
		talkingPoints: `${id}-talking-points`,
		restrictions: `${id}-restrictions`,
		disclosure: `${id}-disclosure`,
		draftDue: `${id}-draft-due`,
		publishDue: `${id}-publish-due`,
		viewTarget: `${id}-view-target`,
		clickTarget: `${id}-click-target`
	};
	const typedCents = valueOf(parseCentsText(form.price));
	const isOverBudget =
		remainingCents !== null && typedCents !== null && typedCents > remainingCents;
	const remainingHint =
		remainingCents === null
			? undefined
			: `Campaign remaining: ${formatCents(remainingCents)}${
					latestCampaign.status === "loading" ? " (checking…)" : ""
				}`;
	const angleHint =
		"A suggestion for the creator. They can propose a different angle.";
	const draftHint = `Your time zone: ${zoneFor(form.draftDue)}`;
	const publishHint = `Your time zone: ${zoneFor(form.publishDue)}`;
	const targetHint = "Optional. Counted over the first 7 days after publishing.";

	function describe(field: keyof typeof fieldIds, hint?: string) {
		const error = errors[field as keyof OfferErrors];

		return {
			"aria-invalid": error ? true : undefined,
			"aria-describedby": fieldDescribedBy(fieldIds[field], { hint, error })
		};
	}

	return (
		<section
			aria-labelledby={`${id}-heading`}
			className="space-y-5 rounded-lg border border-accent-line bg-surface p-4 shadow-panel sm:p-5"
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<h3
					id={`${id}-heading`}
					ref={headingRef}
					tabIndex={-1}
					className="text-lg font-semibold focus:outline-none"
				>
					Offer to {creator.displayName}
				</h3>
				<Button variant="secondary" onClick={onClose} disabled={isSending}>
					Close
				</Button>
			</div>

			{products.status === "failed" ? (
				<LoadFailed
					what="your products"
					error={products.error}
					onRetry={products.reload}
				/>
			) : null}

			{products.status === "loading" && products.data === null ? (
				<LoadingNote>Loading offer details…</LoadingNote>
			) : null}

			{latestCampaign.status === "failed" ? (
				<p role="alert" className="text-sm text-warning">
					Couldn’t refresh the campaign budget, so the remaining amount may be
					out of date.{" "}
					<button
						type="button"
						onClick={latestCampaign.reload}
						className={`min-h-11 sm:min-h-9 ${LINK_CLASSES}`}
					>
						Check again
					</button>
				</p>
			) : null}

			{review === null ? (
				<form noValidate onSubmit={handleReview} className="space-y-5">
					{isDirect ? (
						<Field
							label="Product"
							htmlFor={fieldIds.product}
							hint="No campaign budget applies to a direct offer."
						>
							<select
								id={fieldIds.product}
								value={productId}
								onChange={(event) => setProductId(event.target.value)}
								aria-describedby={fieldDescribedBy(fieldIds.product, {
									hint: "No campaign budget applies to a direct offer."
								})}
								className={INPUT_CLASSES}
							>
								{productList.length === 0 ? (
									<option value="">No products yet</option>
								) : null}
								{productList.map((item) => (
									<option key={item.id} value={item.id}>
										{item.name}
									</option>
								))}
							</select>
							{products.status === "ready" && productList.length === 0 ? (
								<p className="text-sm">
									<Link href="/brand/products" className={LINK_CLASSES}>
										Add a product
									</Link>{" "}
									before sending an offer.
								</p>
							) : null}
						</Field>
					) : (
						<p className="text-sm text-fg-secondary">
							<span className="text-fg-muted">Product: </span>
							<span className="font-medium">{product?.name ?? "…"}</span>
						</p>
					)}

					<div className="grid gap-5 sm:grid-cols-2">
						<Field
							label="Price (USD)"
							htmlFor={fieldIds.price}
							hint={remainingHint}
							error={errors.price}
						>
							<input
								id={fieldIds.price}
								type="text"
								inputMode="decimal"
								value={form.price}
								onChange={(event) => set("price", event.target.value)}
								onBlur={(event) =>
									set("price", normalizeMoneyText(event.target.value))
								}
								placeholder="$250.00"
								required
								{...describe("price", remainingHint)}
								className={INPUT_CLASSES}
							/>
						</Field>
						<Field label="Format" htmlFor={fieldIds.format} error={errors.format}>
							<select
								id={fieldIds.format}
								value={form.format}
								onChange={(event) =>
									set("format", toFormat(event.target.value) ?? "")
								}
								required
								{...describe("format")}
								className={INPUT_CLASSES}
							>
								<option value="">Choose a format</option>
								{Object.entries(FORMAT_LABELS).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</Field>
					</div>

					<Field label="Brief" htmlFor={fieldIds.brief} error={errors.brief}>
						<textarea
							id={fieldIds.brief}
							value={form.brief}
							onChange={(event) => set("brief", event.target.value)}
							rows={3}
							maxLength={2000}
							required
							{...describe("brief")}
							className={INPUT_CLASSES}
						/>
					</Field>

					<Field
						label="Suggested video angle"
						htmlFor={fieldIds.angle}
						hint={angleHint}
						error={errors.angle}
					>
						<textarea
							id={fieldIds.angle}
							value={form.angle}
							onChange={(event) => set("angle", event.target.value)}
							rows={2}
							maxLength={500}
							{...describe("angle", angleHint)}
							className={INPUT_CLASSES}
						/>
					</Field>

					<div className="grid gap-5 sm:grid-cols-2">
						<Field
							label="Talking points"
							htmlFor={fieldIds.talkingPoints}
							hint="Optional. One per line, up to 6."
							error={errors.talkingPoints}
						>
							<textarea
								id={fieldIds.talkingPoints}
								value={form.talkingPoints}
								onChange={(event) => set("talkingPoints", event.target.value)}
								rows={3}
								{...describe("talkingPoints", "Optional. One per line, up to 6.")}
								className={INPUT_CLASSES}
							/>
						</Field>
						<Field
							label="Restrictions"
							htmlFor={fieldIds.restrictions}
							hint="Optional. One per line, up to 6."
							error={errors.restrictions}
						>
							<textarea
								id={fieldIds.restrictions}
								value={form.restrictions}
								onChange={(event) => set("restrictions", event.target.value)}
								rows={3}
								{...describe("restrictions", "Optional. One per line, up to 6.")}
								className={INPUT_CLASSES}
							/>
						</Field>
					</div>

					<Field
						label="Sponsorship disclosure"
						htmlFor={fieldIds.disclosure}
						error={errors.disclosure}
					>
						<textarea
							id={fieldIds.disclosure}
							value={form.disclosure}
							onChange={(event) => set("disclosure", event.target.value)}
							rows={2}
							maxLength={500}
							required
							{...describe("disclosure")}
							className={INPUT_CLASSES}
						/>
					</Field>

					<div className="grid gap-5 sm:grid-cols-2">
						<Field
							label="Draft due"
							htmlFor={fieldIds.draftDue}
							hint={draftHint}
							error={errors.draftDue}
						>
							<input
								id={fieldIds.draftDue}
								type="datetime-local"
								value={form.draftDue}
								onChange={(event) => set("draftDue", event.target.value)}
								required
								{...describe("draftDue", draftHint)}
								className={INPUT_CLASSES}
							/>
						</Field>
						<Field
							label="Publish by"
							htmlFor={fieldIds.publishDue}
							hint={publishHint}
							error={errors.publishDue}
						>
							<input
								id={fieldIds.publishDue}
								type="datetime-local"
								value={form.publishDue}
								onChange={(event) => set("publishDue", event.target.value)}
								required
								{...describe("publishDue", publishHint)}
								className={INPUT_CLASSES}
							/>
						</Field>
						<Field
							label="7-day view target"
							htmlFor={fieldIds.viewTarget}
							hint={targetHint}
							error={errors.viewTarget}
						>
							<input
								id={fieldIds.viewTarget}
								type="text"
								inputMode="numeric"
								value={form.viewTarget}
								onChange={(event) => set("viewTarget", event.target.value)}
								{...describe("viewTarget", targetHint)}
								className={INPUT_CLASSES}
							/>
						</Field>
						<Field
							label="7-day click target"
							htmlFor={fieldIds.clickTarget}
							hint={targetHint}
							error={errors.clickTarget}
						>
							<input
								id={fieldIds.clickTarget}
								type="text"
								inputMode="numeric"
								value={form.clickTarget}
								onChange={(event) => set("clickTarget", event.target.value)}
								{...describe("clickTarget", targetHint)}
								className={INPUT_CLASSES}
							/>
						</Field>
					</div>

					<ErrorNote>{errors.form}</ErrorNote>

					<div className="flex flex-col gap-2 border-t border-divider pt-4 sm:flex-row sm:items-center">
						<Button type="submit" disabled={isOverBudget || product === null}>
							Review offer
						</Button>
						{isOverBudget ? (
							<p className="text-sm text-danger">
								The price is more than the campaign has left.
							</p>
						) : null}
					</div>
				</form>
			) : (
				<div className="space-y-4">
					<div>
						<h4
							ref={summaryHeadingRef}
							tabIndex={-1}
							className="font-semibold focus:outline-none"
						>
							What {creator.displayName} will see
						</h4>
						<p className="mt-1 text-sm text-fg-muted">
							They can accept, decline or counter with a different price, dates
							or angle. The offer expires after {PROPOSAL_TTL_DAYS} days.
							{isDirect
								? ""
								: " Sending doesn’t reserve budget; an accepted offer does."}
						</p>
					</div>

					<dl className="divide-y divide-divider rounded-md border border-border px-3">
						<SummaryRow term="Product">{review.product.name}</SummaryRow>
						<SummaryRow term="Price">
							<span className="font-medium tabular-nums">
								{formatCents(review.terms.amountCents)}
							</span>
							{remainingCents !== null ? (
								<span className="text-sm text-fg-muted">
									{" "}
									· {formatCents(remainingCents)} left in the campaign
								</span>
							) : null}
						</SummaryRow>
						<SummaryRow term="Format">
							{FORMAT_LABELS[review.terms.format]}
						</SummaryRow>
						<SummaryRow term="Brief">{review.terms.brief}</SummaryRow>
						<SummaryRow term="Suggested angle">
							{review.terms.angle ?? <span className="text-fg-subtle">None</span>}
						</SummaryRow>
						<SummaryRow term="Talking points">
							<SummaryList items={review.terms.talkingPoints} />
						</SummaryRow>
						<SummaryRow term="Restrictions">
							<SummaryList items={review.terms.restrictions} />
						</SummaryRow>
						<SummaryRow term="Disclosure">{review.terms.disclosure}</SummaryRow>
						<SummaryRow term="Draft due">
							{formatDateTime(review.terms.draftDueAt)}
						</SummaryRow>
						<SummaryRow term="Publish by">
							{formatDateTime(review.terms.publishDueAt)}
						</SummaryRow>
						<SummaryRow term="7-day targets">
							{review.terms.viewTarget === null &&
							review.terms.clickTarget === null ? (
								<span className="text-fg-subtle">None</span>
							) : (
								[
									review.terms.viewTarget === null
										? null
										: `${review.terms.viewTarget.toLocaleString("en-US")} views`,
									review.terms.clickTarget === null
										? null
										: `${review.terms.clickTarget.toLocaleString("en-US")} clicks`
								]
									.filter((part) => part !== null)
									.join(" · ")
							)}
						</SummaryRow>
					</dl>

					<ErrorNote>{errors.form}</ErrorNote>
					{existingOffer !== null ? (
						<div
							role="alert"
							className="space-y-1 rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning"
						>
							<p>You already have an open offer with {creator.displayName}.</p>
							<Link href={existingOffer.href} className={LINK_CLASSES}>
								{existingOffer.label}
							</Link>
						</div>
					) : null}

					<div className="flex flex-col-reverse gap-2 sm:flex-row">
						<Button variant="secondary" onClick={handleEdit} disabled={isSending}>
							Edit offer
						</Button>
						<Button
							onClick={handleSend}
							busy={isSending}
							busyLabel="Sending…"
							disabled={isOverBudget || existingOffer !== null}
						>
							Send offer
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
