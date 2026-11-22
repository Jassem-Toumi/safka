import type { ReactNode } from "react";
import type { Evidence } from "@/shared/contracts";

import { formatDateTime } from "@/lib/format";
import { OriginLabel } from "@/lib/ui/Chips";

type ExternalLinkProps = {
	href: string;
	children: ReactNode;
	className?: string;
};

type EvidenceRowProps = {
	evidence: Evidence;
};

const LINK_CLASSES =
	"font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/**
 * URLs come from third-party sources, so only http(s) becomes a link; a
 * `javascript:` URL would otherwise run in our origin when clicked.
 */
function isWebUrl(url: string): boolean {
	try {
		const { protocol } = new URL(url);

		return protocol === "https:" || protocol === "http:";
	} catch {
		return false;
	}
}

/** Opens in a new tab and says so to screen readers; non-web URLs render as plain text. */
export function ExternalLink({ href, children, className }: ExternalLinkProps) {
	if (!isWebUrl(href)) {
		return <span className={className}>{children}</span>;
	}

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={className ?? LINK_CLASSES}
		>
			{children}
			<span className="sr-only"> (opens in a new tab)</span>
		</a>
	);
}

export function EvidenceRow({ evidence }: EvidenceRowProps) {
	return (
		<div className="min-w-0 space-y-1">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<ExternalLink
					href={evidence.url}
					className={`${LINK_CLASSES} break-words`}
				>
					{evidence.title}
				</ExternalLink>
				<OriginLabel origin={evidence.kind} />
			</div>
			{evidence.excerpt ? (
				<p className="line-clamp-3 text-sm text-zinc-700">{evidence.excerpt}</p>
			) : null}
			<p className="flex flex-wrap gap-x-3 text-sm text-zinc-500">
				<span>
					Found on{" "}
					<time dateTime={evidence.retrievedAt}>
						{formatDateTime(evidence.retrievedAt)}
					</time>
				</span>
				{evidence.publishedAt ? (
					<span>
						Source dated{" "}
						<time dateTime={evidence.publishedAt}>
							{formatDateTime(evidence.publishedAt)}
						</time>
					</span>
				) : null}
			</p>
		</div>
	);
}
