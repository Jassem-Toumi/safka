import { afterEach, describe, expect, it } from "vitest";
import { GET as getProfile, PUT as putProfile } from "@/app/api/v1/creator/profile/route";
import { POST as setVisibility } from "@/app/api/v1/creator/profile/visibility/route";
import { GET as listCreators } from "@/app/api/v1/creators/route";
import { GET as getCreator } from "@/app/api/v1/creators/[id]/route";
import { GET as getMe } from "@/app/api/v1/me/route";
import { setDbForTests } from "@/server/db/db";
import { SEED } from "@/server/seed/ids";
import { CreatorCard, CreatorProfile, type CreatorProfileInput } from "@/shared/contracts";
import { body, ctx, freshDb, req, signIn } from "./helpers";

afterEach(() => setDbForTests(undefined));

const P = "/api/v1/creator/profile";

function liveDemoInput(over: Partial<CreatorProfileInput> = {}): CreatorProfileInput {
  return {
    displayName: "Live Demo Creator",
    bio: "Keyboard sound tests.",
    channel: "https://www.youtube.com/@LiveDemoKeys/videos?si=track#x",
    topics: ["Mechanical Keyboards", "mechanical keyboards", "Sound tests"],
    formats: ["COMPARISON", "COMPARISON"],
    rate: { minCents: 20000, maxCents: 30000 },
    typical7dViews: 5000,
    selectedEvidenceIds: [],
    expectedVersion: 1,
    ...over,
  };
}

async function put(cookie: string, input: unknown) {
  return putProfile(req("PUT", P, { cookie, body: input }), ctx());
}

describe("creator profile", () => {
  it("GET returns the draft with listing blockers for a blank creator", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.creatorLiveDemo);
    const res = await getProfile(req("GET", P, { cookie }), ctx());
    expect(res.status).toBe(200);
    const p = CreatorProfile.parse((await body(res)).data);
    expect(p.visibility).toBe("DRAFT");
    expect(p.published).toBeNull();
    expect(p.listingBlockers).toEqual(["bio", "channel", "topics", "formats"]);
  });

  it("is creator-only", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    expect((await getProfile(req("GET", P, { cookie: brand }), ctx())).status).toBe(403);
    expect((await getProfile(req("GET", P), ctx())).status).toBe(401);
  });

  it("PUT normalizes channel/topics, bumps version and rejects stale versions", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.creatorLiveDemo);
    const res = await put(cookie, liveDemoInput());
    expect(res.status).toBe(200);
    const p = CreatorProfile.parse((await body(res)).data);
    expect(p.version).toBe(2);
    expect(p.canonicalChannelUrl).toBe("https://www.youtube.com/@LiveDemoKeys");
    expect(p.draft.channel).toBe("@LiveDemoKeys");
    expect(p.draft.topics).toEqual(["mechanical-keyboards", "sound-tests"]);
    expect(p.draft.formats).toEqual(["COMPARISON"]);
    expect(p.listingBlockers).toEqual([]);
    expect(p.hasUnpublishedChanges).toBe(true);

    const stale = await put(cookie, liveDemoInput({ expectedVersion: 1 }));
    expect(stale.status).toBe(409);
    expect((await body(stale)).error.code).toBe("STALE_PROFILE");
  });

  it("PUT rejects an invalid channel with a field error", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.creatorLiveDemo);
    const res = await put(cookie, liveDemoInput({ channel: "https://evil-youtube.com/@x" }));
    expect(res.status).toBe(400);
    expect((await body(res)).error.fields.channel).toBeTruthy();
  });

  it("LISTED requires the full profile; publishes a snapshot; HIDDEN removes it from the directory", async () => {
    freshDb();
    const creator = await signIn(SEED.users.creatorLiveDemo);
    const brand = await signIn(SEED.users.brandHushkeys);

    const blocked = await setVisibility(req("POST", `${P}/visibility`, { cookie: creator, body: { visibility: "LISTED", expectedVersion: 1 } }), ctx());
    expect(blocked.status).toBe(400);
    expect((await body(blocked)).error.details.listingBlockers).toContain("channel");

    await put(creator, liveDemoInput());
    const listed = await setVisibility(req("POST", `${P}/visibility`, { cookie: creator, body: { visibility: "LISTED", expectedVersion: 2 } }), ctx());
    expect(listed.status).toBe(200);
    const p = CreatorProfile.parse((await body(listed)).data);
    expect(p.visibility).toBe("LISTED");
    expect(p.publishedVersion).toBe(2);
    expect(p.hasUnpublishedChanges).toBe(false);
    expect(p.published!.dataMode).toBe("SELF_REPORTED");
    expect(p.published!.topics.every((t) => t.origin === "CREATOR")).toBe(true);
    expect(p.published!.expectedClicks).toBeNull();
    expect((await body(await getMe(req("GET", "/api/v1/me", { cookie: creator }), ctx()))).data.profileReady).toBe(true);

    // Brand sees the published snapshot; later draft edits don't leak until re-listed.
    await put(creator, liveDemoInput({ displayName: "Renamed draft", expectedVersion: 2 }));
    const card = CreatorCard.parse((await body(await getCreator(req("GET", `/api/v1/creators/${p.id}`, { cookie: brand }), ctx({ id: p.id })))).data);
    expect(card.displayName).toBe("Live Demo Creator");

    const hidden = await setVisibility(req("POST", `${P}/visibility`, { cookie: creator, body: { visibility: "HIDDEN", expectedVersion: 3 } }), ctx());
    const hp = CreatorProfile.parse((await body(hidden)).data);
    expect(hp.visibility).toBe("HIDDEN");
    expect(hp.published).not.toBeNull();
    expect((await getCreator(req("GET", `/api/v1/creators/${p.id}`, { cookie: brand }), ctx({ id: p.id }))).status).toBe(404);
  });

  it("rejects listing a channel already listed by another creator", async () => {
    freshDb();
    const creator = await signIn(SEED.users.creatorLiveDemo);
    await put(creator, liveDemoInput({ channel: "@clacklabsample" }));
    const res = await setVisibility(req("POST", `${P}/visibility`, { cookie: creator, body: { visibility: "LISTED", expectedVersion: 2 } }), ctx());
    expect(res.status).toBe(400);
    expect((await body(res)).error.fields.channel).toMatch(/already listed/);
  });

  it("keeps only evidence tied to the current channel selected", async () => {
    freshDb();
    const cookie = await signIn(SEED.users.creatorClackLab);
    const p = CreatorProfile.parse((await body(await getProfile(req("GET", P, { cookie }), ctx()))).data);
    expect(p.evidence.length).toBe(2);
    const ids = p.evidence.map((e) => e.id);
    const moved = CreatorProfile.parse(
      (await body(await put(cookie, { ...p.draft, channel: "@SomeOtherChannel", selectedEvidenceIds: ids, expectedVersion: p.version }))).data,
    );
    expect(moved.evidence).toEqual([]);
    expect(moved.draft.selectedEvidenceIds).toEqual([]);
  });
});

describe("creator directory", () => {
  it("lists LISTED cards for brands, sorted by name, with filters", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const all = (await body(await listCreators(req("GET", "/api/v1/creators", { cookie: brand }), ctx()))).data;
    expect(all.nextCursor).toBeNull();
    const names = all.items.map((c: CreatorCard) => c.displayName);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)));
    expect(names).not.toContain("Live Demo Creator");
    for (const c of all.items) CreatorCard.parse(c);

    const byTopic = (await body(await listCreators(req("GET", "/api/v1/creators?topic=Mechanical%20Keyboards", { cookie: brand }), ctx()))).data.items;
    expect(byTopic.map((c: CreatorCard) => c.id).sort()).toEqual([SEED.profiles.clackLab, SEED.profiles.deskSetup, SEED.profiles.thock].sort());

    const q = (await body(await listCreators(req("GET", "/api/v1/creators?q=sound&format=COMPARISON", { cookie: brand }), ctx()))).data.items;
    expect(q.map((c: CreatorCard) => c.id)).toEqual([SEED.profiles.clackLab]);

    const bad = await listCreators(req("GET", "/api/v1/creators?format=PODCAST", { cookie: brand }), ctx());
    expect(bad.status).toBe(400);
  });

  it("is brand-only and 404s for unlisted profiles", async () => {
    freshDb();
    const creator = await signIn(SEED.users.creatorClackLab);
    expect((await listCreators(req("GET", "/api/v1/creators", { cookie: creator }), ctx())).status).toBe(403);
    const brand = await signIn(SEED.users.brandHushkeys);
    const res = await getCreator(req("GET", `/api/v1/creators/${SEED.profiles.liveDemo}`, { cookie: brand }), ctx({ id: SEED.profiles.liveDemo }));
    expect(res.status).toBe(404);
  });
});
