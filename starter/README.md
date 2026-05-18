# Asset Tracking

A frontend for a multi-site research lab asset tracking system. Technicians scan assets through receiving, storage, deployment, and custody transfer. Managers monitor the fleet and run three-way reconciliation across operations, facilities, and finance.

Built with Next.js 15 (App Router), TypeScript, and Tailwind CSS.

**Live demo:** https://challenge.whyjs.com
**Loom walkthrough:** https://www.loom.com/share/511d264bc7e0445887b51a235ff8b795

## Running locally

```bash
pnpm install
pnpm dev          # API on :8080, starter on :3000
```

Copy `starter/.env.example` to `starter/.env` if you don't have one. The defaults work for local development.

| Variable | Notes |
|---|---|
| `API_BASE_URL` | Upstream API including `/v1`. Default: `http://localhost:8080/v1` |
| `API_TOKEN` | Server-only bearer token. Never prefixed with `NEXT_PUBLIC_`. Browser code goes through `/api/upstream/*` which attaches it. |

```bash
pnpm test         # 26 tests
pnpm typecheck    # tsc --noEmit
```

## What I built

- **Scan workflows** (`/tech/*`) -- Receive, store, deploy, transfer. Step-based flows with asset preview between scans, large success indicators with haptic feedback, and error recovery that preserves context (bad location? rescan it without starting over).
- **Manager dashboard** (`/manager`) -- Asset list with state-count summary bar, filters (state/site/custodian), sorting, pagination at 25/page. Desktop table, mobile card view. Asset detail pages with event timeline.
- **Three-way reconciliation** (`/manager/reconcile`) -- Server-side join at `/api/reconcile` classifying every cross-system disagreement into three tiers (action required, needs review, expected) with recommended next steps for each category.
- **Write-back routes** (`/api/scans/deploy`, `/api/scans/store`) -- Deploy writes to facilities and finance. Store-from-in-service de-racks in facilities. Write-back failures surface as warnings, not silent swallows.
- **Barcode page** (`/dev/barcodes`) -- Code 128 barcodes for asset tags (covering every planted drift case), location strings, and badges. Printable.
- **Camera scanning** -- Phone camera barcode scanning via html5-qrcode, alongside standard keyboard/USB scanner input.

## Three calls I nearly made the other way

### 1. Server-side scan routes vs. browser-side write-backs

I could have fired the facilities/finance POSTs directly from the browser through the existing `/api/upstream` proxy. It would have been simpler -- no new route files, no extra abstraction. I chose dedicated server-side routes for deploy and store because the write-back logic is an orchestration concern: "if deploy succeeds, then write to facilities and finance in parallel, surface failures as warnings." Putting that in the browser means the token reaches the client, and it splits the orchestration across client and server. The reconcile route already established the pattern of keeping multi-system joins server-side for token security. Deploy and store write-backs follow the same argument.

I did *not* create server-side routes for receive and transfer. They have no write-backs, so the existing `/api/upstream` proxy handles them fine. Adding pass-through routes would have been unnecessary surface area.

### 2. Client-side pagination vs. server-side

The API returns all ~1,000 assets in one response with no pagination parameters. I paginate client-side at 25 per page. The alternative was to add server-side pagination (cursor or offset) by extending the proxy. I decided against it because: the dataset is small enough that a single fetch is fast (~200ms), client-side filtering and sorting are instant after the first load, and adding pagination to the proxy would mean either caching state on the server or re-fetching on every page change. For 1,000 rows, the simpler approach wins. If the dataset grew to 50k, I'd revisit.

### 3. Receive as scan-tag-first vs. single-screen form

I nearly put all receive fields on one screen -- tag, serial, model, manufacturer, asset class, location -- and let the tech fill everything at once. Fewer steps, faster for an experienced tech who knows the routine. I split it into scan-tag-first, then form, because: the tag scan validates format immediately before the tech types five fields, duplicate and serial-mismatch detection happens before any manual input (saving wasted effort if the tag is already in the system), and it matches the physical flow -- you pick up the instrument, scan the label on the box, then look at the paperwork. The trade-off is an extra step for every receive. But the cost of filling five fields and then discovering a serial conflict is worse than scanning one barcode first.

## Pushback on the brief and starter

### localhost vs 127.0.0.1

The `.env.example` defaults to `http://localhost:8080/v1`, but the Fastify server binds to `0.0.0.0`, which on macOS resolves `localhost` to `::1` (IPv6) first. Node's `fetch` then connects to IPv6, which the server accepts, but `curl` and some environments get connection resets. Using `127.0.0.1` is more reliable. This cost me debugging time.

### The brief says "three scan endpoints" but there are four

The "How this works" section says "three scan endpoints (receive, store, deploy)" but transfer is also a scan endpoint. It was added later (the git history shows it). The endpoint list in the API reference is correct; the overview paragraph is stale.

### Duplicate receive detection is ambiguous

When you receive a tag that already exists with the same serial, the API returns 200 with the existing asset. There's no field in the response distinguishing "this was a duplicate" from "this was new." I compare `created_at` to `updated_at` -- they differ for duplicates because the `duplicate_receive` event updates the timestamp. A `was_duplicate: boolean` field in the response would be more explicit.

### Deployment instructions are inconsistent with the challenge email

[`starter/README.md`](https://github.com/danielkim-cerebras/ai-builder-challenge/blob/main/starter/README.md) says "Edit .env with the API URL and token from your challenge email," implying a hosted API and token would be provided. The challenge email contained neither. After emailing Daniel to clarify, he confirmed candidates should deploy the API themselves.

### The `scan_payload` field's purpose is unclear

Every scan endpoint requires `scan_payload` but the brief never explains what it's for. Looking at the event log, it's stored verbatim as audit evidence. The field name suggests it's the raw scanner output, but the brief could say that explicitly. I set it to the raw scanned string in all cases.

## What I chose not to build

- **Offline mode / scan queueing.** The brief explicitly says not to. But the architecture doesn't prevent it -- scan pages are self-contained and could queue to IndexedDB.
- **Bulk operations.** No multi-select, no "store all received assets." A manager with 50 received assets would want this, but the brief says skip it and the API doesn't support batch endpoints.
- **Rate limit retry logic.** The API is rate-limited at 60 req/min. I don't retry on 429. A tech doing rapid scans could hit it, but the brief says backend hardening is out of scope. I show the error message from the API rather than silently retrying.
- **RMA workflow UI.** The state machine supports rma_open and rma_receive_back, but the brief says no UI needed. The scan page architecture (step-based reducer + ScanInput) could accommodate it without structural changes.
- **Parent-child asset relationships.** The data model has `parent_asset_tag` but no assets use it in the seed data. Building a hierarchy view without test data would be speculative.

## Architecture

```
Browser                          Server (Next.js)              API (Fastify/SQLite)
  |                                  |                              |
  |-- /tech/deploy (scan) ---------> /api/scans/deploy ----------> POST /v1/scans/deploy
  |                                  |-- (on success) -----------> POST /v1/mock/facilities/spaces
  |                                  |-- (on success) -----------> POST /v1/mock/finance/equipment
  |                                  |<-- asset + sync_warnings
  |<-- render success/warning        |
  |                                  |
  |-- /tech/receive (scan) --------> /api/upstream/scans/receive -> POST /v1/scans/receive
  |<-- render result                 |   (pass-through proxy)
  |                                  |
  |-- /manager/reconcile ----------> /api/reconcile
  |                                  |-- GET /v1/assets
  |                                  |-- GET /v1/mock/facilities/spaces
  |                                  |-- GET /v1/mock/finance/equipment
  |                                  |<-- classify + return report
  |<-- render report                 |
```

Write-backs live in server-side route handlers so the API token never reaches the browser. Same security argument as the reconcile route.

## Testing

26 tests across four suites:

- **ScanInput** (3 tests) -- fires on Enter with trimmed value, ignores empty submissions, clears input after firing.
- **Reconciliation** (10 tests) -- every drift category (location drift, disposed-but-capitalized, ghost in facilities, finance orphan, stale facilities, missing from finance, expected absences), the multi-category case (C0000109 appears in both disposed_but_capitalized and stale_facilities), and the 502 error when the API is unreachable.
- **Write-back routes** (6 tests) -- deploy writes to facilities and finance on success, surfaces sync_warnings when either fails. Store de-racks from facilities when storing an in-service asset, skips write-back for received assets, surfaces warnings on failure.
- **Location parsing** (7 tests) -- parseLocation handles full and partial segments, toRackLocationString matches the facilities seed format (contract test ensuring reconciliation comparison works), isDeployComplete validates required fields, formatLocation skips nulls.

I tested reconciliation, write-backs, and location serialization because they're the complex server-side logic where bugs hide. I did not unit-test individual scan pages because their logic is thin -- the API enforces the state machine, and the pages are mostly wiring.
