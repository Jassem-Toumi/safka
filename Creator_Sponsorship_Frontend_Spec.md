# Creator Sponsorship Marketplace

## Frontend implementation specification

**Audience:** Frontend coding agent. Use `Creator_Sponsorship_Backend_Spec.md`, especially §8, as the authoritative API contract. Build against shared runtime schemas in `src/shared/contracts` or typed fixture handlers while the backend is under construction.  
**Goal:** A brand can create a campaign, understand why a creator fits, and manage a sponsorship. A creator can publish a profile once and complete offers, reviews, and delivery from a mobile-friendly inbox.

## 1. Product behavior to preserve

- One registered creator and one YouTube post per deal. A brand can send a direct offer from the directory or send individual campaign offers to ranked matches.
- Use You.com live to find public creator evidence. The creator approves the profile before it appears in discovery. Content fit ranks first. Offer cards can suggest an angle grounded in the creator’s work. The creator chooses the concept and can share one or two draft videos for approval.
- Agree on offer terms before draft work. A brand approves one draft, which puts the simulated payment on hold. The creator submits the public URL. Each participant confirms delivery before release. An admin resolves delivery disputes, including simulated refunds.
- A campaign budget caps agreed commitments and releases. Pending proposals show their amount without reserving it. Views and clicks are advisory campaign outcomes. A below-target badge belongs in analytics and leaves delivery and payment untouched.
- Label sample profiles, sample forecasts, sample reports, and simulated payments near the values they describe. Keep each source label visible where outcomes are displayed.

## 2. App shell and routing

Use TypeScript and Next.js App Router. Use shared Zod schemas for form validation and API responses. Use Tailwind CSS, a small shared component set, and a readable sans serif like Geist. Prefer a clean directory with creator thumbnails and inline evidence. Use text with color for status and hide decorative elements that compete with the next action.

| Route | UI and behavior |
| --- | --- |
| `/sign-in`, `/sign-up` | Auth, password reset, and role-aware redirect. Signup presents two roles, Brand and Creator. Put the post-auth deep link in a safe same-origin `returnTo`; deny external destinations. Show email verification and resend states. |
| `/brand/creators` | Default brand landing route. Search by text, topic, and format. Creators show name, formats, tags, rate, available metrics, and profile action. Include loading, no-results, and unavailable states. Keep filters in URL query parameters. |
| `/brand/creators/[id]` | Public evidence summary for a creator listed to authenticated brands. Show profile link, formats, content examples, optional past collaboration, rates, and visible data provenance. Primary action is `Send offer`. |
| `/brand/products` | Product list and create/edit form. Show name, short description, and optional product URL. Provide an inline product picker or creation dialog in offer and campaign flows. |
| `/brand/campaigns` | List current and closed campaigns with budget remaining, number of deals, and create action. Surface drafts and resume editing. |
| `/brand/campaigns/new`, `/brand/campaigns/[id]` | Creation and detail. Detail contains `Brief`, `Matches`, `Deals`, and `Report` views. Keep one stable URL for the selected view, such as `?tab=matches`. |
| `/brand/deals`, `/creator/inbox` | Deal list with `Needs action`, `In progress`, and `Closed` filters. Each row shows the other party, product, latest terms or agreed amount, next action or state, and updated time. Campaign link appears for the brand only. |
| `/creator/onboarding`, `/creator/profile` | Shared profile editor with URL, enrichment results, profile fields, and listing controls. First-time onboarding lands in the inbox after publish. |
| `/deals/[id]` | Shared deal detail with role-appropriate actions, term summary, draft comparison, publication, payment, and timeline. Report panel after publication. |
| `/admin/disputes`, `/admin/disputes/[id]` | Open cases ordered by oldest first, resolved history, and evidence-backed decision form. |

Use `/` as an auth-aware redirect. Use role-specific top navigation on desktop and a compact mobile menu. Place notifications and sign-out in the shell. A 404 on inaccessible resources should use generic copy and a back-to-home link. Avoid exposing titles and profile data in a denied route. For a verified creator whose profile is incomplete, link to `Finish profile` from an empty inbox.

## 3. Creator onboarding and evidence review

1. Ask for display name, short bio, public YouTube handle or channel URL, and optional public media kit. Provide field help and example `@YourChannel`. Tell users the app will look up public sources. Save URLs before enabling **Find public profile evidence**. Required profile fields and visibility are server-validated.
2. On click call `POST /creator/enrichment`, then poll its status every 2 seconds, up to 40 seconds per view session. Stop polling when hidden, unmounted, or terminal. Show `Searching with You.com` and allow editing bio and rates while the worker runs. On client timeout, leave the latest status available on reload. If input URLs change, warn that submitted results refer to the previous URL and allow a new run once eligible.
3. For `READY` and `PARTIAL`, show evidence rows with a short excerpt, external source link, `Found on` date, visible metric type, and checkable tag suggestions. Source links open in a new tab and are protected with `rel="noopener noreferrer"`. Separate `Sourced by You.com`, `Creator provided`, `Cached public evidence`, and `Sample data` labels where relevant. For `EMPTY`, `FAILED`, and `STALE`, keep manual editing available. Offer Retry when the server permits it and show rate-limit feedback.
4. Let the creator add and remove topics and choose formats. Rate range is optional; format currency on blur and send integer cents. Use `Rate not provided` for an empty rate. An approximate source value should remain visibly approximate. `Expected clicks` displays `Unavailable` on live profiles. Clearly labeled sample click estimates may appear for sample fixtures.
5. Preview the card as a brand sees it. Use explicit opt-in and **Publish profile**. When already listed, saving creates unpublished edits until the creator chooses **Publish changes**. **Hide profile** explains existing offers stay in the inbox. Latest profile edit/version conflicts re-fetch the record and keep locally typed inputs available for comparison.

## 4. Brand discovery, campaigns, and offers

### Browse and compare

In the directory show the creator’s most relevant facts in the first viewport. Public counts disclose the subject and source, such as `Views on a recent review` with a linked source. Creator-reported reach uses `Typical 7-day views · Creator reported`. Make the rate range comparable at a glance. Filter the current server results and preserve filters when returning from a profile. Never label a creator as verified based on public enrichment.

### Campaign builder

1. Start with a product selector and a plain-language prompt, for example “Promote our quiet mechanical keyboard to people building shared-office setups. Budget $600.” The primary action is **Generate brief** and there is a clear **Enter details manually** path.
2. Render goal, objective, topics, formats, talking points, restrictions, total budget, optional preferred max per post, and optional seven-day view and click targets. Present budget and targets as editable fields that the brand reviews. Format USD to two decimals and use safe cent conversion. If AI fails, preserve the prompt and all inputs. Disable only the generating control while pending. Use a manual form with the same validation.
3. On **Confirm and find creators**, persist the confirmed brief before starting matches. Show the budget as total, committed, spent, and remaining. Use inline help `Agreed deals reserve budget`. A below-cap preferred price is optional. A cap edit under committed plus spent shows a server error inline. A campaign can have zero remaining budget. A campaign with pending offers cannot close until those offers close.
4. In `Matches`, show `Why this creator` with supporting source links. The brand can request a `Suggested video angle`. If the model is slow, the card still supports sending an offer or entering an angle manually. Show editable text in the composer. Labels make it clear the angle is a suggestion for the creator. An empty list offers **Edit brief** and **Browse creators**. A stale result refreshes against the new campaign version.

### Offer composer

Use the same composer from a directory profile or a campaign match. For a campaign prefill product, format when applicable, brief, angle, talking points, disclosure, and optional targets. Allow changes before sending. Require agreed price, draft due date, publish due date, format, brief, and sponsorship disclosure instructions. Optionally make the tracked link a deliverable if the product has a valid landing page URL. Preselect date and time with the viewer’s timezone and always include a timezone label. Convert to UTC before sending.

Show a final summary before **Send offer**. Explain the creator can accept, decline, or counter. Check affordability from the latest campaign data before enabling send, then handle `BUDGET_EXCEEDED` in the composer and preserve the form. Show the link to an existing offer for `ACTIVE_NEGOTIATION_EXISTS` when the server supplies its ID, or route to deal list with the appropriate filter. A successful submission navigates to `/deals/[id]`.

## 5. Deal workspace

Put product, participant names, amount, agreed deadline, and current state at the top. Display **Simulated payment** as text next to a payment status chip. Render the server’s `availableActions` and show who acts next. The backend owns authorization and status. Use explicit confirmation before irreversible actions such as approving a draft, confirming delivery, or resolving a dispute. Refresh state after every mutation and when a tab regains focus.

| Server status | User-facing state and controls |
| --- | --- |
| `NEGOTIATING` | `Offer sent` or `Counteroffer received`. Show latest proposed terms, expiry, and any prior proposal changes in the timeline. The recipient can Accept, Decline, or Counter. The brand can Withdraw. Counter form shows amount, optional angle, and due dates. Show current campaign remaining on the brand view only. |
| `AGREED` | `Draft due`. Creator sees upload controls. Brand sees deadline and the waiting state. |
| `DRAFT_REVIEW` | `Drafts ready for review`. Show up to two latest videos with clear labels like `Option 1` and `Option 2`. The brand can approve one or request changes with feedback. Keep previous batches in a collapsed history. At the revision limit, explain the choices remaining. |
| `REVISION_REQUESTED` | `Changes requested`. Surface the brand’s feedback, previous version, and revision count. Creator uploads one or two replacement drafts in a new batch. |
| `READY_TO_PUBLISH` | `Approved to publish`, with a frozen preview, publication due date, optional link-copy action, and simulated payment `Held`. Creator submits the YouTube URL and publication time, confirms the approved content and offer requirements were used, and indicates whether the tracked link was included. Show a link preview as text and a final confirmation before submission. |
| `PUBLISHED` | `Review published post`. Show the link, attestation, and confirmation indicators for both parties. The brand checks the public link and agreed requirements. Either participant can confirm. After the first confirmation show which confirmation is pending. Use `Report an issue` for delivery problems. |
| `DISPUTED` | `Under review`. Show opener, reason, existing payment state, and timestamp. Pause normal actions. Admin uses the dedicated moderation workspace. |
| Final statuses | `Completed`, `Refunded`, `Cancelled`, `Declined`, `Withdrawn`, or `Expired`. Show outcome, date, and relevant resolution reason. Payment labels remain `Released`, `Refunded`, or `No payment` per API. Completed/released does not imply a performance target was met. |

### Upload, review, and disputes

- Creator selects one or two MP4s, up to 20 MiB each. Show upload progress and allow per-file removal before submission. Offer retry for a failed file. Issue a separate signed upload token per file, upload to the exact private path via the Supabase Storage client, and call completion for each. Submit only ready upload IDs. Browser preview before submission uses an object URL and cleans up on remove or unmount. In a bad-size or type error, give concrete limits and preserve successfully uploaded options.
- For existing draft assets, request a playback URL on demand. Renew it if expired, and provide a keyboard-accessible play control, duration when the browser exposes it, and a visible error when the browser cannot play the file. A selected option is visually and programmatically clear. Do not attach URL signatures to timeline entries.
- The participant issue form asks for category and description. Offer codes for delivery defects, including wrong or missing content, required disclosure/link issues, and unresponsive parties. Provide **See performance report** for low views or clicks. Use the dispute panel for delivery issues before completion.
- Admin sees agreed terms, latest draft batch, approved draft, publication URL, confirmation timestamps, and the issue history. Show `Resume deal`, `Cancel deal`, `Release payment`, or `Refund payment` only as allowed. Require a reason and confirmation. Make the payment mode and effect visible before they submit. After resolution show the resulting state and audit entry.

## 6. Reporting and underperformance

Campaign report opens with budget and count of agreed, published, and completed deals. Per-deal rows show links to the deal and two separate metrics for views and tracked clicks. Label the first seven days and show dates in viewer time. Summaries exclude sample counts from live totals. A sample report can demonstrate underperformance without being confused with a live result.

| Metric status | User-facing treatment |
| --- | --- |
| `NO_TARGET` | `No target set`. Show available observed count and its source independently. |
| `PENDING` | `Measuring through [date]`. If available, show a provisional count and timestamp. |
| `INSUFFICIENT_DATA` | `Insufficient data`. Show missing observation, missing tracking link, or another concrete reason when the available fields support it. Never render a missing value as zero. |
| `MET` | `Target met`. Show actual and target and link to the deal. |
| `BELOW_TARGET` | `Below target`. Show actual, target, and percent shortfall, such as `420 / 600 tracked clicks · 30% below target`. This is informational. Offer a private note field for the brand to capture what to change next time. |

Use `round(100 × (target − actual) / target)` for percent shortfall. All statuses come from the backend. Never infer payment status from reporting. Provide **Record view count** to either deal participant after a publication exists. Ask for count, observation date/time, and source note. Label manual counts as `Self-reported` with their timestamp. Use `Tracked clicks` for counted redirects. A zero is a real count only when the report’s tracking conditions are met. Click collection uses the supplied tracked URL only. For an unset target, the observed count remains visible when present.

## 7. Integration and interaction rules

- Read API routes and action payloads from backend §8. Use a typed API client with the common `data`/`error` envelope. Avoid separate handwritten copies of enums. Seed mocks with at least one example for each significant UI state. Include a slow and failed provider response in local mocks.
- For every deal action send the deal’s last rendered `expectedVersion` and one generated `Idempotency-Key` per intentional submission. Reuse the key on transport retries with the same payload. Disable the pending action and mark it busy. On `STALE_DEAL` refresh the record and show that it changed. Do not silently resubmit against a new version. For `PROPOSAL_EXPIRED` refresh and offer a route back to compose a new offer if eligible.
- Use server-calculated capabilities. Do not optimistically move deal, ledger, or budget states. On success revalidate the inbox, campaign budget, deal, and report caches affected by the mutation. On error keep typed text and existing uploaded assets where recoverable. On slow or denied responses show actionable messages and keep unrelated navigation working.
- Display currency using `Intl.NumberFormat` with USD. Display dates with `Intl.DateTimeFormat` and recognizable local timezone. Show absolute deadline and optional relative hint side by side. Use an accessible dialog for final confirmations, visible keyboard focus, semantic buttons and inputs, `aria-live` on asynchronous status updates, a label for every form field, and text along with status color. Keep primary actions visible and comfortable to tap on mobile.
- Frontend settings use public auth URL and publishable key only. The email deep link navigates to the inbox or deal via authenticated pages. Notifications use an unread badge and mark read when explicitly opened. The server reveals no storage keys or web search credentials to the browser.

## 8. Delivery order and acceptance

1. Stand up role-specific routes, shell, API adapter, and typed fixtures. Implement once-used components locally and share status badges, evidence rows, and budget display across the relevant screens.
2. Build profile editor and evidence review, brand directory, product form, and campaign builder. Pair with the backend on the public evidence preview and match contract.
3. Build offer composer and each deal action. Use two browser contexts for creator and brand and a third for admin. Integrate private upload and video playback as soon as storage is available.
4. Build dispute queue, notification views, results report, and sample comparison. Run the end-to-end demo from a clean seeded session and on a mobile viewport.

| Scenario | What to verify |
| --- | --- |
| Sponsor flow | Submit a live handle, see You.com search run in the app, approve a claim, and see its citation on a campaign match. Provider failure leaves manual input usable. |
| Campaign flow | Generate and edit the brief, confirm it, see ordered matches, open a suggested angle, and send a campaign offer. A direct offer sends from a creator’s profile. |
| Negotiation and budget | Creator counters. Brand accepts with enough funds. A stale tab shows a recoverable conflict. An unaffordable acceptance keeps the negotiation open with a clear error. |
| Draft to delivery | Creator uploads two drafts. Brand can request changes or select one for approval. Payment becomes `Held` only after approval. Creator adds a public URL. First confirmation keeps the hold, second moves it to `Released`. |
| Dispute | Either party opens an issue from an eligible state. Admin opens private evidence and records a resolution. Refund UI shows payment returned to the brand in simulation. |
| Reporting | Show `Below target` with sample data and `Insufficient data` with missing observation. Show `Released` on the same deal when appropriate. A provisional result stays visibly provisional. |
| Responsive and accessible | Creator can finish the full flow on mobile. Focus moves to dialog headings or inline errors and returns after closing. Cards, tables, media, and dialogs remain usable via keyboard. |

**Demo walkthrough:** Import an opted-in keyboard creator through You.com. Show one specific source on their card. Create a quiet-keyboard campaign, confirm the editable brief, and select the creator because they publish sound tests. Send a $250 offer, counter at $300, accept, and approve one of two drafts. Publish the URL, confirm as both parties, and show simulated release. Open the clearly labeled sample campaign report to show how 420 clicks against a 600-click target appears. A prepared disputed deal can demonstrate refund without interrupting the happy path.
