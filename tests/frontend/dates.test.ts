import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isoToLocalInput, localInputToIso, timeZoneLabel } from "@/lib/dates";

// Node re-reads TZ when it is assigned, so these run in a known zone.
const originalTz = process.env.TZ;

beforeAll(() => {
	process.env.TZ = "America/Los_Angeles";
});

afterAll(() => {
	process.env.TZ = originalTz;
});

describe("isoToLocalInput", () => {
	it("renders a UTC instant in the viewer's local time", () => {
		expect(isoToLocalInput("2026-12-01T17:05:00Z")).toBe("2026-12-01T09:05");
		expect(isoToLocalInput("2026-07-01T03:00:00.000Z")).toBe(
			"2026-06-30T20:00"
		);
	});
});

describe("localInputToIso", () => {
	it("returns a UTC ISO string ending in Z", () => {
		expect(localInputToIso("2026-12-01T09:05")).toBe(
			"2026-12-01T17:05:00.000Z"
		);
	});

	it("accepts seconds when the input supplies them", () => {
		expect(localInputToIso("2026-12-01T09:05:30")).toBe(
			"2026-12-01T17:05:30.000Z"
		);
	});

	it("rejects empty and invalid values", () => {
		for (const value of [
			"",
			"  ",
			"not a date",
			"2026-13-01T09:00",
			"2026-02-30T09:00",
			"2026-12-01T24:00"
		]) {
			expect(localInputToIso(value)).toBeNull();
		}
	});

	it("round-trips with isoToLocalInput", () => {
		for (const iso of [
			"2026-12-01T17:05:00.000Z",
			"2026-07-04T00:30:00.000Z",
			"2027-01-01T07:59:00.000Z"
		]) {
			expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
		}

		expect(isoToLocalInput(localInputToIso("2026-11-22T13:45") ?? "")).toBe(
			"2026-11-22T13:45"
		);
	});
});

describe("timeZoneLabel", () => {
	it("names the viewer's zone for the given moment", () => {
		expect(timeZoneLabel(new Date("2026-11-22T17:00:00Z"))).toBe("PST");
		expect(timeZoneLabel(new Date("2026-07-01T17:00:00Z"))).toBe("PDT");
	});

	it("defaults to now", () => {
		expect(timeZoneLabel()).toMatch(/^P[SD]T$/);
	});
});
