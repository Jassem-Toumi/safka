Project: Safka, a creator sponsorship marketplace

Target release: Hackathon MVP (v0.1)

**Project objectives:**

- **Purpose:** Build a marketplace where a small brand can turn a campaign idea
  into a published YouTube sponsorship, and where a creator can set up a profile
  once and then handle offers, drafts, and approvals from one deal inbox.
- **Background:** Small brands find it hard to tell which creators actually fit
  their product. Follower counts and self-reported numbers are easy to find, but
  they don't show whether a creator makes the kind of content the brand needs.
  After a match is found, the deal itself (negotiation, draft review,
  publication, and payment) usually runs through scattered emails and DMs, with
  no shared record of what was agreed. Creators, in turn, repeat the same pitch
  and media-kit details for every brand that contacts them.
- **Strategic context:** Safka ranks creators by content fit first and reach
  second, so a highly relevant small creator can rank above an unrelated large
  one. Each fit claim links to public evidence that You.com finds live and the
  creator approves before publishing their profile. An AI-drafted campaign brief
  and an optional suggested video angle help a brand without much marketing
  experience brief a creator well. The whole deal runs in one structured
  workflow, with a budget cap and a simulated payment hold so both sides can
  trust the process. For the hackathon, the demo focuses on one niche
  (mechanical keyboards and desk accessories) and must show a live You.com call
  from inside the app.

**Feature requirements:**

- **Creator onboarding and evidence:** The creator adds a public YouTube handle
  or URL and an optional media kit. You.com enrichment suggests topics, formats,
  and public metrics, each with a source link and excerpt. The creator reviews
  the suggestions, sets rates, previews their card, and explicitly publishes
  (`DRAFT` / `LISTED` / `HIDDEN`).
- **Private creator directory:** Signed-in brands can browse listed creators,
  filter by text, topic, and format, open a profile with labeled data sources,
  and send a direct offer.
- **AI-assisted campaigns:** The brand picks a product, writes a plain-language
  prompt, and gets an editable AI-generated brief (goal, objective, topics,
  formats, talking points, restrictions). The brand enters and confirms the
  total budget and optional 7-day view and click targets themselves. A manual
  entry path is always available.
- **Deterministic matching:** Creators are ranked by topic match, then format
  match, rate fit, creator-reported reach, and finally creator ID as a
  tie-break. Each match shows "Why this creator" reasons with source links and
  an on-demand "Suggested video angle."
- **Offers and negotiation:** One YouTube post per deal. The brand sends an
  offer covering price, format, brief, disclosure instructions, deadlines, and
  optional targets. The recipient can accept, decline, or counter on amount,
  dates, and angle. Proposals expire after 7 days.
- **Draft review and delivery:** The creator uploads one or two MP4 drafts per
  round, with up to three rounds. The brand approves one draft or requests
  changes. The creator submits the live URL with an attestation, and both
  parties confirm delivery.
- **Simulated payments and budget cap:** Approving a draft moves the payment to
  `Held`, and the second delivery confirmation moves it to `Released`. A dispute
  can end in a refund instead. Agreed deals reserve campaign budget, and
  concurrent acceptances can never exceed the cap. Every payment is labeled
  "Simulated payment," and no money moves.
- **Disputes:** Either party can report a delivery issue (missed deadline,
  content mismatch, missing disclosure, invalid publication, unresponsive
  party). An admin reviews the evidence and resumes, cancels, releases, or
  refunds, with a recorded reason.
- **Reporting:** The campaign report shows real budget and deal counts, plus one clearly labeled sample report of 7-day views and clicks against targets. Live click tracking and view collection are not in this build. Results are labeled with a status (`No target`, `Measuring`,
  `Insufficient data`, `Target met`, `Below target`). Performance never affects
  deal state or payment.
- **Inbox:** A deal inbox ordered by what needs action, and a timeline on every deal. No email or push notifications in this build.

**User personas:**

- **Priya Nair, founder of a small keyboard accessories brand.** She has a $600
  budget for her new quiet mechanical keyboard and no agency. She wants to find
  creators whose audience will actually care, understand why each one fits, and
  run the deal without chasing emails.
- **Marcus Lee, a mid-size YouTube creator who makes keyboard sound tests and
  build videos.** He wants sponsors who match his content, a profile he sets up
  once, and a clear inbox where he can counter offers, share draft cuts, and get
  paid on delivery, all from his phone.
- **Sam Ortiz, platform admin.** Sam reviews disputed deals and needs the agreed
  terms, drafts, publication link, and timeline in one place to make a fair,
  recorded decision.

**Release criteria:**

- **Sponsor demo:** A creator submits a real, opted-in handle, the app (running locally) calls You.com live, the creator accepts a sourced claim, and the brand sees that
  claim cited on a campaign match. If the search fails, the creator can still tag their profile by hand; a failed live search is never quietly replaced with sample data.
- **End-to-end deal:** The full demo script runs from a clean seeded session.
  The brand creates a $600 campaign and sends a $250 offer, the creator counters
  at $300, the brand accepts, the brand approves one of two drafts (`Held`), the
  creator submits the live link, and both parties confirm (`Released`).
- **Budget integrity:** With $500 remaining, only one of two simultaneous $300
  acceptances succeeds. Retries are idempotent. Refunds and cancellations free
  the exact amount reserved.
- **Disputes:** A disputed deal pauses participant actions, and the admin can
  resume, cancel, release, or refund it with an audit trail.
- **Reporting:** The labeled sample report shows "420 / 600 tracked clicks · 30% below
  target." Missing data shows "Insufficient data," never zero.
- **Trust and labeling:** Sample data, creator-provided data, cached public
  evidence, and simulated payments are labeled next to the values they describe.
  Creators are never shown as "verified" based on public enrichment.
- **Security:** Cross-account access, role escalation, forged state transitions,
  and tampered uploads are all rejected by the API.
- **Mobile and accessibility:** A creator can complete the whole flow on a
  phone. Dialogs, forms, media, and tables work with a keyboard and have visible
  focus.

**Out of scope (future):**

- Real payment processing, payouts, and money movement
- Social OAuth, automatic posting, and automatic view collection
- Platforms other than YouTube
- Team seats, shipping and inventory, and automated payout decisions
- Deployment: the build runs on one machine at http://127.0.0.1:3000, with a SQLite file and local video storage
- Sign-up, passwords and email: a demo account picker stands in for sign-in
- Live click tracking and view collection
