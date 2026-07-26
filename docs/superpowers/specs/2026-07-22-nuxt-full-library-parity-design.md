# Nuxt full Library parity design

Status: auto-approved under the active AngularJS-to-Nuxt migration goal.

## Goal and authority

Complete the remaining Angular `LibraryPageCtrl` behavior for `/bibliotek`, the
shared `/epub` alias, and the legacy `/titlar` redirect without changing visual
design. `app/scripts/library_controller.js` and
`app/scripts/components/library/{library,works_list,downloadPopover}.html` are
the authority for copy, classes, control order, row behavior, and batch-source
material interaction.

The existing Nuxt Library already owns its page-local data fetching, route
state, browse modes, EPUB/PDF lists, basic advanced facets, stale-request
protection, and defensive response parsing. This slice extends that page model;
it does not introduce a composable, store, or shared page-only model module.

## Route-owned filter state

The URL remains the durable source of truth. The new supported keys are:

- `keywords`: category/project/department/publisher selections. Values within
  this facet are combined with logical OR, matching Angular `buildFilterQuery`.
- `about_authors`: authors whose authorship is the subject of a work. Values
  become the nested predicate `authorkeyword>(authorid:(A OR B))`.
- `keywords_aux`: narrowing selections. Each selected expression is an
  independent logical AND clause. A compound option such as
  `texttype:drama;dramasamling` is OR within itself and AND against the other
  narrowing selections.
- `hide1800`: only executes in `visa=latest`; elsewhere it is preserved as an
  unrelated query byte but has no UI or request effect.
- `nedladdning`: only executes on `/bibliotek`, forces the visible mode to
  `works`, and disables the incompatible Authors, Parts, EPUB, PDF, and Latest
  views. `/epub` ignores it.

Each committed filter change uses `router.push`, removes `sida`, invalidates
pending requests/counts, and includes its validated values in the request
identity. Back, Forward, reload, and SSR reconstruct controls and results.
Unsupported, duplicated, structurally malformed, or unsafe values fail closed:
they are not interpolated into backend queries. Unrelated query bytes are
preserved.

## Facet vocabulary and query semantics

Category/project/department/publisher options reuse the complete Angular
`keywordSelect` option vocabulary and labels. Values are a closed allowlist.
The two semicolon-delimited texttype choices are parsed as one OR group.
`keyword:Biografika|texttype:brev;brevsamling` is parsed as the Angular union of
the keyword and texttype alternatives. Publisher values such as
`provenance.library:SA` and `author_ids:KunglSamfundet` remain exact.

Ordinary facet values form one OR predicate. Narrowing values form separate AND
predicates. These predicates are appended to the existing free-text,
gender/media/language/year, EPUB/PDF, recent, works, parts, and count requests in
a stable order. About-author filters are nested and ANDed with the other facet
families. The server response remains strict: malformed result envelopes,
author option data, or export descriptors produce the existing closed error or
empty state and can never win after a newer request.

## About-author options

The page fetches the Angular authority endpoints page-locally:
`get_authorkeywords` supplies allowed IDs and `get_authors` supplies display
records. Both responses are strictly parsed and joined by exact author ID.
Missing, duplicate, unsafe, or unknown IDs are discarded. If either envelope is
malformed, the control is unavailable and any `about_authors` URL value is not
executed. This metadata request participates in SSR and uses the private
Library base server-side and public proxy client-side.

## Source-material batch workflow

`?nedladdning` reproduces Angular's source-material mode:

1. Entering it pushes `nedladdning=1`, selects Works, clears the current
   selection, and fetches only works containing source exports.
2. Work rows gain checkboxes and row-click selection. "Välj alla verk i listan"
   and "Avmarkera alla verk i listan" affect the visible page only while keeping
   prior-page selections.
3. The right-hand legacy-shaped selection panel lists chosen works, supports
   individual removal and "Rensa", and opens "Välj format".
4. Format availability is derived strictly from selected works' `etext` and
   `faksimil` export descriptors. Supported types are `txt`, `xml`, `workdb`,
   and `pdf`; each descriptor requires a safe `lbworkid`, media type, type, and
   non-negative finite size.
5. The dialog shows the Angular counts, labels, enabled/disabled choices, and
   total size formatting. Submit uses a native POST form to `/api/download`
   with one hidden `files` value whose comma-separated tokens are
   `lbworkid-mediatype-type`. Tokens come only from validated selected exports.
   No request is made when nothing valid is selected.
6. Closing mode removes `nedladdning`, clears selection/format state, and
   refetches ordinary Works. Browser Back restores mode from the URL but never
   resurrects ephemeral checked works.

## Markup, links, and responsive behavior

Reuse Angular copy and CSS classes. No new visual system or redesigned control
is introduced. Internal title navigation uses `NuxtLink`; route state changes
use the router. Because Nuxt's client matcher owns the encoded static segment,
all generated author/Reader destinations use `/f%C3%B6rfattare/…` while retaining
identical visible output; click-through tests must prove SPA navigation reaches
hydrated author and Reader content without a reload. Direct files remain normal
anchors with `download`. Desktop and
mobile retain the existing Library geometry, with the download sidebar using
the Angular `download_list` and button classes and naturally stacking on small
screens under existing styles.

## Test and comparison evidence

Strict TDD adds SSR and desktop/mobile Playwright coverage for category and
publisher filters, about-author selection, ordinary OR versus narrowing AND,
malformed URLs/metadata/exports, route history, recent-only `hide1800`, download
mode selection across pages, format availability, exact POST body, and stale
request ownership. They also cover client-side click-through of generated
author and Reader links. Fixture tests cover the narrow legacy endpoints and
POST ledger.

Closure additionally requires fresh Angular-authority captures for pristine,
advanced-filter, and download-mode states at desktop and mobile widths, followed
by explicit comparison against Nuxt captures. A passing behavior suite without
that comparison is not closure evidence.
