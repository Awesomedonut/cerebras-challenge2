# Design Notes

Notes I wrote before building to organize my thinking. The commit history tells the execution story; this captures the reasoning behind it.

## Approach

The spec values judgment over feature count, so I planned around the six evaluation criteria before writing code:

1. **Scan UX** -- design for gloves, cold dock, one hand. Two scan paths: USB scanner on desktop (types into focused input), phone camera on mobile.
2. **Reconciliation** -- categorize disagreements by severity, not just diff. Three tiers: action required, needs review, expected.
3. **Manager view** -- sort by most recently updated (standup in 60 seconds), state-count summary bar for quick triage.
4. **Code judgment** -- extract shared components where duplicated 3+ times, keep scan page reducers separate (each workflow diverges).
5. **Subtraction** -- no offline mode, no bulk ops, no RMA UI, no retry logic. Each named in README with reasoning.
6. **Communication** -- phase-numbered commits, README with trade-offs and pushback, microcopy that tells the user what to do.

## Phases

1. **Design system + shared components** -- Tailwind tokens, UI primitives (Button, Card, StatusBadge, Alert, EmptyState), ScanInput with camera toggle, EventTimeline, CameraScanner modal.
2. **Scan workflows** -- Receive (scan-tag-first, then metadata form), Store, Deploy (with location validation), Transfer (two-sided custody handoff). Server-side route handlers for deploy/store write-backs.
3. **Manager dashboard** -- Asset list with filters, sorting, pagination. Asset detail with event timeline. Server Component for fast initial load.
4. **Three-way reconciliation** -- Server-side join across ops, facilities, and finance. Tiered classification with recommended next steps per category.
5. **Barcode page** -- Code 128 barcodes covering every planted drift case, location strings, and badge IDs. Printable.
6. **Polish** -- Refactored shared components, added reconciliation tests, scan UX improvements (large success indicators, haptic feedback, error recovery that preserves context), desktop scanner hint microcopy, camera permission handling, README.

## Key decisions

**Write-backs live server-side.** Deploy and store scans orchestrate writes to facilities and finance through Next.js route handlers. The token never reaches the browser. Receive and transfer use the existing proxy since they have no write-backs.

**Write-back failures surface as warnings.** If deploy succeeds but the facilities write fails, the tech sees a warning rather than silent drift or a false failure. The deploy itself worked; the secondary sync didn't.

**Receive is scan-tag-first, then form.** The alternative was one screen with all fields. Split approach catches duplicates and serial conflicts before the tech fills five fields, matching the physical flow: pick up instrument, scan label, then check paperwork.

**Client-side pagination at 25/page.** The API returns all ~1,000 assets with no pagination params. A single fetch is fast, and client-side filtering/sorting are instant after load.

**5-segment location format.** `site/room/row/rack/ru` with empty segments for nulls. Consistent across barcodes, the location parser, and the facilities API comparison in reconciliation.

## Reconciliation categories

Each category tells the manager what's wrong and what to do about it.

**Action required:**
- Location drift -- ops and facilities disagree on rack position (C0000110: U18 vs U16)
- Disposed but capitalized -- finance hasn't retired it (C0000109)
- Ghost in facilities -- tag exists in facilities but not in ops (C0000199)
- Finance orphan -- tag in finance but not in ops (C0000113)

**Needs review:**
- Stale facilities -- asset no longer in service but still racked (C0000108, C0000109)
- Missing from finance -- asset in ops with no finance record (C0000107)
- Stale observation -- facilities record not observed in 90+ days vs peers (C0000111)

**Expected:**
- Not in facilities by scope -- stored/received/RMA/disposed assets correctly absent (~304 assets, shown as count only)
