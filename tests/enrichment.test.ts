import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getProfile, PUT as putProfile } from "@/app/api/v1/creator/profile/route";
import { POST as setVisibility } from "@/app/api/v1/creator/profile/visibility/route";
import { POST as enrich } from "@/app/api/v1/creator/enrichment/route";
import { all, getDb, run, setDbForTests } from "@/server/db/db";
import { SEED } from "@/server/seed/ids";
import { parseToolResult, YouSearchError } from "@/server/youcom/client";
import { setSearchProviderForTests } from "@/server/youcom/enrichment";
import { extract, matchesIdentity, searchQuery } from "@/server/youcom/extract";
import { normalizeChannel } from "@/server/creators/channel";
import { CreatorProfile, EnrichmentResult } from "@/shared/contracts";
import { body, ctx, freshDb, req, signIn } from "./helpers";

const env = { mode: process.env.YDC_MODE, key: process.env.YDC_API_KEY };
beforeEach(() => {
  process.env.YDC_MODE = "fixture";
  delete process.env.YDC_API_KEY;
});
afterEach(() => {
  setDbForTests(undefined);
  setSearchProviderForTests(null);
  process.env.YDC_MODE = env.mode;
  if (env.key === undefined) delete process.env.YDC_API_KEY;
  else process.env.YDC_API_KEY = env.key;
});

const P = "/api/v1/creator/profile";

async function setupCreator(channel = "@LiveDemoKeys") {
  freshDb();
  const cookie = await signIn(SEED.users.creatorLiveDemo);
  const res = await putProfile(
    req("PUT", P, {
      cookie,
      body: { displayName: "Live Demo Creator", bio: "Keyboards.", channel, topics: [], formats: [], rate: null, typical7dViews: null, selectedEvidenceIds: [], expectedVersion: 1 },
    }),
    ctx(),
  );
  expect(res.status).toBe(200);
  return cookie;
}

const callEnrich = (cookie: string) => enrich(req("POST", "/api/v1/creator/enrichment", { cookie }), ctx());

describe("enrichment: fixture mode", () => {
  it("returns deterministic SAMPLE evidence without network, filtered by identity", async () => {
    const cookie = await setupCreator();
    setSearchProviderForTests(() => {
      throw new Error("network must not be used in fixture mode");
    });
    const res = await callEnrich(cookie);
    expect(res.status).toBe(200);
    const r = EnrichmentResult.parse((await body(res)).data);
    expect(r).toMatchObject({ status: "READY", mode: "SAMPLE", errorCode: null, profileVersion: 2 });
    expect(r.evidence).toHaveLength(3); // the similar-name result is dropped
    expect(r.evidence.every((e) => e.kind === "SAMPLE" && e.url.startsWith("https://example.com/"))).toBe(true);
    expect(r.suggestions.topics.map((t) => t.value)).toContain("mechanical-keyboards");
    expect(r.suggestions.formats.map((f) => f.value)).toEqual(expect.arrayContaining(["COMPARISON", "REVIEW"]));

    // Re-running reuses evidence IDs (selection survives).
    const again = EnrichmentResult.parse((await body(await callEnrich(cookie))).data);
    expect(again.evidence.map((e) => e.id).sort()).toEqual(r.evidence.map((e) => e.id).sort());
    const p = CreatorProfile.parse((await body(await getProfile(req("GET", P, { cookie }), ctx()))).data);
    expect(p.lastEnrichment?.status).toBe("READY");
    expect(p.evidence).toHaveLength(3);
  });

  it("requires a saved channel", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.creatorLiveDemo);
    const res = await callEnrich(cookie);
    expect(res.status).toBe(400);
    expect((await body(res)).error.fields.channel).toBeTruthy();
  });

  it("is creator-only", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    expect((await callEnrich(brand)).status).toBe(403);
  });
});

describe("enrichment: live mode (provider stubbed)", () => {
  it("saves PUBLIC evidence; approved sources make the listed card LIVE with provenance", async () => {
    const cookie = await setupCreator();
    process.env.YDC_MODE = "live";
    let query = "";
    setSearchProviderForTests(async (q, count) => {
      query = q;
      expect(count).toBe(6);
      return [
        { url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Silent switches sound test", snippet: "@LiveDemoKeys compares lubed vs stock switches.", publishedAt: "2026-10-01T00:00:00.000Z" },
        { url: "https://www.youtube.com/@LiveDemoKeysFanClub", title: "Keyboard review", snippet: "Not the same channel.", publishedAt: null },
        { url: "https://www.youtube.com/watch?v=zzzzzzzzzzz", title: "Live Demo Keys review", snippet: "Similar name only.", publishedAt: null },
      ];
    });
    const r = EnrichmentResult.parse((await body(await callEnrich(cookie))).data);
    expect(query).toBe('site:youtube.com "@LiveDemoKeys" videos reviews demonstrations');
    expect(r).toMatchObject({ status: "READY", mode: "LIVE" });
    expect(r.evidence).toHaveLength(1);
    expect(r.evidence[0]).toMatchObject({ kind: "PUBLIC", publishedAt: "2026-10-01T00:00:00.000Z" });
    const topic = r.suggestions.topics.find((t) => t.value === "keyboard-sound-tests")!;
    expect(topic).toMatchObject({ origin: "PUBLIC", evidenceIds: [r.evidence[0]!.id] });

    const put = await putProfile(
      req("PUT", P, {
        cookie,
        body: {
          displayName: "Live Demo Creator",
          bio: "Keyboards.",
          channel: "@LiveDemoKeys",
          topics: ["keyboard-sound-tests", "quiet offices"],
          formats: ["COMPARISON"],
          rate: null,
          typical7dViews: null,
          selectedEvidenceIds: [r.evidence[0]!.id],
          expectedVersion: 2,
        },
      }),
      ctx(),
    );
    const listed = CreatorProfile.parse(
      (await body(await setVisibility(req("POST", `${P}/visibility`, { cookie, body: { visibility: "LISTED", expectedVersion: (await body(put)).data.version } }), ctx()))).data,
    );
    const card = listed.published!;
    expect(card.dataMode).toBe("LIVE");
    expect(card.evidence.map((e) => e.id)).toEqual([r.evidence[0]!.id]);
    expect(card.topics).toEqual([
      { value: "keyboard-sound-tests", origin: "PUBLIC", evidenceIds: [r.evidence[0]!.id] },
      { value: "quiet-offices", origin: "CREATOR", evidenceIds: [] },
    ]);
  });

  it("returns FAILED with an error code and never falls back to fixtures", async () => {
    const cookie = await setupCreator();
    process.env.YDC_MODE = "live";
    process.env.YDC_API_KEY = "sk-test-secret-value";
    setSearchProviderForTests(async () => {
      throw new YouSearchError("TIMEOUT");
    });
    const res = await callEnrich(cookie);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("sk-test-secret-value");
    const r = EnrichmentResult.parse(JSON.parse(text).data);
    expect(r).toMatchObject({ status: "FAILED", mode: "LIVE", errorCode: "TIMEOUT", evidence: [] });
    const runs = all<{ status: string; error_code: string }>(getDb(), "SELECT status, error_code FROM enrichment_runs");
    expect(runs).toEqual([{ status: "FAILED", error_code: "TIMEOUT" }]);
    expect(all(getDb(), "SELECT 1 FROM evidence WHERE creator_id = ?", SEED.profiles.liveDemo)).toHaveLength(0);
  });

  it("returns EMPTY when no result matches the identity", async () => {
    const cookie = await setupCreator();
    process.env.YDC_MODE = "live";
    setSearchProviderForTests(async () => [{ url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", title: "Other", snippet: "Nothing here", publishedAt: null }]);
    const r = EnrichmentResult.parse((await body(await callEnrich(cookie))).data);
    expect(r.status).toBe("EMPTY");
  });

  it("discards results if the profile changed while the request was running", async () => {
    const cookie = await setupCreator();
    process.env.YDC_MODE = "live";
    setSearchProviderForTests(async () => {
      // Simulate a concurrent channel edit landing mid-request.
      run(getDb(), "UPDATE creator_profiles SET version = version + 1, channel_key = 'yt:@other' WHERE id = ?", SEED.profiles.liveDemo);
      return [{ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "x", snippet: "@LiveDemoKeys", publishedAt: null }];
    });
    const res = await callEnrich(cookie);
    expect(res.status).toBe(409);
    expect((await body(res)).error.code).toBe("STALE_PROFILE");
    expect(all<{ applied: number }>(getDb(), "SELECT applied FROM enrichment_runs")).toEqual([{ applied: 0 }]);
    expect(all(getDb(), "SELECT 1 FROM evidence WHERE creator_id = ?", SEED.profiles.liveDemo)).toHaveLength(0);
  });
});

describe("you-search helpers", () => {
  const ch = normalizeChannel("@ClackLab")!;
  const id = normalizeChannel("https://youtube.com/channel/UCabcdefghijklmnopqrstuv")!;

  it("matches exact handles / channel IDs only", () => {
    const h = (url: string, snippet = "") => ({ url, title: "", snippet, publishedAt: null });
    expect(matchesIdentity(h("https://www.youtube.com/@clacklab/videos"), ch)).toBe(true);
    expect(matchesIdentity(h("https://www.youtube.com/watch?v=x", "by @ClackLab."), ch)).toBe(true);
    expect(matchesIdentity(h("https://www.youtube.com/@ClackLabs"), ch)).toBe(false);
    expect(matchesIdentity(h("https://www.youtube.com/@ClackLab.tv"), ch)).toBe(false);
    expect(matchesIdentity(h("https://x", "Clack Lab sound test"), ch)).toBe(false);
    expect(matchesIdentity(h("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"), id)).toBe(true);
    expect(matchesIdentity(h("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuvX"), id)).toBe(false);
    expect(searchQuery(id)).toContain('"UCabcdefghijklmnopqrstuv"');
  });

  it("keeps at most six results and tags them", () => {
    const hits = Array.from({ length: 9 }, (_, i) => ({ url: `https://www.youtube.com/watch?v=${i}`, title: `Mechanical keyboard review ${i}`, snippet: "@ClackLab", publishedAt: null }));
    const out = extract(hits, ch);
    expect(out).toHaveLength(6);
    expect(out[0]).toMatchObject({ topics: ["mechanical-keyboards"], formats: ["REVIEW"] });
  });

  it("parses structured, JSON-text and plain-text tool results", () => {
    expect(parseToolResult({ structuredContent: { results: { web: [{ url: "https://a.example/1", title: "A", snippets: ["one", "two"] }] } } })).toEqual([
      { url: "https://a.example/1", title: "A", snippet: "one two", publishedAt: null },
    ]);
    const jsonText = { content: [{ type: "text", text: JSON.stringify({ results: { web: [{ url: "https://b.example", title: "B", description: "d", page_age: "2026-01-02T00:00:00" }] } }) }] };
    expect(parseToolResult(jsonText)[0]).toMatchObject({ url: "https://b.example", snippet: "d", publishedAt: expect.stringMatching(/^2026-01-0/) });
    const plain = { content: [{ type: "text", text: "Title: C\nURL: https://c.example/x\nSnippets: hello world\n\nTitle: D\nURL: https://d.example" }] };
    expect(parseToolResult(plain).map((h) => h.url)).toEqual(["https://c.example/x", "https://d.example"]);
  });
});

describe("demo channels", () => {
  it("lists demo channels only with PUBLIC-backed tags; skips ones without enough evidence", async () => {
    const { enrichAndListDemoChannels } = await import("@/server/seed/demoChannels");
    freshDb();
    process.env.YDC_MODE = "live";
    setSearchProviderForTests(async (q) => {
      if (q.includes("@TaeKeyboards")) return [];
      const handle = q.match(/"(@[^"]+)"/)![1]!;
      return [{ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Switch sound test review", snippet: `${handle} mechanical keyboard`, publishedAt: null }];
    });
    const out = await enrichAndListDemoChannels(getDb());
    expect(out.filter((o) => o.listed).length).toBe(3);
    expect(out.find((o) => o.name.startsWith("TaeKeyboards"))).toMatchObject({ listed: false, status: "EMPTY" });
    const brand = await signIn(SEED.users.brandHushkeys);
    const { GET } = await import("@/app/api/v1/creators/[id]/route");
    const card = (await body(await GET(req("GET", "/x", { cookie: brand }), ctx({ id: SEED.profiles.demoHipyo })))).data;
    expect(card.dataMode).toBe("LIVE");
    expect(card.rate).toBeNull();
    expect(card.topics.every((t: { origin: string }) => t.origin === "PUBLIC")).toBe(true);
    expect((await enrichAndListDemoChannels(getDb()))[0]!.status).toBe("SKIPPED");
  });
});
