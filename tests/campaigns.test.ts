import { afterEach, describe, expect, it } from "vitest";
import { GET as listCampaigns, POST as createCampaign } from "@/app/api/v1/campaigns/route";
import { GET as getCampaign, PATCH as patchCampaign } from "@/app/api/v1/campaigns/[id]/route";
import { POST as parseBrief } from "@/app/api/v1/campaigns/parse/route";
import { GET as getMatches } from "@/app/api/v1/campaigns/[id]/matches/route";
import { campaignBudget } from "@/server/campaigns/budget";
import { parseBriefRules } from "@/server/campaigns/parse";
import { suggestAngle } from "@/server/campaigns/angles";
import { rank, scoreCreator } from "@/server/campaigns/matcher";
import { fixedClock, setClock, DAY_MS } from "@/server/clock";
import { getDb, run, setDbForTests } from "@/server/db/db";
import { SEED } from "@/server/seed/ids";
import { Campaign, MatchCard, ParseResult, type CreatorCard } from "@/shared/contracts";
import { body, ctx, freshDb, req, signIn } from "./helpers";

afterEach(() => {
  setDbForTests(undefined);
  setClock(null);
});

const quietBrief = {
  title: "Quiet keyboards for shared offices",
  goal: "Show how quiet the Whisper 75 is.",
  objective: "AWARENESS" as const,
  topics: ["Mechanical Keyboards", "keyboard sound tests"],
  formats: ["COMPARISON" as const],
  talkingPoints: ["Silent linear switches"],
  restrictions: [],
};

function campaignBody(over: Record<string, unknown> = {}) {
  return {
    productId: SEED.products.whisper75,
    sourcePrompt: "Quiet keyboard campaign, $600 budget",
    brief: quietBrief,
    budgetCents: 60000,
    preferredMaxPerPostCents: null,
    defaultViewTarget: null,
    defaultClickTarget: null,
    ...over,
  };
}

async function create(cookie: string, over: Record<string, unknown> = {}) {
  const res = await createCampaign(req("POST", "/api/v1/campaigns", { cookie, body: campaignBody(over) }), ctx());
  return { res, data: (await body(res)).data };
}

const patch = (cookie: string, id: string, b: unknown) => patchCampaign(req("PATCH", `/api/v1/campaigns/${id}`, { cookie, body: b }), ctx({ id }));

describe("campaigns/parse (RULES)", () => {
  it("extracts dollar amounts, targets, topics, formats, objective; title from product", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const res = await parseBrief(
      req("POST", "/api/v1/campaigns/parse", {
        cookie,
        body: { productId: SEED.products.whisper75, prompt: "Launch a quiet keyboard campaign with sound test comparisons. $600 total, up to $300 per video. Aim for 20k views and 600 clicks." },
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
    const r = ParseResult.parse((await body(res)).data);
    expect(r).toMatchObject({ mode: "RULES", budgetCents: 60000, preferredMaxPerPostCents: 30000, defaultViewTarget: 20000, defaultClickTarget: 600 });
    expect(r.brief.title).toBe("Hushkeys Whisper 75");
    expect(r.brief.objective).toBe("AWARENESS");
    expect(r.brief.topics).toEqual(expect.arrayContaining(["mechanical-keyboards", "keyboard-sound-tests"]));
    expect(r.brief.formats).toEqual(expect.arrayContaining(["COMPARISON", "DEMO"]));
    expect(r.brief.goal).toContain("quiet keyboard");
  });

  it("leaves unknown fields blank and 404s other brands' products", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const r = parseBriefRules({ name: "Thing", description: "A thing." }, "something nice");
    expect(r).toMatchObject({ budgetCents: null, preferredMaxPerPostCents: null, defaultViewTarget: null, defaultClickTarget: null });
    expect(r.brief).toMatchObject({ objective: null, topics: [], formats: [] });
    expect(parseBriefRules({ name: "x", description: "" }, "$1,250.50 budget, $2k each").budgetCents).toBe(125050);
    const res = await parseBrief(req("POST", "/api/v1/campaigns/parse", { cookie, body: { productId: SEED.products.northwindStand, prompt: "hi" } }), ctx());
    expect(res.status).toBe(404);
  });
});

describe("campaign CRUD", () => {
  it("creates a DRAFT, normalizes topics, confirms to ACTIVE with budget", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const { res, data } = await create(cookie, { brief: { ...quietBrief, topics: [] }, budgetCents: null });
    expect(res.status).toBe(201);
    const c = Campaign.parse(data);
    expect(c).toMatchObject({ status: "DRAFT", version: 1, budget: null, dealCount: 0, hasOpenNegotiations: false });

    const noTopic = await patch(cookie, c.id, { expectedVersion: 1, confirm: true, budgetCents: 60000 });
    expect(noTopic.status).toBe(400);
    expect((await body(noTopic)).error.fields["brief.topics"]).toBeTruthy();

    const ok = await patch(cookie, c.id, { expectedVersion: 1, confirm: true, brief: quietBrief, budgetCents: 60000 });
    expect(ok.status).toBe(200);
    const a = Campaign.parse((await body(ok)).data);
    expect(a).toMatchObject({ status: "ACTIVE", version: 2, sourcePrompt: "Quiet keyboard campaign, $600 budget" });
    expect(a.brief!.topics).toEqual(["mechanical-keyboards", "keyboard-sound-tests"]);
    expect(a.budget).toEqual({ budgetCents: 60000, committedCents: 0, spentCents: 0, remainingCents: 60000 });

    const stale = await patch(cookie, c.id, { expectedVersion: 1, budgetCents: 70000 });
    expect(stale.status).toBe(409);
    expect((await body(stale)).error.code).toBe("STALE_CAMPAIGN");

    const list = (await body(await listCampaigns(req("GET", "/api/v1/campaigns", { cookie }), ctx()))).data.items;
    expect(list.map((x: Campaign) => x.id)).toContain(c.id);
  });

  it("confirm on create requires a full brief and budget", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const { res, data: _d } = await create(cookie, { confirm: true, budgetCents: null });
    expect(res.status).toBe(400);
    const err = await createCampaign(req("POST", "/api/v1/campaigns", { cookie, body: campaignBody({ confirm: true, budgetCents: null }) }), ctx());
    expect((await body(err)).error.fields.budgetCents).toBeTruthy();
    const { data } = await create(cookie, { confirm: true });
    expect(data.status).toBe("ACTIVE");
  });

  it("scopes campaigns and products to the owner (404)", async () => {
    freshDb();
    const other = await signIn(SEED.users.brandNorthwind);
    expect((await getCampaign(req("GET", `/api/v1/campaigns/${SEED.campaigns.moderation}`, { cookie: other }), ctx({ id: SEED.campaigns.moderation }))).status).toBe(404);
    expect((await patch(other, SEED.campaigns.moderation, { expectedVersion: 1, status: "CLOSED" })).status).toBe(404);
    const { res } = await create(other);
    expect(res.status).toBe(404);
    const creator = await signIn(SEED.users.creatorClackLab);
    expect((await listCampaigns(req("GET", "/api/v1/campaigns", { cookie: creator }), ctx())).status).toBe(403);
  });

  it("budget: the held dispute counts as committed; cap below committed+spent is rejected", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const c = Campaign.parse((await body(await getCampaign(req("GET", `/api/v1/campaigns/${SEED.campaigns.moderation}`, { cookie }), ctx({ id: SEED.campaigns.moderation })))).data);
    expect(c.budget).toEqual({ budgetCents: 100000, committedCents: 40000, spentCents: 0, remainingCents: 60000 });
    expect(c.dealCount).toBe(1);
    const sample = campaignBudget(getDb(), SEED.campaigns.sampleDeskMat, 80000);
    expect(sample).toEqual({ budgetCents: 80000, committedCents: 0, spentCents: 30000, remainingCents: 50000 });

    const low = await patch(cookie, c.id, { expectedVersion: c.version, budgetCents: 39999 });
    expect(low.status).toBe(409);
    expect((await body(low)).error.code).toBe("BUDGET_EXCEEDED");
    const ok = await patch(cookie, c.id, { expectedVersion: c.version, budgetCents: 40000 });
    expect((await body(ok)).data.budget.remainingCents).toBe(0);

    // Refund frees the commitment.
    run(getDb(), "UPDATE deals SET status = 'REFUNDED', payment_status = 'REFUNDED' WHERE id = ?", SEED.deals.heldDispute);
    expect(campaignBudget(getDb(), c.id, 40000)).toMatchObject({ committedCents: 0, remainingCents: 40000 });
  });

  it("closes only without unexpired open negotiations; closed campaigns are read-only", async () => {
    const clock = fixedClock("2026-11-22T12:00:00.000Z");
    freshDb(true, new Date("2026-11-22T12:00:00.000Z"));
    let cookie = await signIn(SEED.users.brandHushkeys);
    const { data } = await create(cookie, { confirm: true });
    const db = getDb();
    run(
      db,
      `INSERT INTO deals (id, brand_id, creator_user_id, creator_profile_id, campaign_id, product_id, negotiation_context, status, latest_proposal_id, created_at, updated_at)
       VALUES ('d1', ?, ?, ?, ?, ?, 'ctx1', 'NEGOTIATING', 'p1', ?, ?)`,
      SEED.users.brandHushkeys, SEED.users.creatorClackLab, SEED.profiles.clackLab, data.id, SEED.products.whisper75, "2026-11-22T12:00:00.000Z", "2026-11-22T12:00:00.000Z",
    );
    run(db, "INSERT INTO proposals (id, deal_id, revision, author_role, terms_json, expires_at, created_at) VALUES ('p1', 'd1', 1, 'BRAND', '{}', ?, ?)", "2026-11-29T12:00:00.000Z", "2026-11-22T12:00:00.000Z");

    const c = Campaign.parse((await body(await getCampaign(req("GET", `/api/v1/campaigns/${data.id}`, { cookie }), ctx({ id: data.id })))).data);
    expect(c.hasOpenNegotiations).toBe(true);
    const blocked = await patch(cookie, data.id, { expectedVersion: c.version, status: "CLOSED" });
    expect(blocked.status).toBe(409);
    expect((await body(blocked)).error.code).toBe("INVALID_STATE");

    clock.advance(8 * DAY_MS); // proposal expired by the server clock
    cookie = await signIn(SEED.users.brandHushkeys); // 7-day session expired too
    const closed = await patch(cookie, data.id, { expectedVersion: c.version, status: "CLOSED" });
    expect(closed.status).toBe(200);
    expect((await body(closed)).data.status).toBe("CLOSED");
    const edit = await patch(cookie, data.id, { expectedVersion: c.version + 1, budgetCents: 1000 });
    expect((await body(edit)).error.code).toBe("INVALID_STATE");
  });
});

describe("matches", () => {
  it("ranks the relevant small creator above unrelated huge reach (omitted), with evidence reasons and angle", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const { data } = await create(cookie, { confirm: true });
    const res = await getMatches(req("GET", `/api/v1/campaigns/${data.id}/matches`, { cookie }), ctx({ id: data.id }));
    expect(res.status).toBe(200);
    const items = (await body(res)).data.items.map((m: unknown) => MatchCard.parse(m)) as MatchCard[];
    const ids = items.map((m) => m.creator.id);
    expect(ids[0]).toBe(SEED.profiles.clackLab);
    expect(ids).not.toContain(SEED.profiles.bigTech);
    expect(ids).not.toContain(SEED.profiles.cozy);

    const top = items[0]!;
    expect(top).toMatchObject({ topicMatchPct: 100, formatMatch: true, rateFit: "WITHIN_PREFERENCE", campaignVersion: 1 });
    expect(top.angle).toBe("Let viewers hear the difference between the stock and upgraded build with Hushkeys Whisper 75.");
    const evidenceIds = new Set(top.creator.evidence.map((e) => e.id));
    const withEvidence = top.reasons.filter((r) => r.evidenceIds.length > 0);
    expect(withEvidence.length).toBeGreaterThan(0);
    for (const r of withEvidence) for (const id of r.evidenceIds) expect(evidenceIds.has(id)).toBe(true);

    // Thock (unknown rate) and Desk Setup (rate within 600) both match 50%; neither makes comparisons.
    // Within equal topic% and format overlap, a known within-range rate ranks above unknown.
    expect(ids.indexOf(SEED.profiles.deskSetup)).toBeLessThan(ids.indexOf(SEED.profiles.thock));
  });

  it("requires an ACTIVE owned campaign", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.brandHushkeys);
    const { data } = await create(cookie);
    const res = await getMatches(req("GET", `/api/v1/campaigns/${data.id}/matches`, { cookie }), ctx({ id: data.id }));
    expect((await body(res)).error.code).toBe("INVALID_STATE");
    const other = await signIn(SEED.users.brandNorthwind);
    expect((await getMatches(req("GET", `/api/v1/campaigns/${data.id}/matches`, { cookie: other }), ctx({ id: data.id }))).status).toBe(404);
  });

  it("rate fit uses min(remaining, preferred max) and ranks within > unknown > above", () => {
    const card = (id: string, rate: { minCents: number; maxCents: number } | null, views: number | null = null): CreatorCard => ({
      id, displayName: id, bio: "", profileUrl: "", topics: [{ value: "t", origin: "CREATOR", evidenceIds: [] }], formats: [],
      rate, typical7dViews: views, publicMetrics: [], evidence: [], dataMode: "SELF_REPORTED", expectedClicks: null, profileVersion: 1,
    });
    const brief = { title: "", goal: "", objective: null, topics: ["t"], formats: [], talkingPoints: [], restrictions: [] };
    const scored = [card("a", { minCents: 50000, maxCents: 60000 }), card("b", null), card("c", { minCents: 10000, maxCents: 20000 }, 10), card("d", { minCents: 10000, maxCents: 20000 }, 99)]
      .map((c) => scoreCreator(c, brief, 30000, "P", 1)!);
    expect(rank(scored).map((m) => [m.creator.id, m.rateFit])).toEqual([
      ["d", "WITHIN_PREFERENCE"],
      ["c", "WITHIN_PREFERENCE"],
      ["b", "UNKNOWN"],
      ["a", "ABOVE_PREFERENCE"],
    ]);
  });

  it("angle templates cover every format", () => {
    for (const f of ["REVIEW", "DEMO", "TUTORIAL", "UNBOXING", "COMPARISON", "STORY", "OTHER"] as const) {
      const a = suggestAngle({ format: f, topics: ["desk-setups"], productName: "Mat" });
      expect(a).toContain("Mat");
      expect(a).not.toMatch(/\{|\}/);
    }
    expect(suggestAngle({ format: null, topics: [], productName: "x" })).toBeNull();
  });
});
