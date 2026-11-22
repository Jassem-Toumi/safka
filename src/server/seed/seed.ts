import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CreatorProfileFields, Format, Terms } from "@/shared/contracts";
import { buildCard, type EvidenceWithLabels } from "../creators/card";
import { normalizeChannel } from "../creators/channel";
import { one, repoRoot, run, tx, type Db } from "../db/db";
import { sha256 } from "../ids";
import { DAY_MS, HOUR_MS } from "../clock";
import { SEED } from "./ids";

/** Deterministic UUID from a name, so repeated seeds produce identical child rows. */
export function seedUuid(name: string): string {
  const h = sha256(`safka-seed:${name}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || join(repoRoot(), ".local", "uploads");
}

type CreatorSeed = {
  userId: string;
  profileId: string;
  name: string;
  handle: string;
  bio: string;
  topics: string[];
  formats: Format[];
  rate: { minCents: number; maxCents: number } | null;
  typical7dViews: number | null;
  listed: boolean;
  sample: boolean;
  expectedClicks?: { low: number; high: number };
  evidence: { slug: string; title: string; excerpt: string; topics: string[]; formats: Format[]; daysAgo: number }[];
};

const CREATORS: CreatorSeed[] = [
  {
    userId: SEED.users.creatorClackLab,
    profileId: SEED.profiles.clackLab,
    name: "Clack Lab (sample)",
    handle: "ClackLabSample",
    bio: "Fictitious sample creator. Side-by-side keyboard sound tests: stock vs. lubed switches, foam mods, and quiet builds for shared offices.",
    topics: ["mechanical-keyboards", "keyboard-sound-tests"],
    formats: ["COMPARISON", "DEMO"],
    rate: { minCents: 20000, maxCents: 35000 },
    typical7dViews: 18000,
    listed: true,
    sample: true,
    expectedClicks: { low: 250, high: 600 },
    evidence: [
      {
        slug: "clack-quiet-sound-test",
        title: "Quiet switches sound test: stock vs. lubed (sample)",
        excerpt: "A side-by-side sound test comparing stock and lubed linear switches on the same board.",
        topics: ["mechanical-keyboards", "keyboard-sound-tests"],
        formats: ["COMPARISON"],
        daysAgo: 12,
      },
      {
        slug: "clack-foam-mod-demo",
        title: "Foam mod demo for a quieter 75% keyboard (sample)",
        excerpt: "Demo of adding case foam to reduce hollow sound on a 75% mechanical keyboard.",
        topics: ["mechanical-keyboards"],
        formats: ["DEMO"],
        daysAgo: 30,
      },
    ],
  },
  {
    userId: SEED.users.creatorDeskSetup,
    profileId: SEED.profiles.deskSetup,
    name: "Desk Setup Daily (sample)",
    handle: "DeskSetupDailySample",
    bio: "Fictitious sample creator. Weekly desk setup tours and honest reviews of desk accessories and keyboards.",
    topics: ["desk-setups", "mechanical-keyboards", "productivity"],
    formats: ["REVIEW", "TUTORIAL"],
    rate: { minCents: 40000, maxCents: 70000 },
    typical7dViews: 45000,
    listed: true,
    sample: true,
    expectedClicks: { low: 400, high: 900 },
    evidence: [
      {
        slug: "desk-setup-tour",
        title: "Minimal desk setup tour with a 65% keyboard (sample)",
        excerpt: "Desk setup tour featuring a 65% mechanical keyboard, monitor arm and a felt desk mat.",
        topics: ["desk-setups", "mechanical-keyboards"],
        formats: ["REVIEW"],
        daysAgo: 8,
      },
    ],
  },
  {
    userId: SEED.users.creatorBigTech,
    profileId: SEED.profiles.bigTech,
    name: "Big Tech Mike (sample)",
    handle: "BigTechMikeSample",
    bio: "Fictitious sample creator. Phone unboxings and tech news with a large audience.",
    topics: ["smartphones", "tech-news"],
    formats: ["REVIEW", "UNBOXING"],
    rate: { minCents: 150000, maxCents: 300000 },
    typical7dViews: 900000,
    listed: true,
    sample: true,
    evidence: [
      {
        slug: "bigtech-phone-unboxing",
        title: "Flagship phone unboxing (sample)",
        excerpt: "Unboxing and first impressions of this year's flagship phone.",
        topics: ["smartphones"],
        formats: ["UNBOXING"],
        daysAgo: 5,
      },
    ],
  },
  {
    userId: SEED.users.creatorThock,
    profileId: SEED.profiles.thock,
    name: "Thock & Type (sample)",
    handle: "ThockAndTypeSample",
    bio: "Fictitious sample creator. Keyboard build tutorials and switch mods.",
    topics: ["mechanical-keyboards", "keyboard-mods"],
    formats: ["TUTORIAL", "DEMO"],
    rate: null,
    typical7dViews: null,
    listed: true,
    sample: true,
    evidence: [
      {
        slug: "thock-build-tutorial",
        title: "Build a quiet keyboard from scratch (sample)",
        excerpt: "Step-by-step tutorial for building a quiet mechanical keyboard with silent switches.",
        topics: ["mechanical-keyboards", "keyboard-mods"],
        formats: ["TUTORIAL"],
        daysAgo: 20,
      },
    ],
  },
  {
    userId: SEED.users.creatorCozy,
    profileId: SEED.profiles.cozy,
    name: "Cozy Workspace (sample)",
    handle: "CozyWorkspaceSample",
    bio: "Fictitious sample creator. Calm home-office stories and desk makeovers.",
    topics: ["desk-setups", "home-office"],
    formats: ["STORY"],
    rate: { minCents: 15000, maxCents: 25000 },
    typical7dViews: 9000,
    listed: true,
    sample: true,
    evidence: [],
  },
  {
    // Empty draft for the presenter to run live You.com enrichment with an opted-in handle.
    userId: SEED.users.creatorLiveDemo,
    profileId: SEED.profiles.liveDemo,
    name: "Live Demo Creator",
    handle: "",
    bio: "",
    topics: [],
    formats: [],
    rate: null,
    typical7dViews: null,
    listed: false,
    sample: false,
    evidence: [],
  },
];

/**
 * Real public YouTube channels used for the localhost demo (user-approved, 2026-11-22). Seeded as DRAFT with only the
 * channel set: no rates, views or tags are invented. `npm run demo:enrich` runs live You.com search and lists them with
 * PUBLIC evidence. They are not Safka members; the bio says so.
 */
export const DEMO_CHANNELS: { userId: string; profileId: string; name: string; handle: string }[] = [
  { userId: SEED.users.demoHipyo, profileId: SEED.profiles.demoHipyo, name: "HipyoTech (demo channel)", handle: "hipyotech" },
  { userId: SEED.users.demoGlarses, profileId: SEED.profiles.demoGlarses, name: "Glarses (demo channel)", handle: "Glarses" },
  { userId: SEED.users.demoAlexotos, profileId: SEED.profiles.demoAlexotos, name: "Alexotos (demo channel)", handle: "alexotos" },
  { userId: SEED.users.demoTae, profileId: SEED.profiles.demoTae, name: "TaeKeyboards (demo channel)", handle: "TaeKeyboards" },
];

const DEMO_CHANNEL_BIO =
  "Public YouTube channel shown for a local demo only. Not a Safka member and not affiliated; tags and sources come from live You.com search results.";

for (const d of DEMO_CHANNELS) {
  CREATORS.push({
    userId: d.userId,
    profileId: d.profileId,
    name: d.name,
    handle: d.handle,
    bio: DEMO_CHANNEL_BIO,
    topics: [],
    formats: [],
    rate: null,
    typical7dViews: null,
    listed: false,
    sample: false,
    evidence: [],
  });
}

const iso = (ms: number) => new Date(ms).toISOString();

export type SeedSummary = { usersInserted: number; dealsInserted: number; mediaCopied: number };

/** Idempotent demo seed. Never overwrites existing rows (ongoing deals stay intact). */
export function seedDemo(db: Db, nowDate: Date = new Date()): SeedSummary {
  const t = nowDate.getTime();
  const nowS = iso(t);
  let usersInserted = 0;
  let dealsInserted = 0;

  tx(db, () => {
    const users: [string, string, string][] = [
      [SEED.users.brandHushkeys, "BRAND", "Hushkeys"],
      [SEED.users.brandNorthwind, "BRAND", "Northwind Desks"],
      [SEED.users.admin, "ADMIN", "Demo Admin"],
      ...CREATORS.map((c) => [c.userId, "CREATOR", c.name] as [string, string, string]),
    ];
    for (const [id, role, name] of users) {
      usersInserted += Number(run(db, "INSERT OR IGNORE INTO users (id, role, display_name, created_at) VALUES (?, ?, ?, ?)", id, role, name, nowS).changes);
    }

    for (const c of CREATORS) seedCreator(db, c, t);

    const products: [string, string, string, string, string | null][] = [
      [SEED.products.whisper75, SEED.users.brandHushkeys, "Hushkeys Whisper 75", "A quiet 75% mechanical keyboard with silent linear switches and dampening foam, made for shared offices.", "https://example.com/hushkeys/whisper-75"],
      [SEED.products.deskMat, SEED.users.brandHushkeys, "Hushkeys Felt Desk Mat", "A wool-felt desk mat that softens keyboard and mouse noise.", "https://example.com/hushkeys/desk-mat"],
      [SEED.products.northwindStand, SEED.users.brandNorthwind, "Northwind Laptop Stand", "An aluminium laptop stand for compact desks.", null],
    ];
    for (const [id, brand, name, desc, url] of products) {
      run(db, "INSERT OR IGNORE INTO products (id, brand_id, name, description, landing_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, brand, name, desc, url, nowS, nowS);
    }

    seedCampaign(db, {
      id: SEED.campaigns.sampleDeskMat,
      productId: SEED.products.deskMat,
      sample: true,
      budgetCents: 80000,
      brief: {
        title: "Felt desk mat launch (sample)",
        goal: "Sample campaign used to demonstrate reporting and underperformance.",
        objective: "TRAFFIC",
        topics: ["desk-setups"],
        formats: ["REVIEW"],
        talkingPoints: ["Softens typing noise"],
        restrictions: [],
      },
      createdAt: iso(t - 30 * DAY_MS),
    });
    seedCampaign(db, {
      id: SEED.campaigns.moderation,
      productId: SEED.products.whisper75,
      sample: false,
      budgetCents: 100000,
      brief: {
        title: "Whisper 75 pre-launch (moderation demo)",
        goal: "Early build tutorials ahead of launch. Used to demonstrate dispute resolution.",
        objective: "CONTENT",
        topics: ["mechanical-keyboards", "keyboard-mods"],
        formats: ["TUTORIAL"],
        talkingPoints: ["Silent linear switches", "Dampening foam"],
        restrictions: ["No competitor comparisons"],
      },
      createdAt: iso(t - 10 * DAY_MS),
    });

    dealsInserted += seedSampleCompletedDeal(db, t);
    dealsInserted += seedHeldDisputeDeal(db, t);
  });

  const mediaCopied = copySeedMedia();
  // Seed rows created before the MP4s existed carry a placeholder size; fix it once the files are present.
  for (const key of SEED_MEDIA) {
    const size = seedMediaSize(key);
    if (size > 1) run(db, "UPDATE uploads SET size_bytes = ? WHERE disk_key = ? AND size_bytes <> ?", size, key, size);
  }
  return { usersInserted, dealsInserted, mediaCopied };
}

function seedCreator(db: Db, c: CreatorSeed, t: number) {
  const exists = one(db, "SELECT 1 FROM creator_profiles WHERE id = ?", c.profileId);
  if (exists) return;
  const channel = c.handle ? normalizeChannel(`@${c.handle}`) : null;
  const created = iso(t - 40 * DAY_MS);
  const evidence: EvidenceWithLabels[] = c.evidence.map((e) => ({
    id: seedUuid(`evidence:${e.slug}`),
    url: `https://example.com/sample-evidence/${e.slug}`,
    title: e.title,
    excerpt: e.excerpt,
    retrievedAt: iso(t - 2 * DAY_MS),
    publishedAt: iso(t - e.daysAgo * DAY_MS),
    kind: "SAMPLE",
    topics: e.topics,
    formats: e.formats,
  }));
  const fields: CreatorProfileFields = {
    displayName: c.name,
    bio: c.bio,
    channel: channel ? channel.display : "",
    topics: c.topics,
    formats: c.formats,
    rate: c.rate,
    typical7dViews: c.typical7dViews,
    selectedEvidenceIds: evidence.map((e) => e.id),
  };
  const card = channel
    ? buildCard({
        profileId: c.profileId,
        version: 1,
        fields,
        canonicalUrl: channel.url,
        allEvidence: evidence,
        dataMode: c.sample ? "SAMPLE" : "SELF_REPORTED",
        isSample: c.sample,
        sampleExpectedClicks: c.expectedClicks ?? null,
      })
    : null;

  run(
    db,
    `INSERT INTO creator_profiles (id, user_id, version, visibility, draft_json, channel_key, canonical_channel_url,
       published_json, published_version, listed_channel_key, data_mode, is_sample, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    c.profileId,
    c.userId,
    c.listed ? "LISTED" : "DRAFT",
    JSON.stringify(fields),
    channel?.key ?? null,
    channel?.url ?? null,
    c.listed && card ? JSON.stringify(card) : null,
    c.listed ? 1 : null,
    c.listed && channel ? channel.key : null,
    c.sample ? "SAMPLE" : "SELF_REPORTED",
    c.sample ? 1 : 0,
    created,
    created,
  );
  for (const e of evidence) {
    run(
      db,
      `INSERT OR IGNORE INTO evidence (id, creator_id, run_id, channel_key, url, title, excerpt, kind, topics_json, formats_json, published_at, retrieved_at, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'SAMPLE', ?, ?, ?, ?, ?)`,
      e.id,
      c.profileId,
      channel!.key,
      e.url,
      e.title,
      e.excerpt,
      JSON.stringify(e.topics),
      JSON.stringify(e.formats),
      e.publishedAt,
      e.retrievedAt,
      created,
    );
  }
}

function seedCampaign(
  db: Db,
  c: { id: string; productId: string; sample: boolean; budgetCents: number; brief: unknown; createdAt: string },
) {
  run(
    db,
    `INSERT OR IGNORE INTO campaigns (id, brand_id, product_id, status, version, source_prompt, brief_json, budget_cents,
       preferred_max_cents, default_view_target, default_click_target, is_sample, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', 1, '', ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    c.id,
    SEED.users.brandHushkeys,
    c.productId,
    JSON.stringify(c.brief),
    c.budgetCents,
    c.sample ? 1 : 0,
    c.createdAt,
    c.createdAt,
  );
}

function productSnapshot(db: Db, productId: string): Terms["product"] {
  const p = one<{ id: string; name: string; description: string; landing_url: string | null }>(db, "SELECT id, name, description, landing_url FROM products WHERE id = ?", productId)!;
  return { id: p.id, name: p.name, description: p.description, landingUrl: p.landing_url };
}

function addEvent(db: Db, dealId: string, seq: number, actorId: string | null, role: string, action: string, at: number, note: string | null = null) {
  run(
    db,
    "INSERT OR IGNORE INTO deal_events (id, deal_id, seq, actor_id, actor_role, action, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    seedUuid(`event:${dealId}:${seq}`),
    dealId,
    seq,
    actorId,
    role,
    action,
    note,
    iso(at),
  );
}

/** Completed + released sample deal whose report shows 420 / 600 clicks (BELOW_TARGET, 30%). */
function seedSampleCompletedDeal(db: Db, t: number): number {
  const id = SEED.deals.sampleCompleted;
  if (one(db, "SELECT 1 FROM deals WHERE id = ?", id)) return 0;
  const sent = t - 25 * DAY_MS;
  const accepted = t - 24 * DAY_MS;
  const approved = t - 15 * DAY_MS;
  const published = t - 10 * DAY_MS;
  const confirmed = t - 9 * DAY_MS;
  const terms: Terms = {
    amountCents: 30000,
    format: "REVIEW",
    brief: "Review the felt desk mat in a desk setup tour. (Sample deal)",
    angle: "Show the desk before and after adding the mat and let viewers hear the difference.",
    talkingPoints: ["Softens typing noise"],
    restrictions: [],
    disclosure: "Say 'sponsored by Hushkeys' in the first 30 seconds and add #ad in the description.",
    draftDueAt: iso(t - 18 * DAY_MS),
    publishDueAt: iso(t - 11 * DAY_MS),
    viewTarget: 20000,
    clickTarget: 600,
    currency: "USD",
    platform: "YOUTUBE",
    product: productSnapshot(db, SEED.products.deskMat),
  };
  const proposalId = seedUuid(`proposal:${id}:1`);
  run(
    db,
    `INSERT INTO deals (id, brand_id, creator_user_id, creator_profile_id, campaign_id, product_id, negotiation_context, status,
       payment_status, version, latest_proposal_id, accepted_proposal_id, agreed_amount_cents, agreement_json, accepted_at,
       approved_asset_id, approved_at, publication_url, publication_video_id, published_at, publication_submitted_at,
       publication_sample, brand_confirmed_at, creator_confirmed_at, ever_published, is_sample, sample_metrics_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 'RELEASED', 1, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, 1, 1, ?, ?, ?)`,
    id,
    SEED.users.brandHushkeys,
    SEED.users.creatorDeskSetup,
    SEED.profiles.deskSetup,
    SEED.campaigns.sampleDeskMat,
    SEED.products.deskMat,
    `${SEED.users.brandHushkeys}|${SEED.users.creatorDeskSetup}|campaign:${SEED.campaigns.sampleDeskMat}`,
    proposalId,
    proposalId,
    terms.amountCents,
    JSON.stringify(terms),
    iso(accepted),
    iso(approved),
    "https://www.youtube.com/watch?v=sAmPlEdEmO1",
    "sAmPlEdEmO1",
    iso(published),
    iso(published),
    iso(confirmed),
    iso(confirmed - HOUR_MS),
    JSON.stringify({
      views: { actual: 21500, measuredAt: iso(published + 6.5 * DAY_MS) },
      clicks: { actual: 420, measuredAt: iso(published + 7 * DAY_MS) },
    }),
    iso(sent),
    iso(confirmed),
  );
  run(db, "INSERT INTO proposals (id, deal_id, revision, author_role, terms_json, expires_at, created_at) VALUES (?, ?, 1, 'BRAND', ?, ?, ?)", proposalId, id, JSON.stringify(terms), iso(sent + 7 * DAY_MS), iso(sent));
  const b = SEED.users.brandHushkeys;
  const c = SEED.users.creatorDeskSetup;
  addEvent(db, id, 1, b, "BRAND", "OFFER_SENT", sent, "Sample deal");
  addEvent(db, id, 2, c, "CREATOR", "ACCEPT", accepted);
  addEvent(db, id, 3, c, "CREATOR", "SUBMIT_DRAFTS", approved - DAY_MS);
  addEvent(db, id, 4, b, "BRAND", "APPROVE_DRAFT", approved, "Simulated payment held");
  addEvent(db, id, 5, c, "CREATOR", "SUBMIT_PUBLICATION", published);
  addEvent(db, id, 6, c, "CREATOR", "CONFIRM_DELIVERY", confirmed - HOUR_MS);
  addEvent(db, id, 7, b, "BRAND", "CONFIRM_DELIVERY", confirmed, "Simulated payment released");
  return 1;
}

/** Campaign deal with an approved draft (payment HELD), now DISPUTED for the admin refund demo. */
function seedHeldDisputeDeal(db: Db, t: number): number {
  const id = SEED.deals.heldDispute;
  if (one(db, "SELECT 1 FROM deals WHERE id = ?", id)) return 0;
  const sent = t - 8 * DAY_MS;
  const accepted = t - 7 * DAY_MS;
  const submitted = t - 5 * DAY_MS;
  const approved = t - 4 * DAY_MS;
  const disputed = t - 12 * HOUR_MS;
  const b = SEED.users.brandHushkeys;
  const c = SEED.users.creatorThock;
  const terms: Terms = {
    amountCents: 40000,
    format: "TUTORIAL",
    brief: "Build tutorial featuring the Whisper 75 and its silent switches.",
    angle: "Build the board on camera and finish with a typing test in a quiet room.",
    talkingPoints: ["Silent linear switches", "Dampening foam"],
    restrictions: ["No competitor comparisons"],
    disclosure: "Say 'sponsored by Hushkeys' in the first 30 seconds and add #ad in the description.",
    draftDueAt: iso(t - 5 * DAY_MS),
    publishDueAt: iso(t - 1 * DAY_MS),
    viewTarget: null,
    clickTarget: null,
    currency: "USD",
    platform: "YOUTUBE",
    product: productSnapshot(db, SEED.products.whisper75),
  };
  const proposalId = seedUuid(`proposal:${id}:1`);
  const batchId = seedUuid(`batch:${id}:1`);
  const assets = [
    { key: "seed-draft-option-1.mp4", label: "Option 1" },
    { key: "seed-draft-option-2.mp4", label: "Option 2" },
  ].map((a, i) => ({ ...a, uploadId: seedUuid(`upload:${id}:${i}`), assetId: seedUuid(`asset:${id}:${i}`), position: i + 1 }));

  run(
    db,
    `INSERT INTO deals (id, brand_id, creator_user_id, creator_profile_id, campaign_id, product_id, negotiation_context, status,
       payment_status, version, latest_proposal_id, accepted_proposal_id, agreed_amount_cents, agreement_json, accepted_at,
       approved_asset_id, approved_at, is_sample, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'DISPUTED', 'HELD', 1, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    b,
    c,
    SEED.profiles.thock,
    SEED.campaigns.moderation,
    SEED.products.whisper75,
    `${b}|${c}|campaign:${SEED.campaigns.moderation}`,
    proposalId,
    proposalId,
    terms.amountCents,
    JSON.stringify(terms),
    iso(accepted),
    assets[0]!.assetId,
    iso(approved),
    iso(sent),
    iso(disputed),
  );
  run(db, "INSERT INTO proposals (id, deal_id, revision, author_role, terms_json, expires_at, created_at) VALUES (?, ?, 1, 'BRAND', ?, ?, ?)", proposalId, id, JSON.stringify(terms), iso(sent + 7 * DAY_MS), iso(sent));
  run(db, "INSERT INTO draft_batches (id, deal_id, round, submitted_at, late, change_request) VALUES (?, ?, 1, ?, 0, NULL)", batchId, id, iso(submitted));
  for (const a of assets) {
    const size = seedMediaSize(a.key);
    run(db, "INSERT INTO uploads (id, deal_id, creator_user_id, disk_key, size_bytes, original_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'ATTACHED', ?)", a.uploadId, id, c, a.key, size, a.label, iso(submitted - HOUR_MS));
    run(db, "INSERT INTO draft_assets (id, batch_id, upload_id, position, label) VALUES (?, ?, ?, ?, ?)", a.assetId, batchId, a.uploadId, a.position, a.label);
  }
  run(
    db,
    `INSERT INTO disputes (id, deal_id, opened_by_id, opened_by_role, code, reason, prior_status, opened_at)
     VALUES (?, ?, ?, 'BRAND', 'MISSED_DEADLINE', ?, 'READY_TO_PUBLISH', ?)`,
    seedUuid(`dispute:${id}:1`),
    id,
    b,
    "The publish deadline passed a day ago and the creator hasn't responded.",
    iso(disputed),
  );
  addEvent(db, id, 1, b, "BRAND", "OFFER_SENT", sent);
  addEvent(db, id, 2, c, "CREATOR", "ACCEPT", accepted);
  addEvent(db, id, 3, c, "CREATOR", "SUBMIT_DRAFTS", submitted);
  addEvent(db, id, 4, b, "BRAND", "APPROVE_DRAFT", approved, "Simulated payment held");
  addEvent(db, id, 5, b, "BRAND", "REPORT_ISSUE", disputed, "Missed deadline");
  return 1;
}

/** Seed MP4s are provided by the team in seed-assets/ (not generated). */
const SEED_MEDIA = ["seed-draft-option-1.mp4", "seed-draft-option-2.mp4"];

function seedMediaSize(key: string): number {
  const src = join(repoRoot(), "seed-assets", key);
  return existsSync(src) ? statSync(src).size : 1;
}

function copySeedMedia(): number {
  const dir = uploadsDir();
  mkdirSync(dir, { recursive: true });
  let copied = 0;
  for (const key of SEED_MEDIA) {
    const src = join(repoRoot(), "seed-assets", key);
    const dest = join(dir, key);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      copied++;
    }
  }
  return copied;
}
