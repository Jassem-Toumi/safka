const usdFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD"
});

/** Formats integer USD cents for display, e.g. 25000 → "$250.00". */
export function formatCents(cents: number): string {
	return usdFormatter.format(cents / 100);
}

/**
 * Parses what a person typed as a USD amount into integer cents, without
 * going through floating point. Accepts "$1,234.5", "600", "19.99". Returns
 * null for anything else, including negatives and more than two decimals.
 */
export function dollarsToCents(input: string): number | null {
	const match = /^\$?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(
		input.trim()
	);

	if (match === null) {
		return null;
	}

	const [, wholePart = "", fractionPart = ""] = match;
	const dollars = Number(wholePart.replaceAll(",", ""));
	const cents = Number(fractionPart.padEnd(2, "0"));

	return dollars * 100 + cents;
}

/**
 * Percent shortfall against a target, as the frontend spec §6 defines it:
 * round(100 × (target − actual) / target).
 */
export function shortfallPct(target: number, actual: number): number {
	return Math.round((100 * (target - actual)) / target);
}

/**
 * Formats an ISO timestamp in the viewer's time zone with the zone's name,
 * since the spec asks that every date show a recognizable time zone.
 */
export function formatDateTime(iso: string, timeZone?: string): string {
	return new Intl.DateTimeFormat("en-US", {
		// dateStyle/timeStyle cannot be combined with timeZoneName.
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
		timeZone
	}).format(new Date(iso));
}
