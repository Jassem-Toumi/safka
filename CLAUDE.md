# Safka — Creator Sponsorship Marketplace (localhost hackathon prototype)

## Read first, every session
1. `docs/backend/PROGRESS.md` — what is done, and the **Next session** brief. Start there.
2. `Creator_Sponsorship_Backend_Spec-final.md` — **authoritative** backend spec. Wins over everything else.
3. `docs/backend/DECISIONS.md` — how ambiguous spec points were interpreted. Don't re-decide them.
4. `Creator_Sponsorship_Backend_Spec.md` (original) and `Creator_Sponsorship_Frontend_Spec.md` — background only;
   superseded by the final spec where they conflict (no Supabase, Postgres, OpenAI, email, workers, deployment).

## Ownership
- **Backend (this work):** `src/shared/**`, `src/app/api/**`, `src/server/**`, `scripts/**`, `tests/**`, `seed-assets/`, `docs/backend/**`.
- **Frontend (teammate):** all page routes and components under `src/app/**` except `src/app/api/**`. Don't edit their pages.
- `src/shared/contracts` is the frozen API contract. Any change → add an entry to `docs/backend/CONTRACT_CHANGELOG.md`.

## Stack and commands
- Node **24.22.3** (`.nvmrc`; run `source ~/.nvm/nvm.sh && nvm use` first — system default is Node 22, which lacks `node:sqlite`).
- Next.js 16 App Router route handlers, `node:sqlite` (`DatabaseSync`), Zod 4, Vitest. npm (not pnpm).
- `npm run demo:seed` · `npm run dev` (http://127.0.0.1:3000 only) · `npm test` · `npm run typecheck` · `npm run demo:reset -- --yes`
- The desktop preview runner cannot read ~/Desktop; run the dev server via Bash in the background instead.
- `AGENTS.md` is auto-written by `next dev` (Next 16). Version-specific Next docs live in `node_modules/next/dist/docs/` —
  check them before using unfamiliar Next APIs (e.g. route `params` is a Promise).

## Conventions
- Every route: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";` and wrap with `route()` from
  `src/server/http/route.ts` (loopback Host + same-origin write check + error envelope).
- Responses via `json()` / throw `ApiError(code, message, fields?, details?)`. Validate input with `parse(Schema, body)`.
- Auth: `requireUser(req, ["BRAND"])`. Inaccessible IDs → 404 `NOT_FOUND`, never 403, for other users' resources.
- DB: `getDb()`, helpers `one/all/run`, and `tx(db, () => …)` = `BEGIN IMMEDIATE`. **Never await inside `tx`.**
  Re-read state after the transaction begins. Busy → 503 `RETRY_LATER` (handled by `tx`).
- Time: always `now()`/`nowIso()` from `src/server/clock.ts` (tests use `fixedClock`). Store UTC ISO strings, cents as ints.
- Schema lives in `src/server/db/schema.sql` (single migration v1, already covers all tables for later sessions).
  If you must change it during the hackathon, edit the file and `npm run demo:reset -- --yes && npm run demo:seed`.
- Seed IDs are stable (`src/server/seed/ids.ts`); seed is idempotent and never overwrites existing deals.
- Tests call route handlers directly (`tests/helpers.ts`: `freshDb`, `req`, `signIn`, `ctx`, `body`).
- Never send `YDC_API_KEY` to the browser or include it in logs/errors.

## Session handoff rule
Before ending a session: tests + typecheck green, update `docs/backend/PROGRESS.md` (checklist + a fresh
**Next session** brief), log new interpretations in `DECISIONS.md`, contract changes in `CONTRACT_CHANGELOG.md`, commit.

## Frontend (Zach)

Pages and components under `src/app/**` (except `src/app/api/**`), plus
`src/lib/**` and `tests/frontend/**`. Don't edit backend files from a frontend
task; ask the backend teammate for contract changes.

- **Design brief:** `Creator_Sponsorship_Frontend_Spec.md` (routes §2, surfaces
  §3–§6, status tables, interaction and accessibility §7), as amended by final
  backend spec §8: demo account picker instead of signup, one synchronous
  enrichment request, matches include the angle, multipart uploads, no tracked
  links, view entry, notes or notifications. Where both are silent on something
  a person would notice, ask Zach; don't invent a flow.
- **Data:** call `@/lib/api` (`getDeal`, `actOnDeal`, …), never `fetch`. Every
  response is validated against `@/shared/contracts`; drift throws `ApiError`
  with code `CONTRACT_MISMATCH`. The client is browser-only (relative URLs), so
  pages that load data are client components.
- **Fixtures:** `NEXT_PUBLIC_API_MODE` is `auto` by default: live backend, and
  `src/lib/api/fixtures/` answers only routes Next doesn't have yet (HTML 404),
  so pages switch to live data as backend routes ship. `fixture` forces fixtures,
  `live` forbids them. Fixtures follow the signed-in role; switch with
  `setFixtureRole("CREATOR")` in the browser console. A new endpoint gets a
  function in `endpoints.ts`, a fixture route, and a call in
  `tests/frontend/api.test.ts`, which checks fixtures against the contracts.
- **Deal actions** send `expectedVersion` and one `newIdempotencyKey()` per
  intentional submission. Render the server's `availableActions`; never compute
  permissions or move status optimistically.
- **Labels:** sample data, creator-provided data and "Simulated payment" next to
  the values they describe. Never call a creator "verified".
- **Money and dates:** integer cents via `formatCents`/`dollarsToCents`, dates
  with a time zone via `formatDateTime` (`src/lib/format.ts`).
- **Gate:** a Stop hook runs `npm run typecheck && npm test` on Node 24 when
  `src/` or `tests/` changed (`.claude/hooks/check-on-stop.sh`). Test logic
  first; verify UI by running it at http://127.0.0.1:3000 (not `localhost`,
  which the backend rejects).
- **Style:** Zach's Coding Style (`zach-js-ts` skill) in frontend files: tabs,
  double quotes, no trailing commas, named exports except Next's
  `page`/`layout` files, `type` over `interface`, no `any`, `@/` imports.
- **Network here is slow** (npm ~370 KB/s, 2026-11-22): ask before adding a
  dependency, and don't create worktrees, which need their own install.
