# Backend progress

Spec: `Creator_Sponsorship_Backend_Spec-final.md`. Status legend: ✅ done · 🟡 partial · ⬜ todo.

## Session plan
| Session | Scope (final spec §1 build order) | Status |
|---|---|---|
| 1 | Foundation: Node 24, Next.js, SQLite schema (all tables), shared contracts (all routes), demo accounts/session/me, origin guard, seed, tests, docs | ✅ |
| 2 | Creator profile + visibility, directory, products, You.com live/fixture enrichment, campaigns + parse (RULES, optional AI), matcher + angles | ✅ (AI brief mode deferred) |
| 3 | Deals: create/counter/accept/decline/withdraw/expire, budget cap + concurrency, idempotency, uploads + range streaming, drafts/approval/HELD, publication, confirmations/RELEASED, disputes + admin, inbox filters, reports | ✅ |
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

### §4 Briefs, matches, offers — ✅ (offer terms via `POST /deals`; AI brief mode deferred)
- ✅ Products CRUD `src/server/products/products.ts` (landing URL hygiene)
- ✅ `POST /campaigns/parse` RULES (`src/server/campaigns/parse.ts`). ⬜ optional AI mode via `YDC_BRIEF_MODEL` (Session 4 if time)
- ✅ Campaign CRUD/confirm/close/budget floor (`campaigns.ts`), budget helper (`budget.ts`)
- ✅ Matcher + angle templates (`matcher.ts`, `angles.ts`): Clack Lab ranks first for the quiet-keyboard brief, Big Tech is omitted
### §5 Deal state and payment — ✅
- ✅ `POST/GET /deals`, `GET /deals/{id}`, `POST /deals/{id}/actions` (all 14 actions), derived EXPIRED, one-open-negotiation,
  budget re-check on accept in the same `BEGIN IMMEDIATE` tx, idempotency with replay before the version check (`src/server/deals/*`)
- ✅ Inbox filters `needs_action` / `in_progress` / `closed`; admin `GET /admin/disputes[/{id}]`; resolutions RESUME/CANCEL/REFUND/RELEASE
### §6 Media and reporting — ✅
- ✅ Multipart MP4 upload (20 MiB → 413, `ftyp` check, ≤6 unattached, file deleted if the tx fails), playback URL, media stream with
  single ranges (206/416, `private, no-store`), verified over real HTTP in `next dev`
- ✅ `GET /deals/{id}/report`, `GET /campaigns/{id}/report` (sample 420/600 BELOW_TARGET 30%)
### §7 Contract — ✅ v1.2 — every §7 route is implemented
### §9 Acceptance — 🟡 #1–#5 covered by route-level tests (`tests/deals.test.ts`, `tests/enrichment.test.ts`); a browser run with three contexts is still to do (Session 4)

## Files map
- `src/shared/contracts/*` — Zod schemas + types for every route. `src/shared/topics.ts` — slug normalizer.
- `src/server/db/{schema.sql,db.ts}` — schema + connection/`tx`. `src/server/clock.ts` — injectable clock.
- `src/server/http/{route,respond,errors,auth,origin}.ts` — handler wrapper, envelope, ApiError, sessions, loopback guard.
- `src/server/seed/{ids,seed}.ts` + `scripts/{seed,reset}.ts`.
- `src/server/creators/{profile,directory}.ts`, `src/server/products/products.ts`, `src/server/youcom/{client,fixture,extract,enrichment}.ts`,
  `src/server/campaigns/{budget,parse,campaigns,matcher,angles}.ts`. `scripts/youcom-smoke.ts` (`npm run youcom:smoke`).
- `src/app/api/v1/{demo/accounts,demo/session,me,creator/profile,creator/profile/visibility,creator/enrichment,creators,creators/[id],
  products,products/[id],campaigns,campaigns/parse,campaigns/[id],campaigns/[id]/matches}/route.ts`.
- `src/server/deals/{view,create,actions,idempotency,events,terms,list,media,reports}.ts`; routes under `src/app/api/v1/{deals,admin}/**`
  and `campaigns/[id]/report`.
- `tests/*.test.ts` + `tests/helpers.ts` (80 tests).

---

## Next session brief (Session 4)
**Start:** `source ~/.nvm/nvm.sh && nvm use && npm install && npm run demo:seed && npm test` (expect 80 passing).
`.env.local` has `YDC_MODE=live` and the sponsor key. After any reset, run `npm run demo:enrich` to list the real demo channels.

**Do, in this order:**
1. Help with frontend integration: check that the teammate's pages call `http://127.0.0.1:3000` (D3), send `Idempotency-Key` on
   `POST /deals` and actions, refresh on `STALE_DEAL`, and use `availableActions` / `nextActionRole` rather than re-deriving them.
   Fix backend issues they hit; log contract changes.
2. Run §9 acceptance in a real browser with three profiles (brand, creator, admin) using the built-in browser pane: the
   quiet-keyboard campaign ($600) → match → $250 offer → $300 counter → accept; a direct offer; two drafts → revision → approve
   → publish link → both confirm; the admin refund on the seeded dispute; the sample report.
3. Optional: You.com AI brief mode (`YDC_BRIEF_MODEL`, Zod-validated, falls back to RULES). Only if time allows.

**Known gaps / notes:** admins can read any deal that has ever had a dispute but can only act while one is open (D28).
Live outcome metrics are never collected (by design).
