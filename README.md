# Safka: creator sponsorship marketplace (localhost prototype)

A hackathon prototype. Brands build campaigns, find YouTube creators through evidence sourced with You.com, and run
sponsorships with simulated payment. The whole app runs locally as one Next.js process with a file-backed SQLite database.
**It is never deployed.** Use it only on `http://127.0.0.1:3000`.

The authoritative backend contract is `Creator_Sponsorship_Backend_Spec-final.md`. Shared API types live in
`src/shared/contracts`, and progress notes are in `docs/backend/`.

## Setup

Requires **Node 24.16+ (24.x)** for `node:sqlite`. The repo pins 24.22.3 in `.nvmrc`.

```bash
source ~/.nvm/nvm.sh && nvm use     # or install Node 24 another way
npm install
cp .env.example .env.local          # optional; defaults work offline
npm run demo:seed
npm run dev                         # http://127.0.0.1:3000 (not localhost; see below)
```

Open the app at **`http://127.0.0.1:3000`**. The server rejects other `Host` values, including `localhost:3000`, and
cross-origin writes. Run each demo role in its own browser profile or incognito window, because tabs in one profile share
the session cookie.

## Environment (`.env.local`)

| Variable | Default | Meaning |
|---|---|---|
| `YDC_MODE` | `fixture` | `fixture`: deterministic offline "Sample data" results, with no network calls. `live`: one real You.com `you-search` call per click. |
| `YDC_API_KEY` | empty | Optional sponsor key. When set, live mode uses `https://api.you.com/mcp?tools=you-search` with a bearer token. Without it, live mode uses the keyless `https://api.you.com/mcp/free`. The key stays on the server and is never sent to the browser or written to logs. |
| `YDC_BRIEF_MODEL` | empty | Reserved for the optional AI brief mode, which is not implemented yet. Brief suggestions use `RULES` mode. |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Loopback origin used for the Host and Origin checks. Don't point it at a LAN or public address. |
| `DATABASE_PATH` | `.local/safka.db` | SQLite file. Everything under `.local/` is git-ignored. |

## Commands

| Command | What it does |
|---|---|
| `npm run demo:seed` | Creates or updates the demo data. It is idempotent and never overwrites deals that are in progress. |
| `npm run dev` | Starts `next dev` on 127.0.0.1:3000. |
| `npm test` | Runs the Vitest suite (in-memory SQLite, injected clock, no network). |
| `npm run typecheck` | Runs `tsc --noEmit`. |
| `npm run demo:reset -- --yes` | Deletes **only** the local SQLite files and `.local/uploads/`. Run `demo:seed` afterwards. |
| `npm run demo:enrich` | Runs a live You.com search for each seeded demo channel and lists the ones that have public evidence. Run it after `demo:seed` (needs `YDC_API_KEY`). |
| `npm run demo:videos` | Regenerates the two seed draft MP4s with macOS Swift/AVFoundation. |
| `npm run demo:acceptance` | Runs the spec §9 walkthrough over HTTP against a running dev server, with separate brand, creator and admin sessions. Use a freshly seeded DB; the live step needs `YDC_MODE=live`. |
| `npm run youcom:smoke` | Makes one live You.com call with a generic public query, to check connectivity. Never point it at a creator who hasn't opted in. |

## Demo accounts

Pick an account on the sign-in screen (`GET /api/v1/demo/accounts`). No passwords are involved.

| Account | Role | Notes |
|---|---|---|
| Hushkeys | Brand | Owns the Whisper 75 keyboard and the felt desk mat, a sample report campaign, and a held-dispute campaign. |
| Northwind Desks | Brand | Second brand, used to check isolation. |
| Clack Lab, Desk Setup Daily, Big Tech Mike, Thock & Type, Cozy Workspace (all "sample") | Creator | **Fictitious** listed profiles. Their evidence is `SAMPLE` data with example.com links. |
| HipyoTech, Glarses, Alexotos, TaeKeyboards ("demo channel") | Creator | Real public YouTube channels, used for the demo with approval. They aren't Safka members. They're listed only after `demo:enrich`, with live public sources and no invented rates or views. |
| Live Demo Creator | Creator | Blank draft profile, used to run live You.com enrichment with a handle whose owner has opted in. |
| Demo Admin | Admin | Resolves disputes. |

## You.com enrichment

The creator saves a channel (`@handle`, `youtube.com/@handle`, or `youtube.com/channel/UC…`) and then clicks search, which
calls `POST /api/v1/creator/enrichment`. The server makes one MCP `you-search` call with a 12-second total timeout. It keeps
up to six results whose URL or snippet contains the exact handle or channel ID, then suggests topic and format tags from a
small keyword map. A failed live search returns `FAILED` with an `errorCode` such as `TIMEOUT` or `QUOTA_EXCEEDED`. It never
substitutes fixture data. The creator picks which sources and tags to keep and then lists the profile.

## Reset

```bash
npm run demo:reset -- --yes && npm run demo:seed && npm run demo:enrich
```
