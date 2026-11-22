import { describe, expect, it } from "vitest";

import {
	dollarsToCents,
	formatCents,
	formatDateTime,
	shortfallPct
} from "@/lib/format";

describe("formatCents", () => {
	it("formats integer cents as USD with two decimals", () => {
		expect(formatCents(25000)).toBe("$250.00");
		expect(formatCents(1999)).toBe("$19.99");
		expect(formatCents(123456)).toBe("$1,234.56");
	});
});

describe("dollarsToCents", () => {
	it("parses whole and fractional dollars exactly", () => {
		expect(dollarsToCents("600")).toBe(60000);
		expect(dollarsToCents("19.99")).toBe(1999);
		expect(dollarsToCents("0.1")).toBe(10);
		expect(dollarsToCents("$1,234.5")).toBe(123450);
		expect(dollarsToCents(" 300 ")).toBe(30000);
	});

	it("rejects what is not a USD amount", () => {
		for (const input of ["", "abc", "-5", "1.234", "1,23", "$", "1e3"]) {
			expect(dollarsToCents(input)).toBeNull();
		}
	});
});

describe("shortfallPct", () => {
	it("matches the spec's worked example", () => {
		// "420 / 600 tracked clicks · 30% below target" (frontend spec §6)
		expect(shortfallPct(600, 420)).toBe(30);
	});
});

describe("formatDateTime", () => {
	it("names the time zone", () => {
		const formatted = formatDateTime("2026-11-22T20:00:00Z", "UTC");

		expect(formatted).toContain("UTC");
		expect(formatted).toContain("2026");
	});
});
