"use client";

import type { Product } from "@/shared/contracts";

import { useState } from "react";

import { ApiError, createProduct, updateProduct } from "@/lib/api";
import { errorMessage } from "@/lib/useLoad";

import { Alert, Button, Dialog, Field, Input, Textarea } from "./ui";

export function ProductDialog({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: (p: Product) => void }) {
	const [name, setName] = useState(product?.name ?? "");
	const [description, setDescription] = useState(product?.description ?? "");
	const [landingUrl, setLandingUrl] = useState(product?.landingUrl ?? "");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function save() {
		setSaving(true);
		setFailure(null);

		try {
			const input = { name, description, landingUrl: landingUrl.trim() || null };
			const saved = product ? await updateProduct(product.id, input) : await createProduct(input);

			onSaved(saved);
		} catch (error) {
			setSaving(false);
			setErrors(error instanceof ApiError ? error.fields : {});
			setFailure(errorMessage(error));
		}
	}

	return (
		<Dialog
			open
			onClose={onClose}
			title={product ? "Edit product" : "New product"}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={save} busy={saving}>
						Save product
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				{failure ? <Alert>{failure}</Alert> : null}
				<Field label="Name" error={errors.name}>
					{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={name} onChange={(e) => setName(e.target.value)} />}
				</Field>
				<Field label="Short description" error={errors.description}>
					{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={description} onChange={(e) => setDescription(e.target.value)} />}
				</Field>
				<Field label="Product URL (optional)" hint="Public https:// page." error={errors.landingUrl}>
					{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} inputMode="url" placeholder="https://" value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} />}
				</Field>
			</div>
		</Dialog>
	);
}
