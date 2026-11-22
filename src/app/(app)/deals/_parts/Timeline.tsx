"use client";

import type { Deal, Role } from "@/shared/contracts";

import { actorName, CARD } from "@/app/(app)/deals/_parts/kit";
import { humanizeEvent } from "@/lib/deals";
import { formatDateTime } from "@/lib/format";

type TimelineProps = {
	deal: Deal;
	viewerRole: Role;
};

export function Timeline({ deal, viewerRole }: TimelineProps) {
	return (
		<section aria-labelledby="timeline-heading" className={CARD}>
			<h2 id="timeline-heading" className="text-lg font-semibold">
				Timeline
			</h2>
			{deal.timeline.length === 0 ? (
				<p className="mt-2 text-zinc-600">Nothing has happened yet.</p>
			) : (
				<ol className="mt-3 space-y-3 border-l border-zinc-200 pl-4">
					{deal.timeline.map((event) => (
						<li key={event.id} className="relative">
							<span
								aria-hidden="true"
								className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-zinc-300"
							/>
							<p className="font-medium">{humanizeEvent(event.action)}</p>
							<p className="text-sm text-zinc-600">
								{actorName(deal, event.actorRole, viewerRole)}
								<span aria-hidden="true"> · </span>
								<span className="sr-only">, </span>
								<time dateTime={event.createdAt}>
									{formatDateTime(event.createdAt)}
								</time>
							</p>
							{event.note !== null ? (
								<p className="mt-0.5 text-sm break-words text-zinc-700">
									{event.note}
								</p>
							) : null}
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
