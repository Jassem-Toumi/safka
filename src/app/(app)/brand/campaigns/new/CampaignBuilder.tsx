"use client";

import type { CampaignForm, CampaignFormErrors } from "@/lib/campaignForm";
import type { BriefMode, Product } from "@/shared/contracts";
import type { FormEvent } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BriefFields } from "@/app/(app)/brand/_parts/BriefFields";
import { ProductForm } from "@/app/(app)/brand/_parts/ProductForm";
import {
	CARD_CLASSES,
	errorMessage,
	INPUT_CLASSES,
	LINK_CLASSES,
	LoadFailed,
	LoadingNote
} from "@/app/(app)/brand/_parts/ui";
import { ApiError, createCampaign, listProducts, parseCampaign } from "@/lib/api";
import {
	campaignErrorsFromServer,
	emptyCampaignForm,
	formToCampaignInput,
	parseResultToForm
} from "@/lib/campaignForm";
import { Button, ErrorNote, Field, fieldDescribedBy } from "@/lib/ui/form";
import { useLoad } from "@/lib/ui/useLoad";

const PROMPT_EXAMPLE =
	"Promote our quiet mechanical keyboard to people building shared-office setups. Budget $600.";

const MODE_TAGS: Record<BriefMode, string> = {
	RULES: "Rules-based suggestion",
	AI: "AI suggestion"
};

/**
 * Frontend spec §4 "Campaign builder": product and prompt, a suggested or
 * manual brief, then Confirm and find creators.
 */
export function CampaignBuilder() {
	const router = useRouter();
	const products = useLoad(() => listProducts(), []);

	const [productId, setProductId] = useState("");
	const [isAddingProduct, setIsAddingProduct] = useState(false);
	const [prompt, setPrompt] = useState("");
	const [promptError, setPromptError] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [generateError, setGenerateError] = useState<string | null>(null);

	// Null until the brief is shown; `mode` is null on the manual path.
	const [form, setForm] = useState<CampaignForm | null>(null);
	const [mode, setMode] = useState<BriefMode | null>(null);
	const [errors, setErrors] = useState<CampaignFormErrors>({});
	const [isConfirming, setIsConfirming] = useState(false);

	// Bumped each time the brief is (re)shown, to move focus to it.
	const [briefShownCount, setBriefShownCount] = useState(0);
	const briefHeadingRef = useRef<HTMLHeadingElement>(null);

	const productList = products.data?.items ?? [];
	const hasNoProducts = products.status === "ready" && productList.length === 0;

	// Default to the first product once the list arrives.
	useEffect(() => {
		const first = products.data?.items[0];

		if (productId === "" && first !== undefined) {
			setProductId(first.id);
		}
	}, [products.data, productId]);

	useEffect(() => {
		if (briefShownCount > 0) {
			briefHeadingRef.current?.focus();
		}
	}, [briefShownCount]);

	function handleProductCreated(product: Product) {
		setProductId(product.id);
		setIsAddingProduct(false);
		products.reload();
	}

	async function handleGenerate() {
		setGenerateError(null);

		if (productId === "") {
			setPromptError(null);
			setGenerateError("Choose or add a product first.");

			return;
		}

		if (prompt.trim() === "") {
			setPromptError("Describe the campaign, or enter the details manually.");

			return;
		}

		setPromptError(null);
		setIsGenerating(true);

		try {
			const result = await parseCampaign({ productId, prompt: prompt.trim() });

			setForm(parseResultToForm(result));
			setMode(result.mode);
			setErrors({});
			setBriefShownCount((count) => count + 1);
		} catch (error) {
			setGenerateError(
				`Couldn’t generate a brief. ${errorMessage(error)} Your prompt is kept; try again or enter the details manually.`
			);
		} finally {
			setIsGenerating(false);
		}
	}

	function handleManual() {
		setForm((current) => current ?? emptyCampaignForm());
		setMode(null);
		setGenerateError(null);
		setBriefShownCount((count) => count + 1);
	}

	async function handleConfirm(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (form === null) {
			return;
		}

		const result = formToCampaignInput(form, {
			productId,
			sourcePrompt: prompt.trim()
		});

		if ("errors" in result) {
			setErrors(result.errors);

			return;
		}

		setErrors({});
		setIsConfirming(true);

		try {
			const campaign = await createCampaign(result.input);

			router.push(`/brand/campaigns/${encodeURIComponent(campaign.id)}?tab=matches`);
		} catch (error) {
			setIsConfirming(false);

			if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
				setErrors({ ...campaignErrorsFromServer(error.fields), form: error.message });
			} else {
				setErrors({ form: `Couldn’t save the campaign. ${errorMessage(error)}` });
			}
		}
	}

	const errorCount = Object.keys(errors).filter((key) => key !== "form").length;
	const productHint = productList.find((product) => product.id === productId)?.description;

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<div>
				<p className="text-sm">
					<Link href="/brand/campaigns" className={LINK_CLASSES}>
						Campaigns
					</Link>
				</p>
				<h1 className="mt-2 text-2xl font-semibold tracking-tight">New campaign</h1>
				<p className="mt-1 text-fg-muted">
					Describe what you want. You review every field before anything is saved.
				</p>
			</div>

			<section aria-labelledby="step-product" className={`${CARD_CLASSES} space-y-5`}>
				<h2 id="step-product" className="text-lg font-semibold">
					Product and prompt
				</h2>

				{products.status === "failed" ? (
					<LoadFailed what="your products" error={products.error} onRetry={products.reload} />
				) : null}

				{products.status === "loading" && products.data === null ? (
					<LoadingNote>Loading your products…</LoadingNote>
				) : null}

				{hasNoProducts ? (
					<div className="space-y-3">
						<p className="text-fg-secondary">Add the product this campaign promotes.</p>
						<ProductForm onCreated={handleProductCreated} submitLabel="Add product" />
					</div>
				) : null}

				{productList.length > 0 ? (
					<div className="space-y-2">
						<Field
							label="Product"
							htmlFor="campaign-product"
							hint={productHint}
							error={errors.productId}
						>
							<select
								id="campaign-product"
								value={productId}
								onChange={(event) => setProductId(event.target.value)}
								aria-invalid={errors.productId ? true : undefined}
								aria-describedby={fieldDescribedBy("campaign-product", {
									hint: productHint,
									error: errors.productId
								})}
								className={INPUT_CLASSES}
							>
								{productList.map((product) => (
									<option key={product.id} value={product.id}>
										{product.name}
									</option>
								))}
							</select>
						</Field>
						{isAddingProduct ? (
							<div className="rounded-md border border-border p-4">
								<h3 className="mb-3 font-medium">New product</h3>
								<ProductForm
									onCreated={handleProductCreated}
									onCancel={() => setIsAddingProduct(false)}
									submitLabel="Add product"
								/>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setIsAddingProduct(true)}
								className={`min-h-11 sm:min-h-9 text-sm ${LINK_CLASSES}`}
							>
								Add another product
							</button>
						)}
					</div>
				) : null}

				<Field
					label="What should this campaign do?"
					htmlFor="campaign-prompt"
					hint={`For example: “${PROMPT_EXAMPLE}”`}
					error={promptError}
				>
					<textarea
						id="campaign-prompt"
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						rows={4}
						maxLength={3000}
						aria-invalid={promptError ? true : undefined}
						aria-describedby={fieldDescribedBy("campaign-prompt", {
							hint: PROMPT_EXAMPLE,
							error: promptError
						})}
						className={INPUT_CLASSES}
					/>
				</Field>

				<ErrorNote>{generateError}</ErrorNote>

				<div className="flex flex-wrap gap-2">
					<Button
						onClick={handleGenerate}
						busy={isGenerating}
						busyLabel="Generating brief…"
						disabled={hasNoProducts}
					>
						Generate brief
					</Button>
					<Button variant="secondary" onClick={handleManual}>
						Enter details manually
					</Button>
				</div>
				<p aria-live="polite" className="sr-only">
					{isGenerating ? "Generating a suggested brief…" : ""}
				</p>
			</section>

			{form !== null ? (
				<section aria-labelledby="step-brief" className={`${CARD_CLASSES} space-y-5`}>
					<div className="flex flex-wrap items-center gap-2">
						<h2
							id="step-brief"
							ref={briefHeadingRef}
							tabIndex={-1}
							className="text-lg font-semibold focus:outline-none"
						>
							{mode === null ? "Campaign brief" : "Suggested brief"}
						</h2>
						{mode !== null ? (
							<span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-text ring-1 ring-accent-line ring-inset">
								{MODE_TAGS[mode]}
							</span>
						) : null}
					</div>
					{mode !== null ? (
						<p className="text-sm text-fg-muted">
							A starting point from your prompt. Check every field; blanks need your input.
						</p>
					) : null}

					<form noValidate onSubmit={handleConfirm} className="space-y-6">
						<BriefFields
							form={form}
							errors={errors}
							onChange={setForm}
							idPrefix="campaign"
						/>

						{errorCount > 0 && errors.form === undefined ? (
							<ErrorNote>
								Check {errorCount === 1 ? "the highlighted field" : `the ${errorCount} highlighted fields`}.
							</ErrorNote>
						) : (
							<ErrorNote>{errors.form}</ErrorNote>
						)}

						<div className="flex flex-col gap-2 border-t border-divider pt-5 sm:flex-row sm:items-center">
							<Button type="submit" busy={isConfirming} busyLabel="Saving…">
								Confirm and find creators
							</Button>
							<p className="text-sm text-fg-muted">
								Saves the campaign and ranks listed creators against it.
							</p>
						</div>
					</form>
				</section>
			) : null}
		</div>
	);
}
