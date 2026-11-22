"use client";

import type { Product } from "@/shared/contracts";
import type { FormEvent } from "react";

import { useId, useState } from "react";

import { errorMessage, INPUT_CLASSES } from "@/app/(app)/brand/_parts/ui";
import { ApiError, createProduct } from "@/lib/api";
import { Button, ErrorNote, Field, fieldDescribedBy } from "@/lib/ui/form";

type ProductFormProps = {
	onCreated: (product: Product) => void;
	onCancel?: () => void;
	submitLabel?: string;
};

type ProductErrors = Partial<
	Record<"name" | "description" | "landingUrl", string>
>;

function validate(name: string, description: string, landingUrl: string) {
	const errors: ProductErrors = {};

	if (name.trim() === "") {
		errors.name = "Add the product name.";
	}

	if (description.trim() === "") {
		errors.description = "Describe the product in a sentence or two.";
	}

	if (landingUrl.trim() !== "" && !/^https:\/\//i.test(landingUrl.trim())) {
		errors.landingUrl = "Use a link that starts with https://";
	}

	return errors;
}

/** Name, description and optional https landing page (final spec §4). */
export function ProductForm({
	onCreated,
	onCancel,
	submitLabel = "Save product"
}: ProductFormProps) {
	const id = useId();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [landingUrl, setLandingUrl] = useState("");
	const [errors, setErrors] = useState<ProductErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const nameId = `${id}-name`;
	const descriptionId = `${id}-description`;
	const urlId = `${id}-url`;
	const urlHint = "Optional. Must start with https://";

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const found = validate(name, description, landingUrl);

		setErrors(found);
		setFormError(null);

		if (Object.keys(found).length > 0) {
			return;
		}

		setIsSaving(true);

		try {
			const product = await createProduct({
				name: name.trim(),
				description: description.trim(),
				landingUrl: landingUrl.trim() === "" ? null : landingUrl.trim()
			});

			setName("");
			setDescription("");
			setLandingUrl("");
			onCreated(product);
		} catch (error) {
			if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
				setErrors({
					name: error.fields.name,
					description: error.fields.description,
					landingUrl: error.fields.landingUrl
				});
			}

			setFormError(`Couldn’t save the product. ${errorMessage(error)}`);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<form noValidate onSubmit={handleSubmit} className="space-y-4">
			<Field label="Product name" htmlFor={nameId} error={errors.name}>
				<input
					id={nameId}
					type="text"
					value={name}
					onChange={(event) => setName(event.target.value)}
					maxLength={120}
					required
					aria-invalid={errors.name ? true : undefined}
					aria-describedby={fieldDescribedBy(nameId, { error: errors.name })}
					className={INPUT_CLASSES}
				/>
			</Field>
			<Field
				label="Description"
				htmlFor={descriptionId}
				error={errors.description}
			>
				<textarea
					id={descriptionId}
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					maxLength={2000}
					rows={3}
					required
					aria-invalid={errors.description ? true : undefined}
					aria-describedby={fieldDescribedBy(descriptionId, {
						error: errors.description
					})}
					className={INPUT_CLASSES}
				/>
			</Field>
			<Field
				label="Product page"
				htmlFor={urlId}
				hint={urlHint}
				error={errors.landingUrl}
			>
				<input
					id={urlId}
					type="url"
					inputMode="url"
					value={landingUrl}
					onChange={(event) => setLandingUrl(event.target.value)}
					placeholder="https://"
					maxLength={2048}
					aria-invalid={errors.landingUrl ? true : undefined}
					aria-describedby={fieldDescribedBy(urlId, {
						hint: urlHint,
						error: errors.landingUrl
					})}
					className={INPUT_CLASSES}
				/>
			</Field>
			<ErrorNote>{formError}</ErrorNote>
			<div className="flex flex-wrap gap-2">
				<Button type="submit" busy={isSaving} busyLabel="Saving…">
					{submitLabel}
				</Button>
				{onCancel ? (
					<Button variant="secondary" onClick={onCancel} disabled={isSaving}>
						Cancel
					</Button>
				) : null}
			</div>
		</form>
	);
}
