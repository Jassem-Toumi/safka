"use client";

import type { CreatorCard, CreatorProfile, CreatorProfileFields, EnrichmentResult, Format, Label } from "@/shared/contracts";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ApiError, getCreatorProfile, runEnrichment, saveCreatorProfile, setProfileVisibility } from "@/lib/api";
import { dollarsToCents } from "@/lib/format";
import { errorMessage } from "@/lib/useLoad";
import { Format as FormatEnum } from "@/shared/contracts";
import { normalizeTopics, topicDisplayName } from "@/shared/topics";

import { Avatar, CreatorFacts, DataModeBadge, EvidenceRow, FORMAT_LABELS, LabelChip } from "./creator";
import { Alert, Badge, Button, Card, CardHeader, cx, Dialog, Field, Input, Spinner, Textarea } from "./ui";

const PROVIDER_ERRORS: Record<string, string> = {
	TIMEOUT: "You.com took longer than 12 seconds.",
	QUOTA_EXCEEDED: "The You.com search quota is used up for now.",
	AUTH_FAILED: "The You.com key was rejected.",
	PROVIDER_ERROR: "You.com returned an error.",
	BAD_RESPONSE: "You.com sent a response we couldn’t read."
};

const centsText = (cents: number | undefined) => (cents ? (cents / 100).toFixed(2) : "");

type Props = { initial: CreatorProfile; onboarding: boolean };

/** Shared editor for `/creator/onboarding` and `/creator/profile` (frontend spec §3). */
export function ProfileEditor({ initial, onboarding }: Props) {
	const router = useRouter();
	const [profile, setProfile] = useState(initial);
	const [draft, setDraft] = useState<CreatorProfileFields>(initial.draft);
	const [rateMin, setRateMin] = useState(centsText(initial.draft.rate?.minCents));
	const [rateMax, setRateMax] = useState(centsText(initial.draft.rate?.maxCents));
	const [views, setViews] = useState(initial.draft.typical7dViews === null ? "" : String(initial.draft.typical7dViews));
	const [topicDraft, setTopicDraft] = useState("");
	const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(initial.lastEnrichment);
	const [busy, setBusy] = useState<"save" | "search" | "publish" | "hide" | null>(null);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState<{ tone: "danger" | "info" | "positive"; text: string } | null>(null);
	const [optIn, setOptIn] = useState(false);
	const [confirmHide, setConfirmHide] = useState(false);

	const listed = profile.visibility === "LISTED";
	const channelChanged = draft.channel.trim() !== profile.draft.channel;
	const canSearch = Boolean(profile.canonicalChannelUrl) && !channelChanged;

	function setField<K extends keyof CreatorProfileFields>(key: K, value: CreatorProfileFields[K]) {
		setDraft((d) => ({ ...d, [key]: value }));
	}

	function buildInput(): CreatorProfileFields | null {
		const next: Record<string, string> = {};
		const min = rateMin.trim() ? dollarsToCents(rateMin) : null;
		const max = rateMax.trim() ? dollarsToCents(rateMax) : min;
		const v = views.trim() ? Number(views.replace(/,/g, "")) : null;

		if ((rateMin.trim() && (min === null || min <= 0)) || (rateMax.trim() && (max === null || max <= 0))) next.rate = "Enter amounts like 200 or 200.00.";
		else if (min !== null && max !== null && min > max) next.rate = "Minimum must be at most the maximum.";
		if (v !== null && (!Number.isInteger(v) || v < 0)) next.typical7dViews = "Whole number, or leave empty.";
		setErrors(next);

		if (Object.keys(next).length) return null;

		return { ...draft, rate: min !== null && max !== null ? { minCents: min, maxCents: max } : null, typical7dViews: v };
	}

	async function save(): Promise<CreatorProfile | null> {
		const input = buildInput();

		if (input === null) return null;
		setBusy("save");
		setNotice(null);

		try {
			const saved = await saveCreatorProfile({ ...input, expectedVersion: profile.version });

			setProfile(saved);
			setDraft(saved.draft);
			if (saved.lastEnrichment === null || saved.canonicalChannelUrl !== profile.canonicalChannelUrl) setEnrichment(saved.lastEnrichment);

			return saved;
		} catch (error) {
			if (error instanceof ApiError && error.code === "STALE_PROFILE") {
				setNotice({ tone: "info", text: "Your profile changed in another tab. We kept what you typed; save again to overwrite." });
				// Refresh the version so the next save applies on top of the latest.
				setProfile((p) => ({ ...p, version: typeof error.details.version === "number" ? error.details.version : p.version }));
			} else {
				setErrors(error instanceof ApiError ? error.fields : {});
				setNotice({ tone: "danger", text: errorMessage(error) });
			}

			return null;
		} finally {
			setBusy(null);
		}
	}

	async function search() {
		setBusy("search");
		setNotice(null);

		try {
			const result = await runEnrichment();

			setEnrichment(result);
			// New sources live on the saved profile; keep the creator's unsaved typing.
			setProfile(await getCreatorProfile());
		} catch (error) {
			setNotice({ tone: "danger", text: errorMessage(error) });
		} finally {
			setBusy(null);
		}
	}

	async function publish() {
		const saved = await save();

		if (saved === null) return;
		setBusy("publish");

		try {
			const next = await setProfileVisibility({ visibility: "LISTED", expectedVersion: saved.version });

			setProfile(next);
			setNotice({ tone: "positive", text: "Your profile is live for brands." });
			if (onboarding) router.push("/creator/inbox");
		} catch (error) {
			setErrors(error instanceof ApiError ? error.fields : {});
			setNotice({ tone: "danger", text: errorMessage(error) });
		} finally {
			setBusy(null);
		}
	}

	async function hide() {
		setBusy("hide");

		try {
			setProfile(await setProfileVisibility({ visibility: "HIDDEN", expectedVersion: profile.version }));
			setConfirmHide(false);
		} catch (error) {
			setNotice({ tone: "danger", text: errorMessage(error) });
		} finally {
			setBusy(null);
		}
	}

	function toggleEvidence(id: string) {
		setField("selectedEvidenceIds", draft.selectedEvidenceIds.includes(id) ? draft.selectedEvidenceIds.filter((x) => x !== id) : [...draft.selectedEvidenceIds, id]);
	}

	function toggleTopic(value: string) {
		setField("topics", draft.topics.includes(value) ? draft.topics.filter((t) => t !== value) : normalizeTopics([...draft.topics, value]).slice(0, 8));
	}

	function toggleFormat(value: Format) {
		setField("formats", draft.formats.includes(value) ? draft.formats.filter((f) => f !== value) : [...draft.formats, value].slice(0, 4));
	}

	/** Accepting a suggested tag also keeps the sources behind it. */
	function acceptSuggestion(label: Label, kind: "topic" | "format") {
		if (kind === "topic") {
			if (!draft.topics.includes(label.value)) setField("topics", normalizeTopics([...draft.topics, label.value]).slice(0, 8));
		} else if (!draft.formats.includes(label.value as Format)) {
			setField("formats", [...draft.formats, label.value as Format].slice(0, 4));
		}

		setDraft((d) => ({ ...d, selectedEvidenceIds: [...new Set([...d.selectedEvidenceIds, ...label.evidenceIds])] }));
	}

	const preview = useMemo(() => previewCard(profile, draft, enrichment), [profile, draft, enrichment]);
	const evidenceList = profile.evidence;
	const status = enrichment?.status;

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
			<div className="space-y-6">
				{notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

				<Card>
					<CardHeader title="1 · Your channel" description="We’ll look up public sources about this channel. Your channel link is self-attested." />
					<div className="grid gap-4 p-5 sm:grid-cols-2">
						<Field label="Display name" error={errors.displayName}>
							{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={draft.displayName} onChange={(e) => setField("displayName", e.target.value)} />}
						</Field>
						<Field label="YouTube channel" hint="For example @YourChannel or youtube.com/@YourChannel" error={errors.channel}>
							{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} placeholder="@YourChannel" value={draft.channel} onChange={(e) => setField("channel", e.target.value)} />}
						</Field>
						<Field label="Short bio" error={errors.bio} className="sm:col-span-2">
							{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={draft.bio} onChange={(e) => setField("bio", e.target.value)} />}
						</Field>
						<Field label="Rate per post (USD, optional)" error={errors.rate ?? errors["rate.maxCents"]} hint="A range brands can compare. Leave empty for “Rate not provided”.">
							{(p) => (
								<div className="flex items-center gap-2">
									<Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} aria-label="Minimum rate" inputMode="decimal" placeholder="Min" value={rateMin} onChange={(e) => setRateMin(e.target.value)} onBlur={() => dollarsToCents(rateMin) && setRateMin(centsText(dollarsToCents(rateMin)!))} />
									<span className="text-muted">–</span>
									<Input aria-label="Maximum rate" inputMode="decimal" placeholder="Max" value={rateMax} onChange={(e) => setRateMax(e.target.value)} onBlur={() => dollarsToCents(rateMax) && setRateMax(centsText(dollarsToCents(rateMax)!))} />
								</div>
							)}
						</Field>
						<Field label="Typical 7-day views (optional)" hint="Creator reported. Shown with that label." error={errors.typical7dViews}>
							{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} />}
						</Field>
					</div>
					<div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
						<Button variant="secondary" onClick={() => void save()} busy={busy === "save"} disabled={busy !== null && busy !== "save"}>
							Save
						</Button>
						{channelChanged && profile.canonicalChannelUrl ? <span className="text-xs text-warning">Channel changed. Save to search the new one; earlier results refer to the previous channel.</span> : null}
					</div>
				</Card>

				<Card>
					<CardHeader
						title="2 · Public evidence"
						description="One live You.com search for your channel. You choose which sources and tags to keep."
						action={
							<Button onClick={search} busy={busy === "search"} disabled={!canSearch || (busy !== null && busy !== "search")}>
								{busy === "search" ? "Searching with You.com" : enrichment ? "Search again" : "Find public profile evidence"}
							</Button>
						}
					/>
					<div className="p-5" aria-live="polite">
						{!profile.canonicalChannelUrl ? <p className="text-sm text-muted">Save your channel first.</p> : null}
						{busy === "search" ? (
							<p className="flex items-center gap-2 text-sm text-muted">
								<Spinner /> Searching with You.com… this takes a few seconds. You can keep editing.
							</p>
						) : null}
						{busy !== "search" && enrichment ? (
							<div className="space-y-5">
								<div className="flex flex-wrap items-center gap-2 text-sm">
									<Badge tone={status === "READY" ? "positive" : status === "FAILED" ? "danger" : "neutral"}>
										{status === "READY" ? `${enrichment.evidence.length} source${enrichment.evidence.length === 1 ? "" : "s"} found` : status === "EMPTY" ? "No matching sources" : "Search failed"}
									</Badge>
									{enrichment.mode === "SAMPLE" ? <Badge tone="warning">Sample data</Badge> : <Badge>Live · You.com</Badge>}
								</div>
								{status === "FAILED" ? (
									<Alert title="We couldn’t reach You.com">
										{PROVIDER_ERRORS[enrichment.errorCode ?? ""] ?? "Something went wrong."} You can still add topics and formats yourself and publish.
									</Alert>
								) : null}
								{status === "EMPTY" ? <p className="text-sm text-muted">No public results mention this exact channel. Add tags manually below.</p> : null}

								{enrichment.suggestions.topics.length + enrichment.suggestions.formats.length > 0 ? (
									<div>
										<h3 className="text-xs font-medium tracking-wide text-muted uppercase">Suggested tags</h3>
										<div className="mt-2 flex flex-wrap gap-2">
											{enrichment.suggestions.formats.map((l) => (
												<SuggestionChip key={`f-${l.value}`} text={FORMAT_LABELS[l.value] ?? l.value} on={draft.formats.includes(l.value as Format)} onClick={() => (draft.formats.includes(l.value as Format) ? toggleFormat(l.value as Format) : acceptSuggestion(l, "format"))} />
											))}
											{enrichment.suggestions.topics.map((l) => (
												<SuggestionChip key={`t-${l.value}`} text={topicDisplayName(l.value)} on={draft.topics.includes(l.value)} onClick={() => (draft.topics.includes(l.value) ? toggleTopic(l.value) : acceptSuggestion(l, "topic"))} />
											))}
										</div>
									</div>
								) : null}
							</div>
						) : null}

						{evidenceList.length > 0 && busy !== "search" ? (
							<div className="mt-5">
								<h3 className="text-xs font-medium tracking-wide text-muted uppercase">Sources · check the ones brands should see</h3>
								<ul className="mt-2 divide-y divide-line rounded-xl border border-line">
									{evidenceList.map((e) => (
										<li key={e.id} className="p-4">
											<EvidenceRow
												evidence={e}
												trailing={
													<label className="flex shrink-0 items-start gap-2 pt-0.5 text-sm">
														<input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={draft.selectedEvidenceIds.includes(e.id)} onChange={() => toggleEvidence(e.id)} />
														<span className="sr-only">Show {e.title} on my profile</span>
														<span aria-hidden="true">Keep</span>
													</label>
												}
											/>
										</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
				</Card>

				<Card>
					<CardHeader title="3 · Topics & formats" description="At least one of each to list. Add your own for anything the search missed." />
					<div className="space-y-5 p-5">
						<Field label="Topics" error={errors.topics} hint="Press Enter to add.">
							{(p) => (
								<div className="space-y-2">
									<div className="flex flex-wrap gap-1.5">
										{draft.topics.map((t) => (
											<span key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas py-0.5 pr-1 pl-2.5 text-xs font-medium">
												{topicDisplayName(t)}
												<button type="button" aria-label={`Remove ${topicDisplayName(t)}`} className="rounded-full px-1 text-muted hover:text-ink" onClick={() => toggleTopic(t)}>
													×
												</button>
											</span>
										))}
									</div>
									<Input
										id={p.id}
										aria-describedby={p.describedBy}
										aria-invalid={p.invalid}
										placeholder="keyboard sound tests"
										value={topicDraft}
										onChange={(e) => setTopicDraft(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && topicDraft.trim()) {
												e.preventDefault();
												setField("topics", normalizeTopics([...draft.topics, topicDraft]).slice(0, 8));
												setTopicDraft("");
											}
										}}
									/>
								</div>
							)}
						</Field>
						<fieldset>
							<legend className="mb-2 text-sm font-medium">Formats</legend>
							<div className="flex flex-wrap gap-2">
								{FormatEnum.options.map((f) => (
									<SuggestionChip key={f} text={FORMAT_LABELS[f] ?? f} on={draft.formats.includes(f)} onClick={() => toggleFormat(f)} />
								))}
							</div>
							{errors.formats ? <p className="mt-1 text-xs font-medium text-danger">{errors.formats}</p> : null}
						</fieldset>
					</div>
				</Card>
			</div>

			<aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
				<Card>
					<CardHeader title="Preview" description="How brands will see your card." action={listed ? <Badge tone="positive">Listed</Badge> : profile.visibility === "HIDDEN" ? <Badge>Hidden</Badge> : <Badge tone="info">Draft</Badge>} />
					<div className="space-y-4 p-5">
						<div className="flex items-start gap-3">
							<Avatar name={preview.displayName || "?"} />
							<div className="min-w-0">
								<p className="font-semibold">{preview.displayName || "Your name"}</p>
								<DataModeBadge mode={preview.dataMode} />
							</div>
						</div>
						<p className="line-clamp-3 text-sm text-muted">{preview.bio || "Your bio"}</p>
						<div className="flex flex-wrap gap-1.5">
							{preview.formats.map((f) => (
								<LabelChip key={f.value} label={f} kind="format" />
							))}
							{preview.topics.map((t) => (
								<LabelChip key={t.value} label={t} kind="topic" />
							))}
						</div>
						<CreatorFacts card={preview} dense />
						<p className="text-xs text-muted">{preview.evidence.length} approved source{preview.evidence.length === 1 ? "" : "s"}</p>
					</div>
					<div className="space-y-3 border-t border-line p-5">
						{profile.listingBlockers.length > 0 && !listed ? (
							<p className="text-xs text-muted">To list, complete: {profile.listingBlockers.map(blockerName).join(", ")} (then save).</p>
						) : null}
						{!listed ? (
							<>
								<label className="flex items-start gap-2 text-sm">
									<input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
									<span>List my profile so brands can find me and send offers.</span>
								</label>
								<Button className="w-full" onClick={publish} busy={busy === "publish"} disabled={!optIn || (busy !== null && busy !== "publish")}>
									Publish profile
								</Button>
							</>
						) : (
							<>
								{profile.hasUnpublishedChanges ? <p className="text-xs text-warning">You have saved changes brands can’t see yet.</p> : <p className="text-xs text-muted">Brands see your latest saved profile.</p>}
								<Button className="w-full" onClick={publish} busy={busy === "publish"} disabled={busy !== null && busy !== "publish"}>
									Publish changes
								</Button>
								<Button className="w-full" variant="secondary" onClick={() => setConfirmHide(true)}>
									Hide profile
								</Button>
							</>
						)}
					</div>
				</Card>
			</aside>

			<Dialog
				open={confirmHide}
				onClose={() => setConfirmHide(false)}
				title="Hide your profile?"
				description="Brands won’t find you in the directory or matches. Existing offers and deals stay in your inbox."
				footer={
					<>
						<Button variant="ghost" onClick={() => setConfirmHide(false)}>
							Keep listed
						</Button>
						<Button variant="danger" onClick={hide} busy={busy === "hide"}>
							Hide profile
						</Button>
					</>
				}
			/>
		</div>
	);
}

function SuggestionChip({ text, on, onClick }: { text: string; on: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={cx("rounded-full border px-3 py-1 text-sm transition-colors", on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:bg-canvas")}
		>
			{on ? "✓ " : "+ "}
			{text}
		</button>
	);
}

function blockerName(b: string): string {
	return ({ displayName: "display name", bio: "bio", channel: "channel", topics: "a topic", formats: "a format" } as Record<string, string>)[b] ?? b;
}

/** Client-side preview; label sources come from the latest search’s suggestions. */
function previewCard(profile: CreatorProfile, draft: CreatorProfileFields, enrichment: EnrichmentResult | null): CreatorCard {
	const selected = profile.evidence.filter((e) => draft.selectedEvidenceIds.includes(e.id));
	const selectedIds = new Set(selected.map((e) => e.id));
	const labelFor = (value: string, pool: Label[]): Label => {
		const s = pool.find((l) => l.value === value);
		const ids = (s?.evidenceIds ?? []).filter((id) => selectedIds.has(id));

		return ids.length ? { value, origin: s!.origin, evidenceIds: ids } : { value, origin: "CREATOR", evidenceIds: [] };
	};
	const min = draft.rate?.minCents;
	const isSample = profile.published?.dataMode === "SAMPLE";

	return {
		id: profile.id,
		displayName: draft.displayName,
		bio: draft.bio,
		profileUrl: profile.canonicalChannelUrl ?? "",
		topics: normalizeTopics(draft.topics).map((t) => labelFor(t, enrichment?.suggestions.topics ?? [])),
		formats: draft.formats.map((f) => labelFor(f, enrichment?.suggestions.formats ?? [])),
		rate: min && draft.rate ? draft.rate : null,
		typical7dViews: draft.typical7dViews,
		publicMetrics: [],
		evidence: selected,
		dataMode: isSample ? "SAMPLE" : selected.some((e) => e.kind === "PUBLIC") ? "LIVE" : "SELF_REPORTED",
		expectedClicks: isSample ? (profile.published?.expectedClicks ?? null) : null,
		profileVersion: profile.version
	};
}
