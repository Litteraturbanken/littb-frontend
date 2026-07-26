# Nuxt Library advanced-search parity design

Status: auto-approved under the active AngularJS-to-Nuxt migration goal.

## Goal

Restore the existing `/bibliotek` advanced-search workflow without changing its appearance: the show/hide control, author gender, category/publisher keywords, about-author collections, narrowing collections, media formats, language/status filters, and the interactive imprint-year interval.

## State and navigation

All model/fetch code stays in `bibliotek.vue`. The URL is the durable source of truth and keeps Angular's keys: `avancerat`, `kön`, `keywords`, `keywords_aux`, `about_authors`, `mediatypes`, `languages`, and `intervall`. Multi-values are comma-separated exactly as in Angular. A control commit resets `sida` to 1 and uses `router.push`; Back and Forward must restore controls, request, results, and counts. Merely opening or closing the advanced panel changes only `avancerat` and does not refetch.

The current route-request identity must include every data-affecting advanced key. Requests use the same query-string predicate semantics as Angular's `buildFilterQuery`/`composeQuery`: OR within ordinary multi-value facets, narrowing keyword values as AND clauses, and a bounded imprint-date range. Unknown/malformed values are preserved as unrelated query bytes but never executed as filter expressions.

## Components and visuals

Reuse the legacy DOM classes and current Library layout. Native labelled select controls are acceptable while the old Select2 replacement is absent; multi-selects must remain keyboard operable. The chronology uses two labelled native range inputs plus the existing `.rzslider` visual geometry, with local preview and one route commit at interaction end. From must never exceed To. The default full range is omitted from the URL/request.

No new composable or global store is introduced. Headless UI is only needed if a custom disclosure/dropdown is required; a native disclosure button and selects are preferable because they preserve current visuals and accessibility with less code.

## Failure and safety

Advanced filters use the existing abort/latest-request ownership. Malformed ranges or unsupported facet values fall back to the unfiltered default rather than being interpolated into backend query syntax. Existing core browse, sort, paging, `/epub`, and visual behavior must remain green.

## Closure proof

- Desktop and mobile behavior tests covering disclosure, representative values from every facet family, chronology pointer/keyboard commits, exact URL/request predicate, reset, reload, and Back/Forward.
- SSR test for an advanced URL and escaped request predicate.
- Typecheck and existing Library behavior suite.
- Fresh Angular-authority desktop/mobile visual comparison before declaring the Library route complete.
