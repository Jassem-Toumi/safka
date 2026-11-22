# Frontend plan

Fable's plan (2026-11-22), approved by Zach the same day, with his decisions
below. The specs win where this disagrees:
`Creator_Sponsorship_Backend_Spec-final.md` (§7 contract, §8 frontend changes,
§9 demo) and `Creator_Sponsorship_Frontend_Spec.md` (the design brief).

## Zach's decisions (2026-11-22)

- Execution: Step 0 (shared pieces) first, then tracks A, B, C in parallel.
- The shell's session button says **Switch account** (it returns to the demo
  picker).
- **Send offer** opens the composer **inline under the match card**, keeping the
  match reasons in view.
- Creator avatars: an illustrated avatar from DiceBear
  (`https://api.dicebear.com/9.x/notionists-neutral/svg?seed=<creator id>`,
  free, no key), with initials in a circle as the fallback when it fails to
  load.
- Defaults Fable proposed, taken: the report reads "420 / 600 clicks" (no
  "tracked"); the publication attestation reads "I used the approved draft and
  followed the offer requirements"; the demo shows the sample You.com run unless
  an opted-in handle is supplied; closed deals show their outcome only.

## Step 0: shared pieces (lands first)

| File                                                                            | Minimum                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/(app)/layout.tsx`, `src/lib/ui/AppShell.tsx`, `src/lib/ui/me.tsx`      | Client shell: `getMe()`; AUTH_REQUIRED → `/sign-in?returnTo=…`; wrong-role path → `homePathFor(me)`; `useMe()` context; role nav (Brand: Creators, Campaigns, Deals, Products; Creator: Inbox, Profile; Admin: Disputes); display name; **Switch account** (`signOut()` then `router.replace("/sign-in")`, never a hard navigation). |
| `src/lib/ui/useLoad.ts`                                                         | `useLoad(fn, deps, { refetchOnFocus? })` → `{ status, data, error, reload }` with a cancel guard.                                                                                                                                                                                                                                    |
| `src/lib/ui/Chips.tsx`                                                          | `StatusChip`, `PaymentChip` (always shows "Simulated payment"), `OriginLabel`.                                                                                                                                                                                                                                                       |
| `src/lib/ui/Evidence.tsx`                                                       | `EvidenceRow`: title as external link (`target="_blank" rel="noopener noreferrer"`), excerpt, "Found on" date, origin label.                                                                                                                                                                                                         |
| `src/lib/ui/BudgetBar.tsx`                                                      | Total, committed, spent, remaining, help "Agreed deals reserve budget"; nothing for null.                                                                                                                                                                                                                                            |
| `src/lib/ui/ConfirmDialog.tsx`                                                  | Native `<dialog>` + `showModal()`, heading, body, Confirm/Cancel, busy state.                                                                                                                                                                                                                                                        |
| `src/lib/ui/Avatar.tsx`, `src/lib/ui/CreatorCardView.tsx`                       | Avatar per decision above. Card: name, bio, topics/formats with origin labels, rate or "Rate not provided", "Typical 7-day views · Creator reported", public metrics with source, expected clicks "Unavailable" or labeled sample range, "Sample data" badge for SAMPLE, actions slot. Never "verified".                             |
| `src/lib/ui/form.tsx`                                                           | `Field`, `Button` (busy/disabled), `ErrorNote` (`role="alert"`).                                                                                                                                                                                                                                                                     |
| `src/lib/deals.ts`, `src/lib/labels.ts`, `src/lib/dates.ts`, `src/lib/lists.ts` | Pure helpers with tests in `tests/frontend/`.                                                                                                                                                                                                                                                                                        |
| `src/lib/api/fixtures/index.ts`                                                 | Add `POST /campaigns`, `PATCH /campaigns/:id`, `POST /products`, `PATCH /products/:id`, `GET /deals/:id/report`; `POST /deals` tolerates unknown creator IDs (live directory IDs are profile IDs).                                                                                                                                   |

## Tracks (after Step 0; disjoint folders)

- **A, deals and admin:** `(app)/brand/deals`, `(app)/creator/inbox` (shared
  `deals/_parts/DealList.tsx`), `(app)/deals/[id]` (header, terms, action panel
  for every action, draft uploader and viewer, publication, dispute, timeline),
  `(app)/admin/disputes` and `[id]` (reuses `deals/_parts`). Cut if late: report
  issue, withdraw, deal report panel, batch history.
- **B, brand:** `(app)/brand/creators` directory, `(app)/brand/campaigns/new`
  builder (generate brief, manual path, confirm → matches),
  `(app)/brand/campaigns/[id]` (`?tab=brief|matches|deals|report`), inline
  `OfferComposer`. Cut if late: campaign list, creator detail + direct offer,
  directory filters, products.
- **C, creator:** shared `ProfileEditor` for `(app)/creator/onboarding` and
  `(app)/creator/profile` (save with `expectedVersion`, one enrichment call with
  "Searching with You.com", evidence selection, suggestions, listing blockers,
  publish). Cut if late: brand preview, hide profile.

Rules for every track: only your folders plus your own `src/lib/<name>.ts` and
`tests/frontend/<name>.test.ts`; route changes to shared files through the lead;
don't commit (the lead commits path-scoped).

## Risks to remember

- Fixture state is per-tab memory: until backend deals ship, the two-role demo
  works in one tab via Switch account; never `window.location`.
- Fixture deals have `budget: null`; hide the remaining-budget line when null.
- Admin can't open `/deals/[id]` (`routing.ts`); the dispute detail renders the
  deal inline.
- Client pages: use `useParams()`/`useSearchParams()` (Next 16 page props are
  Promises); one `<Suspense>` in the shell covers `useSearchParams`.
- Contract traps: `IsoDateTime` needs `Z`; `Cents` ≤ 10,000,000; profile formats
  ≤ 4; `confirm: true` needs a full brief with an objective; `attested: true`;
  distinct `uploadIds`.
- Omitted on purpose (no contract field): media kit, thumbnails from data,
  tracked links, view entry, notes, notifications, PARTIAL/STALE enrichment.
- Seeded drafts have no media yet; the player needs a "can't play this file"
  state.
