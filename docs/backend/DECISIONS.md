# Backend decisions

Interpretations of ambiguous points in `Creator_Sponsorship_Backend_Spec-final.md`. Add new ones at the bottom with the date.

| # | Spec ref | Decision | Why |
|---|---|---|---|
| D1 | whole | Final spec supersedes the original backend spec wherever they conflict. The original is background only. | Master dev's final call (2026-11-22). |
| D2 | §2 | Node 24.22.3 (latest 24.x LTS), pinned via `.nvmrc` and `engines`. npm, not pnpm. | Spec asks for ≥24.16 within 24.x and npm commands. |
| D3 | §2 | Host check is strict: only `APP_ORIGIN`'s host (`127.0.0.1:3000`). `localhost:3000` is rejected with 403. Writes need `Origin` equal to `APP_ORIGIN` (or no Origin and `Sec-Fetch-Site` same-origin/none, e.g. curl/tests). | "Validate hosts and browser write origins against the configured loopback origin." Frontend must use `http://127.0.0.1:3000`. |
| D4 | §2 | Session cookie `safka_session` holds a 256-bit random token; DB stores only its sha256. 7-day expiry. | Opaque server-generated session, nothing guessable stored. |
| D5 | §2 | `GET /demo/accounts` returns the standard list shape `{ items, nextCursor: null }`. | §7 says retain list shape. |
| D6 | §2/§7 | `Me.profileReady`: creators → profile has been published at least once; brand/admin → true. | Original spec uses it to route onboarding vs inbox. |
| D7 | §3 | No opted-in real YouTuber yet. All seeded creators are fictitious, named "(sample)", `dataMode: SAMPLE`, evidence `kind: SAMPLE` with `example.com` URLs. A blank "Live Demo Creator" draft account exists for a live You.com run once someone opts in. | User instruction; spec forbids passing fixtures off as live. |
| D8 | §3 | Channel normalization accepts `@handle`, `youtube.com/@handle[/tab]`, `youtube.com/channel/UC…[/tab]` on youtube.com / www / m hosts, http upgraded to https. Rejects `/c/`, `/user/`, watch URLs, look-alike hosts, credentials, ports. Uniqueness key is lowercase handle (`yt:@handle`) or channel ID (`yt:UC…`), enforced only among LISTED profiles (`listed_channel_key`). | Spec: "deduplicate listed channel identities where the canonical keys match". |
| D9 | §3/§7 | Profile input sends topics as free text strings + `selectedEvidenceIds`; the server normalizes slugs and derives each label's `origin` from the selected evidence rows that support it (`evidence.topics_json/formats_json`). | Keeps frontend simple; provenance can't be forged by the client. |
| D10 | §5 | One-open-negotiation is enforced by a partial unique index on `deals(negotiation_context) WHERE status='NEGOTIATING'`. Before inserting, the transaction materializes any expired NEGOTIATING row in that context to `EXPIRED`. | Belt-and-braces with the in-transaction check; spec excludes expired rows. |
| D11 | §5 | Contract additions beyond the spec list (additive only): `Deal.sample`, `DraftBatch.late/changeRequest`, `Publication.submittedAt/late/sample`, `MetricResult.shortfallPct`, `Campaign.hasOpenNegotiations/createdAt`, `CampaignReport.sample`, `EnrichmentResult.profileVersion`, `CreatorProfile` shape, `ApiErrorBody.error.details` (e.g. `{ dealId }` for `ACTIVE_NEGOTIATION_EXISTS`). | Frontend needs them; spec lists minimums. |
| D12 | §6 | Seed MP4s are team-provided files in `seed-assets/seed-draft-option-{1,2}.mp4`; seed copies them to `.local/uploads/`. Until provided, seeded draft rows exist but their media endpoint will 404. | User will supply videos. |
| D13 | §6 | The sample report lives on a dedicated sample campaign ("Felt desk mat launch (sample)") with one COMPLETED/RELEASED sample deal: clicks 420/600 (BELOW_TARGET, 30%), views 21,500/20,000 (MET). Metrics are stored only in `deals.sample_metrics_json` on `is_sample=1` deals. | Keeps sample numbers isolated from real totals. |
| D14 | §6 | The held-dispute demo deal is on a non-sample campaign ("Whisper 75 pre-launch (moderation demo)", $1,000 budget, $400 HELD) so refund visibly frees exactly $400. | Acceptance test 5. |
