"use client";

import type { Deal, DealAction, DraftBatch, IssueCode, Role } from "@/shared/contracts";
import type { ReactNode } from "react";

import Link from "next/link";
import { useMemo, useState } from "react";

import { getDealReport } from "@/lib/api";
import {
	ACTION_LABELS,
	dealStateLabel,
	dealStatusTone,
	isFinalStatus,
	isoToLocalInput,
	ISSUE_LABELS,
	localInputToIso,
	localZoneName,
	nextActionText,
	paymentLabel,
	paymentTone,
	relativeHint,
	roleLabel
} from "@/lib/dealDisplay";
import { dollarsToCents, formatCents, formatDateTime } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { IssueCode as IssueCodeEnum } from "@/shared/contracts";

import { BudgetBar } from "../budget";
import { FORMAT_LABELS } from "../creator";
import { DealReportPanel } from "../Report";
import { Alert, Badge, Button, Card, CardHeader, cx, Dialog, ExternalLink, Field, Input, Select, Textarea } from "../ui";
import { DraftUploader } from "./DraftUploader";
import { DraftVideo } from "./DraftVideo";
import { useDealAction } from "./useDealAction";

type Confirm = { title: string; description: ReactNode; confirmLabel: string; tone?: "primary" | "danger"; run: () => Promise<boolean> };

/** Shared deal workspace for brand, creator and admin (frontend spec §5). */
export function DealRoom({ deal, viewer, onDeal, reload }: { deal: Deal; viewer: Role; onDeal: (d: Deal) => void; reload: () => Promise<unknown> }) {
	const { act, pending, notice } = useDealAction(deal, onDeal, reload);
	const [confirm, setConfirm] = useState<Confirm | null>(null);
	const [dialog, setDialog] = useState<"counter" | "changes" | "issue" | null>(null);
	const can = (a: DealAction) => deal.availableActions.includes(a);
	const terms = deal.agreement?.terms ?? deal.latestProposal.terms;
	const other = viewer === "CREATOR" ? deal.brand : viewer === "BRAND" ? deal.creator : null;
	const next = nextActionText(deal, viewer);
	const latestBatch = deal.draftBatches.at(-1) ?? null;

	async function confirmAndRun() {
		if (!confirm) return;
		const ok = await confirm.run();

		if (ok) setConfirm(null);
	}

	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="text-xs font-medium tracking-wide text-muted uppercase">
						{terms.product.name} · {FORMAT_LABELS[terms.format]} · YouTube
					</p>
					<h1 className="mt-2 text-3xl font-semibold tracking-tight">
						{viewer === "ADMIN" ? `${deal.brand.displayName} × ${deal.creator.displayName}` : other?.displayName}
					</h1>
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<Badge tone={dealStatusTone(deal.status)}>{dealStateLabel(deal, viewer)}</Badge>
						<span className="inline-flex items-center gap-1.5 text-xs text-muted">
							Simulated payment <Badge tone={paymentTone(deal.paymentStatus)}>{paymentLabel(deal.paymentStatus)}</Badge>
						</span>
						{deal.sample ? <Badge tone="warning">Sample deal</Badge> : null}
						{deal.isOverdue ? <Badge tone="danger">Overdue</Badge> : null}
						{next ? <span className={cx("text-sm", deal.nextActionRole === viewer ? "font-medium" : "text-muted")}>{next}</span> : null}
					</div>
				</div>
				<div className="sm:text-right">
					<p className="text-3xl font-semibold tracking-tight tabular">{formatCents(terms.amountCents)}</p>
					<p className="text-xs text-muted">{deal.agreement ? "Agreed price" : `Proposed · revision ${deal.latestProposal.revision}`}</p>
				</div>
			</header>

			<div aria-live="polite">
				{notice ? (
					<Alert tone={notice.tone}>
						{notice.text}{" "}
						{notice.expired && viewer === "BRAND" ? (
							<Link href={`/brand/creators/${deal.creator.id}`} className="font-medium underline underline-offset-4">
								Send a new offer
							</Link>
						) : null}
					</Alert>
				) : null}
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_340px]">
				<div className="space-y-6">
					{/* ---------- Next step ---------- */}
					<NextStep deal={deal} viewer={viewer}>
						{can("ACCEPT") || can("COUNTER") || can("DECLINE") ? (
							<div className="flex flex-wrap gap-2">
								{can("ACCEPT") ? (
									<Button
										onClick={() =>
											setConfirm({
												title: `Accept ${formatCents(terms.amountCents)}?`,
												description:
													viewer === "BRAND" && deal.budget
														? `This reserves ${formatCents(terms.amountCents)} of the ${formatCents(deal.budget.remainingCents)} left in the campaign. The creator then starts drafts.`
														: "You agree to these terms. Draft work starts next; payment is simulated and only held after the brand approves a draft.",
												confirmLabel: "Accept offer",
												run: () => act({ action: "ACCEPT", proposalId: deal.latestProposal.id })
											})
										}
									>
										Accept
									</Button>
								) : null}
								{can("COUNTER") ? (
									<Button variant="secondary" onClick={() => setDialog("counter")}>
										Counter
									</Button>
								) : null}
								{can("DECLINE") ? (
									<Button
										variant="ghost"
										onClick={() =>
											setConfirm({
												title: "Decline this offer?",
												description: "The negotiation ends. The other side can send a new offer later.",
												confirmLabel: "Decline",
												tone: "danger",
												run: () => act({ action: "DECLINE", proposalId: deal.latestProposal.id })
											})
										}
									>
										Decline
									</Button>
								) : null}
							</div>
						) : null}

						{can("SUBMIT_DRAFTS") ? (
							<div className="space-y-4">
								{deal.status === "REVISION_REQUESTED" && latestBatch?.changeRequest ? (
									<Alert tone="warning" title={`Changes requested on round ${latestBatch.round} of 3`}>
										“{latestBatch.changeRequest}”
									</Alert>
								) : null}
								<DraftUploader dealId={deal.id} submitting={pending === "SUBMIT_DRAFTS"} onSubmit={(uploadIds) => void act({ action: "SUBMIT_DRAFTS", uploadIds })} />
							</div>
						) : null}

						{can("SUBMIT_PUBLICATION") ? <PublishForm deal={deal} busy={pending === "SUBMIT_PUBLICATION"} onSubmit={(input) => setConfirm({ title: "Submit this link?", description: <span className="break-all">{input.url}</span>, confirmLabel: "Submit published link", run: () => act({ action: "SUBMIT_PUBLICATION", ...input, attested: true }) })} /> : null}

						{can("CONFIRM_DELIVERY") ? (
							<Button
								onClick={() =>
									setConfirm({
										title: "Confirm delivery?",
										description: deal.confirmations.length
											? "You’re the second to confirm. The deal completes and the simulated payment is released."
											: "The other party still needs to confirm before the simulated payment is released.",
										confirmLabel: "Confirm delivery",
										run: () => act({ action: "CONFIRM_DELIVERY" })
									})
								}
							>
								Confirm delivery
							</Button>
						) : null}

						{can("RESUME_DEAL") || can("CANCEL_DEAL") || can("REFUND_PAYMENT") || can("RELEASE_PAYMENT") ? (
							<AdminResolve deal={deal} pending={pending} onRun={(action, reason) => setConfirm({ title: `${ACTION_LABELS[action]}?`, description: resolutionEffect(action, deal), confirmLabel: ACTION_LABELS[action], tone: action === "CANCEL_DEAL" || action === "REFUND_PAYMENT" ? "danger" : "primary", run: () => act({ action, disputeId: deal.dispute!.id, reason }) })} />
						) : null}
					</NextStep>

					{/* ---------- Drafts ---------- */}
					{deal.draftBatches.length > 0 ? (
						<DraftsCard
							deal={deal}
							reviewing={can("APPROVE_DRAFT")}
							pending={pending}
							onApprove={(assetId, label) =>
								setConfirm({
									title: `Approve ${label}?`,
									description: "This draft is frozen as the one to publish, and the simulated payment moves to Held.",
									confirmLabel: "Approve draft",
									run: () => act({ action: "APPROVE_DRAFT", assetId })
								})
							}
							onRequestChanges={can("REQUEST_CHANGES") ? () => setDialog("changes") : null}
						/>
					) : null}

					{/* ---------- Publication ---------- */}
					{deal.publication ? (
						<Card>
							<CardHeader title="Published post" action={deal.publication.sample ? <Badge tone="warning">Sample link</Badge> : deal.publication.late ? <Badge tone="danger">Published late</Badge> : null} />
							<div className="space-y-3 p-5 text-sm">
								<ExternalLink href={deal.publication.url} className="font-medium break-all">
									{deal.publication.url}
								</ExternalLink>
								<p className="text-muted">
									Published {formatDateTime(deal.publication.publishedAt)} · Creator attested the approved draft and disclosure were used.
								</p>
								<div className="flex flex-wrap gap-2">
									{(["CREATOR", "BRAND"] as const).map((r) => {
										const c = deal.confirmations.find((x) => x.role === r);

										return (
											<Badge key={r} tone={c ? "positive" : "neutral"}>
												{roleLabel(r)} {c ? `confirmed ${formatDateTime(c.confirmedAt)}` : "hasn’t confirmed"}
											</Badge>
										);
									})}
								</div>
							</div>
						</Card>
					) : null}

					{deal.publication && viewer !== "ADMIN" ? <ReportSection dealId={deal.id} version={deal.version} /> : null}

					<Timeline deal={deal} />
				</div>

				{/* ---------- Side column ---------- */}
				<aside className="space-y-6">
					<TermsCard deal={deal} />
					{deal.budget ? (
						<Card className="p-5">
							<h2 className="mb-3 text-[15px] font-semibold">Campaign budget</h2>
							<BudgetBar budget={deal.budget} compact />
							{deal.campaignId ? (
								<Link href={`/brand/campaigns/${deal.campaignId}`} className="mt-3 inline-block text-xs font-medium underline underline-offset-4">
									Open campaign
								</Link>
							) : null}
						</Card>
					) : null}
					{deal.dispute ? <DisputeCard deal={deal} /> : null}
					{can("WITHDRAW") || can("REPORT_ISSUE") ? (
						<div className="flex flex-col gap-2">
							{can("WITHDRAW") ? (
								<Button
									variant="secondary"
									onClick={() =>
										setConfirm({
											title: "Withdraw this offer?",
											description: "The creator can no longer accept it.",
											confirmLabel: "Withdraw offer",
											tone: "danger",
											run: () => act({ action: "WITHDRAW" })
										})
									}
								>
									Withdraw offer
								</Button>
							) : null}
							{can("REPORT_ISSUE") ? (
								<Button variant="ghost" onClick={() => setDialog("issue")}>
									Report an issue
								</Button>
							) : null}
						</div>
					) : null}
				</aside>
			</div>

			<Dialog
				open={confirm !== null}
				onClose={() => setConfirm(null)}
				title={confirm?.title}
				description={confirm?.description}
				footer={
					<>
						<Button variant="ghost" onClick={() => setConfirm(null)} disabled={pending !== null}>
							Cancel
						</Button>
						<Button variant={confirm?.tone === "danger" ? "danger" : "primary"} onClick={confirmAndRun} busy={pending !== null}>
							{confirm?.confirmLabel}
						</Button>
					</>
				}
			/>

			{dialog === "counter" ? <CounterDialog deal={deal} busy={pending === "COUNTER"} onClose={() => setDialog(null)} onSubmit={async (input) => (await act({ action: "COUNTER", proposalId: deal.latestProposal.id, ...input })) && setDialog(null)} /> : null}
			{dialog === "changes" ? (
				<ReasonDialog
					title="Request changes"
					description={`Round ${latestBatch?.round ?? 1} of 3. Be specific so the next drafts land.`}
					label="What should change?"
					submitLabel="Send feedback"
					busy={pending === "REQUEST_CHANGES"}
					onClose={() => setDialog(null)}
					onSubmit={async (reason) => (await act({ action: "REQUEST_CHANGES", reason })) && setDialog(null)}
				/>
			) : null}
			{dialog === "issue" ? <IssueDialog busy={pending === "REPORT_ISSUE"} onClose={() => setDialog(null)} onSubmit={async (code, reason) => (await act({ action: "REPORT_ISSUE", code, reason })) && setDialog(null)} /> : null}
		</div>
	);
}

function NextStep({ deal, viewer, children }: { deal: Deal; viewer: Role; children: ReactNode }) {
	const hasControls = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
	const final = isFinalStatus(deal.status);

	if (!hasControls && final) return null;

	return (
		<Card className={cx(hasControls && "border-ink/20 shadow-[0_0_0_3px_var(--color-accent)]")}>
			<CardHeader title={hasControls ? "Your next step" : "Status"} description={stepHint(deal, viewer, hasControls)} />
			{hasControls ? <div className="p-5">{children}</div> : null}
		</Card>
	);
}

function stepHint(deal: Deal, viewer: Role, hasControls: boolean): string {
	const t = deal.agreement?.terms ?? deal.latestProposal.terms;

	switch (deal.status) {
		case "NEGOTIATING":
			return hasControls
				? `Accept, decline or counter. Expires ${formatDateTime(deal.latestProposal.expiresAt)} (${relativeHint(deal.latestProposal.expiresAt)}).`
				: `Waiting for a reply. Expires ${formatDateTime(deal.latestProposal.expiresAt)}.`;
		case "AGREED":
			return hasControls ? `Upload one or two draft videos by ${formatDateTime(t.draftDueAt)}.` : `Drafts due ${formatDateTime(t.draftDueAt)}.`;
		case "REVISION_REQUESTED":
			return hasControls ? "Upload replacement drafts as a new round." : "The creator is revising the drafts.";
		case "DRAFT_REVIEW":
			return viewer === "BRAND" ? "Watch the drafts below, then approve one or request changes." : "The brand is reviewing your drafts.";
		case "READY_TO_PUBLISH":
			return hasControls ? `Publish the approved draft by ${formatDateTime(t.publishDueAt)}, then submit the link.` : `Approved. Publishing due ${formatDateTime(t.publishDueAt)}.`;
		case "PUBLISHED":
			return hasControls ? "Check the public post against the agreed terms, then confirm." : "Waiting for the other party to confirm.";
		case "DISPUTED":
			return viewer === "ADMIN" ? "Pick a resolution. The payment effect is shown before you submit." : "An admin is reviewing. Normal actions are paused.";
		default:
			return "";
	}
}

function DraftsCard({
	deal,
	reviewing,
	pending,
	onApprove,
	onRequestChanges
}: {
	deal: Deal;
	reviewing: boolean;
	pending: DealAction | null;
	onApprove: (assetId: string, label: string) => void;
	onRequestChanges: (() => void) | null;
}) {
	const batches = deal.draftBatches;
	const latest = batches.at(-1)!;
	const [selected, setSelected] = useState<string | null>(latest.assets.length === 1 ? latest.assets[0]!.id : null);
	const older = batches.slice(0, -1);
	const selectedAsset = latest.assets.find((a) => a.id === selected);

	return (
		<Card>
			<CardHeader
				title={`Drafts · round ${latest.round} of 3`}
				description={`Submitted ${formatDateTime(latest.submittedAt)}${latest.late ? " · after the draft deadline" : ""}`}
				action={latest.late ? <Badge tone="danger">Late</Badge> : null}
			/>
			<div className="p-5">
				<div className={cx("grid gap-4", latest.assets.length > 1 ? "sm:grid-cols-2" : "max-w-md")} role={reviewing ? "radiogroup" : undefined} aria-label={reviewing ? "Choose a draft to approve" : undefined}>
					{latest.assets.map((a) => {
						const approved = deal.approvedAssetId === a.id;
						const isSel = selected === a.id;

						return (
							<div key={a.id} className={cx("rounded-2xl p-1.5 transition-colors", reviewing && isSel && "bg-accent", approved && "bg-positive-bg")}>
								<DraftVideo dealId={deal.id} assetId={a.id} label={a.label} sizeBytes={a.sizeBytes} />
								{reviewing ? (
									<label className="mt-2 flex cursor-pointer items-center gap-2 px-1.5 pb-1 text-sm font-medium">
										<input type="radio" name="approve" className="size-4 accent-ink" checked={isSel} onChange={() => setSelected(a.id)} />
										Choose {a.label}
									</label>
								) : approved ? (
									<p className="px-1.5 pt-2 pb-1 text-sm font-medium text-positive">✓ Approved to publish</p>
								) : null}
							</div>
						);
					})}
				</div>
				{latest.changeRequest ? <p className="mt-4 text-sm text-muted">Feedback on this round: “{latest.changeRequest}”</p> : null}
				{reviewing ? (
					<div className="mt-5 flex flex-wrap items-center gap-2">
						<Button onClick={() => selectedAsset && onApprove(selectedAsset.id, selectedAsset.label)} disabled={!selectedAsset || pending !== null}>
							Approve {selectedAsset ? selectedAsset.label : "selected draft"}
						</Button>
						{onRequestChanges ? (
							<Button variant="secondary" onClick={onRequestChanges} disabled={pending !== null}>
								Request changes
							</Button>
						) : (
							<span className="text-xs text-muted">This is the last round: approve a draft or report an issue.</span>
						)}
					</div>
				) : null}
				{older.length > 0 ? (
					<details className="mt-6 rounded-xl border border-line">
						<summary className="cursor-pointer px-4 py-3 text-sm font-medium">Earlier rounds ({older.length})</summary>
						<div className="space-y-5 border-t border-line p-4">
							{older.map((b) => (
								<OlderBatch key={b.id} dealId={deal.id} batch={b} />
							))}
						</div>
					</details>
				) : null}
			</div>
		</Card>
	);
}

function OlderBatch({ dealId, batch }: { dealId: string; batch: DraftBatch }) {
	return (
		<div>
			<p className="mb-2 text-xs text-muted">
				Round {batch.round} · {formatDateTime(batch.submittedAt)}
				{batch.changeRequest ? ` · Feedback: “${batch.changeRequest}”` : ""}
			</p>
			<div className="grid gap-3 sm:grid-cols-2">
				{batch.assets.map((a) => (
					<DraftVideo key={a.id} dealId={dealId} assetId={a.id} label={a.label} sizeBytes={a.sizeBytes} />
				))}
			</div>
		</div>
	);
}

function TermsCard({ deal }: { deal: Deal }) {
	const t = deal.agreement?.terms ?? deal.latestProposal.terms;
	const rows: [string, ReactNode][] = [
		["Price", <span key="p" className="font-semibold tabular">{formatCents(t.amountCents)}</span>],
		["Format", FORMAT_LABELS[t.format]],
		["Draft due", <Deadline key="d" iso={t.draftDueAt} />],
		["Publish by", <Deadline key="pb" iso={t.publishDueAt} />],
		["View target", t.viewTarget ? t.viewTarget.toLocaleString("en-US") : "None"],
		["Click target", t.clickTarget ? t.clickTarget.toLocaleString("en-US") : "None"]
	];

	return (
		<Card>
			<CardHeader title={deal.agreement ? "Agreed terms" : "Proposed terms"} description={deal.agreement ? `Accepted ${formatDateTime(deal.agreement.acceptedAt)}` : `From the ${roleLabel(deal.latestProposal.authorRole).toLowerCase()}`} />
			<dl className="divide-y divide-line text-sm">
				{rows.map(([k, v]) => (
					<div key={k} className="flex justify-between gap-4 px-5 py-2.5">
						<dt className="text-muted">{k}</dt>
						<dd className="text-right">{v}</dd>
					</div>
				))}
			</dl>
			<div className="space-y-3 border-t border-line p-5 text-sm">
				<TermText label="Brief">{t.brief}</TermText>
				{t.angle ? <TermText label="Suggested angle">{t.angle}</TermText> : null}
				{t.talkingPoints.length ? <TermList label="Talking points" items={t.talkingPoints} /> : null}
				{t.restrictions.length ? <TermList label="Restrictions" items={t.restrictions} /> : null}
				<TermText label="Disclosure">{t.disclosure}</TermText>
			</div>
		</Card>
	);
}

function Deadline({ iso }: { iso: string }) {
	return (
		<span>
			{formatDateTime(iso)}
			<span className="block text-xs text-faint">{relativeHint(iso)}</span>
		</span>
	);
}

function TermText({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div>
			<p className="text-xs text-muted">{label}</p>
			<p className="mt-0.5 whitespace-pre-line">{children}</p>
		</div>
	);
}

function TermList({ label, items }: { label: string; items: string[] }) {
	return (
		<div>
			<p className="text-xs text-muted">{label}</p>
			<ul className="mt-0.5 list-disc pl-4">
				{items.map((i) => (
					<li key={i}>{i}</li>
				))}
			</ul>
		</div>
	);
}

function DisputeCard({ deal }: { deal: Deal }) {
	const d = deal.dispute!;

	return (
		<Card className={d.resolvedAt ? undefined : "border-warning/40"}>
			<CardHeader title={d.resolvedAt ? "Resolved dispute" : "Under review"} action={<Badge tone={d.resolvedAt ? "neutral" : "warning"}>{ISSUE_LABELS[d.code]}</Badge>} />
			<div className="space-y-2 p-5 text-sm">
				<p>“{d.reason}”</p>
				<p className="text-xs text-muted">
					Opened by the {roleLabel(d.openedByRole).toLowerCase()} {formatDateTime(d.openedAt)} · was {d.priorStatus.toLowerCase().replace(/_/g, " ")}
				</p>
				{d.resolvedAt ? (
					<p className="border-t border-line pt-2">
						<span className="font-medium">{ACTION_LABELS[d.resolution!]}</span> · {formatDateTime(d.resolvedAt)}
						<span className="block text-muted">“{d.resolutionReason}”</span>
					</p>
				) : null}
			</div>
		</Card>
	);
}

function Timeline({ deal }: { deal: Deal }) {
	return (
		<Card>
			<CardHeader title="Timeline" />
			<ol className="p-5">
				{[...deal.timeline].reverse().map((e, i, arr) => (
					<li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
						{i < arr.length - 1 ? <span aria-hidden="true" className="absolute top-3 left-[5px] h-full w-px bg-line" /> : null}
						<span aria-hidden="true" className={cx("relative mt-1.5 size-[11px] shrink-0 rounded-full border-2", i === 0 ? "border-ink bg-accent" : "border-line-strong bg-surface")} />
						<div className="min-w-0 text-sm">
							<p>
								<span className="font-medium">{(ACTION_LABELS as Record<string, string>)[e.action] ?? e.action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>
								<span className="text-muted"> · {roleLabel(e.actorRole)}</span>
							</p>
							{e.note ? <p className="text-muted">{e.note}</p> : null}
							<p className="text-xs text-faint">{formatDateTime(e.createdAt)}</p>
						</div>
					</li>
				))}
			</ol>
		</Card>
	);
}

function ReportSection({ dealId, version }: { dealId: string; version: number }) {
	const report = useLoad(() => getDealReport(dealId), `${dealId}|${version}`);

	return report.data ? <DealReportPanel report={report.data} /> : null;
}

function PublishForm({ deal, busy, onSubmit }: { deal: Deal; busy: boolean; onSubmit: (input: { url: string; publishedAt: string }) => void }) {
	const [url, setUrl] = useState("");
	const [at, setAt] = useState(() => isoToLocalInput(new Date().toISOString()));
	const [touched, setTouched] = useState(false);
	const [attested, setAttested] = useState(false);
	const zone = useMemo(() => localZoneName(), []);
	const iso = localInputToIso(at);
	const valid = /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?|shorts\/)|youtu\.be\/)/i.test(url.trim());
	// datetime-local has minute precision; never send a time before the approval moment.
	const approvedAt = [...deal.timeline].reverse().find((e) => e.action === "APPROVE_DRAFT")?.createdAt ?? null;

	function publishedAt(): string | null {
		if (!touched) return new Date().toISOString();
		if (!iso) return null;

		return approvedAt && iso < approvedAt && Date.parse(approvedAt) - Date.parse(iso) < 60_000 ? approvedAt : iso;
	}

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				const when = publishedAt();

				if (valid && when && attested) onSubmit({ url: url.trim(), publishedAt: when });
			}}
		>
			<Field label="YouTube link" hint="A watch, Shorts or youtu.be link." error={url && !valid ? "That doesn’t look like a YouTube video link." : undefined}>
				{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="url" placeholder="https://youtu.be/…" value={url} onChange={(e) => setUrl(e.target.value)} />}
			</Field>
			<Field label={`Published at (${zone})`} hint={deal.agreement ? `Between approval and now. Due ${formatDateTime(deal.agreement.terms.publishDueAt)}.` : undefined}>
				{(p) => (
					<Input
						id={p.id}
						aria-describedby={p.describedBy}
						type="datetime-local"
						value={at}
						onChange={(e) => {
							setTouched(true);
							setAt(e.target.value);
						}}
					/>
				)}
			</Field>
			<label className="flex items-start gap-2 text-sm">
				<input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
				<span>I published the approved draft and followed the disclosure and offer requirements.</span>
			</label>
			<Button type="submit" busy={busy} disabled={!valid || !iso || !attested}>
				Review link
			</Button>
		</form>
	);
}

function CounterDialog({ deal, busy, onClose, onSubmit }: { deal: Deal; busy: boolean; onClose: () => void; onSubmit: (input: { amountCents: number; draftDueAt: string; publishDueAt: string; angle: string | null }) => void }) {
	const t = deal.latestProposal.terms;
	const [amount, setAmount] = useState((t.amountCents / 100).toFixed(2));
	const [draft, setDraft] = useState(isoToLocalInput(new Date(Math.max(Date.parse(t.draftDueAt), Date.now() + 86_400_000)).toISOString()));
	const [publish, setPublish] = useState(isoToLocalInput(new Date(Math.max(Date.parse(t.publishDueAt), Date.now() + 4 * 86_400_000)).toISOString()));
	const [angle, setAngle] = useState(t.angle ?? "");
	const cents = dollarsToCents(amount);
	const zone = useMemo(() => localZoneName(), []);
	const draftIso = localInputToIso(draft);
	const publishIso = localInputToIso(publish);
	const dateError = !draftIso || Date.parse(draftIso) <= Date.now() ? "Must be in the future." : undefined;
	const pubError = !publishIso || (draftIso && publishIso <= draftIso) ? "Must be after the draft due date." : undefined;
	const ok = cents !== null && cents > 0 && !dateError && !pubError;

	return (
		<Dialog
			open
			onClose={onClose}
			title="Counteroffer"
			description={`Current: ${formatCents(t.amountCents)}. A counter renews the 7-day expiry. Other terms stay the same.`}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button busy={busy} disabled={!ok} onClick={() => ok && onSubmit({ amountCents: cents!, draftDueAt: draftIso!, publishDueAt: publishIso!, angle: angle.trim() || null })}>
						Send counter
					</Button>
				</>
			}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field label="Price (USD)" error={amount && (cents === null || cents <= 0) ? "Enter an amount like 300.00." : undefined} className="sm:col-span-2">
					{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
				</Field>
				<Field label={`Draft due (${zone})`} error={dateError}>
					{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} />}
				</Field>
				<Field label={`Publish by (${zone})`} error={pubError}>
					{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} type="datetime-local" value={publish} onChange={(e) => setPublish(e.target.value)} />}
				</Field>
				<Field label="Video angle (optional)" className="sm:col-span-2">
					{(p) => <Textarea id={p.id} rows={2} value={angle} onChange={(e) => setAngle(e.target.value)} />}
				</Field>
			</div>
		</Dialog>
	);
}

function ReasonDialog({ title, description, label, submitLabel, busy, onClose, onSubmit }: { title: string; description: string; label: string; submitLabel: string; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
	const [reason, setReason] = useState("");

	return (
		<Dialog
			open
			onClose={onClose}
			title={title}
			description={description}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button busy={busy} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>
						{submitLabel}
					</Button>
				</>
			}
		>
			<Field label={label}>{(p) => <Textarea id={p.id} rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
		</Dialog>
	);
}

function IssueDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (code: IssueCode, reason: string) => void }) {
	const [code, setCode] = useState<IssueCode>("MISSED_DEADLINE");
	const [reason, setReason] = useState("");

	return (
		<Dialog
			open
			onClose={onClose}
			title="Report an issue"
			description="An admin reviews delivery problems. Normal actions pause and the payment state stays as it is. Low views or clicks belong in the report, not here."
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={() => onSubmit(code, reason.trim())}>
						Report issue
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				<Field label="Category">
					{(p) => (
						<Select id={p.id} value={code} onChange={(e) => setCode(e.target.value as IssueCode)}>
							{IssueCodeEnum.options.map((c) => (
								<option key={c} value={c}>
									{ISSUE_LABELS[c]}
								</option>
							))}
						</Select>
					)}
				</Field>
				<Field label="What happened?">{(p) => <Textarea id={p.id} rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
			</div>
		</Dialog>
	);
}

type Resolution = "RESUME_DEAL" | "CANCEL_DEAL" | "REFUND_PAYMENT" | "RELEASE_PAYMENT";

function resolutionEffect(action: Resolution, deal: Deal): string {
	const amount = formatCents(deal.agreement?.terms.amountCents ?? 0);

	switch (action) {
		case "RESUME_DEAL":
			return `The deal returns to “${deal.dispute?.priorStatus.toLowerCase().replace(/_/g, " ")}”. Payment stays ${paymentLabel(deal.paymentStatus).toLowerCase()}.`;
		case "CANCEL_DEAL":
			return "The deal ends as cancelled. No payment was held, so nothing moves.";
		case "REFUND_PAYMENT":
			return `The held ${amount} is returned to the brand (simulated). Any campaign commitment is freed.`;
		case "RELEASE_PAYMENT":
			return `The held ${amount} is released to the creator (simulated), overriding the confirmations.`;
	}
}

function AdminResolve({ deal, pending, onRun }: { deal: Deal; pending: DealAction | null; onRun: (action: Resolution, reason: string) => void }) {
	const options = (["RESUME_DEAL", "CANCEL_DEAL", "REFUND_PAYMENT", "RELEASE_PAYMENT"] as const).filter((a) => deal.availableActions.includes(a));
	const [choice, setChoice] = useState<Resolution>(options[0]!);
	const [reason, setReason] = useState("");

	return (
		<div className="space-y-4">
			<fieldset>
				<legend className="mb-2 text-sm font-medium">Resolution</legend>
				<div className="grid gap-2 sm:grid-cols-2">
					{options.map((a) => (
						<label key={a} className={cx("flex cursor-pointer gap-2 rounded-xl border p-3 text-sm", choice === a ? "border-ink bg-canvas" : "border-line")}>
							<input type="radio" name="resolution" className="mt-0.5 size-4 accent-ink" checked={choice === a} onChange={() => setChoice(a)} />
							<span>
								<span className="font-medium">{ACTION_LABELS[a]}</span>
								<span className="mt-0.5 block text-xs text-muted">{resolutionEffect(a, deal)}</span>
							</span>
						</label>
					))}
				</div>
			</fieldset>
			<Field label="Reason (recorded in the audit trail)">{(p) => <Textarea id={p.id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
			<Button disabled={!reason.trim() || pending !== null} busy={pending === choice} onClick={() => onRun(choice, reason.trim())}>
				{ACTION_LABELS[choice]}
			</Button>
		</div>
	);
}
