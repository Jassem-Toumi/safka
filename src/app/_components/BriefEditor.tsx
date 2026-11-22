"use client";

import type { BriefDraft, Campaign, Format, Objective, Product } from "@/shared/contracts";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, createCampaign, parseCampaign, updateCampaign } from "@/lib/api";
import { dollarsToCents, formatCents } from "@/lib/format";
import { errorMessage } from "@/lib/useLoad";
import { Format as FormatEnum, Objective as ObjectiveEnum } from "@/shared/contracts";
import { normalizeTopics, topicDisplayName } from "@/shared/topics";

import { BudgetBar } from "./budget";
import { FORMAT_LABELS } from "./creator";
import { ProductDialog } from "./ProductDialog";
import { Alert, Badge, Button, Card, cx, Field, Input, Select, Textarea } from "./ui";

const OBJECTIVE_LABELS: Record<Objective, string> = {
	AWARENESS: "Awareness",
	TRAFFIC: "Traffic",
	SALES: "Sales",
	CONTENT: "Content"
};

const EXAMPLE_PROMPT = "Promote our quiet mechanical keyboard to people building shared-office setups with sound test comparisons. Budget $600.";

type Props = {
	products: Product[];
	campaign: Campaign | null;
	onSaved?: (campaign: Campaign) => void;
	onProductsChanged?: () => void;
};

const centsText = (cents: number | null | undefined) => (cents ? (cents / 100).toFixed(2) : "");
const linesOf = (text: string) =>
	text
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);

/** Prompt → suggested brief → review → confirm (frontend spec §4 campaign builder). */
export function BriefEditor({ products, campaign, onSaved, onProductsChanged }: Props) {
	const router = useRouter();
	const brief = campaign?.brief ?? null;
	const [productId, setProductId] = useState(campaign?.productId ?? products[0]?.id ?? "");
	const [prompt, setPrompt] = useState(campaign?.sourcePrompt ?? "");
	const [title, setTitle] = useState(brief?.title ?? "");
	const [goal, setGoal] = useState(brief?.goal ?? "");
	const [objective, setObjective] = useState<Objective | "">(brief?.objective ?? "");
	const [topics, setTopics] = useState<string[]>(brief?.topics ?? []);
	const [topicDraft, setTopicDraft] = useState("");
	const [formats, setFormats] = useState<Format[]>(brief?.formats ?? []);
	const [talkingPoints, setTalkingPoints] = useState((brief?.talkingPoints ?? []).join("\n"));
	const [restrictions, setRestrictions] = useState((brief?.restrictions ?? []).join("\n"));
	const [budget, setBudget] = useState(centsText(campaign?.budget?.budgetCents));
	const [preferredMax, setPreferredMax] = useState(centsText(campaign?.preferredMaxPerPostCents));
	const [viewTarget, setViewTarget] = useState(campaign?.defaultViewTarget ? String(campaign.defaultViewTarget) : "");
	const [clickTarget, setClickTarget] = useState(campaign?.defaultClickTarget ? String(campaign.defaultClickTarget) : "");
	const [suggested, setSuggested] = useState<"RULES" | "AI" | null>(null);
	const [showForm, setShowForm] = useState(Boolean(campaign));
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [busy, setBusy] = useState<"generate" | "draft" | "confirm" | "close" | null>(null);
	const [addingProduct, setAddingProduct] = useState(false);
	const locked = campaign?.status === "CLOSED";

	async function generate() {
		if (!productId || !prompt.trim()) {
			setErrors({ prompt: !prompt.trim() ? "Describe the campaign first." : "", productId: !productId ? "Pick a product." : "" });
			return;
		}

		setBusy("generate");
		setFailure(null);
		setErrors({});

		try {
			const r = await parseCampaign({ productId, prompt });

			setTitle(r.brief.title);
			setGoal(r.brief.goal);
			setObjective(r.brief.objective ?? "");
			setTopics(r.brief.topics);
			setFormats(r.brief.formats);
			if (r.brief.talkingPoints.length) setTalkingPoints(r.brief.talkingPoints.join("\n"));
			if (r.brief.restrictions.length) setRestrictions(r.brief.restrictions.join("\n"));
			if (r.budgetCents) setBudget(centsText(r.budgetCents));
			if (r.preferredMaxPerPostCents) setPreferredMax(centsText(r.preferredMaxPerPostCents));
			if (r.defaultViewTarget) setViewTarget(String(r.defaultViewTarget));
			if (r.defaultClickTarget) setClickTarget(String(r.defaultClickTarget));
			setSuggested(r.mode);
			setShowForm(true);
		} catch (error) {
			// Prompt and inputs stay as typed.
			setFailure(`Couldn’t generate a brief. ${errorMessage(error)} You can enter details manually.`);
		} finally {
			setBusy(null);
		}
	}

	function addTopics(raw: string) {
		const next = normalizeTopics([...topics, ...raw.split(",")]).slice(0, 8);

		setTopics(next);
		setTopicDraft("");
	}

	function payload(): { ok: true; value: Parameters<typeof createCampaign>[0] } | { ok: false } {
		const next: Record<string, string> = {};
		const budgetCents = budget.trim() ? dollarsToCents(budget) : null;
		const maxCents = preferredMax.trim() ? dollarsToCents(preferredMax) : null;
		const views = viewTarget.trim() ? Number(viewTarget) : null;
		const clicks = clickTarget.trim() ? Number(clickTarget) : null;

		if (budget.trim() && (budgetCents === null || budgetCents <= 0)) next.budgetCents = "Enter an amount like 600 or 600.00.";
		if (preferredMax.trim() && (maxCents === null || maxCents <= 0)) next.preferredMaxPerPostCents = "Enter an amount, or leave empty.";
		if (views !== null && (!Number.isInteger(views) || views <= 0)) next.defaultViewTarget = "Whole number above zero, or leave empty.";
		if (clicks !== null && (!Number.isInteger(clicks) || clicks <= 0)) next.defaultClickTarget = "Whole number above zero, or leave empty.";
		setErrors(next);

		if (Object.keys(next).length) {
			return { ok: false };
		}

		const draft: BriefDraft = {
			title: title.trim(),
			goal: goal.trim(),
			objective: objective || null,
			topics,
			formats,
			talkingPoints: linesOf(talkingPoints).slice(0, 6),
			restrictions: linesOf(restrictions).slice(0, 6)
		};

		return {
			ok: true,
			value: {
				productId,
				sourcePrompt: prompt,
				brief: draft,
				budgetCents,
				preferredMaxPerPostCents: maxCents,
				defaultViewTarget: views,
				defaultClickTarget: clicks
			}
		};
	}

	async function save(confirm: boolean) {
		const p = payload();

		if (!p.ok) return;
		setBusy(confirm ? "confirm" : "draft");
		setFailure(null);

		try {
			const saved = campaign
				? await updateCampaign(campaign.id, { ...p.value, confirm: confirm || undefined, expectedVersion: campaign.version })
				: await createCampaign({ ...p.value, confirm: confirm || undefined });

			if (!campaign) {
				router.replace(`/brand/campaigns/${saved.id}${confirm ? "?tab=matches" : "?tab=brief"}`);
			} else {
				onSaved?.(saved);
				if (confirm && campaign.status === "DRAFT") router.replace(`/brand/campaigns/${saved.id}?tab=matches`);
			}
		} catch (error) {
			if (error instanceof ApiError) {
				setErrors(error.fields);
				setFailure(
					error.code === "STALE_CAMPAIGN"
						? "This campaign changed in another tab. Reload to see the latest; your edits are still here."
						: error.code === "BUDGET_EXCEEDED"
							? "The budget can’t go below what’s already committed and spent."
							: error.message
				);
			} else {
				setFailure(errorMessage(error));
			}
		} finally {
			setBusy(null);
		}
	}

	async function closeCampaign() {
		if (!campaign) return;
		setBusy("close");
		setFailure(null);

		try {
			onSaved?.(await updateCampaign(campaign.id, { status: "CLOSED", expectedVersion: campaign.version }));
		} catch (error) {
			setFailure(errorMessage(error));
		} finally {
			setBusy(null);
		}
	}

	const fieldError = (key: string) => errors[key] || errors[`brief.${key}`] || undefined;

	return (
		<div className="space-y-6">
			{failure ? <Alert>{failure}</Alert> : null}

			{!campaign || campaign.status === "DRAFT" ? (
				<Card className="p-5 sm:p-6">
					<div className="grid gap-4 sm:grid-cols-[260px_1fr]">
						<Field label="Product" error={errors.productId || undefined}>
							{(p) => (
								<div className="flex gap-2">
									<Select id={p.id} aria-describedby={p.describedBy} value={productId} onChange={(e) => setProductId(e.target.value)}>
										{products.length === 0 ? <option value="">No products yet</option> : null}
										{products.map((item) => (
											<option key={item.id} value={item.id}>
												{item.name}
											</option>
										))}
									</Select>
									<Button variant="secondary" onClick={() => setAddingProduct(true)} aria-label="New product">
										+
									</Button>
								</div>
							)}
						</Field>
						<Field label="What do you want to promote?" error={errors.prompt || undefined} hint="Mention a budget like “$600” and we’ll pick it up.">
							{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} rows={3} placeholder={EXAMPLE_PROMPT} value={prompt} onChange={(e) => setPrompt(e.target.value)} />}
						</Field>
					</div>
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<Button onClick={generate} busy={busy === "generate"} disabled={busy !== null && busy !== "generate"}>
							Generate brief
						</Button>
						{!showForm ? (
							<button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setShowForm(true)}>
								Enter details manually
							</button>
						) : null}
						<span aria-live="polite" className="text-sm text-muted">
							{busy === "generate" ? "Drafting a brief…" : ""}
						</span>
					</div>
				</Card>
			) : null}

			{showForm ? (
				<Card className="p-5 sm:p-6">
					<div className="mb-5 flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-[15px] font-semibold">Brief</h2>
						{suggested ? <Badge tone="info">Suggested brief · {suggested === "AI" ? "AI" : "Rules"} · review before confirming</Badge> : null}
					</div>
					<fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
						<Field label="Title" error={fieldError("title")}>
							{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={title} onChange={(e) => setTitle(e.target.value)} />}
						</Field>
						<Field label="Objective" error={fieldError("objective")}>
							{(p) => (
								<Select id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
									<option value="">Choose…</option>
									{ObjectiveEnum.options.map((o) => (
										<option key={o} value={o}>
											{OBJECTIVE_LABELS[o]}
										</option>
									))}
								</Select>
							)}
						</Field>
						<Field label="Goal" error={fieldError("goal")} className="sm:col-span-2">
							{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={goal} onChange={(e) => setGoal(e.target.value)} />}
						</Field>
						<Field label="Topics" error={fieldError("topics")} hint="Press Enter or comma to add. At least one to confirm." className="sm:col-span-2">
							{(p) => (
								<div className="space-y-2">
									<div className="flex flex-wrap gap-1.5">
										{topics.map((t) => (
											<span key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas py-0.5 pr-1 pl-2.5 text-xs font-medium">
												{topicDisplayName(t)}
												<button type="button" aria-label={`Remove ${topicDisplayName(t)}`} className="rounded-full px-1 text-muted hover:text-ink" onClick={() => setTopics(topics.filter((x) => x !== t))}>
													×
												</button>
											</span>
										))}
									</div>
									<Input
										id={p.id}
										aria-describedby={p.describedBy}
										aria-invalid={p.invalid}
										placeholder="mechanical keyboards"
										value={topicDraft}
										onChange={(e) => setTopicDraft(e.target.value)}
										onKeyDown={(e) => {
											if ((e.key === "Enter" || e.key === ",") && topicDraft.trim()) {
												e.preventDefault();
												addTopics(topicDraft);
											}
										}}
										onBlur={() => topicDraft.trim() && addTopics(topicDraft)}
									/>
								</div>
							)}
						</Field>
						<fieldset className="sm:col-span-2">
							<legend className="mb-1.5 text-sm font-medium">Formats</legend>
							<p className="mb-2 text-xs text-muted">Leave all off to stay open to any format.</p>
							<div className="flex flex-wrap gap-2">
								{FormatEnum.options.map((f) => {
									const on = formats.includes(f);

									return (
										<button
											key={f}
											type="button"
											aria-pressed={on}
											onClick={() => setFormats(on ? formats.filter((x) => x !== f) : [...formats, f])}
											className={cx("rounded-full border px-3 py-1 text-sm transition-colors", on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:bg-canvas")}
										>
											{FORMAT_LABELS[f]}
										</button>
									);
								})}
							</div>
						</fieldset>
						<Field label="Talking points" hint="One per line.">
							{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} value={talkingPoints} onChange={(e) => setTalkingPoints(e.target.value)} />}
						</Field>
						<Field label="Restrictions" hint="One per line.">
							{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />}
						</Field>
					</fieldset>

					<div className="mt-6 border-t border-line pt-5">
						<h3 className="text-sm font-semibold">Budget & targets</h3>
						<p className="mb-4 text-xs text-muted">Agreed deals reserve budget. Pending offers don’t.</p>
						<fieldset disabled={locked} className="grid gap-4 sm:grid-cols-4">
							<Field label="Total budget (USD)" error={fieldError("budgetCents")}>
								{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="decimal" placeholder="600.00" value={budget} onChange={(e) => setBudget(e.target.value)} onBlur={() => dollarsToCents(budget) && setBudget(centsText(dollarsToCents(budget)))} />}
							</Field>
							<Field label="Preferred max / post" error={fieldError("preferredMaxPerPostCents")}>
								{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="decimal" placeholder="Optional" value={preferredMax} onChange={(e) => setPreferredMax(e.target.value)} onBlur={() => dollarsToCents(preferredMax) && setPreferredMax(centsText(dollarsToCents(preferredMax)))} />}
							</Field>
							<Field label="7-day views target" error={fieldError("defaultViewTarget")}>
								{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="numeric" placeholder="Optional" value={viewTarget} onChange={(e) => setViewTarget(e.target.value)} />}
							</Field>
							<Field label="7-day clicks target" error={fieldError("defaultClickTarget")}>
								{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="numeric" placeholder="Optional" value={clickTarget} onChange={(e) => setClickTarget(e.target.value)} />}
							</Field>
						</fieldset>
						{campaign?.budget ? (
							<div className="mt-5">
								<BudgetBar budget={campaign.budget} />
							</div>
						) : null}
					</div>

					{!locked ? (
						<div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
							{campaign?.status === "ACTIVE" ? (
								<>
									<Button onClick={() => save(false)} busy={busy === "draft"} disabled={busy !== null}>
										Save changes
									</Button>
									<Button
										variant="secondary"
										onClick={closeCampaign}
										busy={busy === "close"}
										disabled={busy !== null || campaign.hasOpenNegotiations}
										title={campaign.hasOpenNegotiations ? "Close open offers first" : undefined}
									>
										Close campaign
									</Button>
									{campaign.hasOpenNegotiations ? <span className="text-xs text-muted">Pending offers must close before the campaign can.</span> : null}
								</>
							) : (
								<>
									<Button onClick={() => save(true)} busy={busy === "confirm"} disabled={busy !== null}>
										Confirm and find creators
									</Button>
									<Button variant="secondary" onClick={() => save(false)} busy={busy === "draft"} disabled={busy !== null}>
										Save draft
									</Button>
									{budget && dollarsToCents(budget) ? <span className="text-sm text-muted tabular">Cap: {formatCents(dollarsToCents(budget)!)}</span> : null}
								</>
							)}
						</div>
					) : (
						<p className="mt-6 border-t border-line pt-5 text-sm text-muted">This campaign is closed and read-only.</p>
					)}
				</Card>
			) : null}

			{addingProduct ? (
				<ProductDialog
					product={null}
					onClose={() => setAddingProduct(false)}
					onSaved={(p) => {
						setAddingProduct(false);
						setProductId(p.id);
						onProductsChanged?.();
					}}
				/>
			) : null}
		</div>
	);
}
