"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { listCreators } from "@/lib/api";
import { errorMessage, useLoad } from "@/lib/useLoad";
import { Format } from "@/shared/contracts";

import { CreatorListItem, FORMAT_LABELS } from "../../../_components/creator";
import { Alert, Button, EmptyState, Input, Loading, PageHeader, Select } from "../../../_components/ui";

export default function CreatorDirectoryPage() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const q = params.get("q") ?? "";
	const topic = params.get("topic") ?? "";
	const format = params.get("format") ?? "";
	const [text, setText] = useState(q);
	const [topicText, setTopicText] = useState(topic);

	const result = useLoad(
		() =>
			listCreators({
				q: q || undefined,
				topic: topic || undefined,
				format: (Format.options as readonly string[]).includes(format) ? (format as Format) : undefined
			}),
		`${q}|${topic}|${format}`
	);

	function setParam(next: Record<string, string>) {
		const sp = new URLSearchParams(params.toString());

		for (const [k, v] of Object.entries(next)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}

		router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
	}

	// Debounce typed filters into the URL so they survive back-navigation.
	useEffect(() => {
		const t = setTimeout(() => {
			if (text !== q || topicText !== topic) setParam({ q: text, topic: topicText });
		}, 300);

		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [text, topicText]);

	const items = result.data?.items ?? [];
	const filtered = Boolean(q || topic || format);

	return (
		<>
			<PageHeader
				eyebrow="Discover"
				title="Creators"
				description="Listed YouTube creators, with the public sources behind their tags. Content fit first, reach second."
			/>

			<div className="mb-6 grid gap-3 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[1fr_200px_180px_auto]">
				<label className="sr-only" htmlFor="dir-q">
					Search creators
				</label>
				<Input id="dir-q" type="search" placeholder="Search name or bio…" value={text} onChange={(e) => setText(e.target.value)} />
				<label className="sr-only" htmlFor="dir-topic">
					Topic
				</label>
				<Input id="dir-topic" placeholder="Topic, e.g. keyboards" value={topicText} onChange={(e) => setTopicText(e.target.value)} />
				<label className="sr-only" htmlFor="dir-format">
					Format
				</label>
				<Select id="dir-format" value={format} onChange={(e) => setParam({ format: e.target.value })}>
					<option value="">Any format</option>
					{Format.options.map((f) => (
						<option key={f} value={f}>
							{FORMAT_LABELS[f]}
						</option>
					))}
				</Select>
				{filtered ? (
					<Button
						variant="ghost"
						onClick={() => {
							setText("");
							setTopicText("");
							router.replace(pathname);
						}}
					>
						Clear
					</Button>
				) : null}
			</div>

			{result.status === "loading" ? <Loading label="Loading creators…" /> : null}
			{result.status === "failed" ? (
				<Alert title="Creators are unavailable right now">
					{errorMessage(result.error)}{" "}
					<button type="button" className="font-medium underline" onClick={() => void result.reload()}>
						Try again
					</button>
				</Alert>
			) : null}
			{result.status === "ready" && items.length === 0 ? (
				<EmptyState title="No creators match" description="Try a broader topic or another format." />
			) : null}
			{items.length > 0 ? (
				<>
					<p className="mb-3 text-sm text-muted" aria-live="polite">
						{items.length} creator{items.length === 1 ? "" : "s"}
					</p>
					<ul className="grid gap-3">
						{items.map((card) => (
							<CreatorListItem key={card.id} card={card} href={`/brand/creators/${card.id}${params.toString() ? `?back=${encodeURIComponent(params.toString())}` : ""}`} />
						))}
					</ul>
				</>
			) : null}
		</>
	);
}
