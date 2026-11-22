-- Safka local prototype schema (single checked-in migration, version 1).
-- Times: UTC ISO 8601 text. Money: integer USD cents. Snapshots: validated JSON text.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('BRAND','CREATOR','ADMIN')),
  display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,           -- sha256(token) hex; raw token only in the cookie
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS creator_profiles (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL UNIQUE REFERENCES users(id),
  version                INTEGER NOT NULL DEFAULT 1,
  visibility             TEXT NOT NULL DEFAULT 'DRAFT' CHECK (visibility IN ('DRAFT','LISTED','HIDDEN')),
  draft_json             TEXT NOT NULL,          -- CreatorProfileFields
  channel_key            TEXT,                   -- canonical key of the draft channel, e.g. yt:@handle / yt:UC…
  canonical_channel_url  TEXT,
  published_json         TEXT,                   -- CreatorCard snapshot shown to brands
  published_version      INTEGER,
  listed_channel_key     TEXT,                   -- channel key of the published snapshot while LISTED
  data_mode              TEXT NOT NULL DEFAULT 'SELF_REPORTED' CHECK (data_mode IN ('LIVE','SELF_REPORTED','SAMPLE')),
  is_sample              INTEGER NOT NULL DEFAULT 0,
  last_enrichment_json   TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS creator_profiles_listed_channel
  ON creator_profiles(listed_channel_key) WHERE listed_channel_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS enrichment_runs (
  id               TEXT PRIMARY KEY,
  creator_id       TEXT NOT NULL REFERENCES creator_profiles(id),
  channel_key      TEXT NOT NULL,
  profile_version  INTEGER NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('READY','EMPTY','FAILED')),
  mode             TEXT NOT NULL CHECK (mode IN ('LIVE','SAMPLE')),
  error_code       TEXT,
  elapsed_ms       INTEGER,
  result_count     INTEGER NOT NULL DEFAULT 0,
  applied          INTEGER NOT NULL DEFAULT 1,  -- 0 when discarded because the profile changed mid-request
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS enrichment_runs_creator ON enrichment_runs(creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence (
  id            TEXT PRIMARY KEY,
  creator_id    TEXT NOT NULL REFERENCES creator_profiles(id),
  run_id        TEXT REFERENCES enrichment_runs(id),
  channel_key   TEXT NOT NULL,
  url           TEXT NOT NULL,
  title         TEXT NOT NULL,
  excerpt       TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('PUBLIC','CREATOR','SAMPLE')),
  topics_json   TEXT NOT NULL DEFAULT '[]',   -- topic slugs this source supports
  formats_json  TEXT NOT NULL DEFAULT '[]',   -- formats this source supports
  published_at  TEXT,
  retrieved_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_creator ON evidence(creator_id, channel_key, created_at DESC);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  brand_id     TEXT NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  landing_url  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS products_brand ON products(brand_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS campaigns (
  id                   TEXT PRIMARY KEY,
  brand_id             TEXT NOT NULL REFERENCES users(id),
  product_id           TEXT NOT NULL REFERENCES products(id),
  status               TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','CLOSED')),
  version              INTEGER NOT NULL DEFAULT 1,
  source_prompt        TEXT NOT NULL DEFAULT '',
  brief_json           TEXT,
  budget_cents         INTEGER CHECK (budget_cents IS NULL OR budget_cents > 0),
  preferred_max_cents  INTEGER CHECK (preferred_max_cents IS NULL OR preferred_max_cents > 0),
  default_view_target  INTEGER,
  default_click_target INTEGER,
  is_sample            INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS campaigns_brand ON campaigns(brand_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS deals (
  id                     TEXT PRIMARY KEY,
  brand_id               TEXT NOT NULL REFERENCES users(id),
  creator_user_id        TEXT NOT NULL REFERENCES users(id),
  creator_profile_id     TEXT NOT NULL REFERENCES creator_profiles(id),
  campaign_id            TEXT REFERENCES campaigns(id),
  product_id             TEXT NOT NULL REFERENCES products(id),
  negotiation_context    TEXT NOT NULL,    -- brand|creator|campaign:<id> or brand|creator|direct:<productId>
  status                 TEXT NOT NULL CHECK (status IN ('NEGOTIATING','AGREED','DRAFT_REVIEW','REVISION_REQUESTED',
                           'READY_TO_PUBLISH','PUBLISHED','DISPUTED','COMPLETED','REFUNDED','CANCELLED',
                           'DECLINED','WITHDRAWN','EXPIRED')),
  payment_status         TEXT NOT NULL DEFAULT 'NONE' CHECK (payment_status IN ('NONE','HELD','RELEASED','REFUNDED')),
  version                INTEGER NOT NULL DEFAULT 1,
  latest_proposal_id     TEXT,
  accepted_proposal_id   TEXT,
  agreed_amount_cents    INTEGER,          -- copy of accepted terms amount, used for budget totals
  agreement_json         TEXT,             -- Terms snapshot at acceptance
  accepted_at            TEXT,
  approved_asset_id      TEXT,
  approved_at            TEXT,
  publication_url        TEXT,
  publication_video_id   TEXT,
  published_at           TEXT,
  publication_submitted_at TEXT,
  publication_sample     INTEGER NOT NULL DEFAULT 0,
  brand_confirmed_at     TEXT,
  creator_confirmed_at   TEXT,
  ever_published         INTEGER NOT NULL DEFAULT 0,
  is_sample              INTEGER NOT NULL DEFAULT 0,
  sample_metrics_json    TEXT,             -- only for is_sample deals: seeded report values
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deals_brand ON deals(brand_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS deals_creator ON deals(creator_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS deals_campaign ON deals(campaign_id, status);
-- One open negotiation per context. Expired-but-unwritten rows are materialized to EXPIRED before insert.
CREATE UNIQUE INDEX IF NOT EXISTS deals_one_open_negotiation
  ON deals(negotiation_context) WHERE status = 'NEGOTIATING';

CREATE TABLE IF NOT EXISTS proposals (
  id           TEXT PRIMARY KEY,
  deal_id      TEXT NOT NULL REFERENCES deals(id),
  revision     INTEGER NOT NULL,
  author_role  TEXT NOT NULL CHECK (author_role IN ('BRAND','CREATOR')),
  terms_json   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  UNIQUE (deal_id, revision)
);

CREATE TABLE IF NOT EXISTS deal_events (
  id          TEXT PRIMARY KEY,
  deal_id     TEXT NOT NULL REFERENCES deals(id),
  seq         INTEGER NOT NULL,
  actor_id    TEXT,
  actor_role  TEXT NOT NULL CHECK (actor_role IN ('BRAND','CREATOR','ADMIN','SYSTEM')),
  action      TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (deal_id, seq)
);

CREATE TABLE IF NOT EXISTS uploads (
  id             TEXT PRIMARY KEY,
  deal_id        TEXT NOT NULL REFERENCES deals(id),
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  disk_key       TEXT NOT NULL UNIQUE,      -- opaque generated filename under .local/uploads/
  size_bytes     INTEGER NOT NULL CHECK (size_bytes > 0),
  original_name  TEXT,
  status         TEXT NOT NULL CHECK (status IN ('READY','ATTACHED')),
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_deal ON uploads(deal_id, status);

CREATE TABLE IF NOT EXISTS draft_batches (
  id              TEXT PRIMARY KEY,
  deal_id         TEXT NOT NULL REFERENCES deals(id),
  round           INTEGER NOT NULL CHECK (round BETWEEN 1 AND 3),
  submitted_at    TEXT NOT NULL,
  late            INTEGER NOT NULL DEFAULT 0,
  change_request  TEXT,
  UNIQUE (deal_id, round)
);

CREATE TABLE IF NOT EXISTS draft_assets (
  id         TEXT PRIMARY KEY,
  batch_id   TEXT NOT NULL REFERENCES draft_batches(id),
  upload_id  TEXT NOT NULL UNIQUE REFERENCES uploads(id),   -- each upload attaches once
  position   INTEGER NOT NULL,
  label      TEXT NOT NULL,
  UNIQUE (batch_id, position)
);

CREATE TABLE IF NOT EXISTS disputes (
  id                 TEXT PRIMARY KEY,
  deal_id            TEXT NOT NULL REFERENCES deals(id),
  opened_by_id       TEXT NOT NULL REFERENCES users(id),
  opened_by_role     TEXT NOT NULL CHECK (opened_by_role IN ('BRAND','CREATOR')),
  code               TEXT NOT NULL CHECK (code IN ('MISSED_DEADLINE','CONTENT_MISMATCH','MISSING_DISCLOSURE',
                       'INVALID_PUBLICATION','UNRESPONSIVE_PARTY','OTHER')),
  reason             TEXT NOT NULL,
  prior_status       TEXT NOT NULL,
  opened_at          TEXT NOT NULL,
  resolved_at        TEXT,
  resolution         TEXT CHECK (resolution IS NULL OR resolution IN ('RESUME_DEAL','CANCEL_DEAL','RELEASE_PAYMENT','REFUND_PAYMENT')),
  resolution_reason  TEXT,
  resolved_by_id     TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open ON disputes(deal_id) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  actor_id       TEXT NOT NULL,
  operation      TEXT NOT NULL,
  key            TEXT NOT NULL,
  fingerprint    TEXT NOT NULL,
  status_code    INTEGER NOT NULL,
  response_json  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (actor_id, operation, key)
);
