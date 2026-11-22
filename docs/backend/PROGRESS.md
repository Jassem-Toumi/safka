# Backend progress

Spec: `Creator_Sponsorship_Backend_Spec-final.md`. Status legend: ✅ done · 🟡 partial · ⬜ todo.

## Session plan
| Session | Scope (final spec §1 build order) | Status |
|---|---|---|
| 1 | Foundation: Node 24, Next.js, SQLite schema (all tables), shared contracts (all routes), demo accounts/session/me, origin guard, seed, tests, docs | ✅ |
| 2 | Creator profile + visibility, directory, products, You.com live/fixture enrichment, campaigns + parse (RULES, optional AI), matcher + angles | ⬜ |
| 3 | Deals: create/counter/accept/decline/withdraw/expire, budget cap + concurrency, idempotency, uploads + range streaming, drafts/approval/HELD, publication, confirmations/RELEASED, disputes + admin, inbox filters, reports | ⬜ |
| 4 (if time) | Full §9 acceptance run with three contexts, frontend integration fixes, optional You.com AI brief | ⬜ |

## Checklist by spec section
### §2 Local execution, accounts, persistence
- ✅ Node 24.22.3 pinned, `node:sqlite` `DatabaseSync`, WAL, foreign keys, busy timeout 2s, one schema migration
- ✅ `npm run demo:seed` (idempotent, stable UUIDs, relative dates), `demo:reset -- --yes`, `dev` on 127.0.0.1:3000, `test`, `typecheck`
- ✅ Host + write-origin validation (`src/server/http/origin.ts`)
- ✅ `GET /demo/accounts`, `POST/DELETE /demo/session`, `GET /me`; HttpOnly SameSite=Lax cookie; hashed session IDs in SQLite
- ✅ Seeds: 2 brands, 5 fictitious sample creators (listed), 1 blank live-demo creator (draft), admin, 3 products, sample campaign + completed sample deal (420/600), moderation campaign + HELD disputed deal
- ⬜ README (setup + commands) — write in Session 2 once more routes exist (CLAUDE.md has commands now)
- ⬜ Seed MP4s: waiting on the team (`seed-assets/seed-draft-option-{1,2}.mp4`)

### §3 You.com + profile — ⬜ (Session 2)
- ✅ Channel normalizer `src/server/creators/channel.ts` + tests
- ✅ Card builder with label provenance `src/server/creators/card.ts`
- ⬜ `GET/PUT /creator/profile`, `POST /creator/profile/visibility`, `GET /creators`, `GET /creators/{id}`
- ⬜ `POST /creator/enrichment` live (MCP `you-search`) + fixture mode

### §4 Briefs, matches, offers — ⬜ (Session 2: products/campaigns/parse/matches; Session 3: offer terms)
### §5 Deal state and payment — ⬜ (Session 3)
### §6 Media and reporting — ⬜ (Session 3)
### §7 Contract — ✅ frozen v1 in `src/shared/contracts` (routes implemented: identity only)
### §9 Acceptance — 🟡 #1 partially (seed, sign-in, restart persistence by file DB). Rest pending.

## Files map
- `src/shared/contracts/*` — Zod schemas + types for every route. `src/shared/topics.ts` — slug normalizer.
- `src/server/db/{schema.sql,db.ts}` — schema + connection/`tx`. `src/server/clock.ts` — injectable clock.
- `src/server/http/{route,respond,errors,auth,origin}.ts` — handler wrapper, envelope, ApiError, sessions, loopback guard.
- `src/server/seed/{ids,seed}.ts` + `scripts/{seed,reset}.ts`.
- `src/app/api/v1/{demo/accounts,demo/session,me}/route.ts`.
- `tests/*.test.ts` + `tests/helpers.ts` (31 tests).

---

## Next session brief (Session 2)
**Start:** `source ~/.nvm/nvm.sh && nvm use && npm install && npm run demo:seed && npm test` — expect 31 passing.
Read `CLAUDE.md`, then final spec §3, §4, §7.

**Build, in this order (each with tests in `tests/`):**
1. `src/server/creators/profile.ts` + routes `GET/PUT /api/v1/creator/profile`, `POST /api/v1/creator/profile/visibility`
   (creator only). PUT checks `expectedVersion` (409 `STALE_PROFILE`), bumps `version`, re-normalizes channel into
   `channel_key`/`canonical_channel_url` (invalid channel → 400 field error `channel`). LISTED requires displayName, bio,
   valid channel, ≥1 topic, ≥1 format; returns `listingBlockers`. LISTED copies draft → `published_json` via `buildCard`,
   sets `published_version` and `listed_channel_key` (unique index → 409 `VALIDATION_ERROR` field `channel` "already listed").
   HIDDEN clears `listed_channel_key`, keeps `published_json`. `hasUnpublishedChanges = version !== published_version`.
   Evidence returned = rows for the current `channel_key`.
2. Directory `GET /api/v1/creators` (brand only; LISTED; `q` over name/bio, `topic` slug, `format`; sort display name, id)
   and `GET /api/v1/creators/{id}` (404 unless LISTED). Return the published `CreatorCard`.
3. Products CRUD `GET/POST /api/v1/products`, `PATCH /api/v1/products/{id}` (brand-owned; others' IDs → 404).
   Reject landing URLs with credentials or loopback/private IP literals.
4. You.com: `src/server/youcom/{client,fixture,extract}.ts`. MCP Streamable HTTP via `@modelcontextprotocol/sdk`
   (`StreamableHTTPClientTransport`), endpoint `https://api.you.com/mcp?tools=you-search` + `Authorization: Bearer $YDC_API_KEY`
   when key present else `https://api.you.com/mcp/free`. One `you-search` call, `count: 6`, query
   `site:youtube.com "<@handle or UC id>" videos reviews demonstrations`, 12 s total timeout incl. connect, always close.
   Identity match = exact handle/channel ID in URL or snippet. Keyword map → topic/format suggestions. **Do the network call
   outside `tx`**, then in a short `tx` re-check profile version + channel key before saving evidence (discard if changed,
   `enrichment_runs.applied=0`). `YDC_MODE=fixture` → deterministic SAMPLE results, no network. Live failure → `FAILED` +
   `errorCode`, never fixture fallback. Verify the live keyless endpoint once with a smoke script (any public query) —
   **do not** run live enrichment against a real creator who hasn't opted in.
5. Campaigns: `POST /api/v1/campaigns/parse` (RULES dictionary: dollar amounts like "$600" → budgetCents, topic/format keywords,
   title from product, goal from prompt; `mode: RULES`), `GET/POST /api/v1/campaigns`, `GET/PATCH /api/v1/campaigns/{id}`
   (DRAFT save, `confirm: true` → ACTIVE needs full `Brief` + budget; version check 409 `STALE_CAMPAIGN`; cap below
   committed+spent → 409 `BUDGET_EXCEEDED`; close only without open unexpired negotiations). Budget helper in
   `src/server/campaigns/budget.ts` (committed = agreed deals with payment NONE/HELD incl. DISPUTED; spent = RELEASED) —
   Session 3 reuses it.
6. Matcher `GET /api/v1/campaigns/{id}/matches` per §4 ranking + fixture test: Clack Lab (low reach, relevant) must rank
   above Big Tech Mike (unrelated, huge reach, and actually omitted for zero topics). Angle templates by format.
7. Write `README.md` (setup, env table, commands, demo accounts, reset). Update this file + changelog. Commit.

**Open items for the user:** seed MP4s; an opted-in YouTube handle if they find one; they paste `YDC_API_KEY` in `.env.local`.
