import type { CampaignStatus } from "@/shared/contracts";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api";
import { Button } from "@/lib/ui/form";

/** Text inputs, selects and textareas; 16px text keeps iOS from zooming. */
export const INPUT_CLASSES =
	"block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 aria-[invalid=true]:border-red-600";

export const LINK_CLASSES =
	"font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

const LINK_BUTTON_BASE =
	"inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/** A link styled like the shared primary `Button`. */
export const PRIMARY_LINK_CLASSES = `${LINK_BUTTON_BASE} bg-indigo-600 text-white hover:bg-indigo-700`;

/** A link styled like the shared secondary `Button`. */
export const SECONDARY_LINK_CLASSES = `${LINK_BUTTON_BASE} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100`;

export const CARD_CLASSES =
	"rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5";

export function errorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		return error.message;
	}

	return "The server didn’t respond. Check your connection and try again.";
}

export function LoadingNote({ children }: { children: ReactNode }) {
	return (
		<p aria-live="polite" className="text-zinc-600">
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
			className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
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
			classes: "bg-zinc-100 text-zinc-700 ring-zinc-300"
		},
		ACTIVE: {
			label: "Active",
			classes: "bg-emerald-50 text-emerald-800 ring-emerald-200"
		},
		CLOSED: {
			label: "Closed",
			classes: "bg-zinc-100 text-zinc-700 ring-zinc-300"
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
		<p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
			<span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium ring-1 ring-amber-300 ring-inset">
				Sample data
			</span>
			{children}
		</p>
	);
}
