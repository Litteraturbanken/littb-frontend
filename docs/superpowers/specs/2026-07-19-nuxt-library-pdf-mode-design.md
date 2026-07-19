# Nuxt Library PDF Mode Design

**Date:** 2026-07-19

## Goal

Restore the remaining download-only PDF result mode in the Nuxt Library without
changing its appearance. The mode must work in both legacy shells:

- `/bibliotek?visa=pdf&sort=popularitet`
- `/epub?visa=pdf&sort=popularitet`

This is a bounded continuation of the reviewed Library EPUB implementation. It
does not attempt the larger Works, Latest, Authors, Parts, advanced-filter,
chronology, or source-bundle programs.

## Authority

Angular's `library-page` is the behavioral and visual authority. PDF reuses the
same work table, four sort choices, 100-row pagination, empty/error states, and
ordinary title/author links as EPUB. The only row-level differences are:

- the title opens the work's about-book view using `faksimil` when the indexed
  document itself has media type `pdf`;
- `Hämta` points to the validated PDF export URL and carries the legacy
  download filename when one is supplied;
- the active tab and query state are `pdf`, not `epub`.

The `/bibliotek` shell keeps its Library background, heading, full tab row, and
body class. `/epub` keeps the standalone heading, background-free shell, EPUB
and PDF tabs, and `page-epub` body class even while PDF is active.

## Page-local architecture

`nuxt/app/pages/bibliotek.vue` remains the single owner of this one-page model,
matching the project's rule against one-consumer composables. Extend the
existing route-state union from `all | epub` to `all | epub | pdf`. EPUB and PDF
share the existing work-sort, pagination, cancellation, hydration, URL, and
latest-intent machinery; their response parsers stay distinct so an EPUB row
can never be mistaken for a PDF row.

The path controls only the shell. On `/bibliotek`, `visa=pdf` activates PDF. On
`/epub`, `visa=pdf` activates PDF and every other absent/unsupported `visa`
value defaults to EPUB. Interactions preserve unrelated repeated query keys,
rewrite only `visa`, `filter`, `sort`, and `sida`, reset `sida` on search/sort or
mode changes, and restore Back/Forward state with the existing version guard.

## Data boundary

Use the established private/server and public/browser Library API bases and the
existing legacy operation:

```text
GET /api/query_string/etext,faksimil,pdf
```

The request retains the reviewed EPUB exclusion/inclusion lists, partial-string
mode, suggestion flag, page bounds, and selected sort. Its predicate is:

```text
((export>type:pdf AND license:pd) OR mediatype:pdf)
```

When a sanitized free-text filter exists, combine it with that predicate using
`AND`. Do not add an inactive-tab count request or create a new composable.

The top-level envelope guard remains strict: object `data`, finite numeric
`hits`, finite numeric `distinct_hits`, and absent/null/array `suggest`. Each
PDF row must independently prove:

- safe author, title, and media-type path segments;
- display title, imprint year, and complete main-author identity;
- either a public-domain PDF export or an indexed PDF representation;
- exactly one safe same-origin `/txt/**` or HTTP(S) Litteraturbanken download
  destination;
- an optional filename that cannot inject path separators, control characters,
  or a second extension.

Malformed rows are omitted. Malformed envelopes or transport failures render
`Ett fel uppstod.`; valid empty results render `Inga träffar.`. No upstream
payload detail is exposed.

## Visual and interaction contract

Reuse the existing copied Angular SCSS and current Library class strings. Do not
change shared styles or legacy Angular files. PDF renders the existing
three-content-column plus download-column grid, desktop-hidden mobile year,
uppercase author surname and role suffix, `Hämta` action, sort strip, spinner,
and pagination. The active PDF tab must be a real anchor with `aria-current`;
EPUB remains enabled, and switching either way performs client navigation
without a full reload.

No dropdown, disclosure, or modal enters this slice, so Headless UI is not
applicable here.

## Verification

Follow TDD and freeze deterministic fixtures before implementation. Tests must
cover:

1. exact PDF fixture request predicates, page windows, success, empty,
   malformed-envelope, malformed-row, delayed, and failed responses;
2. SSR for both shells, all four sorts, invalid/default pages, safe title,
   author, and download links, filename handling, empty/error states, and
   pagination;
3. browser tab switching, debounced filtering, sort/page reset, stale-response
   rejection, Back/Forward restoration, download attributes, hydration reuse,
   and one active request per state;
4. deterministic desktop/mobile Angular PDF authority and strict Nuxt
   comparison, with all existing Library relevance and EPUB baselines unchanged;
5. focused unit/SSR/browser/visual suites, full frontend unit tests, typecheck,
   build, exact API check, and `git diff --check`.

## Alternatives considered

### Selected: extend the reviewed page-local EPUB engine

PDF has the same route state, work rows, sorting, and pagination. Reusing that
engine is the smallest implementation and preserves the existing cancellation
and hydration guarantees.

### New typed v2 Library endpoint

A generated v2 boundary remains desirable for the complete Library program,
especially once the filter and inactive-count fan-out are ported. Introducing
it only for PDF would create two authorities for otherwise identical EPUB/PDF
work searches and would slow this parity repair. It is deferred to the unified
remaining Library design.

### Separate `/pdf` page or composable

Angular has no separate PDF shell and the model has one consumer. Either option
would duplicate route state and markup, so both are rejected.

## Explicitly deferred

- Works, Latest, Authors, and Parts modes;
- advanced filters and chronology interaction;
- inactive-tab counts and author aggregations;
- expandable Works rows and Reader/search actions;
- source-bundle/bulk downloads and their Headless UI modal/popover;
- the unified typed v2 Library endpoint.
