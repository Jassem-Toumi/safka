"use client";

import type { CampaignForm, CampaignFormErrors } from "@/lib/campaignForm";
import type { Format, Objective } from "@/shared/contracts";

import {
	FORMAT_LABELS,
	FORMATS,
	OBJECTIVE_LABELS,
	OBJECTIVES
} from "@/app/(app)/brand/_parts/briefLabels";
import { INPUT_CLASSES } from "@/app/(app)/brand/_parts/ui";
import { normalizeMoneyText } from "@/lib/campaignForm";
import { Field, fieldDescribedBy, fieldErrorId } from "@/lib/ui/form";

type BriefFieldsProps = {
	form: CampaignForm;
	errors: CampaignFormErrors;
	onChange: (form: CampaignForm) => void;
	idPrefix: string;
};

type TextFieldName = Exclude<keyof CampaignForm, "formats" | "objective">;

type TextFieldSpec = {
	name: TextFieldName;
	label: string;
	hint?: string;
	multiline?: boolean;
	rows?: number;
	maxLength?: number;
	money?: boolean;
	count?: boolean;
	placeholder?: string;
};

const TOP_FIELDS: readonly TextFieldSpec[] = [
	{ name: "title", label: "Title", maxLength: 80 },
	{
		name: "goal",
		label: "Goal",
		hint: "What the videos should achieve, in a sentence or two.",
		multiline: true,
		rows: 3,
		maxLength: 1500
	}
];

const LIST_FIELDS: readonly TextFieldSpec[] = [
	{
		name: "topics",
		label: "Topics",
		hint: "Separate with commas, e.g. mechanical keyboards, desk setups. Up to 8.",
		maxLength: 600
	},
	{
		name: "talkingPoints",
		label: "Talking points",
		hint: "Optional. One per line, up to 6.",
		multiline: true,
		rows: 3
	},
	{
		name: "restrictions",
		label: "Restrictions",
		hint: "Optional. One per line, up to 6.",
		multiline: true,
		rows: 2
	}
];

const BUDGET_FIELDS: readonly TextFieldSpec[] = [
	{ name: "budget", label: "Total budget (USD)", money: true, placeholder: "$600.00" },
	{
		name: "preferredMax",
		label: "Preferred max per video (USD)",
		hint: "Optional. Used to rank creators by rate.",
		money: true
	},
	{
		name: "viewTarget",
		label: "7-day view target",
		hint: "Optional. Views in the first 7 days after publishing.",
		count: true
	},
	{
		name: "clickTarget",
		label: "7-day click target",
		hint: "Optional. Clicks in the first 7 days after publishing.",
		count: true
	}
];

/** The editable brief (frontend spec §4 step 2). */
export function BriefFields({ form, errors, onChange, idPrefix }: BriefFieldsProps) {
	const fieldId = (name: string) => `${idPrefix}-${name}`;

	function set<K extends keyof CampaignForm>(name: K, value: CampaignForm[K]) {
		onChange({ ...form, [name]: value });
	}

	function toggleFormat(format: Format, checked: boolean) {
		const next = checked
			? FORMATS.filter((option) => option === format || form.formats.includes(option))
			: form.formats.filter((option) => option !== format);

		set("formats", next);
	}

	function renderText(spec: TextFieldSpec) {
		const id = fieldId(spec.name);
		const error = errors[spec.name];
		const shared = {
			id,
			value: form[spec.name],
			maxLength: spec.maxLength,
			placeholder: spec.placeholder,
			"aria-invalid": error ? true : undefined,
			"aria-describedby": fieldDescribedBy(id, { hint: spec.hint, error }),
			className: INPUT_CLASSES
		};

		return (
			<Field
				key={spec.name}
				label={spec.label}
				htmlFor={id}
				hint={spec.hint}
				error={error}
			>
				{spec.multiline ? (
					<textarea
						{...shared}
						rows={spec.rows}
						onChange={(event) => set(spec.name, event.target.value)}
					/>
				) : (
					<input
						{...shared}
						type="text"
						inputMode={spec.money ? "decimal" : spec.count ? "numeric" : undefined}
						onChange={(event) => set(spec.name, event.target.value)}
						onBlur={
							spec.money
								? (event) => set(spec.name, normalizeMoneyText(event.target.value))
								: undefined
						}
					/>
				)}
			</Field>
		);
	}

	const objectiveId = fieldId("objective");
	const formatsErrorId = fieldErrorId(fieldId("formats"));

	return (
		<div className="space-y-5">
			{TOP_FIELDS.map(renderText)}

			<Field label="Objective" htmlFor={objectiveId} error={errors.objective}>
				<select
					id={objectiveId}
					value={form.objective}
					onChange={(event) => {
						const value = OBJECTIVES.find((option) => option === event.target.value);

						set("objective", value ?? "");
					}}
					required
					aria-invalid={errors.objective ? true : undefined}
					aria-describedby={fieldDescribedBy(objectiveId, {
						error: errors.objective
					})}
					className={INPUT_CLASSES}
				>
					<option value="">Choose an objective</option>
					{OBJECTIVES.map((option: Objective) => (
						<option key={option} value={option}>
							{OBJECTIVE_LABELS[option]}
						</option>
					))}
				</select>
			</Field>

			{LIST_FIELDS.slice(0, 1).map(renderText)}

			<fieldset
				aria-describedby={errors.formats ? formatsErrorId : undefined}
				className="space-y-2"
			>
				<legend className="text-sm font-medium">Formats</legend>
				<p className="text-sm text-fg-muted">
					Optional. Leave all unchecked to accept any format.
				</p>
				<div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
					{FORMATS.map((format) => {
						const id = fieldId(`format-${format}`);

						return (
							<label
								key={format}
								htmlFor={id}
								className="flex min-h-11 sm:min-h-9 items-center gap-2 text-sm"
							>
								<input
									id={id}
									type="checkbox"
									checked={form.formats.includes(format)}
									onChange={(event) => toggleFormat(format, event.target.checked)}
									className="size-5 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
								/>
								{FORMAT_LABELS[format]}
							</label>
						);
					})}
				</div>
				{errors.formats ? (
					<p id={formatsErrorId} role="alert" className="text-sm font-medium text-danger">
						{errors.formats}
					</p>
				) : null}
			</fieldset>

			{LIST_FIELDS.slice(1).map(renderText)}

			<div className="grid gap-5 sm:grid-cols-2">{BUDGET_FIELDS.map(renderText)}</div>
		</div>
	);
}
