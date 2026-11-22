/**
 * Spec §9 acceptance walkthrough over real HTTP against a running `npm run dev`.
 * Each role has its own cookie jar (= separate browser context). Run on a freshly seeded DB:
 *   npm run demo:acceptance            (BASE defaults to http://127.0.0.1:3000)
 * Step 1's live part needs YDC_MODE=live in the server's env and uses an approved demo channel (D24).
 */
import { readFileSync } from "node:fs";
import { SEED } from "../src/server/seed/ids";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const API = `${BASE}/api/v1`;
const LIVE_HANDLE = process.env.LIVE_HANDLE || "@Glarses";
const DAY = 86_400_000;
let failures = 0;
let n = 0;

function check(label: string, cond: unknown, detail?: unknown) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail).slice(0, 300)}`}`);
  }
}

class Ctx {
  cookie = "";
  constructor(public name: string) {}
  async signIn(accountId: string) {
    const r = await fetch(`${API}/demo/session`, { method: "POST", headers: { origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ accountId }) });
    this.cookie = r.headers.get("set-cookie")!.split(";")[0]!;
    return (await r.json()).data;
  }
  async call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { cookie: this.cookie, ...extra };
    if (method !== "GET") headers.origin = BASE;
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* media */
    }
    return { status: r.status, data: json?.data, error: json?.error, headers: r.headers };
  }
  get = (p: string) => this.call("GET", p);
  post = (p: string, b?: unknown, key?: string) => this.call("POST", p, b, key ? { "idempotency-key": key } : {});
  act = (dealId: string, b: Record<string, unknown>, key = `walk-${Date.now()}-${++n}`) => this.post(`/deals/${dealId}/actions`, b, key);
}

const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const terms = (amountCents: number, format = "COMPARISON") => ({
  amountCents,
  format,
  brief: "Sound test comparing the Whisper 75 with a stock board.",
  angle: null,
  talkingPoints: ["Silent linear switches"],
  restrictions: [],
  disclosure: "Say 'sponsored by Hushkeys' in the first 30 seconds and add #ad.",
  draftDueAt: iso(3 * DAY),
  publishDueAt: iso(6 * DAY),
  viewTarget: null,
  clickTarget: 300,
});

async function quietCampaign(brand: Ctx, budgetCents: number, title: string) {
  const parsed = await brand.post("/campaigns/parse", { productId: SEED.products.whisper75, prompt: `Quiet keyboard sound test campaign for shared offices, $${budgetCents / 100} budget.` });
  const r = await brand.post("/campaigns", {
    productId: SEED.products.whisper75,
    sourcePrompt: "quiet keyboard",
    brief: { ...parsed.data.brief, title, objective: parsed.data.brief.objective ?? "AWARENESS" },
    budgetCents: parsed.data.budgetCents,
    preferredMaxPerPostCents: null,
    defaultViewTarget: null,
    defaultClickTarget: null,
    confirm: true,
  });
  return { parsed: parsed.data, campaign: r.data, status: r.status };
}

async function main() {
  const brand = new Ctx("brand");
  const creator = new Ctx("creator");
  const admin = new Ctx("admin");
  const live = new Ctx("live-creator");
  const other = new Ctx("other-brand");

  console.log("\n#1 Seed, separate sessions, live You.com source on a listed creator and a brand match");
  check("brand signs in", (await brand.signIn(SEED.users.brandHushkeys)).role === "BRAND");
  check("creator signs in separately", (await creator.signIn(SEED.users.creatorClackLab)).role === "CREATOR");
  check("admin signs in separately", (await admin.signIn(SEED.users.admin)).role === "ADMIN");
  await live.signIn(SEED.users.creatorLiveDemo);
  await other.signIn(SEED.users.brandNorthwind);
  check("sessions are isolated (brand cookie ≠ creator cookie)", brand.cookie !== creator.cookie);

  const prof = await live.get("/creator/profile");
  const put = await live.call("PUT", "/creator/profile", { ...prof.data.draft, displayName: "Live Demo Creator", bio: "Live You.com demo.", channel: LIVE_HANDLE, expectedVersion: prof.data.version });
  check("live creator saves channel", put.status === 200, put.error);
  const t0 = Date.now();
  const en = await live.post("/creator/enrichment");
  console.log(`    enrichment: ${en.data?.status} ${en.data?.mode} in ${Date.now() - t0} ms, ${en.data?.evidence?.length ?? 0} sources, error ${en.data?.errorCode}`);
  check("live search returns READY/LIVE with PUBLIC sources", en.data?.status === "READY" && en.data?.mode === "LIVE" && en.data.evidence.every((e: any) => e.kind === "PUBLIC"), en.data ?? en.error);
  let liveProfileId: string | null = null;
  let approvedEvidence: string | null = null;
  if (en.data?.status === "READY") {
    approvedEvidence = en.data.evidence[0].id;
    const topics = [...new Set(["mechanical-keyboards", ...en.data.suggestions.topics.map((t: any) => t.value)])];
    const formats = en.data.suggestions.formats.length ? en.data.suggestions.formats.map((f: any) => f.value).slice(0, 4) : ["REVIEW"];
    const saved = await live.call("PUT", "/creator/profile", { ...put.data.draft, topics, formats, selectedEvidenceIds: [approvedEvidence], expectedVersion: put.data.version });
    const listed = await live.post("/creator/profile/visibility", { visibility: "LISTED", expectedVersion: saved.data.version });
    liveProfileId = listed.data?.id;
    check("creator approves one citation and lists", listed.status === 200 && listed.data.published.evidence.length === 1, listed.error);
    check("published card is LIVE", listed.data?.published?.dataMode === "LIVE");
  }

  console.log("\n#2 Quiet-keyboard campaign $600 → sound-test match → $250 offer → $300 counter → accept; direct offer");
  const { parsed, campaign, status } = await quietCampaign(brand, 60000, "Whisper 75 quiet office");
  check("parse suggests $600 budget in RULES mode", parsed.budgetCents === 60000 && parsed.mode === "RULES", parsed);
  check("campaign confirmed ACTIVE", status === 201 && campaign.status === "ACTIVE", campaign);
  const matches = (await brand.get(`/campaigns/${campaign.id}/matches`)).data.items;
  console.log(`    matches: ${matches.map((m: any) => `${m.creator.displayName} ${m.topicMatchPct}%`).join(", ")}`);
  check("sound-test creator ranks first", matches[0]?.creator.id === SEED.profiles.clackLab, matches[0]?.creator.displayName);
  check("unrelated huge-reach creator omitted", !matches.some((m: any) => m.creator.id === SEED.profiles.bigTech));
  check("top match has an angle", typeof matches[0]?.angle === "string", matches[0]?.angle);
  if (liveProfileId) {
    const lm = matches.find((m: any) => m.creator.id === liveProfileId);
    check("live creator's approved citation appears on the brand match", !!lm && lm.reasons.some((r: any) => r.evidenceIds.includes(approvedEvidence)), lm?.reasons);
  }

  const sent = await brand.post("/deals", { creatorId: SEED.profiles.clackLab, productId: SEED.products.whisper75, campaignId: campaign.id, terms: { ...terms(25000), angle: matches[0].angle } }, "walk-offer-1");
  check("brand sends $250 offer", sent.status === 201 && sent.data.status === "NEGOTIATING", sent.error);
  const dealId = sent.data.id;
  const inbox = (await creator.get("/deals?filter=needs_action")).data.items;
  check("offer is in the creator's needs_action inbox", inbox.some((d: any) => d.id === dealId));
  const counter = await creator.act(dealId, { action: "COUNTER", expectedVersion: 1, proposalId: sent.data.latestProposal.id, amountCents: 30000, draftDueAt: iso(3 * DAY), publishDueAt: iso(7 * DAY), angle: matches[0].angle });
  check("creator counters $300", counter.status === 200 && counter.data.latestProposal.terms.amountCents === 30000, counter.error);
  const accepted = await brand.act(dealId, { action: "ACCEPT", expectedVersion: counter.data.version, proposalId: counter.data.latestProposal.id });
  check("brand accepts", accepted.data?.status === "AGREED", accepted.error);
  check("$300 committed, $300 remaining", accepted.data?.budget?.committedCents === 30000 && accepted.data.budget.remainingCents === 30000, accepted.data?.budget);
  const direct = await brand.post("/deals", { creatorId: SEED.profiles.deskSetup, productId: SEED.products.deskMat, campaignId: null, terms: terms(20000, "REVIEW") }, "walk-direct-1");
  check("direct offer has no campaign budget", direct.status === 201 && direct.data.budget === null && direct.data.campaignId === null, direct.error);

  console.log("\n#3 $500 available, two $300 proposals accepted concurrently; stale and duplicate requests");
  const c3 = (await quietCampaign(brand, 50000, "Concurrency check")).campaign;
  const o1 = await brand.post("/deals", { creatorId: SEED.profiles.clackLab, productId: SEED.products.whisper75, campaignId: c3.id, terms: terms(30000) }, "walk-c3-a");
  const o2 = await brand.post("/deals", { creatorId: SEED.profiles.thock, productId: SEED.products.whisper75, campaignId: c3.id, terms: terms(30000, "TUTORIAL") }, "walk-c3-b");
  const thock = new Ctx("creator-2");
  await thock.signIn(SEED.users.creatorThock);
  const [a1, a2] = await Promise.all([
    creator.act(o1.data.id, { action: "ACCEPT", expectedVersion: 1, proposalId: o1.data.latestProposal.id }, "walk-acc-a"),
    thock.act(o2.data.id, { action: "ACCEPT", expectedVersion: 1, proposalId: o2.data.latestProposal.id }, "walk-acc-b"),
  ]);
  check("exactly one acceptance commits", [a1.status, a2.status].sort().join() === "200,409", [a1.status, a2.status]);
  check("the other gets BUDGET_EXCEEDED", [a1.error?.code, a2.error?.code].includes("BUDGET_EXCEEDED"));
  const b3 = (await brand.get(`/campaigns/${c3.id}`)).data.budget;
  check("committed $300 of $500", b3.committedCents === 30000 && b3.remainingCents === 20000, b3);
  const winner = a1.status === 200 ? a1 : a2;
  const winnerCtx = a1.status === 200 ? creator : thock;
  const winnerKey = a1.status === 200 ? "walk-acc-a" : "walk-acc-b";
  const winnerDeal = a1.status === 200 ? o1 : o2;
  const replay = await winnerCtx.act(winnerDeal.data.id, { action: "ACCEPT", expectedVersion: 1, proposalId: winnerDeal.data.latestProposal.id }, winnerKey);
  check("duplicate accept replays the saved result", replay.status === 200 && replay.headers.get("idempotent-replay") === "true" && replay.data.version === winner.data.version);
  const stale = await winnerCtx.act(winnerDeal.data.id, { action: "REPORT_ISSUE", expectedVersion: 1, code: "OTHER", reason: "stale" });
  check("stale version → STALE_DEAL", stale.error?.code === "STALE_DEAL", stale.error);
  check("balances unchanged after replay/stale", (await brand.get(`/campaigns/${c3.id}`)).data.budget.committedCents === 30000);
  const loserDeal = a1.status === 200 ? o2 : o1;
  const declined = await (a1.status === 200 ? thock : creator).act(loserDeal.data.id, { action: "DECLINE", expectedVersion: 1, proposalId: loserDeal.data.latestProposal.id });
  check("blocked proposal stayed open and can be declined", declined.data?.status === "DECLINED", declined.error);
  const w = await brand.post("/deals", { creatorId: SEED.profiles.cozy, productId: SEED.products.deskMat, campaignId: null, terms: terms(10000, "STORY") }, "walk-withdraw");
  check("brand withdraws an offer", (await brand.act(w.data.id, { action: "WITHDRAW", expectedVersion: 1 })).data?.status === "WITHDRAWN");
  console.log("    (expiry by the server clock is covered by tests/deals.test.ts with an injected clock)");

  console.log("\n#4 Two MP4 drafts → revision → approve one → HELD → link → both confirm → RELEASED once; access control");
  const mp4 = readFileSync("seed-assets/seed-draft-option-1.mp4");
  const up = async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(mp4)], "draft.mp4", { type: "video/mp4" }));
    const r = await fetch(`${API}/deals/${dealId}/uploads`, { method: "POST", headers: { origin: BASE, cookie: creator.cookie }, body: form });
    return { status: r.status, ...(await r.json()) };
  };
  const u1 = await up();
  const u2 = await up();
  check("creator uploads two MP4s", u1.status === 201 && u2.status === 201, [u1, u2]);
  let d = (await creator.act(dealId, { action: "SUBMIT_DRAFTS", expectedVersion: accepted.data.version, uploadIds: [u1.data.uploadId, u2.data.uploadId] })).data;
  const bview = (await brand.get(`/deals/${dealId}`)).data;
  check("brand sees both drafts", bview.draftBatches[0].assets.length === 2);
  const asset1 = bview.draftBatches[0].assets[0].id;
  const pb = (await brand.get(`/deals/${dealId}/assets/${asset1}/playback`)).data;
  const media = await fetch(`${BASE}${pb.url}`, { headers: { cookie: brand.cookie, range: "bytes=0-1023" } });
  check("brand streams a draft with a byte range (206)", media.status === 206 && media.headers.get("content-type") === "video/mp4");
  const intruder = await fetch(`${BASE}${pb.url}`, { headers: { cookie: other.cookie } });
  const anon = await fetch(`${BASE}${pb.url}`);
  const adminNo = await fetch(`${BASE}${pb.url}`, { headers: { cookie: admin.cookie } });
  check("other brand / anonymous / admin (no dispute) cannot stream", intruder.status === 404 && anon.status === 401 && adminNo.status === 404, [intruder.status, anon.status, adminNo.status]);
  d = (await brand.act(dealId, { action: "REQUEST_CHANGES", expectedVersion: d.version, reason: "Show the foam layer." })).data;
  check("brand requests a revision", d.status === "REVISION_REQUESTED");
  const u3 = await up();
  const u4 = await up();
  d = (await creator.act(dealId, { action: "SUBMIT_DRAFTS", expectedVersion: d.version, uploadIds: [u3.data.uploadId, u4.data.uploadId] })).data;
  const latest = d.draftBatches[1].assets[0].id;
  d = (await brand.act(dealId, { action: "APPROVE_DRAFT", expectedVersion: d.version, assetId: latest })).data;
  check("brand approves exactly one draft → payment HELD", d.status === "READY_TO_PUBLISH" && d.paymentStatus === "HELD" && d.approvedAssetId === latest, d);
  d = (await creator.act(dealId, { action: "SUBMIT_PUBLICATION", expectedVersion: d.version, url: "https://youtu.be/sAmPlEdEmO2", publishedAt: new Date().toISOString(), attested: true })).data;
  check("creator submits the YouTube link", d.status === "PUBLISHED" && d.publication.url === "https://www.youtube.com/watch?v=sAmPlEdEmO2", d);
  d = (await creator.act(dealId, { action: "CONFIRM_DELIVERY", expectedVersion: d.version })).data;
  check("first confirmation keeps payment HELD", d.status === "PUBLISHED" && d.paymentStatus === "HELD");
  const fin = await brand.act(dealId, { action: "CONFIRM_DELIVERY", expectedVersion: d.version });
  check("second confirmation → COMPLETED + RELEASED", fin.data?.status === "COMPLETED" && fin.data.paymentStatus === "RELEASED", fin.error);
  const again = await creator.act(dealId, { action: "CONFIRM_DELIVERY", expectedVersion: fin.data.version });
  check("release happens once (further confirm rejected)", again.error?.code === "INVALID_STATE", again.error);
  check("campaign shows $300 spent, $0 committed", fin.data.budget.spentCents === 30000 && fin.data.budget.committedCents === 0, fin.data.budget);

  console.log("\n#5 Seeded held dispute → admin refund frees exactly $400; sample report 420/600");
  const before = (await brand.get(`/campaigns/${SEED.campaigns.moderation}`)).data.budget;
  const disputes = (await admin.get("/admin/disputes")).data.items;
  const held = disputes.find((x: any) => x.dealId === SEED.deals.heldDispute && !x.resolvedAt);
  check("admin sees the open held dispute", !!held && held.paymentStatus === "HELD" && held.amountCents === 40000, held);
  const detail = (await admin.get(`/admin/disputes/${held.id}`)).data;
  const refund = await admin.act(SEED.deals.heldDispute, { action: "REFUND_PAYMENT", expectedVersion: detail.deal.version, disputeId: held.id, reason: "Publish deadline missed; brand refunded." });
  check("admin refunds", refund.data?.status === "REFUNDED" && refund.data.paymentStatus === "REFUNDED", refund.error);
  const after = (await brand.get(`/campaigns/${SEED.campaigns.moderation}`)).data.budget;
  check(`commitment freed exactly $400 (${before.remainingCents / 100} → ${after.remainingCents / 100})`, after.remainingCents - before.remainingCents === 40000, { before, after });
  const report = (await brand.get(`/campaigns/${SEED.campaigns.sampleDeskMat}/report`)).data;
  const clicks = report.deals.items[0].clicks;
  check("sample report: 420 of 600 clicks, BELOW_TARGET, 30%, labeled sample", clicks.actual === 420 && clicks.target === 600 && clicks.status === "BELOW_TARGET" && clicks.shortfallPct === 30 && report.sample === true, clicks);
  check("sample deal has no payout effect on other campaigns", report.budget.spentCents === 30000);
  const liveReport = (await brand.get(`/deals/${dealId}/report`)).data;
  check("live deal report has no actual values", liveReport.clicks.actual === null && liveReport.sample === false, liveReport.clicks);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  console.log(`DEAL_ID=${dealId}`);
  process.exitCode = failures ? 1 : 0;
}

await main();
