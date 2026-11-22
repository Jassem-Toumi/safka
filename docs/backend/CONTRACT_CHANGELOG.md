# API contract changelog

Source of truth: `src/shared/contracts/*`. Frontend: import types and Zod schemas from `@/shared/contracts`; never copy enums.
Log every change here (newest first) so the frontend teammate can see what moved.

## v1.2 — 2026-11-22 (Session 3)
- **Live now:** `POST/GET /deals`, `GET /deals/{id}`, `POST /deals/{id}/actions`, `POST /deals/{id}/uploads`,
  `GET /deals/{id}/assets/{assetId}/playback`, `GET|HEAD /deals/{id}/assets/{assetId}/media`, `GET /deals/{id}/report`,
  `GET /campaigns/{id}/report`, `GET /admin/disputes`, `GET /admin/disputes/{id}`. Every §7 route is now implemented.
- No schema changes. Notes for the frontend:
  - `POST /deals` and actions **require** an `Idempotency-Key` header (reuse the same key when retrying the same click).
    Replays return the header `Idempotent-Replay: true`.
  - `Deal.creator.id` is the creator profile ID (D27).
  - Upload returns **201** `{ uploadId, status: "READY", sizeBytes }`. Use `playback.url` directly as `<video src>` (same origin,
    cookie auth, Range support).
  - Errors: wrong participant → 403; wrong state → 409 `INVALID_STATE`; older `proposalId` → 409 `STALE_DEAL`; lapsed proposal →
    409 `PROPOSAL_EXPIRED`.

## v1.1.1 — 2026-11-22
- No shape changes. New seed IDs `SEED.users/profiles.demoHipyo|demoGlarses|demoAlexotos|demoTae` (real demo channels with LIVE data).

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
