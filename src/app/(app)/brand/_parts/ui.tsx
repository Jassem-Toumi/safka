import type { CampaignStatus } from "@/shared/contracts";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api";
import { Button } from "@/lib/ui/form";

/** Text inputs, selects and textareas; 16px text keeps iOS from zooming. */
export const INPUT_CLASSES =
	"block min-h-11 sm:min-h-9 w-full rounded-md border border-border-strong bg-surface dark:bg-surface-2 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[invalid=true]:border-danger sm:text-sm";

export const LINK_CLASSES =
	"font-medium text-accent-text underline underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const LINK_BUTTON_BASE =
	"inline-flex min-h-11 sm:min-h-9 items-center justify-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** A link styled like the shared primary `Button`. */
export const PRIMARY_LINK_CLASSES = `${LINK_BUTTON_BASE} bg-accent text-accent-fg hover:bg-accent-hover`;

/** A link styled like the shared secondary `Button`. */
export const SECONDARY_LINK_CLASSES = `${LINK_BUTTON_BASE} border border-border-strong bg-surface text-fg hover:bg-surface-2`;

export const CARD_CLASSES =
	"rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5";

export function errorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		return error.message;
	}

	return "The server didn’t respond. Check your connection and try again.";
}

export function LoadingNote({ children }: { children: ReactNode }) {
	return (
		<p aria-live="polite" className="text-fg-muted">
			{children}
		</p>
	);
}

type LoadFailedProps = {
	/** What couldn't load, e.g. "this campaign". */
	what: string;
	error: Error;
	onRetry: () => void;
};

export function LoadFailed({ what, error, onRetry }: LoadFailedProps) {
	return (
		<div
			role="alert"
			className="space-y-3 rounded-lg border border-border bg-surface p-4"
		>
			<p>
				Couldn’t load {what}. {errorMessage(error)}
			</p>
			<Button variant="secondary" onClick={onRetry}>
				Try again
			</Button>
		</div>
	);
}

const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; classes: string }> =
	{
		DRAFT: {
			label: "Draft",
			classes: "bg-surface-3 text-fg-secondary ring-border-strong"
		},
		ACTIVE: {
			label: "Active",
			classes: "bg-success-soft text-success ring-success-line"
		},
		CLOSED: {
			label: "Closed",
			classes: "bg-surface-3 text-fg-secondary ring-border-strong"
		}
	};

export function CampaignStatusChip({ status }: { status: CampaignStatus }) {
	const { label, classes } = CAMPAIGN_STATUS[status];

	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset ${classes}`}
		>
			{label}
		</span>
	);
}

/** The amber banner for seeded demo data. */
export function SampleBanner({ children }: { children: ReactNode }) {
	return (
		<p className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning">
			<span className="mr-2 rounded bg-warning-soft px-1.5 py-0.5 text-xs font-medium ring-1 ring-warning-line ring-inset">
				Sample data
			</span>
			{children}
		</p>
	);
}
