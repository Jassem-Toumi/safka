"use client";

import type { KeyboardEvent } from "react";
import type { FormErrors, ProfileForm } from "@/lib/profileForm";
import type { Format } from "@/shared/contracts";

import { useState } from "react";

import {
	CONTROL_IDS,
	INPUT_CLASSES
} from "@/app/(app)/creator/_parts/editorKit";
import {
	addTopics,
	FORMAT_OPTIONS,
	formatLabel,
	formatMoneyInput,
	topicLabel
} from "@/lib/profileForm";
import { ExternalLink } from "@/lib/ui/Evidence";
import { Button, Field, fieldDescribedBy } from "@/lib/ui/form";
import { LIMITS } from "@/shared/contracts";

type DetailsFieldsProps = {
	form: ProfileForm;
	errors: FormErrors;
	/** Canonical URL of the saved channel, when it is valid. */
	savedChannelUrl: string | null;
	onChange: (patch: Partial<ProfileForm>) => void;
	onTopicError: (message: string | null) => void;
};

const CHANNEL_HINT =
	"Your public @handle or channel URL, e.g. @YourChannel. After you save, the app can look up public sources about this channel with You.com.";

const TOPICS_HINT = `Free text, up to ${LIMITS.maxTopics}. Press Enter or Add; separate several with commas.`;

const FORMATS_HINT = `Choose up to ${LIMITS.maxFormats}.`;

const RATE_HINT =
	"Optional, in USD per video. Leave both empty and brands see “Rate not provided”.";

const VIEWS_HINT =
	"Optional. Brands see this labeled “Creator reported”, since it’s your own number.";

function CharacterCount({ length, max }: { length: number; max: number }) {
	return (
		<p
			className={`text-right text-xs tabular-nums ${length > max ? "font-medium text-danger" : "text-fg-subtle"}`}
		>
			{length} / {max} characters
		</p>
	);
}

/** Display name, bio, channel, topics, formats, rate and views. */
export function DetailsFields({
	form,
	errors,
	savedChannelUrl,
	onChange,
	onTopicError
}: DetailsFieldsProps) {
	const [topicText, setTopicText] = useState("");
	const formatsHintId = "profile-formats-hint";
	const formatsErrorId = "profile-formats-error";
	const rateHintId = "profile-rate-hint";
	const formatsAtLimit = form.formats.length >= LIMITS.maxFormats;

	function handleAddTopics() {
		if (topicText.trim() === "") {
			return;
		}

		const { topics, error } = addTopics(form.topics, topicText);

		onChange({ topics });
		onTopicError(error);

		if (error === null) {
			setTopicText("");
		}
	}

	function handleTopicKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter") {
			event.preventDefault();
			handleAddTopics();
		}
	}

	function handleRemoveTopic(topic: string) {
		onChange({ topics: form.topics.filter((item) => item !== topic) });
		onTopicError(null);
	}

	function handleFormatToggle(format: Format, checked: boolean) {
		onChange({
			formats: checked
				? [...form.formats, format]
				: form.formats.filter((item) => item !== format)
		});
	}

	return (
		<div className="space-y-5">
			<Field
				label="Display name"
				htmlFor={CONTROL_IDS.displayName}
				error={errors.displayName}
			>
				<input
					id={CONTROL_IDS.displayName}
					type="text"
					autoComplete="nickname"
					maxLength={LIMITS.displayName}
					value={form.displayName}
					onChange={(event) => onChange({ displayName: event.target.value })}
					aria-invalid={errors.displayName ? true : undefined}
					aria-describedby={fieldDescribedBy(CONTROL_IDS.displayName, {
						error: errors.displayName
					})}
					className={INPUT_CLASSES}
				/>
			</Field>

			<Field
				label="Short bio"
				htmlFor={CONTROL_IDS.bio}
				hint="What you make and who watches. Brands read this first."
				error={errors.bio}
			>
				<textarea
					id={CONTROL_IDS.bio}
					rows={4}
					maxLength={LIMITS.bio}
					value={form.bio}
					onChange={(event) => onChange({ bio: event.target.value })}
					aria-invalid={errors.bio ? true : undefined}
					aria-describedby={fieldDescribedBy(CONTROL_IDS.bio, {
						hint: "bio",
						error: errors.bio
					})}
					className={INPUT_CLASSES}
				/>
				<CharacterCount length={form.bio.length} max={LIMITS.bio} />
			</Field>

			<Field
				label="YouTube channel"
				htmlFor={CONTROL_IDS.channel}
				hint={CHANNEL_HINT}
				error={errors.channel}
			>
				<input
					id={CONTROL_IDS.channel}
					type="text"
					inputMode="url"
					autoCapitalize="none"
					autoCorrect="off"
					spellCheck={false}
					placeholder="@YourChannel"
					maxLength={LIMITS.url}
					value={form.channel}
					onChange={(event) => onChange({ channel: event.target.value })}
					aria-invalid={errors.channel ? true : undefined}
					aria-describedby={fieldDescribedBy(CONTROL_IDS.channel, {
						hint: CHANNEL_HINT,
						error: errors.channel
					})}
					className={INPUT_CLASSES}
				/>
				{savedChannelUrl !== null ? (
					<p className="text-sm text-fg-muted">
						Saved as{" "}
						<ExternalLink href={savedChannelUrl}>{savedChannelUrl}</ExternalLink>
					</p>
				) : null}
			</Field>

			<Field
				label="Topics"
				htmlFor={CONTROL_IDS.topics}
				hint={TOPICS_HINT}
				error={errors.topics}
			>
				<div className="flex gap-2">
					<input
						id={CONTROL_IDS.topics}
						type="text"
						placeholder="e.g. mechanical keyboards"
						value={topicText}
						onChange={(event) => setTopicText(event.target.value)}
						onKeyDown={handleTopicKeyDown}
						aria-invalid={errors.topics ? true : undefined}
						aria-describedby={fieldDescribedBy(CONTROL_IDS.topics, {
							hint: TOPICS_HINT,
							error: errors.topics
						})}
						className={INPUT_CLASSES}
					/>
					<Button variant="secondary" onClick={handleAddTopics}>
						Add
					</Button>
				</div>
				{form.topics.length === 0 ? (
					<p className="text-sm text-fg-subtle">No topics yet.</p>
				) : (
					<ul aria-label="Your topics" className="flex flex-wrap gap-2 pt-1">
						{form.topics.map((topic) => (
							<li
								key={topic}
								className="inline-flex items-center gap-1 rounded-full bg-surface-3 py-0.5 pr-0.5 pl-3 text-sm ring-1 ring-border-strong ring-inset"
							>
								<span>{topicLabel(topic)}</span>
								<button
									type="button"
									onClick={() => handleRemoveTopic(topic)}
									className="inline-flex size-8 items-center justify-center rounded-full text-fg-muted hover:bg-fill hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
								>
									<span aria-hidden="true">×</span>
									<span className="sr-only">Remove {topicLabel(topic)}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</Field>

			<fieldset
				aria-describedby={
					errors.formats ? `${formatsHintId} ${formatsErrorId}` : formatsHintId
				}
				className="space-y-1"
			>
				<legend className="text-sm font-medium">Formats</legend>
				<p id={formatsHintId} className="text-sm text-fg-muted">
					{FORMATS_HINT}
				</p>
				<div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
					{FORMAT_OPTIONS.map((format) => {
						const checked = form.formats.includes(format);

						return (
							<label
								key={format}
								className="flex min-h-11 sm:min-h-9 items-center gap-2 rounded-md border border-border-strong px-3 text-sm has-checked:border-accent has-checked:bg-accent-soft has-disabled:opacity-60"
							>
								<input
									id={`profile-format-${format}`}
									type="checkbox"
									checked={checked}
									disabled={!checked && formatsAtLimit}
									onChange={(event) =>
										handleFormatToggle(format, event.target.checked)
									}
									className="size-4 accent-accent"
								/>
								{formatLabel(format)}
							</label>
						);
					})}
				</div>
				{errors.formats ? (
					<p
						id={formatsErrorId}
						role="alert"
						className="text-sm font-medium text-danger"
					>
						{errors.formats}
					</p>
				) : null}
			</fieldset>

			<fieldset aria-describedby={rateHintId} className="space-y-1">
				<legend className="text-sm font-medium">Rate (optional)</legend>
				<p id={rateHintId} className="text-sm text-fg-muted">
					{RATE_HINT}
				</p>
				<div className="grid gap-3 pt-1 sm:grid-cols-2">
					<Field
						label="Minimum"
						htmlFor={CONTROL_IDS.rateMin}
						error={errors.rateMin}
					>
						<input
							id={CONTROL_IDS.rateMin}
							type="text"
							inputMode="decimal"
							placeholder="$250.00"
							value={form.rateMin}
							onChange={(event) => onChange({ rateMin: event.target.value })}
							onBlur={() => onChange({ rateMin: formatMoneyInput(form.rateMin) })}
							aria-invalid={errors.rateMin ? true : undefined}
							aria-describedby={fieldDescribedBy(CONTROL_IDS.rateMin, {
								error: errors.rateMin
							})}
							className={INPUT_CLASSES}
						/>
					</Field>
					<Field
						label="Maximum"
						htmlFor={CONTROL_IDS.rateMax}
						error={errors.rateMax}
					>
						<input
							id={CONTROL_IDS.rateMax}
							type="text"
							inputMode="decimal"
							placeholder="$400.00"
							value={form.rateMax}
							onChange={(event) => onChange({ rateMax: event.target.value })}
							onBlur={() => onChange({ rateMax: formatMoneyInput(form.rateMax) })}
							aria-invalid={errors.rateMax ? true : undefined}
							aria-describedby={fieldDescribedBy(CONTROL_IDS.rateMax, {
								error: errors.rateMax
							})}
							className={INPUT_CLASSES}
						/>
					</Field>
				</div>
			</fieldset>

			<Field
				label="Typical 7-day views (optional)"
				htmlFor={CONTROL_IDS.typical7dViews}
				hint={VIEWS_HINT}
				error={errors.typical7dViews}
			>
				<input
					id={CONTROL_IDS.typical7dViews}
					type="text"
					inputMode="numeric"
					placeholder="12,000"
					value={form.typical7dViews}
					onChange={(event) => onChange({ typical7dViews: event.target.value })}
					aria-invalid={errors.typical7dViews ? true : undefined}
					aria-describedby={fieldDescribedBy(CONTROL_IDS.typical7dViews, {
						hint: VIEWS_HINT,
						error: errors.typical7dViews
					})}
					className={`${INPUT_CLASSES} sm:max-w-48`}
				/>
			</Field>
		</div>
	);
}
