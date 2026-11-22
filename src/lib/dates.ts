function pad(n: number): string {
	return String(n).padStart(2, "0");
}

/**
 * Value for an `<input type="datetime-local">`, in the viewer's local time:
 * "YYYY-MM-DDTHH:mm". Returns "" for an unparseable timestamp, which the
 * input shows as empty.
 */
export function isoToLocalInput(iso: string): string {
	const date = new Date(iso);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	const year = date.getFullYear();
	const day = `${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

	return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Reads a datetime-local value as the viewer's local time and returns it as a
 * UTC ISO string ending in "Z", since the API's IsoDateTime rejects offsets.
 * Returns null for an empty or impossible value.
 */
export function localInputToIso(value: string): string | null {
	const match = LOCAL_INPUT.exec(value.trim());

	if (match === null) {
		return null;
	}

	const [, y = "", mo = "", d = "", h = "", mi = "", sec = "0"] = match;
	const [year, month, day] = [Number(y), Number(mo), Number(d)];
	const [hours, minutes, seconds] = [Number(h), Number(mi), Number(sec)];

	// Checked in UTC so a local DST gap can't make a real date look invalid.
	const calendar = new Date(Date.UTC(year, month - 1, day));
	const isRealDay =
		calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;

	if (!isRealDay || hours > 23 || minutes > 59 || seconds > 59) {
		return null;
	}

	return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
}

/** The viewer's time zone short name at a moment, e.g. "PST", for labels. */
export function timeZoneLabel(at: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZoneName: "short"
	}).formatToParts(at);

	return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}
