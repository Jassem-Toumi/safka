# Creator Sponsorship Marketplace
## Backend specification for the localhost prototype

**Audience:** Backend coding agent. Use this document as the local API contract. The frontend spec still describes the product flow. The integration changes in §8 supersede its deployment, sign-in, upload, enrichment, and reporting instructions for this build.

**Demo goal:** An opted-in creator uses live You.com search to find public evidence. A brand builds a campaign, sees why the creator fits, and completes a sponsorship with draft approval and simulated payment. Run the entire app locally.

## 1. Scope and implementation order

| Build | Decision |
| --- | --- |
| Server and persistence | One Next.js App Router process with Node.js Route Handlers, a file-backed SQLite database, and an MP4 directory under `.local/`. |
| Roles | Seed brand, creator, and admin demo accounts. Local account picker with server-side sessions and role checks. |
| You.com | Live `you-search` from inside the app. The creator reviews sourced tags. Fixture mode and manual editing support offline testing. |
| Campaigns | Editable brief, product, hard budget cap, registered-creator ranking, evidence-backed explanations, and suggested angles. |
| Sponsorship | Direct and campaign offers, counteroffer, one post per deal, up to two candidate drafts per round, approval, submitted YouTube link, confirmation by both parties, and admin dispute resolution. |
| Payment and reporting | Record simulated hold, release, or refund. Show campaign commitments, spend, deal status, and sample seven-day performance. Live outcome values remain unavailable. |

**Defer:** Deployment, Docker, PostgreSQL and Supabase, password signup and recovery, email, scheduled jobs, queues, cloud video storage, live analytics and click tracking, social OAuth, public-web leads, payment provider, dedicated profile metrics APIs, and automatic posting. The same local database survives refreshes and process restarts.

Implement in this order:

1. Seed roles, products, creator profiles, and fixture data. Freeze shared TypeScript/Zod API types so frontend development can start.
2. Build the live You.com evidence path and the campaign matcher. Wire up brief suggestions and deterministic angle templates.
3. Build offer creation, negotiation, budget checks, uploads, approval, publication, confirmations, and simulated payment. Add the dispute path and sample report.
4. Verify the full flow with three browser contexts. If time remains, enable the optional You.com model call for free-text briefs.

## 2. Local execution, accounts, and persistence

- Pin a Node.js 24 release that provides `node:sqlite` (24.16 or later within the 24.x line). Use `DatabaseSync`, parameterized statements, short transactions, foreign keys, WAL mode, and a bounded busy timeout. Check in one schema migration. Initialize a fresh SQLite file with the seed command. Keep all local data and secrets out of Git. [Node.js SQLite](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html)
- Provide `npm install` or `npm ci`, `npm run demo:seed`, `npm run dev`, and `npm test`. Document them in the README. Use `next dev --hostname 127.0.0.1` and `http://127.0.0.1:3000`. Use that same origin in UI and API calls. The account picker and data routes are for loopback development. Validate hosts and browser write origins against the configured loopback origin. Do not expose the process on a LAN or through a public tunnel.
- `.env.local` has `YDC_MODE=live|fixture` (default `fixture`), optional `YDC_API_KEY`, and optional `YDC_BRIEF_MODEL`. Fixture mode runs without outbound calls. Live search works with the keyless MCP endpoint when available. A sponsor key selects the authenticated endpoint. Never provide the key to browser code.
- `GET /demo/accounts` lists seeded display names, IDs and roles. `POST /demo/session` accepts `{ accountId }` and starts a server-generated opaque session for a seed account only. Store the session in SQLite and use an HttpOnly, SameSite=Lax cookie. `DELETE /demo/session` invalidates that session. `GET /me` returns `{ id, role, displayName, profileReady }`. Open each demo role in a separate browser profile or test context. Cookies in tabs within one profile share the session.
- Check ownership on every state-changing route and every private read. Brands own their products and campaigns. Only participants and an admin assigned through the local role picker may access a deal, with admin access limited to dispute review. Inaccessible IDs return 404. Derive actor and role from the session. Only the creator can upload their draft. Keep app data outside `public/`.
- Use stable UUIDs for seed records and relative-to-now fixture dates. Seed idempotently for a fresh run without overwriting ongoing deals. Provide a documented reset command that deletes only the local demo SQLite data and MP4 directory when explicitly invoked. Seed a listing used for live enrichment, clearly labeled fictitious profiles, and one sample completed deal plus one held disputed deal.

| SQLite records | Minimal fields |
| --- | --- |
| `users`, `sessions` | ID, seed role, display name; opaque session identifier, user, expiry. |
| `creator_profiles`, `evidence` | Owner, version, visibility, draft and published snapshot, canonical channel key, sources tied to the current URL, label suggestions, and retrieval dates. |
| `products`, `campaigns` | Brand owner, current product and brief, state, version, budget and preferences. Snapshot accepted terms on the deal so later edits leave prior agreements intact. |
| `deals`, `proposals`, `deal_events` | Participants, optional campaign, product, state, simulated payment, version, accepted proposal ID, approved draft, public link, both confirmation timestamps, and timeline. Proposals store author, revision, terms snapshot, and expiry. |
| `uploads`, `draft_batches`, `draft_assets` | Owner, deal, server-generated disk key, size, batch, and attachment status. |
| `disputes`, `idempotency_keys` | Dispute prior state and decision audit; actor, operation, key, request fingerprint, and saved successful response. |

Use JSON text for small validated snapshots. Store times as UTC ISO 8601 strings and amounts as integer USD cents. Use uniqueness constraints for proposal revisions, upload attachment, and one open dispute per deal. Use the deal's payment state and agreement to derive campaign totals. Include no separate payment provider ledger or job tables.

## 3. Live You.com search and profile data

1. Creator enters `@handle`, a YouTube `/@handle` URL, or `/channel/UC…`. Normalize approved YouTube hosts and paths, strip tracking and fragments, and deduplicate listed channel identities where the canonical keys match. A channel is self-attested. The profile can be saved and listed manually with display name, bio, channel, at least one reviewed topic and format, and explicit visibility opt-in. Rate range and creator-reported typical seven-day views are optional.
2. From `POST /creator/enrichment`, call the You.com MCP tool `you-search` with a server-side Streamable HTTP client. For example, search `site:youtube.com "@CreatorHandle" videos reviews demonstrations` with `count: 6`. Use `https://api.you.com/mcp/free` for keyless live testing, or `https://api.you.com/mcp?tools=you-search` with the sponsor key as a bearer token. Use one live search per click. Use a 12-second total timeout, including MCP connection; close the client afterwards. Do not crawl videos, download videos, or use a second extraction service. [You.com MCP server](https://you.com/docs/agents/mcp-server)
3. Keep up to six usable results. Match each result to the exact handle/channel ID in the URL or snippet, or to an explicit channel link. Similar display names alone do not establish identity. Extract candidate topic and format tags with a small keyword map over titles and snippets. For example, keyboard builds or switches map to `mechanical-keyboards`, “sound test” maps to a comparison or demo suggestion, and “review” maps to `REVIEW`. Unknown terms are eligible for manual tags. Save source URL, title, short supporting excerpt, and retrieval time. Display publicly sourced counts only if explicitly stated with a subject and source. Rates are creator-entered. Expected clicks are available only as labeled sample data. Omit audience demographics.
4. Use one request and response. The button shows `Searching with You.com` while the request is pending. Respond with `{ status, mode, evidence, suggestions, retrievedAt }`. Use terminal `READY`, `EMPTY`, or `FAILED` and mode `LIVE` or `SAMPLE`. Return a short error code for provider failures. The creator can always add tags manually. Do not silently replace a failed live request with fixture results. Check the saved profile version and channel identity again before applying results, so a response cannot overwrite a channel edited while the request was running.
5. The creator explicitly chooses sources and tags and then lists the profile. `DRAFT`, `LISTED`, and `HIDDEN` control directory eligibility. Use a published snapshot for brand views. Removing a listing leaves existing deals accessible. Fixture results clearly display `Sample data`. For sponsor acceptance, test one actual search inside the running app with a known opted-in handle and show one approved citation on the brand's match card.

## 4. Briefs, matches, and offer terms

Brands create products with a name, description, and optional HTTPS landing URL. Campaigns use one owned product and include title, goal, objective (`AWARENESS`, `TRAFFIC`, `SALES`, `CONTENT`), topics, optional requested formats, talking points and restrictions, positive USD budget, and optional preferred rate maximum and seven-day targets. Supported format values are `REVIEW`, `DEMO`, `TUTORIAL`, `UNBOXING`, `COMPARISON`, `STORY`, and `OTHER`. Normalize topic slugs and deduplicate. Require at least one topic to activate. A brand explicitly reviews and confirms. Pending proposals keep immutable snapshots as campaign settings change.

**Brief suggestions:** `POST /campaigns/parse` accepts product ID and prompt. The default extracts explicitly written dollar amounts and known topics/formats from the prompt and product text with a small dictionary. Prefill goal from the prompt and title from the product, leaving unknown fields for review. Return `mode: RULES`; label the result “Suggested brief.” With `YDC_BRIEF_MODEL` and a working sponsor key, optionally use You.com's Inference Router for one text-to-JSON call. List accessible models during setup, choose one that passes a structured JSON smoke test, validate the response with Zod, and fall back to the same rules on error. Return `mode: AI` only on successful model output. No separate OpenAI account or API key. [You.com Inference Router](https://you.com/docs/guides/inference-router/quickstart)

**Ranking:** Compute from current `LISTED` profiles at request time. Sort by percentage of requested topics matched, format overlap, rate fit, self-reported typical seven-day views where supplied, then stable creator ID. Omit zero-topic matches. For rate fit, use lower of remaining budget and preferred max if set. Rank a known within-range rate above unknown, and unknown above above-range. Use the creator's minimum to judge fit. Attach actual approved evidence to each matched tag. Generate a short editable video angle from format or tags with templates. Example for a keyboard comparison creator: “Let viewers hear the difference between the stock and upgraded build.” Return the angle with the match, without a separate generation endpoint or model call.

**Offer terms:** `creatorId`, optional `campaignId`, `productId`, price in cents, one format, brief, suggested angle if any, talking points, restrictions, sponsorship disclosure instructions, draft due date, publish due date, and nullable view/click targets. Freeze a product snapshot and platform `YOUTUBE` in the proposal. Require a listed recipient for a new offer. Validate `now < draftDueAt < publishDueAt` on send/counter and validate dates again on accept. Accept only positive amounts. The product in a campaign offer must be the campaign product at send time. Both direct and campaign offers use the same deal endpoint.

## 5. Deal state and simulated payment

The backend returns both deal and payment status, actions for this viewer, and the party that acts next when there is one. Inbox rows are derived from current deal state and ordered by needed action, then updated time. All deal actions append a timeline event.

| Action and actor | Result |
| --- | --- |
| Brand sends | Create `NEGOTIATING` with first proposal and payment `NONE`. Limit to one open negotiation per brand, creator and campaign, or per brand, creator and product for direct offers. |
| Current proposal recipient counters | Create an immutable next proposal. Price, suggested angle and dates may change. Recipient becomes the other participant. |
| Recipient declines or brand withdraws | `DECLINED` or `WITHDRAWN`, respectively. Proposals expire after seven days, renewed by a counter. Derive `EXPIRED` from the server clock on reads and enforce it before an action. No scheduler. |
| Recipient accepts | Verify latest proposal, dates, campaign status and budget in the same transaction. Snapshot the agreement. Set `AGREED`; payment stays `NONE`. |
| Creator submits one or two draft IDs | From `AGREED` or `REVISION_REQUESTED`, attach ready uploads as one batch and move to `DRAFT_REVIEW`. |
| Brand requests changes | From `DRAFT_REVIEW`, save required feedback and move to `REVISION_REQUESTED`. Allow up to three total batches. |
| Brand approves one draft | Only one asset from the latest batch. Freeze it, move to `READY_TO_PUBLISH`, and set simulated payment `HELD`. |
| Creator submits a publication | From `READY_TO_PUBLISH`, validate a YouTube watch, Shorts, or youtu.be link with an 11-character video ID. Store the canonical link and creator's attestation and timestamp. State becomes `PUBLISHED`. The brand opens the link to review it. A clearly labeled sample link can be seeded for demos. |
| Either participant confirms | From `PUBLISHED`, store that person's confirmation once. First confirmation leaves payment held. Second moves deal to `COMPLETED` and payment `RELEASED` atomically. |
| Either participant reports an issue | Allow in active agreed states through `PUBLISHED`, before completion. Record prior status, issue type and reason. Set `DISPUTED`. Keep the payment state. |
| Admin resolves | Require reason. `RESUME_DEAL` restores prior state. `CANCEL_DEAL` when payment is `NONE` ends it as `CANCELLED`. With payment `HELD`, `REFUND_PAYMENT` sets deal and payment `REFUNDED`; `RELEASE_PAYMENT` sets deal `COMPLETED` and payment `RELEASED`, recording the override. |

Only active, agreed deals qualify for disputes. Use issue codes `MISSED_DEADLINE`, `CONTENT_MISMATCH`, `MISSING_DISCLOSURE`, `INVALID_PUBLICATION`, `UNRESPONSIVE_PARTY`, and `OTHER`. Deadline lateness appears in the deal and can be reported. Late drafts and posts remain submittable. No automatic release. The app accepts a publication timestamp from approval through now and identifies the associated video by URL. It performs no external posting, identity verification, or media comparison. Performance shortfalls stay in reports.

### Hard budget cap and duplicate prevention

- Pending proposals do not reserve budget. On sending an initial campaign offer, ensure its price fits the remaining amount. On acceptance, recompute totals from current campaign deals. `committedCents` includes agreements with pending or held payments, including open disputes. `spentCents` includes released payments. `remainingCents = budgetCents - committedCents - spentCents`. Cancel and refund free the corresponding amount. Direct deals have no campaign budget. Reject a cap reduction below committed plus spent. Close a campaign only when it has no open negotiations.
- Run every budget- or payment-changing action in one short SQLite `BEGIN IMMEDIATE` transaction. Re-read the current state and balance after the transaction begins. Write agreement/payment change and timeline entry atomically. Do not await network or file IO within a transaction. A temporary database lock can return a retryable 503. [SQLite write transactions](https://www.sqlite.org/lang_transaction.html)
- Use the same transaction for the one-open-negotiation check and insert. Exclude rows whose latest proposal has expired when checking duplicates or whether a campaign can close. For an acceptance blocked by the budget, keep the negotiation open.
- Deal creation and deal actions require `Idempotency-Key`. Scope it to actor and operation, store a payload fingerprint and the successful result in the same transaction, and replay identical repeats. Check replay before stale-version validation. A reused key with a different payload returns `IDEMPOTENCY_CONFLICT`. Deal actions require the last `expectedVersion`. A stale action returns `STALE_DEAL` and the frontend refreshes. Failed actions do not consume budget or write idempotency successes.

## 6. Local draft media and reporting

**Video:** `POST /deals/{id}/uploads` accepts multipart `file` (one MP4 per request, up to 20 MiB). Only the deal's creator can upload in a draft-submission state. Validate size and MP4 signature, use an opaque generated filename, and store bytes under `.local/uploads/`. Limit to six unattached files per deal. Clean up partial writes on error. Return `{ uploadId, status: "READY" }`. `SUBMIT_DRAFTS` takes one or two distinct ready IDs belonging to that deal. To preview attached drafts, return a same-origin media URL from the playback endpoint. Authorize every stream request and support single HTTP byte ranges for browser seeking. Return correct 206/416 responses and `Cache-Control: private, no-store`. Seed short browser-playable MP4s with permission to use them.

**Reporting:** Show actual deal counts and campaign budget values from SQLite. Targets are optional advisory values for the first seven days. Use one completed, clearly labeled sample report with 420 sample clicks against a 600-click goal, showing `BELOW_TARGET` and 30% below target. Keep sample metrics isolated from any real profile or campaign totals. For other deals, display `NO_TARGET` if a target is unset, `PENDING` until the measurement window ends, and `INSUFFICIENT_DATA` afterwards. Actual values are `null`. No external analytics collector, manual observations form, redirect route, or campaign notes endpoint. Simulated release is independent of reporting.

## 7. Local API contract

Prefix paths below with `/api/v1`. Share schemas in `src/shared/contracts`. JSON success is `{ data: ... }`; failure is `{ error: { code, message, fields? } }`. Retain list shape `{ items, nextCursor: null }` for seed-sized results. Use 201 for creation, 200 for synchronous reads and actions. Authenticated sensitive responses are `no-store`. Media bytes are the exception to JSON responses.

| Route | Request and result |
| --- | --- |
| `GET /demo/accounts`, `POST /demo/session`, `DELETE /demo/session`, `GET /me` | Seed identity list, session management, and current user per §2. POST returns the same user shape as `GET /me`. |
| `GET /creators`, `GET /creators/{id}` | Listed profiles for brands. Support `q`, `topic`, `format`; sorted by display name and ID. |
| `GET /creator/profile`, `PUT /creator/profile`, `POST /creator/profile/visibility` | Creator draft and published snapshot. Update with `expectedVersion`; visibility input `{ visibility: LISTED or HIDDEN, expectedVersion }`. Profile input has display name, bio, channel URL or handle, topic and format labels, optional rate and typical seven-day views, and selected evidence IDs. |
| `POST /creator/enrichment` | Saved profile's public channel. Synchronously returns terminal result per §3. |
| `GET /products`, `POST /products`, `PATCH /products/{id}` | Brand-owned products. Input `{ name, description, landingUrl }`. Output adds `id`. |
| `POST /campaigns/parse` | `{ productId, prompt }` → `{ brief, budgetCents, preferredMaxPerPostCents, defaultViewTarget, defaultClickTarget, mode }`. Numeric suggestions may be null. |
| `GET /campaigns`, `POST /campaigns`, `GET /campaigns/{id}`, `PATCH /campaigns/{id}` | Brand-owned campaign fields from §4. Create/edit accepts `productId, sourcePrompt, brief, budgetCents, preferredMaxPerPostCents, defaultViewTarget, defaultClickTarget`, plus `confirm: true` to activate and `expectedVersion` for an edit. Close via `{ status: "CLOSED", expectedVersion }`. Return campaign with `version, status, budget, dealCount`. |
| `GET /campaigns/{id}/matches` | Compute active campaign matches. Return cards, evidence reasons, and suggested angles. |
| `POST /deals`, `GET /deals`, `GET /deals/{id}` | Create from `{ creatorId, productId, campaignId, terms }`. List by `filter=needs_action\|in_progress\|closed` and optional owned `campaignId`. |
| `POST /deals/{id}/actions` | `{ action, expectedVersion, ...actionFields }` and `Idempotency-Key`. Return updated deal. |
| `POST /deals/{id}/uploads`, `GET /deals/{id}/assets/{assetId}/playback`, `GET /deals/{id}/assets/{assetId}/media` | Multipart upload, playback URL `{ url, expiresAt: null }`, authorized MP4 byte stream. |
| `GET /admin/disputes`, `GET /admin/disputes/{id}` | Issue data and authorized deal details. Resolution goes through the deal actions endpoint. |
| `GET /campaigns/{id}/report`, `GET /deals/{id}/report` | Budget, milestone counts and per-deal metric results for the campaign owner, or individual report for deal participants. |

**Response shapes:** A creator card has `id, displayName, bio, profileUrl, topics, formats, rate, typical7dViews, publicMetrics, evidence, dataMode, expectedClicks, profileVersion`. A label is `{ value, origin: PUBLIC | CREATOR | SAMPLE, evidenceIds }`. Evidence is `{ id, url, title, excerpt, retrievedAt, publishedAt, kind }`. The optional rate is `{ minCents, maxCents }`. Use null for unavailable `expectedClicks` except explicitly sample estimates. A match has `{ creator, topicMatchPct, formatMatch, rateFit, reasons, angle, campaignVersion }`, where each reason has `text` and `evidenceIds`. A report metric has `{ target, actual, measuredAt, source, status }`, with nullable source and `SAMPLE` for seeded observations.

- Creator `dataMode` is `LIVE`, `SELF_REPORTED`, or `SAMPLE`. `publicMetrics` entries have `{ label, value, approximate, subject, measuredAt, evidenceId, source }`. `expectedClicks`, when present, is `{ low, high, isSample: true }`. An enrichment result has `suggestions: { topics: Label[], formats: Label[] }` and nullable `errorCode`.
- `brief` is `{ title, goal, objective, topics, formats, talkingPoints, restrictions }`. `rateFit` is `WITHIN_PREFERENCE`, `UNKNOWN`, or `ABOVE_PREFERENCE`. `budget` is `{ budgetCents, committedCents, spentCents, remainingCents }`.
- Deal report is `{ dealId, status, windowStart, windowEnd, views, clicks, sample }`. Campaign report is `{ campaignId, budget, countsByStatus, agreedCount, publishedCount, completedCount, deals }`, where `deals` uses the standard list shape. Counts include deal history when an agreement or publication exists. No click total is returned for live campaigns.
- Deal list filters use caller capabilities. `needs_action` includes active deals with an available workflow action for the caller. `in_progress` includes active deals awaiting the other party or review. `closed` includes the final statuses. `REPORT_ISSUE` is a secondary action and does not by itself qualify a deal as needing action.

A deal returns `id, version, status, paymentStatus, brand, creator, campaignId, budget, latestProposal, agreement, draftBatches, approvedAssetId, publication, confirmations, dispute, nextActionRole, availableActions, timeline, createdAt, updatedAt, isOverdue`. Actor summaries have `id` and `displayName`. Proposal includes `id, revision, authorRole, expiresAt, createdAt, terms`. Agreement includes `proposalId, acceptedAt, terms`. Batch includes `id, round, submittedAt, assets`, with asset ID, label and file size. Publication includes canonical `url`, `videoId`, and `publishedAt`. Confirmations contain role and timestamp. Brand budget is null for creator viewers or direct deals. Available actions reflect server authorization.

| Action | Additional fields |
| --- | --- |
| `ACCEPT`, `DECLINE` | `proposalId` |
| `COUNTER` | `proposalId, amountCents, draftDueAt, publishDueAt, angle` |
| `SUBMIT_DRAFTS` | `uploadIds` |
| `REQUEST_CHANGES` | `reason` |
| `APPROVE_DRAFT` | `assetId` |
| `SUBMIT_PUBLICATION` | `url, publishedAt, attested: true` |
| `REPORT_ISSUE` | `code, reason` |
| `CANCEL_DEAL`, `RESUME_DEAL`, `REFUND_PAYMENT`, `RELEASE_PAYMENT` | `disputeId, reason` |
| `WITHDRAW`, `CONFIRM_DELIVERY` | None |

Return standard 400/401/403/404 for invalid input, missing session, wrong role, or inaccessible data. Return 409 with `STALE_DEAL`, `STALE_PROFILE`, `STALE_CAMPAIGN`, `BUDGET_EXCEEDED`, `INVALID_STATE`, `PROPOSAL_EXPIRED`, `ACTIVE_NEGOTIATION_EXISTS`, `PROFILE_UNAVAILABLE`, or `IDEMPOTENCY_CONFLICT` as applicable. Oversize uploads return 413. Bounded database contention returns 503 with `RETRY_LATER`. Non-wall-clock tests use an injected test clock.

## 8. Frontend integration changes

| Earlier frontend instruction | Local prototype route and behavior |
| --- | --- |
| Signup, verification, and email | Show the demo account picker. Use local sessions and the deal inbox. Hide signup, email notifications and password reset. |
| Poll for queued enrichment | One `POST /creator/enrichment` request and a loading state. Use the terminal response directly. |
| Run a match job and request the AI angle | One `GET /campaigns/{id}/matches` after confirmation. Render the included suggested angle. Distinguish `AI` and `RULES` on brief generation. |
| Upload via Supabase signed URLs | Use multipart `POST /deals/{id}/uploads`. Use the returned ID and the authenticated playback URL. |
| Tracked link, manual view entry, notes and notification controls | Hide these controls and their payload fields. Keep the inbox, timeline, campaign budget, and report with sample/live labels. |

## 9. Local acceptance tests

1. Start on a clean machine with Node and npm. Seed, run one process, sign in as brand and creator separately, and confirm file-backed state survives a restart. Fixture mode works offline. In live mode an outbound You.com call from the app results in a visible approved source on a listed creator and on a brand match.
2. Brand confirms a quiet-keyboard campaign with $600, sees the creator's sound-test match, and sends an offer for $250. Creator counters $300. Brand accepts and commits $300. Also create a direct offer without a campaign budget.
3. With $500 available and two unaccepted $300 proposals, concurrently accept both. Only one commits. Verify stale and duplicate requests preserve balances. Test declined, withdrawn, and expired proposals with the server clock.
4. Creator uploads two MP4s. Brand can see both, request a revision, and approve exactly one. The payment becomes `HELD`. Submit the link and confirm from each role. The second confirmation releases once. Unauthorized viewers cannot stream the drafts.
5. Open a seeded held dispute, resolve it as admin, and verify refund frees the exact campaign commitment. Show the separate sample report with 420 of 600 clicks, labeled sample, with no payout effect.
