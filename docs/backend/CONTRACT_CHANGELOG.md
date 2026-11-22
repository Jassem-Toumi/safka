# API contract changelog

Source of truth: `src/shared/contracts/*`. Frontend: import types and Zod schemas from `@/shared/contracts`; never copy enums.
Log every change here (newest first) so the frontend teammate can see what moved.

## v1 — 2026-11-22 (Session 1, initial freeze)
- All enums, envelopes (`{ data }`, `{ error: { code, message, fields?, details? } }`), and shapes for every §7 route.
- Live now: `GET /api/v1/demo/accounts`, `POST /api/v1/demo/session`, `DELETE /api/v1/demo/session`, `GET /api/v1/me`.
- Additive fields beyond the spec minimum are listed in `docs/backend/DECISIONS.md` (D11).
- Base URL must be `http://127.0.0.1:3000` (not `localhost`) — see D3.
