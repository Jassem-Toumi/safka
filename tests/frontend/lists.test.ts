import { describe, expect, it } from "vitest";

import { splitList } from "@/lib/lists";

describe("splitList", () => {
	it("splits on commas and newlines and trims", () => {
		expect(splitList("keyboards, switches\n  desk setups ,\r\nASMR")).toEqual([
			"keyboards",
			"switches",
			"desk setups",
			"ASMR"
		]);
	});

	it("drops empty items", () => {
		expect(splitList("")).toEqual([]);
		expect(splitList(" ,\n, a,,\n\nb ")).toEqual(["a", "b"]);
	});

	it("de-duplicates case-insensitively keeping the first spelling", () => {
		expect(splitList("ASMR, asmr\nKeyboards, keyboards, Asmr")).toEqual([
			"ASMR",
			"Keyboards"
		]);
	});
});
