# Nuxt Library EPUB Mode and Standalone EPUB Design

**Date:** 2026-07-17

## Goal

Port one native EPUB work listing shared by Library EPUB mode and the standalone
EPUB page. The following routes must become fully SSR-rendered, searchable,
sortable, paginated, and downloadable while preserving their distinct legacy
shells and visuals:

- `/bibliotek?visa=epub&sort=popularitet`
- `/epub`
- `/epub?visa=epub&sort=popularitet`

This is the next bounded Library slice. PDF, advanced filters, chronology,
result-count fan-out, Works accordions, and bulk/source downloads remain
separate work.

## Authority and intentional repairs

The AngularJS `library-page` component owns both `/bibliotek` and `/epub`.
Library EPUB mode retains the `page-library` shell, background, full tab row,
and heading `Botanisera i biblioteket`. Standalone EPUB uses `page-epub`, the
`ljudlandskap.jpg` background, heading `Hämta e-böcker`, EPUB/PDF tabs only, and
title `E-böcker för nedladdning | Litteraturbanken`.

Two legacy state bugs are repaired deliberately:

1. Bare Angular `/epub` falls into a broken mixed-results state. Nuxt `/epub`
   defaults directly to EPUB with the `popularitet` sort without redirecting or
   changing its standalone shell.
2. Angular EPUB pagination does not persist its page. Nuxt stores a one-based
   page in `sida`, so SSR, reload, Back, and Forward reproduce the selected
   rows.

These are behavior repairs, not a visual redesign. The canonical Angular
`/epub?visa=epub&sort=popularitet` state remains the standalone visual authority.
The legacy horizontal standalone EPUB corridor at mobile width is preserved in
this architectural slice.

## Architecture

### One aliased page, two shells

`pages/bibliotek.vue` remains the sole owner of Library fetching, response
validation, URL synchronization, and markup. `definePageMeta` aliases the page
to `/epub`, avoiding duplicated page code or a one-use composable. The alias is
an explicit contract and must be proven by SSR route, typecheck, and production
build tests.

The current path determines only shell metadata:

| State | `/bibliotek` | `/epub` |
| --- | --- | --- |
| Body class | `focus page-library ready` | `focus page-epub ready` |
| Heading | `Botanisera i biblioteket` | `Hämta e-böcker` |
| Background | `biblioteket_bakgrund.jpg` | `ljudlandskap.jpg` |
| Tabs | all legacy tabs | EPUB and PDF only |
| Default mode | mixed relevance | EPUB |

On `/bibliotek`, absent `visa` remains the existing relevance mode. `visa=epub`
activates EPUB. Other unimplemented `visa` values remain honest: they do not
activate a fake list. On `/epub`, the effective mode is always EPUB in this
slice; a query-supplied unsupported mode is normalized to EPUB when subsequent
interactions update the URL.

### Atomic route state

The page parses path, `visa`, `filter`, `sort`, and `sida` together into one
immutable state. This prevents relevance defaults from leaking into EPUB state.

EPUB supports exactly these symbolic sorts and initial expressions:

| Query | Label | Expression |
| --- | --- | --- |
| `forfattare` | Författare | `main_author.name_for_index|asc,sortkey|asc` |
| `titlar` | Titel | `sortkey|asc` |
| `popularitet` | Populärt | `popularity|desc` |
| `kronologi` | Tryckår | `sort_date_imprint.date|desc` |

Missing or unsupported EPUB sorts normalize to `popularitet`. Missing,
non-numeric, fractional, negative, or zero `sida` values normalize to 1. The
filter uses the current Library sanitizer. Search and sort changes reset page 1;
pagination retains mode, filter, sort, and every existing query key except the
four owned keys `visa`, `filter`, `sort`, and `sida`, which it rewrites from the
new state.

Typing remains 300 ms debounced. All immediate and delayed actions use the
existing abort/version/latest-intent discipline. The committed rows remain
visible under the loading indicator until the newest request settles. Browser
Back/Forward is treated as a new authoritative route intent, not as an owned
navigation echo.

## Live data boundary

EPUB uses the existing legacy operation through the same private/server and
public/browser bases as the relevance slice:

```text
GET /api/query_string/etext,faksimil,pdf
```

One active-mode request is made per state. Nuxt does not copy Angular's inactive
count requests or unused author aggregation. The request contains:

```text
from=(sida - 1) * 100
to=sida * 100
exclude=text,parts,sourcedesc,pages,errata
include=lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword
partial_string=true
q=@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (has_epub:true)
sort_field=<selected expression>
suggest=true
```

When a sanitized filter exists, the predicate becomes
`has_epub:true AND (<filter>)` inside the same prefixed query.

The local top-level guard requires object `data`, finite numeric `hits`, and
finite numeric `distinct_hits`. `suggest` may be absent, null, or an array; any
other value rejects the envelope. Pagination and visible total use
`distinct_hits`, never raw `hits`.

Rows are validated independently and malformed rows are omitted. A row must
have safe author/title identifiers, display title, media type, main-author name
and surname, imprint year as a finite number or nonblank string, `has_epub=true`,
and an EPUB export. Control characters, slash, backslash, dot segments, or blank
identifiers cannot enter synthesized paths. Safe identifiers are encoded one
path segment at a time.

Transport or malformed-envelope failures render `Ett fel uppstod.`; a valid
empty response renders `Inga träffar.`. Failures expose no payload detail.

## Rows, downloads, and pagination

Every EPUB row preserves the legacy four-column work layout:

1. one-line ellipsized title;
2. imprint year, hidden below `sm`;
3. uppercase/small-caps author surname, with `(red.)` for editor or `(ill.)`
   for illustrator when that type is present;
4. right-aligned `Hämta`.

All destinations are ordinary anchors:

```text
Title:  /författare/{authorid}/titlar/{work_titleid || titleid}/{mediatype}?om-boken
Author: /författare/{authorid}
EPUB:   /txt/epub/{authorid}_{work_titleid || titleid}.epub
```

The EPUB anchor has `download` and `target="_self"`. It uses the existing
`/txt` development proxy; no new download endpoint is introduced.

Pagination appears only when `distinct_hits > 100`, uses page size 100, shows
at most ten numeric pages with forced ellipses, and retains the labels
`Föregående` and `Nästa`. Its active page and disabled boundaries are semantic
and keyboard accessible. Page links update `sida` and request exactly the
matching `from`/`to` range.

## Visual contract

The existing copied Angular SCSS and established class strings are authority.
No copied SCSS, legacy Angular source, or visual baseline is changed merely to
make a test pass. The implementation preserves:

- translucent white 65% form/result surfaces and large-screen borders;
- white headings, primary-red active tab, small-caps tabs and sort row;
- legacy four-column work grid and mobile year visibility;
- Library background and responsive block switch;
- standalone EPUB background, left-corridor colors, and existing mobile
  horizontal overflow.

No modal, dropdown, disclosure, or listbox is part of this slice, so Headless UI
would add no useful semantic behavior.

Deterministic Angular authority captures and Nuxt comparisons cover desktop and
mobile Library EPUB and standalone EPUB states. Default Library relevance
desktop/mobile baselines are rerun unchanged. The broken bare Angular `/epub`
state is behavior evidence only; the canonical query URL is visual authority.

## Deterministic fixtures and verification

A separate query-string fixture models page one, page two, filtered, empty,
malformed-envelope, malformed-row, absent/null-suggest, delayed, and transport
failure states. Its ledger records both private and public paths plus exact
query parameters; delay identity includes query, sort, `from`, and `to` so
filter/sort/page races are deterministic. A small local `ljudlandskap.jpg`
fixture supplies visual tests without copying editorial page content.

Tests prove:

1. Exact fixture request/response/failure/delay contracts.
2. SSR of Library EPUB, bare `/epub`, canonical `/epub`, page two, all four
   sorts, absent/null suggestions, invalid pages, empty/error, safe row links,
   and distinct-hit pagination.
3. Browser tab activation, bare-route defaults, 300 ms search, sort/page reset,
   stale-request protection, Back/Forward restoration, one request per state,
   and exact download semantics.
4. No hydration warnings, private-config client access, or client duplicate of
   an SSR request.
5. Desktop/mobile Angular-to-Nuxt parity for populated and paginated EPUB
   states, with default relevance baselines unchanged.
6. Focused fixtures, SSR, browser, visual parity, typecheck, build, and
   `git diff --check` all pass.

## Alternatives considered

### Selected: Nuxt route alias

One page and one model remain the source of truth. This is the smallest change
and preserves the user's preference for page-local single-consumer data logic.
Its risk—route metadata divergence—is directly covered by SSR/build tests.

### Shared component with two thin page wrappers

This gives explicit route files and becomes attractive when more standalone
Library routes need the same engine. Today it moves a large existing page only
to support a second path and increases regression surface without improving the
bounded behavior.

### Duplicate `/epub.vue`

Copying the model or only the markup would make the first implementation quick,
but sort, cancellation, validation, and visuals would drift immediately. It is
rejected.

## Explicitly deferred

- PDF mode and `/export/faksimil/**` proxying
- advanced filters and Headless UI listboxes
- chronology interaction
- inactive tab counts and author aggregations
- Works/Latest/Parts/Authors modes
- source-bundle and bulk downloads
- session-only reverse-sort toggling
- a typed v2 backend Library search replacement
- Reader about-book completion beyond preserving its ordinary destination
