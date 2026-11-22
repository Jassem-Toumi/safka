# Backend progress

Spec: `Creator_Sponsorship_Backend_Spec-final.md`. Status legend: ✅ done · 🟡 partial · ⬜ todo.

## Session plan
| Session | Scope (final spec §1 build order) | Status |
|---|---|---|
| 1 | Foundation: Node 24, Next.js, SQLite schema (all tables), shared contracts (all routes), demo accounts/session/me, origin guard, seed, tests, docs | ✅ |
| 2 | Creator profile + visibility, directory, products, You.com live/fixture enrichment, campaigns + parse (RULES, optional AI), matcher + angles | ✅ (AI brief mode deferred) |
| 3 | Deals: create/counter/accept/decline/withdraw/expire, budget cap + concurrency, idempotency, uploads + range streaming, drafts/approval/HELD, publication, confirmations/RELEASED, disputes + admin, inbox filters, reports | ⬜ |
| 4 (if time) | Full §9 acceptance run with three contexts, frontend integration fixes, optional You.com AI brief | ⬜ |

## Checklist by spec section
### §2 Local execution, accounts, persistence
- ✅ Node 24.22.3 pinned, `node:sqlite` `DatabaseSync`, WAL, foreign keys, busy timeout 2s, one schema migration
- ✅ `npm run demo:seed` (idempotent, stable UUIDs, relative dates), `demo:reset -- --yes`, `dev` on 127.0.0.1:3000, `test`, `typecheck`
- ✅ Host + write-origin validation (`src/server/http/origin.ts`)
- ✅ `GET /demo/accounts`, `POST/DELETE /demo/session`, `GET /me`; HttpOnly SameSite=Lax cookie; hashed session IDs in SQLite
- ✅ Seeds: 2 brands, 5 fictitious sample creators (listed), 1 blank live-demo creator (draft), admin, 3 products, sample campaign + completed sample deal (420/600), moderation campaign + HELD disputed deal
- ✅ README (setup, env table, commands, demo accounts, reset)
- ✅ Seed MP4s generated (`npm run demo:videos`, D25) and copied to `.local/uploads/` by seed

### §3 You.com + profile — ✅
- ✅ Channel normalizer `src/server/creators/channel.ts`, card builder with label provenance `src/server/creators/card.ts`
- ✅ `GET/PUT /creator/profile`, `POST /creator/profile/visibility` (`src/server/creators/profile.ts`)
- ✅ `GET /creators`, `GET /creators/{id}` (`src/server/creators/directory.ts`)
- ✅ `POST /creator/enrichment` live (MCP `you-search`, `src/server/youcom/client.ts`) + fixture mode (`fixture.ts`), identity
  match + keyword map (`extract.ts`), stale-safe apply (`enrichment.ts`). Live path tested with a stubbed provider.
- ✅ Live search verified with the sponsor key in `.env.local` (`YDC_MODE=live`). Four real demo channels are listed with PUBLIC evidence via
  `npm run demo:enrich` (D24) and appear in brand matches with live citations (acceptance #1).

### §4 Briefs, matches, offers — 🟡 (offer terms are Session 3)
- ✅ Products CRUD `src/server/products/products.ts` (landing URL hygiene)
- ✅ `POST /campaigns/parse` RULES (`src/server/campaigns/parse.ts`). ⬜ optional AI mode via `YDC_BRIEF_MODEL` (Session 4 if time)
- ✅ Campaign CRUD/confirm/close/budget floor (`campaigns.ts`), budget helper (`budget.ts`)
- ✅ Matcher + angle templates (`matcher.ts`, `angles.ts`): Clack Lab ranks first for the quiet-keyboard brief, Big Tech is omitted
### §5 Deal state and payment — ⬜ (Session 3)
### §6 Media and reporting — ⬜ (Session 3)
### §7 Contract — ✅ v1.1 in `src/shared/contracts` (routes implemented: identity, profile, directory, enrichment, products, campaigns, matches)
### §9 Acceptance — 🟡 #1 partially (seed, sign-in, restart persistence by file DB). Rest pending.

## Files map
- `src/shared/contracts/*` — Zod schemas + types for every route. `src/shared/topics.ts` — slug normalizer.
- `src/server/db/{schema.sql,db.ts}` — schema + connection/`tx`. `src/server/clock.ts` — injectable clock.
- `src/server/http/{route,respond,errors,auth,origin}.ts` — handler wrapper, envelope, ApiError, sessions, loopback guard.
- `src/server/seed/{ids,seed}.ts` + `scripts/{seed,reset}.ts`.
- `src/server/creators/{profile,directory}.ts`, `src/server/products/products.ts`, `src/server/youcom/{client,fixture,extract,enrichment}.ts`,
  `src/server/campaigns/{budget,parse,campaigns,matcher,angles}.ts`. `scripts/youcom-smoke.ts` (`npm run youcom:smoke`).
- `src/app/api/v1/{demo/accounts,demo/session,me,creator/profile,creator/profile/visibility,creator/enrichment,creators,creators/[id],
  products,products/[id],campaigns,campaigns/parse,campaigns/[id],campaigns/[id]/matches}/route.ts`.
- `tests/*.test.ts` + `tests/helpers.ts` (66 tests).

---

## Next session brief (Session 3)
**Start:** `source ~/.nvm/nvm.sh && nvm use && npm install && npm run demo:seed && npm test` (expect 66 passing). `.env.local` has `YDC_MODE=live` and the key; run `npm run demo:enrich` after a reset.
Read `CLAUDE.md`, then final spec §4 (offer terms), §5, §6, §7, and `DECISIONS.md` D10–D14, D22.

**Reuse:** `campaignTotals`/`campaignBudget`/`openNegotiationCount` from `src/server/campaigns/budget.ts` (call them inside the
`tx`, after BEGIN IMMEDIATE). `ownedProductRow`, `ownedCampaignRow`, `listedCard` for ownership/recipient checks.
`fingerprint()` in `src/server/ids.ts` for idempotency. `fixedClock` for expiry tests.

**Build, in this order (each with tests):**
1. `src/server/deals/` (view builder + actions). `POST /deals` (Idempotency-Key, listed recipient → else 409 `PROFILE_UNAVAILABLE`,
   campaign product = campaign's product, ACTIVE campaign, price ≤ remaining for campaign offers, `now < draftDueAt < publishDueAt`,
   product snapshot + `YOUTUBE`, proposal expiry +7 days, materialize expired rows then insert under the one-open index (D10) →
   409 `ACTIVE_NEGOTIATION_EXISTS` with `details.dealId`). `GET /deals?filter=&campaignId=`, `GET /deals/{id}` (participants; admin
   only when the deal has a dispute; else 404). Derive `EXPIRED` on reads.
2. `POST /deals/{id}/actions`: idempotency replay is checked **before** the version check, then `STALE_DEAL`. ACCEPT/DECLINE/COUNTER/WITHDRAW,
   accept re-checks budget in the same tx (`BUDGET_EXCEEDED` keeps the negotiation open), dates re-validated. Concurrency test: $500
   left, two $300 proposals accepted concurrently → only one commits (two DB connections on one file DB).
3. Uploads `POST /deals/{id}/uploads` (multipart, ≤20 MiB → 413, MP4 `ftyp` signature, opaque name in `.local/uploads/`, ≤6 unattached,
   cleanup on error; write the file **before** the tx, insert row in tx, delete the file if the tx fails). Playback URL + media
   stream with single byte ranges (206/416, `Cache-Control: private, no-store`).
4. SUBMIT_DRAFTS / REQUEST_CHANGES (≤3 batches) / APPROVE_DRAFT (latest batch, payment HELD) / SUBMIT_PUBLICATION (watch/shorts/youtu.be,
   11-char ID, publishedAt between approval and now) / CONFIRM_DELIVERY (second → COMPLETED + RELEASED atomically).
5. REPORT_ISSUE + admin `GET /admin/disputes[/{id}]` + RESUME/CANCEL/REFUND/RELEASE (reason required). Refund on the seeded held
   dispute frees exactly $400 (moderation campaign remaining 60000 → 100000).
6. Reports `GET /campaigns/{id}/report`, `GET /deals/{id}/report` (sample 420/600 BELOW_TARGET 30%, NO_TARGET/PENDING/INSUFFICIENT_DATA).
7. Update this file, changelog, decisions. Commit.

**Open items for the user:** none blocking. Rotate the You.com key after the hackathon (it was pasted into chat).
