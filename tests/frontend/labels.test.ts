import type { MetricResult } from "@/shared/contracts";

import { describe, expect, it } from "vitest";

import { metricText, originLabel, rateFitLabel } from "@/lib/labels";

function metric(overrides: Partial<MetricResult>): MetricResult {
	return {
		target: null,
		actual: null,
		measuredAt: null,
		source: null,
		status: "NO_TARGET",
		shortfallPct: null,
		...overrides
	};
}

describe("originLabel", () => {
	it("labels each origin", () => {
		expect(originLabel("PUBLIC")).toBe("Sourced by You.com");
		expect(originLabel("CREATOR")).toBe("Creator provided");
		expect(originLabel("SAMPLE")).toBe("Sample data");
	});
});

describe("rateFitLabel", () => {
	it("labels each rate fit", () => {
		expect(rateFitLabel("WITHIN_PREFERENCE")).toBe("Within your price");
		expect(rateFitLabel("UNKNOWN")).toBe("Rate not provided");
		expect(rateFitLabel("ABOVE_PREFERENCE")).toBe("Above your price");
	});
});

describe("metricText", () => {
	it("matches the spec's below-target example", () => {
		const m = metric({
			status: "BELOW_TARGET",
			target: 600,
			actual: 420,
			shortfallPct: 30
		});

		expect(metricText(m, "clicks")).toBe("420 / 600 clicks · 30% below target");
	});

	it("computes the shortfall when the server omits it", () => {
		const m = metric({ status: "BELOW_TARGET", target: 600, actual: 420 });

		expect(metricText(m, "clicks")).toBe("420 / 600 clicks · 30% below target");
	});

	it("formats large numbers", () => {
		const m = metric({ status: "MET", target: 10000, actual: 12345 });

		expect(metricText(m, "views")).toBe("12,345 / 10,000 views · Target met");
	});

	it("shows an observed count without a target", () => {
		expect(metricText(metric({ actual: 1500 }), "views")).toBe(
			"1,500 views · No target set"
		);
		expect(metricText(metric({}), "views")).toBe("No target set");
	});

	it("keeps provisional counts provisional", () => {
		expect(metricText(metric({ status: "PENDING" }), "views")).toBe(
			"Measuring"
		);
		expect(
			metricText(metric({ status: "PENDING", actual: 80 }), "views")
		).toBe("Measuring · 80 so far (provisional)");
	});

	it("never renders a missing value as zero", () => {
		const m = metric({ status: "INSUFFICIENT_DATA", target: 600 });

		expect(metricText(m, "clicks")).toBe("Insufficient data");
		expect(metricText(m, "clicks")).not.toMatch(/\b0\b/);
	});

	it("renders a real zero as zero", () => {
		const m = metric({ status: "BELOW_TARGET", target: 600, actual: 0 });

		expect(metricText(m, "clicks")).toBe("0 / 600 clicks · 100% below target");
	});
});
