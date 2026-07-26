# Search reset and category-group parity report

## Implemented

- The reset control is omitted from the DOM for pristine `/sök` routes. As in the
  Angular implementation, `avancerad` is the only query key ignored by the
  pristine check; repeated `avancerad` values remain pristine, while unknown
  keys make reset available.
- Reset uses one Nuxt Router push to bare `/sök`, clears known, unknown, and
  repeated query entries, hides the control, and restores focus to `Sökfras`
  after navigation without reloading.
- The existing `SearchMultiSelect` now receives four grouped option collections
  in legacy order: `Kategorier`, `Projekt`, `Avdelningar`, `Utgivare`.
  Existing option order, disabled rows, selected chips, canonical serialization,
  unrelated/repeated query preservation during filter changes, and Escape
  behavior remain intact.

## TDD evidence

The three new focused E2E cases first failed for the expected missing behavior:

- pristine reset count was `1`, expected `0`;
- reset left `?okand=ett&okand=två` in the URL;
- the category dropdown contained zero group headings.

After the minimal implementation, the focused run passed 4/4 (including the
updated existing reset transition case).

## Verification

- `text-search.behavior.spec.ts`, desktop Chromium: **49 passed**
- `text-search.spec.ts`, SSR: **26 passed**
- `text-search.spec.ts` + `search-multi-select.spec.ts`, Vitest: **90 passed**
- `yarn typecheck`: passed
- `git diff --check`: passed

The first SSR invocation used a non-default fixture port, but that spec has a
fixed `4100` fixture URL and consequently failed setup with `ECONNREFUSED` only.
It was rerun with the expected fixture port and all 26 tests passed.
