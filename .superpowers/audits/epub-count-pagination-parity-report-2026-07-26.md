# EPUB/PDF count and pagination parity — 2026-07-26

## Implemented

- Standalone `/epub` SSR fetches the active format's full page and the inactive
  format's `distinct_hits` concurrently. The inactive request reuses the exact
  legacy predicate with `from=0&to=0`, so no result rows are requested.
- Client filter and advanced chronology changes keep active rows under the full
  request while an independent abortable, identity-versioned request refreshes
  the inactive count. A failed or stale count cannot replace rows or a newer
  count identity.
- Switching EPUB/PDF tabs retains the hydrated counts but always fetches the
  selected format's rows.
- Pagination now follows the checked-in UI Bootstrap configuration exactly:
  `max-size=10`, `rotate=true`, `force-ellipses=true`, and no boundary page
  numbers. Ellipses remain links to the adjacent page window, as on Angular.

## Verification

- Unit token arrays freeze first, middle, and final windows for 17 pages.
- SSR coverage freezes both standalone counts and inactive-count failure
  isolation.
- Playwright coverage freezes debounced filter counts, advanced chronology and
  repeated keys, stale count races, tab switching, failure isolation, and the
  rendered ten-page window.
