"use client";

import type { FormEvent } from "react";
import type { EditorMode } from "@/app/(app)/creator/_parts/editorKit";
import type { FormErrors, ProfileForm } from "@/lib/profileForm";
import type { CreatorProfile, Label } from "@/shared/contracts";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DetailsFields } from "@/app/(app)/creator/_parts/DetailsFields";
import {
	blockersFrom,
	CONTROL_IDS,
	describeError,
	ERROR_ORDER,
	SECTION_CLASSES
} from "@/app/(app)/creator/_parts/editorKit";
import {
	ApiError,
	getCreatorProfile,
	runEnrichment,
	saveCreatorProfile,
	setProfileVisibility
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
	applySuggestions,
	blockerText,
	enrichmentErrorText,
	enrichmentOrigin,
	errorsFromApiFields,
	formatLabel,
	formToProfileInput,
	isDirty,
	mergeEvidence,
	profileToForm,
	topicLabel,
	visibilityText
} from "@/lib/profileForm";
import { OriginLabel } from "@/lib/ui/Chips";
import { EvidenceRow } from "@/lib/ui/Evidence";
import { Button, ErrorNote } from "@/lib/ui/form";
import { useLoad } from "@/lib/ui/useLoad";
import { Format, LIMITS } from "@/shared/contracts";
import { normalizeTopic } from "@/shared/topics";

type ProfileEditorProps = {
	mode: EditorMode;
};

type EditorBodyProps = {
	mode: EditorMode;
	initialProfile: CreatorProfile;
};

type ListingError = { message: string; blockers: string[] };

const MAX_SELECTED_EVIDENCE = 20;

const INTROS: Record<EditorMode, string> = {
	onboarding:
		"Tell brands who you are. Save your channel, let You.com find public examples of your work, keep the ones you want, then publish.",
	profile:
		"Edit what brands see. Saved changes stay private until you publish them."
};

/** Shared by /creator/onboarding and /creator/profile (frontend spec §3). */
export function ProfileEditor({ mode }: ProfileEditorProps) {
	const load = useLoad(getCreatorProfile, []);

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">
					{mode === "onboarding" ? "Set up your profile" : "Your profile"}
				</h1>
				<p className="text-fg-muted">{INTROS[mode]}</p>
			</header>
			{load.data !== null ? (
				<EditorBody mode={mode} initialProfile={load.data} />
			) : load.status === "failed" ? (
				<div className="space-y-3">
					<ErrorNote>
						Couldn’t load your profile. {describeError(load.error)}
					</ErrorNote>
					<Button variant="secondary" onClick={load.reload}>
						Try again
					</Button>
				</div>
			) : (
				<p className="text-fg-muted" aria-live="polite">
					Loading your profile…
				</p>
			)}
		</div>
	);
}

function EditorBody({ mode, initialProfile }: EditorBodyProps) {
	const router = useRouter();
	const [profile, setProfile] = useState(initialProfile);
	const [form, setForm] = useState(() => profileToForm(initialProfile));
	const [selectedIds, setSelectedIds] = useState(
		initialProfile.draft.selectedEvidenceIds
	);
	const [errors, setErrors] = useState<FormErrors>({});
	const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(
		null
	);
	const [saving, setSaving] = useState(false);
	const [saveNotice, setSaveNotice] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [staleNotice, setStaleNotice] = useState(false);
	const [searching, setSearching] = useState(false);
	const [searchChannel, setSearchChannel] = useState("");
	const [searchError, setSearchError] = useState<string | null>(null);
	const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
	const [optIn, setOptIn] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [listingError, setListingError] = useState<ListingError | null>(null);
	const [listingNotice, setListingNotice] = useState<string | null>(null);

	useEffect(() => {
		if (focusRequest !== null) {
			document.getElementById(focusRequest.id)?.focus();
		}
	}, [focusRequest]);

	const dirty = isDirty(form, profile, selectedIds);
	const savedChannel = profile.draft.channel.trim();
	const typedChannel = form.channel.trim();
	const result = profile.lastEnrichment;
	const busy = saving || publishing;
	const canSearch =
		profile.canonicalChannelUrl !== null && !dirty && !searching && !busy;
	const isListed = profile.visibility === "LISTED";

	let searchHint: string | null = null;

	if (profile.canonicalChannelUrl === null) {
		searchHint = "Save your channel first.";
	} else if (dirty && !searching) {
		searchHint = "Save your changes first. The search uses your saved channel.";
	}

	let channelWarning: string | null = null;

	if (searching && typedChannel !== searchChannel) {
		channelWarning = `You changed your channel during the search. These results will refer to ${searchChannel}.`;
	} else if (
		!searching &&
		typedChannel !== savedChannel &&
		savedChannel !== "" &&
		(result !== null || profile.evidence.length > 0)
	) {
		channelWarning = `These results refer to ${savedChannel}. Save your new channel, then search again.`;
	}

	function showErrors(next: FormErrors) {
		setErrors(next);

		const first = ERROR_ORDER.find((field) => next[field] !== undefined);

		if (first !== undefined) {
			setFocusRequest({ id: CONTROL_IDS[first] });
		}
	}

	function handleChange(patch: Partial<ProfileForm>) {
		setForm((current) => ({ ...current, ...patch }));
		setSaveNotice(null);
		setErrors((current) => {
			const next = { ...current };

			for (const key of Object.keys(patch)) {
				if (key === "displayName" || key === "bio" || key === "channel") {
					delete next[key];
				} else if (key === "topics" || key === "formats") {
					delete next[key];
				} else if (key === "rateMin" || key === "rateMax") {
					delete next.rateMin;
					delete next.rateMax;
				} else if (key === "typical7dViews") {
					delete next.typical7dViews;
				}
			}

			return next;
		});
	}

	function handleTopicError(message: string | null) {
		setErrors((current) => {
			const next = { ...current };

			if (message === null) {
				delete next.topics;
			} else {
				next.topics = message;
			}

			return next;
		});
	}

	/**
	 * A conflict re-fetches the record and keeps what was typed, so the next
	 * save (against the fresh version) keeps the creator's values.
	 */
	async function handleStale() {
		try {
			const fresh = await getCreatorProfile();

			setProfile(fresh);
			setStaleNotice(true);
		} catch (error) {
			setSaveError(describeError(error));
		}
	}

	async function save(): Promise<CreatorProfile | null> {
		const built = formToProfileInput(form, profile.version, selectedIds);

		setSaveNotice(null);
		setSaveError(null);

		if ("errors" in built) {
			showErrors(built.errors);

			return null;
		}

		setSaving(true);

		try {
			const next = await saveCreatorProfile(built.input);

			setProfile(next);
			setForm(profileToForm(next));
			setSelectedIds(next.draft.selectedEvidenceIds);
			setErrors({});
			setStaleNotice(false);
			setSaveNotice(
				next.visibility === "LISTED"
					? "Saved. Brands still see your published profile until you choose Publish changes."
					: "Saved."
			);

			return next;
		} catch (error) {
			if (error instanceof ApiError && error.code === "STALE_PROFILE") {
				await handleStale();
			} else if (
				error instanceof ApiError &&
				Object.keys(errorsFromApiFields(error.fields)).length > 0
			) {
				showErrors(errorsFromApiFields(error.fields));
			} else {
				setSaveError(describeError(error));
			}

			return null;
		} finally {
			setSaving(false);
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		await save();
	}

	async function handleSearch() {
		setSearching(true);
		setSearchChannel(savedChannel);
		setSearchError(null);
		setSuggestionNote(null);

		try {
			const next = await runEnrichment();

			setProfile((current) => ({
				...current,
				lastEnrichment: next,
				evidence: mergeEvidence(next.evidence, current.evidence)
			}));
		} catch (error) {
			if (error instanceof ApiError && error.code === "STALE_PROFILE") {
				setSearchError("Your profile changed during the search. Search again.");
			} else if (error instanceof ApiError && error.fields.channel) {
				setSearchError("Save a valid YouTube channel first, then search.");
			} else {
				setSearchError(describeError(error));
			}
		} finally {
			setSearching(false);
		}
	}

	function handleEvidenceToggle(id: string, checked: boolean) {
		setSaveNotice(null);
		setSelectedIds((current) =>
			checked ? [...current, id] : current.filter((item) => item !== id)
		);
	}

	function handleTopicSuggestion(label: Label, checked: boolean) {
		if (checked) {
			const applied = applySuggestions(form, { topics: [label], formats: [] });

			handleChange({ topics: applied.form.topics });
			setSuggestionNote(
				applied.skipped.length > 0
					? `You already have ${LIMITS.maxTopics} topics. Remove one to add ${applied.skipped.join(", ")}.`
					: null
			);

			return;
		}

		const slug = normalizeTopic(label.value);

		handleChange({
			topics: form.topics.filter((topic) => normalizeTopic(topic) !== slug)
		});
	}

	function handleFormatSuggestion(label: Label, checked: boolean) {
		if (checked) {
			const applied = applySuggestions(form, { topics: [], formats: [label] });

			handleChange({ formats: applied.form.formats });
			setSuggestionNote(
				applied.skipped.length > 0
					? `You already have ${LIMITS.maxFormats} formats. Remove one to add ${applied.skipped.join(", ")}.`
					: null
			);

			return;
		}

		handleChange({
			formats: form.formats.filter((format) => format !== label.value)
		});
	}

	async function handlePublish() {
		setListingError(null);
		setListingNotice(null);

		let current = profile;

		if (dirty) {
			const saved = await save();

			if (saved === null) {
				return;
			}

			current = saved;
		}

		setPublishing(true);

		try {
			const next = await setProfileVisibility({
				visibility: "LISTED",
				expectedVersion: current.version
			});

			setProfile(next);

			if (mode === "onboarding") {
				router.replace("/creator/inbox");

				return;
			}

			setSaveNotice(null);
			setListingNotice("Published. Brands now see this version of your profile.");
		} catch (error) {
			if (error instanceof ApiError && error.code === "STALE_PROFILE") {
				await handleStale();
				setListingError({
					message: "Your profile changed somewhere else. Check it, then publish again.",
					blockers: []
				});
			} else if (error instanceof ApiError) {
				setListingError({
					message: error.message,
					blockers: blockersFrom(error)
				});
				showErrors(errorsFromApiFields(error.fields));
			} else {
				setListingError({ message: describeError(error), blockers: [] });
			}
		} finally {
			setPublishing(false);
		}
	}

	const showPublish =
		!isListed || profile.hasUnpublishedChanges || dirty;
	let publishLabel = isListed ? "Publish changes" : "Publish profile";

	if (dirty) {
		publishLabel = isListed ? "Save and publish changes" : "Save and publish profile";
	}

	const suggestions = result?.suggestions ?? { topics: [], formats: [] };
	const formSlugs = new Set(form.topics.map(normalizeTopic));
	const showRetry =
		!searching && (result?.status === "FAILED" || searchError !== null);

	return (
		<div className="space-y-6">
			{staleNotice ? (
				<div
					role="alert"
					className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning"
				>
					<p className="font-medium">
						Your profile was changed somewhere else, so this wasn’t saved.
					</p>
					<p className="mt-1">
						Your typed values are still in the form. Save again to keep them,
						or reload the page to see the saved version.
					</p>
				</div>
			) : null}

			<form
				onSubmit={handleSubmit}
				noValidate
				aria-labelledby="profile-details-heading"
				className={SECTION_CLASSES}
			>
				<h2 id="profile-details-heading" className="text-lg font-semibold">
					Profile details
				</h2>
				<DetailsFields
					form={form}
					errors={errors}
					savedChannelUrl={profile.canonicalChannelUrl}
					onChange={handleChange}
					onTopicError={handleTopicError}
				/>
				<ErrorNote>{saveError}</ErrorNote>
				<div className="flex flex-wrap items-center gap-3 border-t border-divider pt-4">
					<Button
						type="submit"
						busy={saving}
						busyLabel="Saving…"
						disabled={publishing}
					>
						Save profile
					</Button>
					<p role="status" aria-live="polite" className="text-sm text-fg-secondary">
						{saveNotice ?? (dirty ? "You have unsaved changes." : "")}
					</p>
				</div>
			</form>

			<section aria-labelledby="evidence-heading" className={SECTION_CLASSES}>
				<div className="space-y-1">
					<h2 id="evidence-heading" className="text-lg font-semibold">
						Public profile evidence
					</h2>
					<p className="text-sm text-fg-muted">
						The app looks up public sources about your saved channel with
						You.com. Nothing appears on your profile until you choose it.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						onClick={handleSearch}
						disabled={!canSearch}
						busy={searching}
						busyLabel="Searching with You.com…"
						aria-describedby={searchHint ? "search-hint" : undefined}
					>
						Find public profile evidence
					</Button>
					{searchHint ? (
						<p id="search-hint" className="text-sm text-fg-muted">
							{searchHint}
						</p>
					) : null}
				</div>

				<div aria-live="polite" role="status" className="text-sm">
					{searching ? (
						<p className="font-medium text-accent-text">
							Searching with You.com… You can keep editing your profile.
						</p>
					) : searchError !== null ? (
						<p className="font-medium text-danger">{searchError}</p>
					) : result !== null ? (
						<div className="space-y-1">
							<p className="flex flex-wrap items-center gap-2">
								<OriginLabel origin={enrichmentOrigin(result.mode)} />
								<span className="text-fg-muted">
									Found on{" "}
									<time dateTime={result.retrievedAt}>
										{formatDateTime(result.retrievedAt)}
									</time>
								</span>
							</p>
							{result.status === "READY" ? (
								<p>
									{result.evidence.length === 1
										? "1 source found."
										: `${result.evidence.length} sources found.`}{" "}
									Tick the ones you want brands to see, then save.
								</p>
							) : result.status === "EMPTY" ? (
								<p>
									No usable evidence found. You can still add topics and
									formats by hand above.
								</p>
							) : (
								<p className="font-medium text-danger">
									{enrichmentErrorText(result.errorCode)}
								</p>
							)}
						</div>
					) : null}
				</div>

				{showRetry ? (
					<Button variant="secondary" onClick={handleSearch} disabled={!canSearch}>
						{searchError !== null ? "Search again" : "Retry"}
					</Button>
				) : null}

				{channelWarning !== null ? (
					<p className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning">
						{channelWarning}
					</p>
				) : null}

				{profile.evidence.length > 0 ? (
					<div className="space-y-2">
						<h3 className="font-medium">Choose evidence to show brands</h3>
						<ul className="space-y-2">
							{profile.evidence.map((evidence) => {
								const checked = selectedIds.includes(evidence.id);
								const inputId = `evidence-${evidence.id}`;

								return (
									<li
										key={evidence.id}
										className="flex gap-3 rounded-md border border-border p-3 has-checked:border-accent-line has-checked:bg-accent-soft"
									>
										<div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
											<input
												id={inputId}
												type="checkbox"
												checked={checked}
												disabled={
													!checked &&
													selectedIds.length >= MAX_SELECTED_EVIDENCE
												}
												onChange={(event) =>
													handleEvidenceToggle(evidence.id, event.target.checked)
												}
												className="size-5 accent-accent"
											/>
											<label htmlFor={inputId} className="text-xs text-fg-muted">
												Keep<span className="sr-only">: {evidence.title}</span>
											</label>
										</div>
										<EvidenceRow evidence={evidence} />
									</li>
								);
							})}
						</ul>
						{dirty ? (
							<div className="flex flex-wrap items-center gap-3">
								<Button
									variant="secondary"
									onClick={() => void save()}
									busy={saving}
									busyLabel="Saving…"
									disabled={publishing}
								>
									Save profile
								</Button>
								<p className="text-sm text-fg-muted">
									Save to keep your choices.
								</p>
							</div>
						) : null}
					</div>
				) : null}

				{suggestions.topics.length > 0 || suggestions.formats.length > 0 ? (
					<div className="space-y-3">
						<p className="text-sm text-fg-muted">
							Tick a suggestion to add it to your profile details. It shows as
							sourced on your card only while you keep evidence that supports
							it.
						</p>
						{suggestions.topics.length > 0 ? (
							<fieldset className="space-y-2">
								<legend className="flex items-center gap-2 text-sm font-medium">
									Suggested topics
									<OriginLabel origin={suggestions.topics[0]?.origin ?? "PUBLIC"} />
								</legend>
								<div className="flex flex-wrap gap-2">
									{suggestions.topics.map((label) => (
										<label
											key={label.value}
											className="inline-flex min-h-11 sm:min-h-9 items-center gap-2 rounded-full border border-border-strong px-3 text-sm has-checked:border-accent has-checked:bg-accent-soft"
										>
											<input
												type="checkbox"
												checked={formSlugs.has(normalizeTopic(label.value))}
												onChange={(event) =>
													handleTopicSuggestion(label, event.target.checked)
												}
												className="size-4 accent-accent"
											/>
											{topicLabel(label.value)}
										</label>
									))}
								</div>
							</fieldset>
						) : null}
						{suggestions.formats.length > 0 ? (
							<fieldset className="space-y-2">
								<legend className="flex items-center gap-2 text-sm font-medium">
									Suggested formats
									<OriginLabel origin={suggestions.formats[0]?.origin ?? "PUBLIC"} />
								</legend>
								<div className="flex flex-wrap gap-2">
									{suggestions.formats.map((label) => {
										const parsed = Format.safeParse(label.value);

										if (!parsed.success) {
											return null;
										}

										const format = parsed.data;
										const checked = form.formats.includes(format);

										return (
											<label
												key={label.value}
												className="inline-flex min-h-11 sm:min-h-9 items-center gap-2 rounded-full border border-border-strong px-3 text-sm has-checked:border-accent has-checked:bg-accent-soft has-disabled:opacity-60"
											>
												<input
													type="checkbox"
													checked={checked}
													disabled={
														!checked && form.formats.length >= LIMITS.maxFormats
													}
													onChange={(event) =>
														handleFormatSuggestion(label, event.target.checked)
													}
													className="size-4 accent-accent"
												/>
												{formatLabel(format)}
											</label>
										);
									})}
								</div>
							</fieldset>
						) : null}
						<p aria-live="polite" className="text-sm text-warning empty:hidden">
							{suggestionNote}
						</p>
					</div>
				) : null}
			</section>

			<section aria-labelledby="listing-heading" className={SECTION_CLASSES}>
				<h2 id="listing-heading" className="text-lg font-semibold">
					Listing
				</h2>
				<p>
					<span className="text-fg-muted">Status: </span>
					<span className="font-medium">{visibilityText(profile.visibility)}</span>
				</p>
				{isListed && profile.hasUnpublishedChanges ? (
					<p className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning">
						You have unpublished changes. Brands see your last published
						profile until you choose Publish changes.
					</p>
				) : null}
				{profile.listingBlockers.length > 0 ? (
					<div className="text-sm">
						<p className="font-medium">Before you can list your profile:</p>
						<ul className="mt-1 list-disc space-y-0.5 pl-5">
							{profile.listingBlockers.map((blocker) => (
								<li key={blocker}>{blockerText(blocker)}</li>
							))}
						</ul>
						{dirty ? (
							<p className="mt-1 text-fg-muted">Based on your last save.</p>
						) : null}
					</div>
				) : null}
				{!isListed ? (
					<label className="flex min-h-11 sm:min-h-9 items-start gap-3 text-sm">
						<input
							type="checkbox"
							checked={optIn}
							onChange={(event) => setOptIn(event.target.checked)}
							className="mt-0.5 size-5 accent-accent"
						/>
						<span>
							<span className="font-medium">
								List my profile in the brand directory
							</span>
							<span className="block text-fg-muted">
								Brands can find your published card and send you offers.
							</span>
						</span>
					</label>
				) : null}
				{showPublish ? (
					<Button
						onClick={handlePublish}
						disabled={(!isListed && !optIn) || saving || searching}
						busy={publishing}
						busyLabel="Publishing…"
					>
						{publishLabel}
					</Button>
				) : null}
				{listingError !== null ? (
					<ErrorNote>
						<p>{listingError.message}</p>
						{listingError.blockers.length > 0 ? (
							<ul className="mt-1 list-disc pl-5">
								{listingError.blockers.map((blocker) => (
									<li key={blocker}>{blockerText(blocker)}</li>
								))}
							</ul>
						) : null}
					</ErrorNote>
				) : null}
				<p role="status" aria-live="polite" className="text-sm text-success empty:hidden">
					{listingNotice}
				</p>
			</section>
		</div>
	);
}
