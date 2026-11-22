import type { FormErrorField } from "@/lib/profileForm";

import { ApiError } from "@/lib/api";
import { FORMAT_OPTIONS } from "@/lib/profileForm";

export type EditorMode = "onboarding" | "profile";

export const INPUT_CLASSES =
	"block min-h-11 sm:min-h-9 w-full rounded-md border border-border-strong bg-surface dark:bg-surface-2 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus aria-invalid:border-danger sm:text-sm";

export const SECTION_CLASSES =
	"space-y-4 rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-6";

/** One editor per page, so fixed ids are safe and let errors move focus. */
export const CONTROL_IDS: Record<FormErrorField, string> = {
	displayName: "profile-display-name",
	bio: "profile-bio",
	channel: "profile-channel",
	topics: "profile-topic-input",
	formats: `profile-format-${FORMAT_OPTIONS[0] ?? "REVIEW"}`,
	rateMin: "profile-rate-min",
	rateMax: "profile-rate-max",
	typical7dViews: "profile-views"
};

/** Form order, so focus lands on the first error a person would reach. */
export const ERROR_ORDER: readonly FormErrorField[] = [
	"displayName",
	"bio",
	"channel",
	"topics",
	"formats",
	"rateMin",
	"rateMax",
	"typical7dViews"
];

export function describeError(error: unknown): string {
	if (error instanceof ApiError) {
		return error.message;
	}

	return "The server didn’t respond. Check your connection and try again.";
}

/** `details.listingBlockers` from a listing error, if the server sent it. */
export function blockersFrom(error: ApiError): string[] {
	const blockers = error.details.listingBlockers;

	if (!Array.isArray(blockers)) {
		return [];
	}

	return blockers.filter((item): item is string => typeof item === "string");
}
