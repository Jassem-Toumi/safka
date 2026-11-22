# API contract changelog

Source of truth: `src/shared/contracts/*`. Frontend: import types and Zod schemas from `@/shared/contracts`; never copy enums.
Log every change here (newest first) so the frontend teammate can see what moved.

## v1.1 — 2026-11-22 (Session 2)
- **Live now:** `GET/PUT /creator/profile`, `POST /creator/profile/visibility`, `POST /creator/enrichment`, `GET /creators`,
  `GET /creators/{id}`, `GET/POST /products`, `GET/PATCH /products/{id}`, `POST /campaigns/parse`, `GET/POST /campaigns`,
  `GET/PATCH /campaigns/{id}`, `GET /campaigns/{id}/matches`.
- **Fix:** `CampaignPatch.sourcePrompt` no longer defaults to `""`. Leaving it out of a PATCH keeps the saved prompt (it was being reset).
- **Added:** `GET /products/{id}` (owned products only).
- `GET /campaigns/{id}/matches` returns the list shape `{ items: MatchCard[], nextCursor: null }`.
- `EnrichmentResult.errorCode` values: `TIMEOUT`, `QUOTA_EXCEEDED`, `AUTH_FAILED`, `PROVIDER_ERROR`, `BAD_RESPONSE`.
  A failed search is HTTP 200 with `status: "FAILED"`. A profile edited mid-search → 409 `STALE_PROFILE` (search again).
- Listing errors: 400 `VALIDATION_ERROR` with `fields.<blocker>` and `details.listingBlockers`. A duplicate listed channel is
  400 with `fields.channel`.

## v1 — 2026-11-22 (Session 1, initial freeze)
- All enums, envelopes (`{ data }`, `{ error: { code, message, fields?, details? } }`), and shapes for every §7 route.
- Live now: `GET /api/v1/demo/accounts`, `POST /api/v1/demo/session`, `DELETE /api/v1/demo/session`, `GET /api/v1/me`.
- Additive fields beyond the spec minimum are listed in `docs/backend/DECISIONS.md` (D11).
- Base URL must be `http://127.0.0.1:3000` (not `localhost`) — see D3.
