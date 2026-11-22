import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST as createCampaignRoute } from "@/app/api/v1/campaigns/route";
import { GET as getMatches } from "@/app/api/v1/campaigns/[id]/matches/route";
import { GET as campaignReportRoute } from "@/app/api/v1/campaigns/[id]/report/route";
import { GET as listDealsRoute, POST as createDealRoute } from "@/app/api/v1/deals/route";
import { GET as getDealRoute } from "@/app/api/v1/deals/[id]/route";
import { POST as actionRoute } from "@/app/api/v1/deals/[id]/actions/route";
import { POST as uploadRoute } from "@/app/api/v1/deals/[id]/uploads/route";
import { GET as playbackRoute } from "@/app/api/v1/deals/[id]/assets/[assetId]/playback/route";
import { GET as mediaRoute } from "@/app/api/v1/deals/[id]/assets/[assetId]/media/route";
import { GET as dealReportRoute } from "@/app/api/v1/deals/[id]/report/route";
import { GET as adminList } from "@/app/api/v1/admin/disputes/route";
import { GET as adminDetail } from "@/app/api/v1/admin/disputes/[id]/route";
import { DAY_MS, HOUR_MS, fixedClock, now, setClock } from "@/server/clock";
import { openDb, setDbForTests, tx } from "@/server/db/db";
import { parseRange } from "@/server/deals/media";
import { parseYouTubeVideo } from "@/server/deals/terms";
import { seedDemo } from "@/server/seed/seed";
import { SEED } from "@/server/seed/ids";
import { AdminDisputeDetail, CampaignReport, Deal, DealReport, MatchCard } from "@/shared/contracts";
import { ORIGIN, body, ctx, freshDb, req, signIn } from "./helpers";

let uploadDir = "";
beforeAll(() => {
  uploadDir = mkdtempSync(join(tmpdir(), "safka-uploads-"));
  process.env.UPLOADS_DIR = uploadDir;
});
afterAll(() => {
  delete process.env.UPLOADS_DIR;
  rmSync(uploadDir, { recursive: true, force: true });
});
afterEach(() => {
  setDbForTests(undefined);
  setClock(null);
});

const iso = (msFromNow: number) => new Date(now().getTime() + msFromNow).toISOString();
let keyN = 0;
const key = () => `k-${++keyN}`;

function terms(amountCents: number, over: Record<string, unknown> = {}) {
  return {
    amountCents,
    format: "COMPARISON",
    brief: "Sound test comparing the Whisper 75 with a stock board.",
    angle: "Let viewers hear the difference.",
    talkingPoints: ["Silent linear switches"],
    restrictions: [],
    disclosure: "Say 'sponsored by Hushkeys' and add #ad.",
    draftDueAt: iso(3 * DAY_MS),
    publishDueAt: iso(6 * DAY_MS),
    viewTarget: null,
    clickTarget: null,
    ...over,
  };
}

async function createCampaign(cookie: string, budgetCents: number) {
  const res = await createCampaignRoute(
    req("POST", "/api/v1/campaigns", {
      cookie,
      body: {
        productId: SEED.products.whisper75,
        sourcePrompt: "",
        brief: {
          title: "Quiet keyboards",
          goal: "Show how quiet it is",
          objective: "AWARENESS",
          topics: ["mechanical-keyboards", "keyboard-sound-tests"],
          formats: ["COMPARISON"],
          talkingPoints: [],
          restrictions: [],
        },
        budgetCents,
        preferredMaxPerPostCents: null,
        defaultViewTarget: null,
        defaultClickTarget: null,
        confirm: true,
      },
    }),
    ctx(),
  );
  expect(res.status).toBe(201);
  return (await body(res)).data.id as string;
}

async function offer(cookie: string, creatorId: string, campaignId: string | null, amount: number, k = key(), productId: string = SEED.products.whisper75) {
  return createDealRoute(
    req("POST", "/api/v1/deals", { cookie, body: { creatorId, productId, campaignId, terms: terms(amount) }, headers: { "idempotency-key": k } }),
    ctx(),
  );
}

async function act(cookie: string, dealId: string, b: Record<string, unknown>, k = key()) {
  return actionRoute(req("POST", `/api/v1/deals/${dealId}/actions`, { cookie, body: b, headers: { "idempotency-key": k } }), ctx({ id: dealId }));
}

async function ok<T = Deal>(res: Response, status = 200): Promise<T> {
  const b = await body(res);
  if (res.status !== status) throw new Error(`expected ${status}, got ${res.status}: ${JSON.stringify(b)}`);
  return b.data as T;
}

async function getDeal(cookie: string, id: string) {
  return getDealRoute(req("GET", `/api/v1/deals/${id}`, { cookie }), ctx({ id }));
}

const MP4 = readFileSync(join(process.cwd(), "seed-assets/seed-draft-option-1.mp4"));

async function upload(cookie: string, dealId: string, bytes: Uint8Array = MP4, name = "draft.mp4") {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], name, { type: "video/mp4" }));
  return uploadRoute(
    new Request(`${ORIGIN}/api/v1/deals/${dealId}/uploads`, { method: "POST", headers: { host: "127.0.0.1:3000", origin: ORIGIN, cookie }, body: form }),
    ctx({ id: dealId }),
  );
}

describe("acceptance 2: offer, counter, accept, direct offer", () => {
  it("brand offers $250 from the sound-test match, creator counters $300, brand accepts and commits $300", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const creator = await signIn(SEED.users.creatorClackLab);
    const campaignId = await createCampaign(brand, 60000);
    const matches = (await ok<{ items: MatchCard[] }>(await getMatches(req("GET", `/x`, { cookie: brand }), ctx({ id: campaignId })))).items;
    expect(matches[0]!.creator.id).toBe(SEED.profiles.clackLab);

    const d0 = Deal.parse(await ok(await offer(brand, SEED.profiles.clackLab, campaignId, 25000), 201));
    expect(d0).toMatchObject({ status: "NEGOTIATING", paymentStatus: "NONE", nextActionRole: "CREATOR", version: 1 });
    expect(d0.latestProposal.terms).toMatchObject({ platform: "YOUTUBE", currency: "USD", product: { id: SEED.products.whisper75 } });
    expect(d0.budget).toMatchObject({ committedCents: 0, remainingCents: 60000 }); // pending proposals reserve nothing

    const seen = Deal.parse(await ok(await getDeal(creator, d0.id)));
    expect(seen.availableActions).toEqual(["ACCEPT", "COUNTER", "DECLINE"]);
    expect(seen.budget).toBeNull(); // creators never see the brand's budget

    const d1 = await ok(await act(creator, d0.id, { action: "COUNTER", expectedVersion: 1, proposalId: d0.latestProposal.id, amountCents: 30000, draftDueAt: iso(4 * DAY_MS), publishDueAt: iso(8 * DAY_MS), angle: "Stock vs. Whisper 75 sound test" }));
    expect(d1).toMatchObject({ status: "NEGOTIATING", nextActionRole: "BRAND" });
    expect(d1.latestProposal).toMatchObject({ revision: 2, authorRole: "CREATOR", terms: { amountCents: 30000 } });

    const d2 = await ok(await act(brand, d0.id, { action: "ACCEPT", expectedVersion: d1.version, proposalId: d1.latestProposal.id }));
    expect(d2).toMatchObject({ status: "AGREED", paymentStatus: "NONE", nextActionRole: "CREATOR" });
    expect(d2.agreement!.terms.amountCents).toBe(30000);
    expect(d2.budget).toEqual({ budgetCents: 60000, committedCents: 30000, spentCents: 0, remainingCents: 30000 });
    expect(d2.timeline.map((e) => e.action)).toEqual(["OFFER_SENT", "COUNTER", "ACCEPT"]);
  });

  it("direct offer has no campaign budget; one open negotiation per context", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const d = await ok(await offer(brand, SEED.profiles.deskSetup, null, 40000, key(), SEED.products.deskMat), 201);
    expect(d).toMatchObject({ campaignId: null, budget: null });
    const dup = await offer(brand, SEED.profiles.deskSetup, null, 41000, key(), SEED.products.deskMat);
    expect(dup.status).toBe(409);
    expect((await body(dup)).error).toMatchObject({ code: "ACTIVE_NEGOTIATION_EXISTS", details: { dealId: d.id } });
    // A different product is a different direct context.
    expect((await offer(brand, SEED.profiles.deskSetup, null, 41000)).status).toBe(201);
  });

  it("validates recipient, product, dates and initial budget", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const campaignId = await createCampaign(brand, 30000);
    expect((await body(await offer(brand, SEED.profiles.liveDemo, null, 100))).error.code).toBe("PROFILE_UNAVAILABLE");
    expect((await body(await offer(brand, SEED.profiles.clackLab, campaignId, 30001))).error.code).toBe("BUDGET_EXCEEDED");
    expect((await offer(brand, SEED.profiles.clackLab, campaignId, 100, key(), SEED.products.deskMat)).status).toBe(400);
    expect((await offer(brand, SEED.profiles.clackLab, null, 100, key(), SEED.products.northwindStand)).status).toBe(404);
    const badDates = await createDealRoute(
      req("POST", "/api/v1/deals", { cookie: brand, body: { creatorId: SEED.profiles.clackLab, productId: SEED.products.whisper75, campaignId: null, terms: terms(100, { draftDueAt: iso(5 * DAY_MS), publishDueAt: iso(4 * DAY_MS) }) }, headers: { "idempotency-key": key() } }),
      ctx(),
    );
    expect((await body(badDates)).error.fields.publishDueAt).toBeTruthy();
    const noKey = await createDealRoute(req("POST", "/api/v1/deals", { cookie: brand, body: { creatorId: SEED.profiles.clackLab, productId: SEED.products.whisper75, campaignId: null, terms: terms(100) } }), ctx());
    expect(noKey.status).toBe(400);
    const creator = await signIn(SEED.users.creatorClackLab);
    expect((await offer(creator, SEED.profiles.clackLab, null, 100)).status).toBe(403);
  });
});

describe("acceptance 3: budget cap, stale and duplicate requests, decline/withdraw/expire", () => {
  it("with $500 available, only one of two $300 acceptances commits", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const campaignId = await createCampaign(brand, 50000);
    const a = await ok(await offer(brand, SEED.profiles.clackLab, campaignId, 30000), 201);
    const b = await ok(await offer(brand, SEED.profiles.deskSetup, campaignId, 30000), 201);
    const ca = await signIn(SEED.users.creatorClackLab);
    const cb = await signIn(SEED.users.creatorDeskSetup);
    const [ra, rb] = await Promise.all([
      act(ca, a.id, { action: "ACCEPT", expectedVersion: 1, proposalId: a.latestProposal.id }),
      act(cb, b.id, { action: "ACCEPT", expectedVersion: 1, proposalId: b.latestProposal.id }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const loser = ra.status === 409 ? ra : rb;
    expect((await body(loser)).error.code).toBe("BUDGET_EXCEEDED");
    const fromBrand = await ok(await getDeal(brand, b.id));
    const fromBrandA = await ok(await getDeal(brand, a.id));
    expect([fromBrand.status, fromBrandA.status].sort()).toEqual(["AGREED", "NEGOTIATING"]); // blocked one stays open
    expect(fromBrand.budget).toMatchObject({ committedCents: 30000, remainingCents: 20000 });
  });

  it("returns RETRY_LATER when another connection holds the write lock", async () => {
    const dir = mkdtempSync(join(tmpdir(), "safka-lock-"));
    const file = join(dir, "t.db");
    const a = openDb(file);
    seedDemo(a);
    const b = openDb(file);
    a.exec("BEGIN IMMEDIATE");
    try {
      expect(() => tx(b, () => 1)).toThrowError(expect.objectContaining({ code: "RETRY_LATER" }));
    } finally {
      a.exec("ROLLBACK");
      a.close();
      b.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 10_000);

  it("replays duplicates, rejects reused keys with new payloads, and stale versions", async () => {
    fixedClock(new Date().toISOString()); // identical payloads need identical due dates
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const creator = await signIn(SEED.users.creatorClackLab);
    const campaignId = await createCampaign(brand, 60000);
    const k = key();
    const first = await ok(await offer(brand, SEED.profiles.clackLab, campaignId, 25000, k), 201);
    const again = await offer(brand, SEED.profiles.clackLab, campaignId, 25000, k);
    expect(again.status).toBe(201);
    expect(again.headers.get("idempotent-replay")).toBe("true");
    expect((await body(again)).data.id).toBe(first.id);
    expect((await body(await offer(brand, SEED.profiles.clackLab, campaignId, 26000, k))).error.code).toBe("IDEMPOTENCY_CONFLICT");

    const ak = key();
    const accept = { action: "ACCEPT", expectedVersion: 1, proposalId: first.latestProposal.id };
    const r1 = await ok(await act(creator, first.id, accept, ak));
    // Replay is checked before the (now stale) version: identical repeat returns the saved result.
    const r2 = await act(creator, first.id, accept, ak);
    expect(r2.status).toBe(200);
    expect((await body(r2)).data.version).toBe(r1.version);
    const stale = await act(creator, first.id, { action: "DECLINE", expectedVersion: 1, proposalId: first.latestProposal.id });
    expect((await body(stale)).error.code).toBe("STALE_DEAL");
    expect((await ok(await getDeal(brand, first.id))).budget).toMatchObject({ committedCents: 25000 });
  });

  it("decline, withdraw and expiry by the server clock", async () => {
    const clock = fixedClock(new Date().toISOString());
    freshDb();
    let brand = await signIn(SEED.users.brandHushkeys);
    let creator = await signIn(SEED.users.creatorClackLab);
    const d1 = await ok(await offer(brand, SEED.profiles.clackLab, null, 100), 201);
    expect((await ok(await act(creator, d1.id, { action: "DECLINE", expectedVersion: 1, proposalId: d1.latestProposal.id }))).status).toBe("DECLINED");
    const d2 = await ok(await offer(brand, SEED.profiles.clackLab, null, 100), 201);
    expect((await body(await act(creator, d2.id, { action: "WITHDRAW", expectedVersion: 1 }))).error.code).toBe("FORBIDDEN");
    expect((await ok(await act(brand, d2.id, { action: "WITHDRAW", expectedVersion: 1 }))).status).toBe("WITHDRAWN");

    const d3 = await ok(await offer(brand, SEED.profiles.clackLab, null, 100), 201);
    clock.advance(7 * DAY_MS + HOUR_MS);
    brand = await signIn(SEED.users.brandHushkeys);
    creator = await signIn(SEED.users.creatorClackLab);
    expect((await ok(await getDeal(creator, d3.id))).status).toBe("EXPIRED");
    const late = await act(creator, d3.id, { action: "ACCEPT", expectedVersion: 1, proposalId: d3.latestProposal.id });
    expect((await body(late)).error.code).toBe("PROPOSAL_EXPIRED");
    const closed = (await ok<{ items: Deal[] }>(await listDealsRoute(req("GET", "/api/v1/deals?filter=closed", { cookie: creator }), ctx()))).items;
    expect(closed.map((d) => d.id)).toEqual(expect.arrayContaining([d1.id, d2.id, d3.id]));
    // The expired negotiation no longer blocks a new offer in the same context.
    expect((await offer(brand, SEED.profiles.clackLab, null, 100)).status).toBe(201);
  });
});

describe("acceptance 4: drafts, approval, publication, confirmations, media access", () => {
  it("runs the full delivery flow and releases exactly once", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const creator = await signIn(SEED.users.creatorClackLab);
    const campaignId = await createCampaign(brand, 60000);
    let d = await ok(await offer(brand, SEED.profiles.clackLab, campaignId, 30000), 201);
    d = await ok(await act(creator, d.id, { action: "ACCEPT", expectedVersion: d.version, proposalId: d.latestProposal.id }));

    // Upload validation.
    expect((await upload(brand, d.id)).status).toBe(403);
    expect((await upload(creator, d.id, new TextEncoder().encode("not a video at all"))).status).toBe(400);
    const u1 = await ok<{ uploadId: string; status: string }>(await upload(creator, d.id), 201);
    const u2 = await ok<{ uploadId: string }>(await upload(creator, d.id), 201);
    expect(u1.status).toBe("READY");

    d = await ok(await act(creator, d.id, { action: "SUBMIT_DRAFTS", expectedVersion: d.version, uploadIds: [u1.uploadId, u2.uploadId] }));
    expect(d).toMatchObject({ status: "DRAFT_REVIEW", nextActionRole: "BRAND" });
    const brandView = await ok(await getDeal(brand, d.id));
    expect(brandView.draftBatches[0]!.assets).toHaveLength(2);
    expect(brandView.availableActions).toEqual(["APPROVE_DRAFT", "REQUEST_CHANGES", "REPORT_ISSUE"]);

    // Attached uploads can't be reused.
    d = await ok(await act(brand, d.id, { action: "REQUEST_CHANGES", expectedVersion: d.version, reason: "Mention the foam." }));
    expect(d.status).toBe("REVISION_REQUESTED");
    expect((await body(await act(creator, d.id, { action: "SUBMIT_DRAFTS", expectedVersion: d.version, uploadIds: [u1.uploadId] }))).error.code).toBe("VALIDATION_ERROR");
    const u3 = await ok<{ uploadId: string }>(await upload(creator, d.id), 201);
    d = await ok(await act(creator, d.id, { action: "SUBMIT_DRAFTS", expectedVersion: d.version, uploadIds: [u3.uploadId] }));
    expect(d.draftBatches.map((b) => b.round)).toEqual([1, 2]);
    expect(d.draftBatches[0]!.changeRequest).toBe("Mention the foam.");

    // Only an asset from the latest batch can be approved.
    const oldAsset = d.draftBatches[0]!.assets[0]!.id;
    expect((await body(await act(brand, d.id, { action: "APPROVE_DRAFT", expectedVersion: d.version, assetId: oldAsset }))).error.code).toBe("VALIDATION_ERROR");
    const newAsset = d.draftBatches[1]!.assets[0]!.id;
    d = await ok(await act(brand, d.id, { action: "APPROVE_DRAFT", expectedVersion: d.version, assetId: newAsset }));
    expect(d).toMatchObject({ status: "READY_TO_PUBLISH", paymentStatus: "HELD", approvedAssetId: newAsset });
    expect(d.budget).toMatchObject({ committedCents: 30000 });

    // Media: participants stream with ranges; others get 404.
    const pb = await ok<{ url: string; expiresAt: null }>(await playbackRoute(req("GET", "/x", { cookie: brand }), ctx({ id: d.id, assetId: newAsset })));
    expect(pb).toEqual({ url: `/api/v1/deals/${d.id}/assets/${newAsset}/media`, expiresAt: null });
    const full = await mediaRoute(req("GET", pb.url, { cookie: brand }), ctx({ id: d.id, assetId: newAsset }));
    expect(full.status).toBe(200);
    expect(full.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await full.arrayBuffer()).equals(MP4)).toBe(true);
    const part = await mediaRoute(req("GET", pb.url, { cookie: creator, headers: { range: "bytes=0-99" } }), ctx({ id: d.id, assetId: newAsset }));
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-99/${MP4.length}`);
    expect((await part.arrayBuffer()).byteLength).toBe(100);
    const bad = await mediaRoute(req("GET", pb.url, { cookie: creator, headers: { range: `bytes=${MP4.length}-` } }), ctx({ id: d.id, assetId: newAsset }));
    expect(bad.status).toBe(416);
    for (const other of [SEED.users.creatorDeskSetup, SEED.users.brandNorthwind, SEED.users.admin]) {
      const c = await signIn(other);
      expect((await mediaRoute(req("GET", pb.url, { cookie: c }), ctx({ id: d.id, assetId: newAsset }))).status).toBe(404);
      expect((await getDeal(c, d.id)).status).toBe(404);
    }

    // Publication.
    expect((await act(creator, d.id, { action: "SUBMIT_PUBLICATION", expectedVersion: d.version, url: "https://vimeo.com/123", publishedAt: new Date().toISOString(), attested: true })).status).toBe(400);
    d = await ok(await act(creator, d.id, { action: "SUBMIT_PUBLICATION", expectedVersion: d.version, url: "https://youtu.be/dQw4w9WgXcQ?t=3", publishedAt: new Date().toISOString(), attested: true }));
    expect(d.status).toBe("PUBLISHED");
    expect(d.publication).toMatchObject({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ", late: false, sample: false });

    d = await ok(await act(creator, d.id, { action: "CONFIRM_DELIVERY", expectedVersion: d.version }));
    expect(d).toMatchObject({ status: "PUBLISHED", paymentStatus: "HELD", nextActionRole: "BRAND" });
    expect((await body(await act(creator, d.id, { action: "CONFIRM_DELIVERY", expectedVersion: d.version }))).error.code).toBe("INVALID_STATE");
    d = await ok(await act(brand, d.id, { action: "CONFIRM_DELIVERY", expectedVersion: d.version }));
    expect(d).toMatchObject({ status: "COMPLETED", paymentStatus: "RELEASED", availableActions: [] });
    expect(d.budget).toEqual({ budgetCents: 60000, committedCents: 0, spentCents: 30000, remainingCents: 30000 });
    expect(d.timeline.filter((e) => e.note?.includes("released"))).toHaveLength(1);

    const report = DealReport.parse(await ok(await dealReportRoute(req("GET", "/x", { cookie: creator }), ctx({ id: d.id }))));
    expect(report).toMatchObject({ sample: false, views: { status: "NO_TARGET", actual: null }, clicks: { status: "NO_TARGET" } });
  });

  it("rejects oversized uploads with 413", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const creator = await signIn(SEED.users.creatorClackLab);
    let d = await ok(await offer(brand, SEED.profiles.clackLab, null, 100), 201);
    d = await ok(await act(creator, d.id, { action: "ACCEPT", expectedVersion: 1, proposalId: d.latestProposal.id }));
    const big = new Uint8Array(20 * 1024 * 1024 + 1);
    big.set(MP4.subarray(0, 12));
    expect((await upload(creator, d.id, big)).status).toBe(413);
  });
});

describe("acceptance 5: held dispute, admin refund, sample report", () => {
  it("admin refund frees exactly the $400 commitment", async () => {
    freshDb();
    const admin = await signIn(SEED.users.admin);
    const brand = await signIn(SEED.users.brandHushkeys);
    const list = (await ok<{ items: { id: string; dealId: string; amountCents: number; resolvedAt: string | null }[] }>(await adminList(req("GET", "/x", { cookie: admin }), ctx()))).items;
    const open = list.find((x) => x.dealId === SEED.deals.heldDispute)!;
    expect(open).toMatchObject({ amountCents: 40000, resolvedAt: null });
    expect((await adminList(req("GET", "/x", { cookie: brand }), ctx())).status).toBe(403);

    const detail = AdminDisputeDetail.parse(await ok(await adminDetail(req("GET", "/x", { cookie: admin }), ctx({ id: open.id }))));
    expect(detail.deal.availableActions).toEqual(["RESUME_DEAL", "REFUND_PAYMENT", "RELEASE_PAYMENT"]);
    expect(detail.deal.budget).toBeNull();

    const before = await ok(await getDeal(brand, SEED.deals.heldDispute));
    expect(before.budget).toMatchObject({ committedCents: 40000, remainingCents: 60000 });
    expect((await body(await act(admin, SEED.deals.heldDispute, { action: "CANCEL_DEAL", expectedVersion: 1, disputeId: open.id, reason: "x" }))).error.code).toBe("INVALID_STATE");
    const done = await ok(await act(admin, SEED.deals.heldDispute, { action: "REFUND_PAYMENT", expectedVersion: 1, disputeId: open.id, reason: "Creator missed the deadline." }));
    expect(done).toMatchObject({ status: "REFUNDED", paymentStatus: "REFUNDED" });
    const after = await ok(await getDeal(brand, SEED.deals.heldDispute));
    expect(after.budget).toMatchObject({ committedCents: 0, remainingCents: 100000 });
    expect(after.dispute).toMatchObject({ resolution: "REFUND_PAYMENT", resolutionReason: "Creator missed the deadline." });
  });

  it("report issue → resume restores the prior state; admins see only disputed deals", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const creator = await signIn(SEED.users.creatorClackLab);
    const admin = await signIn(SEED.users.admin);
    let d = await ok(await offer(brand, SEED.profiles.clackLab, null, 100), 201);
    expect((await getDeal(admin, d.id)).status).toBe(404);
    expect((await body(await act(brand, d.id, { action: "REPORT_ISSUE", expectedVersion: 1, code: "OTHER", reason: "x" }))).error.code).toBe("INVALID_STATE");
    d = await ok(await act(creator, d.id, { action: "ACCEPT", expectedVersion: 1, proposalId: d.latestProposal.id }));
    d = await ok(await act(creator, d.id, { action: "REPORT_ISSUE", expectedVersion: d.version, code: "UNRESPONSIVE_PARTY", reason: "No reply." }));
    expect(d).toMatchObject({ status: "DISPUTED", paymentStatus: "NONE", nextActionRole: "ADMIN" });
    const ad = await ok(await getDeal(admin, d.id));
    expect(ad.availableActions).toEqual(["RESUME_DEAL", "CANCEL_DEAL"]);
    d = await ok(await act(admin, d.id, { action: "RESUME_DEAL", expectedVersion: d.version, disputeId: d.dispute!.id, reason: "Resolved by chat." }));
    expect(d.status).toBe("AGREED");
    expect((await ok(await getDeal(admin, d.id))).availableActions).toEqual([]);
  });

  it("sample report shows 420 of 600 clicks, BELOW_TARGET by 30%, labeled sample", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const r = CampaignReport.parse(await ok(await campaignReportRoute(req("GET", "/x", { cookie: brand }), ctx({ id: SEED.campaigns.sampleDeskMat }))));
    expect(r).toMatchObject({ sample: true, agreedCount: 1, publishedCount: 1, completedCount: 1, countsByStatus: { COMPLETED: 1 } });
    expect(r.budget).toEqual({ budgetCents: 80000, committedCents: 0, spentCents: 30000, remainingCents: 50000 });
    const dr = r.deals.items[0]!;
    expect(dr.clicks).toMatchObject({ target: 600, actual: 420, source: "SAMPLE", status: "BELOW_TARGET", shortfallPct: 30 });
    expect(dr.views).toMatchObject({ target: 20000, actual: 21500, status: "MET" });
    expect(dr.sample).toBe(true);
    const other = await signIn(SEED.users.brandNorthwind);
    expect((await campaignReportRoute(req("GET", "/x", { cookie: other }), ctx({ id: SEED.campaigns.sampleDeskMat }))).status).toBe(404);
  });
});

describe("inbox", () => {
  it("filters needs_action / in_progress / closed by caller capabilities", async () => {
    freshDb();
    const brand = await signIn(SEED.users.brandHushkeys);
    const creator = await signIn(SEED.users.creatorClackLab);
    const d = await ok(await offer(brand, SEED.profiles.clackLab, null, 100), 201);
    const ids = async (cookie: string, filter: string) =>
      (await ok<{ items: Deal[] }>(await listDealsRoute(req("GET", `/api/v1/deals?filter=${filter}`, { cookie }), ctx()))).items.map((x) => x.id);
    expect(await ids(creator, "needs_action")).toContain(d.id);
    // Brand is waiting on the creator (WITHDRAW is secondary).
    expect(await ids(brand, "in_progress")).toContain(d.id);
    expect(await ids(brand, "needs_action")).not.toContain(d.id);
    expect(await ids(brand, "closed")).toContain(SEED.deals.sampleCompleted);
    expect(await ids(brand, "in_progress")).toContain(SEED.deals.heldDispute); // awaiting admin
    expect((await listDealsRoute(req("GET", "/api/v1/deals?filter=bogus", { cookie: brand }), ctx())).status).toBe(400);
  });
});

describe("helpers", () => {
  it("parses YouTube links and byte ranges", () => {
    expect(parseYouTubeVideo("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideo("https://m.youtube.com/watch?v=dQw4w9WgXcQ&si=x")?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(parseYouTubeVideo("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYouTubeVideo("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=5-", 100)).toEqual({ start: 5, end: 99 });
    expect(parseRange("bytes=0-1000", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("bytes=50-10", 100)).toBe("invalid");
    expect(parseRange("items=1-2", 100)).toBe("invalid");
  });
});
