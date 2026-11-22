"use client";

import type { Campaign, CreatorCard, Format, Product, TermsInput } from "@/shared/contracts";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { ApiError, createDeal, newIdempotencyKey } from "@/lib/api";
import { isoToLocalInput, localInputToIso, localZoneName } from "@/lib/dealDisplay";
import { dollarsToCents, formatCents, formatDateTime } from "@/lib/format";
import { Format as FormatEnum } from "@/shared/contracts";

import { FORMAT_LABELS } from "./creator";
import { Alert, Button, Dialog, Field, Input, Select, Textarea } from "./ui";

const DAY = 86_400_000;
const DEFAULT_DISCLOSURE = "Say “sponsored by” the brand in the first 30 seconds and add #ad to the description.";

type Props = {
	open: boolean;
	onClose: () => void;
	creator: CreatorCard;
	products: Product[];
	campaign?: Campaign | null;
	angle?: string | null;
};

const lines = (text: string) =>
	text
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean)
		.slice(0, 6);

/** One composer for direct and campaign offers (frontend spec §4). */
export function OfferComposer({ open, onClose, creator, products, campaign = null, angle = null }: Props) {
	const router = useRouter();
	const brief = campaign?.brief ?? null;
	const campaignFormat = brief?.formats.find((f) => creator.formats.some((c) => c.value === f));
	const [productId, setProductId] = useState(campaign?.productId ?? products[0]?.id ?? "");
	const [format, setFormat] = useState<Format>((campaignFormat ?? creator.formats[0]?.value ?? "REVIEW") as Format);
	const [amount, setAmount] = useState(creator.rate ? (creator.rate.minCents / 100).toFixed(2) : "");
	const [briefText, setBriefText] = useState(brief ? `${brief.goal}` : "");
	const [angleText, setAngleText] = useState(angle ?? "");
	const [talkingPoints, setTalkingPoints] = useState((brief?.talkingPoints ?? []).join("\n"));
	const [restrictions, setRestrictions] = useState((brief?.restrictions ?? []).join("\n"));
	const [disclosure, setDisclosure] = useState(DEFAULT_DISCLOSURE);
	const [draftDue, setDraftDue] = useState(() => isoToLocalInput(new Date(Date.now() + 5 * DAY).toISOString()));
	const [publishDue, setPublishDue] = useState(() => isoToLocalInput(new Date(Date.now() + 10 * DAY).toISOString()));
	const [viewTarget, setViewTarget] = useState(campaign?.defaultViewTarget ? String(campaign.defaultViewTarget) : "");
	const [clickTarget, setClickTarget] = useState(campaign?.defaultClickTarget ? String(campaign.defaultClickTarget) : "");
	const [step, setStep] = useState<"edit" | "review">("edit");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [serverError, setServerError] = useState<{ message: string; dealId?: string } | null>(null);
	const [sending, setSending] = useState(false);
	const keyRef = useRef<string | null>(null);

	const remaining = campaign?.budget?.remainingCents ?? null;
	const amountCents = dollarsToCents(amount);
	const product = products.find((p) => p.id === productId) ?? null;
	const zone = useMemo(() => localZoneName(), []);

	function validate(): TermsInput | null {
		const next: Record<string, string> = {};
		const draftIso = localInputToIso(draftDue);
		const publishIso = localInputToIso(publishDue);

		if (!productId) next.productId = "Pick a product.";
		if (amountCents === null || amountCents <= 0) next.amount = "Enter a positive amount, like 250 or 250.00.";
		else if (remaining !== null && amountCents > remaining) next.amount = `More than the ${formatCents(remaining)} left in this campaign.`;
		if (!briefText.trim()) next.brief = "Describe what the video should cover.";
		if (!disclosure.trim()) next.disclosure = "Sponsorship disclosure instructions are required.";
		if (!draftIso || new Date(draftIso).getTime() <= Date.now()) next.draftDue = "Pick a future date.";
		if (!publishIso || (draftIso && publishIso <= draftIso)) next.publishDue = "Must be after the draft due date.";
		const views = viewTarget ? Number(viewTarget) : null;
		const clicks = clickTarget ? Number(clickTarget) : null;
		if (views !== null && (!Number.isInteger(views) || views <= 0)) next.viewTarget = "Whole number above zero, or leave empty.";
		if (clicks !== null && (!Number.isInteger(clicks) || clicks <= 0)) next.clickTarget = "Whole number above zero, or leave empty.";
		setErrors(next);

		if (Object.keys(next).length > 0) {
			return null;
		}

		return {
			amountCents: amountCents!,
			format,
			brief: briefText.trim(),
			angle: angleText.trim() || null,
			talkingPoints: lines(talkingPoints),
			restrictions: lines(restrictions),
			disclosure: disclosure.trim(),
			draftDueAt: draftIso!,
			publishDueAt: publishIso!,
			viewTarget: views,
			clickTarget: clicks
		};
	}

	async function send() {
		const terms = validate();

		if (terms === null) {
			setStep("edit");
			return;
		}

		keyRef.current ??= newIdempotencyKey();
		setSending(true);
		setServerError(null);

		try {
			const deal = await createDeal({ creatorId: creator.id, productId, campaignId: campaign?.id ?? null, terms }, keyRef.current);

			router.push(`/deals/${deal.id}`);
		} catch (error) {
			keyRef.current = null;
			setSending(false);

			if (error instanceof ApiError) {
				const dealId = typeof error.details.dealId === "string" ? error.details.dealId : undefined;

				setServerError({ message: error.message, dealId });
				setErrors(error.fields);
				setStep("edit");
			} else {
				setServerError({ message: "The server didn’t respond. Your offer is kept here; try again." });
			}
		}
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			wide
			title={step === "edit" ? `Offer to ${creator.displayName}` : "Review and send"}
			description={
				campaign ? (
					<>
						Campaign offer · {formatCents(remaining ?? 0)} remaining. Pending offers don’t reserve budget; accepted ones do.
					</>
				) : (
					"Direct offer · not tied to a campaign budget."
				)
			}
			footer={
				step === "edit" ? (
					<>
						<Button variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={() => validate() && setStep("review")}>Review offer</Button>
					</>
				) : (
					<>
						<Button variant="ghost" onClick={() => setStep("edit")} disabled={sending}>
							Back to edit
						</Button>
						<Button onClick={send} busy={sending}>
							Send offer
						</Button>
					</>
				)
			}
		>
			{serverError ? (
				<div className="mb-4">
					<Alert title="The offer wasn’t sent">
						{serverError.message}{" "}
						{serverError.dealId ? (
							<Link href={`/deals/${serverError.dealId}`} className="font-medium underline underline-offset-4">
								Open the existing offer
							</Link>
						) : null}
					</Alert>
				</div>
			) : null}

			{step === "edit" ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="Product" error={errors.productId} hint={campaign ? "Campaign offers use the campaign’s product." : undefined}>
						{(p) => (
							<Select id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={productId} disabled={Boolean(campaign)} onChange={(e) => setProductId(e.target.value)}>
								{products.map((item) => (
									<option key={item.id} value={item.id}>
										{item.name}
									</option>
								))}
							</Select>
						)}
					</Field>
					<Field label="Format">
						{(p) => (
							<Select id={p.id} value={format} onChange={(e) => setFormat(e.target.value as Format)}>
								{FormatEnum.options.map((f) => (
									<option key={f} value={f}>
										{FORMAT_LABELS[f]}
									</option>
								))}
							</Select>
						)}
					</Field>
					<Field label="Price (USD)" error={errors.amount ?? errors["terms.amountCents"]} hint={creator.rate ? `Creator’s rate: ${formatCents(creator.rate.minCents)}–${formatCents(creator.rate.maxCents)}` : "Creator hasn’t shared a rate."}>
						{(p) => (
							<Input
								id={p.id}
								aria-describedby={p.describedBy}
								aria-invalid={p.invalid}
								inputMode="decimal"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								onBlur={() => amountCents !== null && setAmount((amountCents / 100).toFixed(2))}
								placeholder="250.00"
							/>
						)}
					</Field>
					<div className="hidden sm:block" />
					<Field label={`Draft due (${zone})`} error={errors.draftDue ?? errors["terms.draftDueAt"]}>
						{(p) => <Input id={p.id} type="datetime-local" aria-describedby={p.describedBy} aria-invalid={p.invalid} value={draftDue} onChange={(e) => setDraftDue(e.target.value)} />}
					</Field>
					<Field label={`Publish by (${zone})`} error={errors.publishDue ?? errors["terms.publishDueAt"]}>
						{(p) => <Input id={p.id} type="datetime-local" aria-describedby={p.describedBy} aria-invalid={p.invalid} value={publishDue} onChange={(e) => setPublishDue(e.target.value)} />}
					</Field>
					<Field label="Brief" error={errors.brief} className="sm:col-span-2">
						{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={briefText} onChange={(e) => setBriefText(e.target.value)} />}
					</Field>
					<Field label="Suggested video angle" hint="A suggestion for the creator. They choose the final concept." className="sm:col-span-2">
						{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} rows={2} value={angleText} onChange={(e) => setAngleText(e.target.value)} />}
					</Field>
					<Field label="Talking points" hint="One per line, up to 6.">
						{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} value={talkingPoints} onChange={(e) => setTalkingPoints(e.target.value)} />}
					</Field>
					<Field label="Restrictions" hint="One per line, up to 6.">
						{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />}
					</Field>
					<Field label="Sponsorship disclosure" error={errors.disclosure} className="sm:col-span-2">
						{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} rows={2} value={disclosure} onChange={(e) => setDisclosure(e.target.value)} />}
					</Field>
					<Field label="7-day view target (optional)" error={errors.viewTarget}>
						{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="numeric" value={viewTarget} onChange={(e) => setViewTarget(e.target.value)} />}
					</Field>
					<Field label="7-day click target (optional)" error={errors.clickTarget}>
						{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="numeric" value={clickTarget} onChange={(e) => setClickTarget(e.target.value)} />}
					</Field>
				</div>
			) : (
				<div className="space-y-4">
					<dl className="grid grid-cols-2 gap-4 rounded-xl bg-canvas p-4 text-sm">
						<div>
							<dt className="text-muted">Price</dt>
							<dd className="text-lg font-semibold tabular">{amountCents !== null ? formatCents(amountCents) : "—"}</dd>
						</div>
						<div>
							<dt className="text-muted">Format</dt>
							<dd className="font-medium">{FORMAT_LABELS[format]}</dd>
						</div>
						<div>
							<dt className="text-muted">Draft due</dt>
							<dd className="font-medium">{localInputToIso(draftDue) ? formatDateTime(localInputToIso(draftDue)!) : "—"}</dd>
						</div>
						<div>
							<dt className="text-muted">Publish by</dt>
							<dd className="font-medium">{localInputToIso(publishDue) ? formatDateTime(localInputToIso(publishDue)!) : "—"}</dd>
						</div>
						<div className="col-span-2">
							<dt className="text-muted">Product</dt>
							<dd className="font-medium">{product?.name ?? "—"}</dd>
						</div>
					</dl>
					<p className="text-sm text-muted">
						{creator.displayName} can accept, decline or counter. Offers expire after 7 days. Nothing is charged; payment is simulated and is only held once you approve a draft.
					</p>
				</div>
			)}
		</Dialog>
	);
}
