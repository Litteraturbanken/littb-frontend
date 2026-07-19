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

- the title opens the work's about-book view using `faksimil` when the selected
  display representation itself has media type `pdf`;
- `Hämta` uses a locally synthesized legacy PDF route and filename; provider
  export URLs and filenames are never trusted;
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
`hits`, finite numeric `distinct_hits`, and absent/null/array `suggest`. Raw
representations are grouped by the exact `(titlepath, lbworkid)` tuple before
rendering, matching Angular's `createExpandMediatypes` behavior without its
ambiguous string-concatenation key. One grouped work produces at most one row.
Within a group, a real indexed `mediatype:pdf` representation takes precedence
over every PDF export. Only when no real PDF exists may the first source-ordered
public-domain representation with an export object whose `type` is `pdf`
provide the download. Duplicate export descriptors still produce one action;
they do not invalidate the work. Real PDF representations remain valid when
`export` is absent.

Every accepted representation/group must prove:

- safe `lbworkid`, author, title, and media-type path segments;
- a media type in the exact `etext | faksimil | pdf` set;
- display title, imprint year, and complete main-author identity;
- either a real indexed PDF representation or a public-domain PDF export; and
- an ordered filename-author identity from `work_authors`, then `authors`, then
  `main_author`, matching the legacy authority.

Destinations are synthesized exactly as Angular does, with one leading slash:

```text
Real PDF: /txt/{pdf.lbworkid}/{pdf.lbworkid}.pdf
Export:   /export/faksimil/{group-main.lbworkid}.pdf
```

The download filename is synthesized as
`{filename-author-id}_{work_titleid || titleid}.pdf` from the real PDF
representation, or from the group-main representation for an export. Provider
`url` and `filename` values are ignored. All inserted values are validated as
single safe path/filename segments before either anchor is rendered. An
exported e-text or faksimil retains that representation's media type in the
about-book title link; only a selected raw PDF maps the title link to
`faksimil`.

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
2. SSR for both shells, all four sorts, invalid/default pages, grouping and
   direct-PDF precedence, safe title/author/synthesized-download links, filename
   identity, empty/error states, and pagination;
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
