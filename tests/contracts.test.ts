import { describe, expect, it } from "vitest";
import { CreateDealInput, DealActionInput, ERROR_STATUS, ErrorCode, ProductInput } from "@/shared/contracts";
import { normalizeTopics } from "@/shared/topics";

describe("shared contracts", () => {
  it("maps every error code to an HTTP status", () => {
    for (const code of ErrorCode.options) expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
  });

  it("validates deal actions by discriminator", () => {
    expect(DealActionInput.safeParse({ action: "WITHDRAW", expectedVersion: 1 }).success).toBe(true);
    expect(DealActionInput.safeParse({ action: "SUBMIT_DRAFTS", expectedVersion: 1, uploadIds: ["a", "a"] }).success).toBe(false);
    expect(DealActionInput.safeParse({ action: "SUBMIT_PUBLICATION", expectedVersion: 1, url: "x", publishedAt: "2026-01-01T00:00:00Z", attested: false }).success).toBe(false);
    expect(DealActionInput.safeParse({ action: "NOPE", expectedVersion: 1 }).success).toBe(false);
  });

  it("enforces amount bounds on offers", () => {
    const base = {
      creatorId: "c", productId: "p", campaignId: null,
      terms: { amountCents: 25000, format: "COMPARISON", brief: "b", angle: null, talkingPoints: [], restrictions: [], disclosure: "#ad",
        draftDueAt: "2030-01-01T00:00:00Z", publishDueAt: "2030-01-08T00:00:00Z", viewTarget: null, clickTarget: null },
    };
    expect(CreateDealInput.safeParse(base).success).toBe(true);
    expect(CreateDealInput.safeParse({ ...base, terms: { ...base.terms, amountCents: 0 } }).success).toBe(false);
    expect(CreateDealInput.safeParse({ ...base, terms: { ...base.terms, amountCents: 10_000_001 } }).success).toBe(false);
  });

  it("requires https product URLs and treats empty as null", () => {
    expect(ProductInput.parse({ name: "n", description: "d", landingUrl: "" }).landingUrl).toBeNull();
    expect(ProductInput.safeParse({ name: "n", description: "d", landingUrl: "http://x.com" }).success).toBe(false);
  });

  it("normalizes topic slugs", () => {
    expect(normalizeTopics([" Mechanical Keyboards ", "mechanical-keyboards", "Desk & Setup", ""])).toEqual(["mechanical-keyboards", "desk-and-setup"]);
  });
});
