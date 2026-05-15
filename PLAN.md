# Cerebras Asset Tracking Challenge -- Implementation Plan

## Context
Build a frontend for an asset tracking system used by a multi-site research lab. Pre-built Fastify/SQLite API with ~1012 seeded assets (12 hand-crafted with planted drift, ~1000 procedural clean). We build the Next.js (App Router) + TypeScript + Tailwind UX on top, with an Apple-inspired design system for visual polish.

**Deliverables:** Deployed URL (Vercel), GitHub repo link, 3-5 min Loom, README.

---

## Phase 0: Design System + Shared Infrastructure

### 0A. Tailwind Config (`starter/tailwind.config.ts`)
Extend with Apple tokens:
- Colors: `canvas #fff`, `parchment #f5f5f7`, `action #0066cc`, `focus-blue #0071e3`, `headline #1d1d1f`, `muted #7a7a7a`, `tile-dark #272729`, `border #e0e0e0`
- Border radius: `card 18px`, `pill 9999px`
- Font family: SF Pro Display/Text system stack fallback
- Typography scale: body 17px, caption 14px, tagline 21px, display 34/40px

### 0B. Global Styles (`starter/app/globals.css`)
- SF Pro system font stack
- Body 17px base
- Utility classes: `.btn-primary`, `.btn-secondary`, `.card`
- Print styles for barcode page

### 0C. Layout (`starter/app/layout.tsx`)
- Sticky nav with `backdrop-blur-xl bg-white/80`
- Role-aware nav links (tech vs manager)
- Restyled RoleSwitcher
- `max-w-[980px]` content area, `bg-parchment` body

### 0D. Shared UI Components (`starter/components/ui/`)

| Component | Purpose |
|---|---|
| `Button.tsx` | Primary (pill, blue) + secondary (outline). 44px min-h, `active:scale-[0.95]`, loading state |
| `Card.tsx` | 1px border, 18px radius, white bg |
| `StatusBadge.tsx` | Color-coded pill per AssetState (green=in_service, blue=stored, amber=received, orange=rma, red=disposed, gray=unreceived) |
| `LocationDisplay.tsx` | Renders Location as `site / room / rack / ru`, skips nulls |
| `Alert.tsx` | Success/error/warning banners, dismissible, does NOT steal focus from scan input |
| `EmptyState.tsx` | Icon + headline + description for zero-result states |
| `Spinner.tsx` | Full-page and inline loading spinner |

### 0E. Enhanced ScanInput (`starter/components/ScanInput.tsx`)
- Restyle with Apple tokens (17px, action-blue focus ring)
- Add camera toggle button (44px) for mobile barcode scanning

### 0F. Camera Scanner (`starter/components/CameraScanner.tsx`)
- Full-screen modal using `html5-qrcode`
- Rear camera, vibrate on decode, clean unmount
- Camera permission denied error state

### 0G. Event Timeline (`starter/components/EventTimeline.tsx`)
- Vertical timeline for Event[] (newest first, matching API order)
- Shows: event type, timestamp, state transition, location, user

### 0H. Dependencies
Add to `starter/package.json`:
- `html5-qrcode` (camera scanning)
- `jsbarcode` (barcode generation)

---

## Phase 1: Scan Workflows -- `/tech/*`

### Shared Utilities

**`starter/lib/parse-location.ts`** -- Location string parser
- `parseLocation("Lab-Building-A/Bay-12/Aisle-3/B-04/P-02")` -> `{ site, room, row, rack, ru }`
- 5-segment slash format, empty segments -> null
- `formatLocation(loc)` -> human-readable with ` / ` separator
- `toRackLocationString(loc)` -> slash-joined for facilities API
- `isDeployComplete(loc)` -> validates site + room + rack + ru present

### Server-Side Scan Routes

Deploy and store need server-side route handlers for write-back orchestration (token stays server-side, same security argument as reconcile route). Receive and transfer have no write-backs, so they use the existing `/api/upstream` proxy directly -- no extra route surface needed.

**`starter/app/api/scans/deploy/route.ts`** -- POST handler:
1. Call `api.scans.deploy(body)`
2. On success, fire in parallel:
   - `api.mock.updateFacilities({ tagged_id, rack_location })` -- rack_location = `site/room/row/rack/ru`
   - `api.mock.updateFinance({ tag, status: "capitalized", site, capitalized_on })` -- capitalize the asset
3. If write-back fails: still return the asset, but include a `sync_warnings` array in the response so the UI can surface "Asset deployed, but facilities/finance sync failed -- run reconciliation to verify."
4. On deploy API error, forward the error.

**`starter/app/api/scans/store/route.ts`** -- POST handler:
1. GET asset first to check current state
2. Call `api.scans.store(body)`
3. If was `in_service` -> `api.mock.updateFacilities({ tagged_id, rack_location: null })` -- de-rack
4. If was `received` -> no write-back (store-from-received leaves facilities/finance untouched per spec)
5. Same `sync_warnings` pattern on write-back failure.
6. Return asset.

### Scan Pages

All scan pages must include `user_id` (from `getCurrentUserId()`) and `scan_payload` (raw scanned string) in every API call. Each uses a step-based `useReducer`.

**`/tech/receive`** -- Most complex (requires full asset metadata). Uses existing `/api/upstream` proxy (no write-back needed):
1. `scan_tag` -> scan/type asset tag, validate format client-side (`/^C\d{7}$/`)
2. `fill_details` -> form with ALL required fields:
   - `serial` (text, required)
   - `model` (text, required)
   - `manufacturer` (text, required)
   - `asset_class` (select: instrument/compute/network/power/consumable_durable)
   - Location: either scan a location barcode OR fill fields (site required; room, row, rack, ru optional). Receiving dock example: `{ site: "Lab-Building-A", room: "Receiving", rack: "DOCK-2" }`
   - `user_id` auto-filled from `getCurrentUserId()`
   - `scan_payload` auto-filled with the raw scanned tag
3. `submitting` -> call API
4. `success` -> green alert, "Scan another" button
5. Error handling per API code:
   - `and_match_failed` (409): show BOTH serials -- "Tag C0009001 already exists with serial SN-INST-A001 but you scanned serial SN-DEMO-1"
   - `invalid_tag_format` (400): "Invalid tag format. Expected C followed by 7 digits."
   - Duplicate receive (200, same tag + same serial): treat as success with note "Already received -- duplicate scan logged"

**`/tech/store`** -- Uses custom `/api/scans/store` route (write-back):
1. `scan_tag` -> fetch asset via `/api/upstream`, show info card (tag, serial, model, current state badge, current location, custodian)
2. If state not `received` or `in_service`: show error "Cannot store -- asset is {state}"
3. `scan_location` -> scan/type location barcode, parse via `parseLocation()`
4. `submitting` -> call `/api/scans/store` with `{ asset_tag, location, user_id, scan_payload }`
5. `success` -> show result, surface any `sync_warnings` if write-back failed
6. `error` -> handle `invalid_transition`, `unknown_asset`

**`/tech/deploy`** -- Uses custom `/api/scans/deploy` route (write-back):
1. `scan_tag` -> fetch asset, show info card
2. If state not `received` or `stored`: show error "Cannot deploy -- asset is {state}"
3. `scan_location` -> parse + validate all 4 required fields (site, room, rack, ru). If missing: "Deploy needs a complete rack location. Missing: {fields}"
4. `submitting` -> call `/api/scans/deploy` with `{ asset_tag, location, user_id, scan_payload }`
5. `success` -> show result, surface any `sync_warnings`
6. `error` -> handle `incomplete_deploy_location`, `invalid_transition`

**`/tech/transfer`** -- Uses existing `/api/upstream` proxy (no write-back):
1. `scan_tag` -> fetch asset, show info card with current custodian prominently
2. If state is `disposed` or `unreceived`: show error "Cannot transfer -- asset is {state}"
3. `scan_badge` -> scan receiving party's badge (user ID like `tech-mike`, `manager-paul`)
4. Client-side check: badge != current custodian (avoid `same_custodian` error)
5. `submitting` -> call API with `{ asset_tag, to_custodian, user_id, scan_payload }`
6. `success`: "Custody of C0009001 transferred from tech-jane to tech-mike"
7. `error`: handle `same_custodian`, `invalid_transition`

**`/tech` Landing**: Four large touch-friendly cards (full width mobile, 2x2 desktop) linking to each workflow. Each card: icon, name, one-line description. Min 44px touch target.

---

## Phase 2: Manager Dashboard -- `/manager/*`

### `/manager` -- Asset List (`starter/app/manager/page.tsx`)
- Client component, fetch all ~1000 assets on mount
- **Filters** (sticky bar with backdrop blur): state dropdown, site dropdown, custodian text search, clear button
- **Client-side pagination**: 25/page, prev/next pills, "Showing X-Y of Z"
- **Table** (desktop >=768px): Tag (link to detail), Serial, Model, State (badge), Site, Custodian, Updated
- **Card list** (mobile <768px): condensed info per asset
- Sortable columns (tag, state, updated)
- Empty state when filters match nothing: "No assets match your filters"
- Loading state while fetching

### `/manager/assets/[tag]` -- Asset Detail (`starter/app/manager/assets/[tag]/page.tsx`)
- Server Component (RSC) -- fetch on server for fast load
- **Top section**: asset info card
  - Tag (large headline), State badge
  - Serial, Model, Manufacturer, Asset class
  - Location (formatted with LocationDisplay)
  - Custodian
  - Created / Updated timestamps
  - Procurement note (if present, in a subtle callout -- not all assets have one)
- **Bottom section**: EventTimeline component (events come newest-first from API)
- 404 handling: "Asset not found" with link back to list

### `/manager/reconcile` -- Reconciliation Page (`starter/app/manager/reconcile/page.tsx`)
- Client component, fetches from `/api/reconcile`
- Summary cards at top: count per category, color-coded by severity
- Expandable sections per category with affected assets table
- Each row links to asset detail page
- Categories ordered: action required -> needs review -> expected/explained
- Written for a non-technical asset manager who runs this every Monday

---

## Phase 3: Reconciliation Logic

### `starter/app/api/reconcile/route.ts`

**Algorithm:**
1. Fetch ops, facilities, finance in parallel via `api.assets.list()`, `api.mock.facilities()`, `api.mock.finance()`
2. Build maps: `opsMap<tag, Asset>`, `facMap<tagged_id, FacilitiesRecord>`, `finMap<tag, FinanceRecord>`
3. Collect all unique tags across all three systems
4. For each tag, classify into categories (an asset can appear in multiple):

**Action Required** (real problems a manager should investigate):

| Category | Condition | Seeded examples |
|---|---|---|
| `location_drift` | In ops (in_service) AND in facilities, locations differ | C0000110 (ops U18 vs fac U16) |
| `disposed_but_capitalized` | Ops=disposed, finance=capitalized (should be retired) | C0000109 |
| `ghost_in_facilities` | Tag in facilities but NOT in ops at all | C0000199 |
| `finance_orphan` | Tag in finance but NOT in ops at all | C0000113 (pending_receipt) |

**Needs Review** (ambiguous -- could be a real problem or a timing lag):

| Category | Condition | Seeded examples |
|---|---|---|
| `stale_facilities` | Ops NOT in_service, but still appears in facilities | C0000108 (rma_pending, still racked), C0000109 (disposed, still racked) |
| `missing_from_finance` | In ops but NOT in finance | C0000107 (received, no finance record) |
| `stale_observation` | In facilities with `last_observed` significantly older than peers | C0000111 (Nov 2025 vs May 2026 for others) |

**Expected / Explained** (not problems -- different system scopes):

| Category | Condition | Seeded examples |
|---|---|---|
| `not_in_facilities_by_scope` | Asset not in_service (stored/received/rma/disposed) and correctly absent from facilities | C0000104, C0000105, C0000112, plus ~300 procedural |

5. Return structured JSON:
```
{
  generated_at: string,
  summary: { [category]: count },
  action_required: { location_drift: [...], disposed_but_capitalized: [...], ghost_in_facilities: [...], finance_orphan: [...] },
  needs_review: { stale_facilities: [...], missing_from_finance: [...], stale_observation: [...] },
  expected: { not_in_facilities_by_scope: { count: number } }
}
```

The `expected` bucket shows a count only (not individual rows) -- a manager needs to know the system is aware of these, but doesn't need to scroll through 300 expected absences.

---

## Phase 4: Barcode Page

### `starter/app/dev/barcodes/page.tsx`
- Uses `JsBarcode` to render Code 128 into SVGs
- **Asset tags** (covering every interesting case):
  - C0000101 (clean, in_service -- baseline)
  - C0000107 (received, missing from finance)
  - C0000108 (rma_pending, stale in facilities)
  - C0000109 (disposed, ghost in facilities + still capitalized)
  - C0000110 (in_service, location drift)
  - C0000111 (in_service, stale observation)
  - C0000199 (ghost -- exists in facilities only)
  - C0009001 (fresh tag for happy-path testing)
- **Location barcodes**:
  - `Lab-Building-A/Bay-12/Aisle-3/B-04/P-02` (full deploy location)
  - `Lab-Building-A/Storage-1//SHELF-3/` (storage -- no row, no ru)
  - `Lab-Building-B/Computing-1/Aisle-1/C-12/U18` (deploy location)
  - `Lab-Building-A/Receiving//DOCK-2/` (receiving dock)
- **Badge barcodes** (for transfer):
  - `tech-jane`, `tech-mike`, `tech-carlos`, `tech-priya`, `manager-paul`
- Print button with `@media print` CSS hiding header/nav

---

## Phase 5: Polish + README + Loom

### Error & Edge Case Handling
- Empty states on every list/table/timeline (zero results, zero events)
- Error states for API unreachable / 429 rate limit
- Mobile responsive pass on all scan pages (375px viewport)
- Loading states on all data-fetching pages
- What happens when a tech scans the wrong thing twice in a row -- clear recovery path

### README (`starter/README.md` or repo root)
Required sections per spec:
- **"Three calls I nearly made the other way"** -- three design decisions with reasoning
- **Pushback** -- any bugs, inconsistencies, or confusing claims found in the brief or starter
- **Write-back architecture** -- explain why writes live in server-side route handlers (token security, same argument as reconcile route)
- **What I chose not to build** -- subtraction decisions with reasoning
- **How to run** -- setup instructions, env vars

### Loom (3-5 min)
Per spec, must cover:
- What was built (walkthrough of scan workflows + manager views + reconciliation)
- **One call nearly made the other way** -- a design decision explained
- **One piece of microcopy** -- an empty state, error message, or column header, and why it's worded that way

---

## Key Architecture Decisions

1. **Write-backs live in server-side route handlers** -- Token never reaches browser. Deploy/store routes orchestrate the upstream API call + facilities/finance writes. Per spec: "same token-security argument as the reconcile route." Write-back failures surface warnings to the user, not silently swallowed.

2. **Receive/transfer use existing `/api/upstream` proxy** -- No write-backs needed, so no custom routes. Avoids unnecessary surface area.

3. **Client-side pagination** -- API returns all ~1000 assets with no pagination params. Paginate + filter client-side for instant response. 25 per page keeps rendering fast.

4. **`html5-qrcode` for camera scanning** -- Simpler API than `@zxing/browser`, built-in viewfinder, easier mount/unmount lifecycle.

5. **5-segment location format** -- `site/room/row/rack/ru` with empty segments for nulls. Consistent across barcodes, parsing, and facilities API comparison.

6. **No shared scan reducer** -- Each scan page has its own step-based useReducer. Same shape, different steps. Keeps each page self-contained and readable.

7. **Three-tier reconciliation categories** -- Action required / Needs review / Expected. Not just a diff report -- each category has a clear label a non-technical manager can act on.

---

## New File Tree

```
starter/
  components/
    ui/Button.tsx, Card.tsx, StatusBadge.tsx, LocationDisplay.tsx,
       Alert.tsx, EmptyState.tsx, Spinner.tsx         (CREATE)
    CameraScanner.tsx                                  (CREATE)
    EventTimeline.tsx                                  (CREATE)
    ScanInput.tsx                                      (MODIFY)
    RoleSwitcher.tsx                                   (MODIFY)
  lib/
    parse-location.ts                                  (CREATE)
    scan-client.ts                                     (CREATE - deploy/store only)
  app/
    globals.css, layout.tsx, page.tsx                   (MODIFY)
    api/scans/{deploy,store}/route.ts                  (CREATE - write-back routes only)
    api/reconcile/route.ts                             (MODIFY)
    tech/{page,receive/page,store/page,deploy/page,transfer/page}.tsx  (MODIFY)
    manager/{page,assets/[tag]/page,reconcile/page}.tsx               (MODIFY)
    dev/barcodes/page.tsx                              (CREATE)
  tailwind.config.ts                                   (MODIFY)
```

---

## Verification

1. `pnpm dev` -- both API (:8080) and starter (:3000) run
2. Run the 11-step happy path from `starter/docs/happy-path.md`
3. Reconciliation catches ALL planted drift: C0000107 (missing finance), C0000108 (stale fac), C0000109 (disposed+capitalized, stale fac), C0000110 (location drift), C0000111 (stale observation), C0000199 (ghost fac), C0000113 (finance orphan), plus the expected-scope absences for stored/received assets
4. Deploy write-back verified: deploy an asset, then check reconcile page -- it should NOT show as drift
5. Test camera scanner on mobile (or DevTools mobile emulation)
6. Print barcodes page, scan them with camera scanner
7. Test empty states: filter to zero results, view asset with one event
8. Test error states: scan invalid tag, deploy without ru, transfer to same custodian, scan wrong thing twice
9. `pnpm typecheck && pnpm test && pnpm lint`
