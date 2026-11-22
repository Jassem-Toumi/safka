"use client";

import type { FormEvent } from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
	FORMAT_LABELS,
	FORMATS,
	toFormat
} from "@/app/(app)/brand/_parts/briefLabels";
import {
	INPUT_CLASSES,
	LoadFailed,
	LoadingNote,
	SECONDARY_LINK_CLASSES
} from "@/app/(app)/brand/_parts/ui";
import { listCreators } from "@/lib/api";
import { CreatorCardView } from "@/lib/ui/CreatorCardView";
import { Button } from "@/lib/ui/form";
import { useLoad } from "@/lib/ui/useLoad";

type Filters = {
	q: string;
	topic: string;
	format: string;
};

function toQueryString(filters: Filters): string {
	const params = new URLSearchParams();

	for (const [key, value] of Object.entries(filters)) {
		const trimmed = value.trim();

		if (trimmed !== "") {
			params.set(key, trimmed);
		}
	}

	const query = params.toString();

	return query === "" ? "" : `?${query}`;
}

/**
 * Brand landing page (frontend spec §2, §4 "Browse and compare"). Filters
 * live in the URL so returning from a profile keeps them.
 */
export function CreatorDirectory() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const q = searchParams.get("q") ?? "";
	const topic = searchParams.get("topic") ?? "";
	const format = toFormat(searchParams.get("format"));
	const hasFilters = q !== "" || topic !== "" || format !== null;

	const [draft, setDraft] = useState<Filters>({
		q,
		topic,
		format: format ?? ""
	});
	const creators = useLoad(
		() =>
			listCreators({
				q: q || undefined,
				topic: topic || undefined,
				format: format ?? undefined
			}),
		[q, topic, format]
	);

	function applyFilters(next: Filters) {
		router.replace(`${pathname}${toQueryString(next)}`, { scroll: false });
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		applyFilters(draft);
	}

	function handleFormatChange(value: string) {
		const next = { ...draft, format: value };

		setDraft(next);
		applyFilters(next);
	}

	function handleClear() {
		const empty = { q: "", topic: "", format: "" };

		setDraft(empty);
		applyFilters(empty);
	}

	const returnQuery = searchParams.toString();
	const items = creators.data?.items ?? [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Creators</h1>
				<p className="mt-1 text-zinc-600">
					Listed YouTube creators. Each fact shows where it came from.
				</p>
			</div>

			<form
				role="search"
				aria-label="Filter creators"
				onSubmit={handleSubmit}
				className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
			>
				<div className="space-y-1">
					<label htmlFor="creator-q" className="block text-sm font-medium">
						Search
					</label>
					<input
						id="creator-q"
						type="search"
						value={draft.q}
						onChange={(event) => setDraft({ ...draft, q: event.target.value })}
						placeholder="Name, bio or topic"
						maxLength={200}
						className={INPUT_CLASSES}
					/>
				</div>
				<div className="space-y-1">
					<label htmlFor="creator-topic" className="block text-sm font-medium">
						Topic
					</label>
					<input
						id="creator-topic"
						type="text"
						value={draft.topic}
						onChange={(event) =>
							setDraft({ ...draft, topic: event.target.value })
						}
						placeholder="e.g. desk setups"
						maxLength={60}
						className={INPUT_CLASSES}
					/>
				</div>
				<div className="space-y-1">
					<label htmlFor="creator-format" className="block text-sm font-medium">
						Format
					</label>
					<select
						id="creator-format"
						value={draft.format}
						onChange={(event) => handleFormatChange(event.target.value)}
						className={INPUT_CLASSES}
					>
						<option value="">Any format</option>
						{FORMATS.map((option) => (
							<option key={option} value={option}>
								{FORMAT_LABELS[option]}
							</option>
						))}
					</select>
				</div>
				<div className="flex gap-2">
					<Button type="submit">Search</Button>
					{hasFilters ? (
						<Button variant="secondary" onClick={handleClear}>
							Clear
						</Button>
					) : null}
				</div>
			</form>

			<p aria-live="polite" className="sr-only">
				{creators.status === "ready"
					? `${items.length} ${items.length === 1 ? "creator" : "creators"} found`
					: ""}
			</p>

			{creators.status === "failed" ? (
				<LoadFailed
					what="creators. The directory is unavailable right now"
					error={creators.error}
					onRetry={creators.reload}
				/>
			) : null}

			{creators.status === "loading" && creators.data === null ? (
				<LoadingNote>Loading creators…</LoadingNote>
			) : null}

			{creators.status === "ready" && items.length === 0 ? (
				<div className="space-y-3 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
					<p className="font-medium">
						{hasFilters
							? "No creators match these filters."
							: "No creators are listed yet."}
					</p>
					{hasFilters ? (
						<Button variant="secondary" onClick={handleClear}>
							Clear filters
						</Button>
					) : null}
				</div>
			) : null}

			{items.length > 0 ? (
				<ul
					aria-busy={creators.status === "loading"}
					className="grid gap-4 md:grid-cols-2"
				>
					{items.map((creator) => (
						<li key={creator.id} className="min-w-0">
							<CreatorCardView creator={creator} />
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
