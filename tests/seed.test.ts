import { afterEach, describe, expect, it } from "vitest";
import { all, one, setDbForTests } from "@/server/db/db";
import { seedDemo } from "@/server/seed/seed";
import { SEED } from "@/server/seed/ids";
import { CreatorCard, Terms } from "@/shared/contracts";
import { freshDb } from "./helpers";

afterEach(() => setDbForTests(undefined));

describe("demo seed", () => {
  it("is idempotent and does not overwrite ongoing deals", () => {
    const db = freshDb();
    db.prepare("UPDATE deals SET version = 5 WHERE id = ?").run(SEED.deals.heldDispute);
    const again = seedDemo(db);
    expect(again).toMatchObject({ usersInserted: 0, dealsInserted: 0 });
    expect(one<{ version: number }>(db, "SELECT version FROM deals WHERE id = ?", SEED.deals.heldDispute)!.version).toBe(5);
  });

  it("stores schema-valid snapshots", () => {
    const db = freshDb();
    for (const r of all<{ published_json: string }>(db, "SELECT published_json FROM creator_profiles WHERE published_json IS NOT NULL")) {
      CreatorCard.parse(JSON.parse(r.published_json));
    }
    for (const r of all<{ terms_json: string }>(db, "SELECT terms_json FROM proposals")) Terms.parse(JSON.parse(r.terms_json));
  });

  it("labels fictitious creators as sample and leaves forecasts sample-only", () => {
    const db = freshDb();
    for (const r of all<{ is_sample: number; published_json: string | null }>(db, "SELECT is_sample, published_json FROM creator_profiles")) {
      if (!r.published_json) continue;
      const card = CreatorCard.parse(JSON.parse(r.published_json));
      if (card.expectedClicks) expect(card.expectedClicks.isSample).toBe(true);
      expect(r.is_sample).toBe(1);
      expect(card.dataMode).toBe("SAMPLE");
    }
  });

  it("seeds one held dispute and one completed sample deal", () => {
    const db = freshDb();
    const held = one<{ status: string; payment_status: string }>(db, "SELECT status, payment_status FROM deals WHERE id = ?", SEED.deals.heldDispute)!;
    expect(held).toEqual({ status: "DISPUTED", payment_status: "HELD" });
    const sample = one<{ status: string; payment_status: string; is_sample: number }>(db, "SELECT status, payment_status, is_sample FROM deals WHERE id = ?", SEED.deals.sampleCompleted)!;
    expect(sample).toEqual({ status: "COMPLETED", payment_status: "RELEASED", is_sample: 1 });
    expect(one(db, "SELECT 1 FROM disputes WHERE deal_id = ? AND resolved_at IS NULL", SEED.deals.heldDispute)).toBeTruthy();
  });
});
