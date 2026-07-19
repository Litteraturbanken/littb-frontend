# Nuxt Reader Contents and Sidebar Navigation Design

**Date:** 2026-07-19

**Status:** Auto-approved under the active Nuxt migration goal and the explicit
Reader gap-audit follow-up.

## Goal

Replace the Reader's visible-but-inert contents and sidebar-navigation
placeholders with truthful, accessible behavior while preserving the established
Angular appearance and the current page-local fetch architecture.

This slice adds:

- exact current-part context, including part-author links;
- previous- and next-part navigation;
- first- and last-page navigation;
- an exact-name page chooser; and
- a Headless UI contents dialog controlled by the canonical `innehall` query
  key.

It applies to both public canonical Reader media routes:

- `/författare/:author/titlar/:title/sida/:page/etext`
- `/författare/:author/titlar/:title/sida/:page/faksimil`

The existing shorthand routes continue to resolve to those canonical routes and
preserve raw query state:

- `/författare/:author/titlar/:title/etext`
- `/författare/:author/titlar/:title/faksimil`

Keyboard shortcuts, the decorative slider, source information, in-Reader search
entry, focus mode, OCR overlays, parallel view, analytics, downloads, and editor
routes remain separate slices.

## Existing authority and gap

Angular builds a page map from `get_work_info.pages`, decorates every part with
its start and end page indexes, and keeps a stable part-start ordering. The
sidebar derives the current part from the visible page, links to the preceding
and following part starts, links to the representation's declared start and end
pages, and accepts an exact public page name in its chooser. The
`Innehållsförteckning` action opens a query-backed modal whose rows retain source
order and link to each part's start page.

Nuxt already renders the correct Reader corridor and typography, but the current
part is a work-title placeholder. Previous part, next part, first page, last
page, goto page, slider, and all subnavigation labels are visually present but
`aria-hidden` and inert. The normalized Reader response exposes only the first
work author, current page, adjacent pages, and page count; it deliberately omits
the page map and parts required to make those controls truthful.

The deterministic Angular Reader fixtures already contain one part whose labels
match the current Nuxt placeholders. Normalizing that same part data must leave
all existing closed Reader screenshots byte-identical. A new part-rich authority
state will exercise visible current-part changes and the open contents dialog.

## Chosen architecture

### One strict metadata normalization and one page response

The existing `reader-source.ts` boundary remains the only interpreter of legacy
Reader metadata. It extends its internal work model with:

- the ordered public page names;
- a declared start page when it resolves to an exact page;
- a declared end page when it resolves to an exact page; and
- normalized parts in original source order.

Each normalized part contains a stable source index, exact start/end page names
and indexes, full title, optional navigation/short title and title ID, and
ordered author IDs. Production metadata proves representation-local author
records are incomplete for translated and collected parts: `Nattmusik`, for
example, has one representation author but four distinct part authors. After
strict metadata normalization, the Nitro Reader handler therefore resolves the
distinct part-author IDs in one bounded call to the existing typed
`POST /authors/resolve` FastAPI operation. Resolved summaries provide exact full
names and surnames. A structurally valid ID omitted by a successful resolver
remains linkable and uses the ID as its bounded display fallback; an unavailable
or malformed resolver response produces the existing `502 Invalid reader
source` boundary instead of silently changing visible names.

The checked resolver accepts at most 50 distinct IDs. After subtracting exact
representation-local summaries, more than 50 unresolved distinct part-author
IDs is therefore an invalid Reader metadata projection and returns `502` before
the resolver or page asset is fetched. One request remains sufficient for every
accepted graph. The generated client supplies compile-time types, but the Nitro
boundary also validates the runtime 200 response: an exact `{ items }` object,
an array of at most 50 exact summary objects, unique requested safe IDs, bounded
nonempty full names, and `null` or bounded nonempty surnames. Extra keys,
duplicate or unrequested IDs, and malformed strings are invalid. Successfully
omitted IDs use the ID fallback. A resolved `surname: null` displays the bounded
full name wherever Angular asks for a surname, then the ID only if the whole
summary was omitted.

The canonical page endpoint uses pure server-side navigation helpers to add this
page-specific projection to the existing `ReaderPage` base:

- `pageNames`
- `startPageName`
- `endPageName`
- `parts`
- `currentPartIndex`
- `previousPartPageName`
- `nextPartPageName`

`currentPartIndex` indexes the source-ordered `parts` array. The client does not
receive raw legacy dictionaries and does not reimplement the nested-part
algorithm. Both e-text and faksimil arms inherit the same navigation projection.

The existing page-local `useAsyncData` remains the only browser Reader model
fetch. The Nitro handler may make the one conditional typed author-resolution
request described above; it adds no browser endpoint or composable. A query-only
contents open or close does not change the primary request identity
and must not refetch metadata, e-text HTML, or search-hit data. The existing
search-hit async-data key, watcher, accepted-response identity, and stale matcher
therefore use one raw-query identity that removes only `innehall` while
preserving every other raw query pair, order, and encoding. Search-relevant
changes still produce distinct identities. No composable, store, second Nitro
endpoint, FastAPI change, or generated client change is introduced because the
typed resolver already exists in the checked schema and generated client.

### Strict but compatible legacy boundaries

Existing author/title/media identity rules remain unchanged. E-text and
faksimil pages require nonempty unique page names and unique safe nonnegative
page indexes. Faksimil retains its separate image-number rules.

Partless works are valid: an absent, `null`, or empty `parts` value normalizes to
an empty array. When a nonempty parts array is present, every item must be a
record with:

- nonempty string `startpagename`, `endpagename`, and `title`;
- start and end names that each identify exactly one normalized page;
- a start index less than or equal to its end index;
- optional `navtitle`, `shorttitle`, and `titleid` values that are strings when
  present (empty optional display labels normalize to `null`, matching legacy
  truthy fallback); and
- an absent/`null` author list or an array of records containing nonempty string
  `authorid` values.

Malformed containers, items, optional field types, author entries, missing page
endpoints, or reversed ranges make the metadata response invalid and produce the
existing `502 Invalid reader source` behavior before a page asset is fetched.
Duplicate ranges, nested ranges, overlapping ranges, equal start indexes, and
source-order ties are valid and must not be deduplicated or reordered.

The work-level `startpagename` and `endpagename` are optional for a canonical
page. A present non-string value is malformed (`502`). A well-formed name that
does not exist in the exact representation yields no corresponding sidebar
target; shorthand keeps its existing `404` rule when its required start page is
absent or unresolved. This avoids inventing a first or last page that Angular did
not declare.

All strings and arrays added to the public DTO use explicit high bounds selected
above known production values. Crossing a bound is malformed source data, not a
reason to truncate and silently change navigation.

### Exact nested and overlapping part semantics

Contents rows preserve legacy source order. Navigation derives a separate stable
ordering by `(startPageIndex, sourceIndex)` without changing the public row
order.

For visible page index `p`:

1. If no part range contains `p`, `currentPartIndex` is `null`.
2. If one or more parts start at `p`, the first such part in stable start/source
   order is current, matching Angular's explicit start-page branch.
3. Otherwise, the last stably ordered part whose range contains `p` is current.
4. Previous-part navigation selects the last part whose start index is at most
   `p - 1`. It can therefore return the current containing part's start when the
   reader is inside that part.
5. Next-part navigation selects the first part whose start index is at least
   `p + 1`; parts starting on the current page are skipped.

The helpers return source-array indexes and page names, not object identity.
Focused unit tests freeze same-start ties, nested parts, partially overlapping
parts, gaps between parts, pages before the first part, and pages after the last
part.

## Page-owned URL and interaction state

### Ordinary navigation

Previous/next part, start/end page, page chooser, contents rows, and the existing
previous/next page links all use the canonical route and preserve every current
query byte other than the contents key when leaving the dialog. Helpers operate
on the raw query suffix of `route.fullPath`, not Vue query objects or
`URLSearchParams`, so bare keys, empty values, `+` versus `%20`, percent-escape
case, cross-key interleaving, repeated unknown keys, and fragments remain
byte-identical. They split only on `&`, decode only enough to decide whether a
key is exactly `innehall`, and copy all nonmatching segments verbatim. Canonical
e-text `q`, `hit`, `lemma`,
`ej_modern`, `prefix`, and `suffix` state remains intact; faksimil `storlek` and
search-shaped unknown state remain intact. Navigation continues to update the
existing Reader history producer through a history identity that removes only
`innehall`. Contents-only open/close does not write or reorder `lastPageViews`,
and a direct contents-open entry stores the restorable canonical URL without the
transient modal key. Selecting a part or otherwise changing page stores the
exact resulting destination query.

Disabled controls have no `href`, keyboard focus, or click behavior but retain
the exact legacy disabled appearance. The current page chooser opens from the
existing `Gå till sida . . .` row. It accepts only an exact, case-sensitive page
name present in `pageNames`; it performs no trimming, numeric coercion, or fuzzy
matching. Invalid input leaves the URL and Reader content unchanged and exposes
a concise screen-reader status. A valid submission pushes one canonical page
navigation and closes the input.

The visible slider remains a decorative `aria-hidden` parity element in this
slice. The keyboard-help copy also remains `aria-hidden` until keyboard paging
is implemented. Other deferred subnavigation labels remain individually
`aria-hidden`; the parent subnavigation container is no longer hidden because
the contents trigger is real.

### Query-backed contents dialog

The dialog is open only when `route.query.innehall` is a single bare or empty
value (`?innehall` or `?innehall=`). Repeated values and explicit nonempty values
are preserved but ignored. This fail-closed parser prevents ambiguous query
state from opening UI.

Opening from the sidebar pushes the same canonical page with all existing query
bytes preserved, any invalid/repeated prior `innehall` segment removed, and one
bare `innehall` key appended. Browser Back closes the newly opened dialog and
Forward reopens it. Headless UI `Dialog`, `DialogPanel`, and `DialogTitle` own
focus trapping, Escape, backdrop close, focus restoration, and accessible modal
semantics. While open, the existing head declaration adds `modal-open` without
removing `focus page-reading ready`; closing removes only `modal-open`.

Closing through Escape, backdrop, or the visible `Stäng` control replaces the
current URL after removing only `innehall`. A direct canonical or shorthand
entry with `?innehall` therefore closes to the same page without adding another
history entry. Selecting a contents row pushes that part's canonical start page,
removes only `innehall`, and preserves all other query values. A contents-open
query never changes the Reader request identity and never creates duplicate
metadata, page-body, image, or hit requests.

Headless UI alone owns outside-click/backdrop dismissal; the backdrop has no
second click handler. The page-owned close operation is idempotent, so one user
action produces at most one router replacement and one history mutation.

The dialog is client-rendered using the existing global legacy modal styles. Its
header shows the work author, title, and optional imprint year. Every contents
row shows the surname for every part author, including a single author, and uses
`navtitle || shorttitle || title` as its label, always exposes the full title as
its native tooltip exactly as Angular does, and retains an ordinary canonical
`href`.

## Rendering and metadata

The existing sidebar title, typography, spacing, corridor placement, arrows,
slider decoration, and subnavigation order do not change. The current-part block
uses the normalized current part only when one exists. Unlike contents rows, it
shows one author's full name or multiple authors' surnames, matching Angular. A
page outside all part ranges has an empty current-part block rather than
fabricated work context. Its tooltip is present only when the displayed fallback
label differs from the full title.

When the current part has a nonempty `titleid`, the page emits
`<meta name="part" content="...">`. It removes that metadata on a page without a
current part or title ID. This uses Vue head state and does not mutate the DOM
manually.

The contents trigger is present only when `parts.length > 0`. Source-info,
focus, search, and author-search labels remain visibly unchanged and inert under
their existing deferrals.

## Error and transition behavior

- Unsupported media or a missing requested page remains `404`.
- Unavailable or malformed core/part metadata remains `502`.
- A malformed part response cannot leak raw values or partially enable controls.
- An invalid goto value is local and nonfatal.
- A late Reader response cannot replace a newer route; existing request-identity
  ownership remains authoritative.
- During canonical client page navigation, the old sidebar/parts model is not
  rendered under the new URL.
- Query-only dialog transitions reuse the current successful Reader model.
- Contents-only state never creates a page view; history stores the exact
  resulting canonical URL without `innehall` on initial success or after page
  selection.

## Visual authority and verification

A new deterministic part-rich Reader fixture uses the same local Angular shell,
fonts, page content, and request firewall as the existing Reader captures while
providing nested, overlapping, same-start, and multi-author part metadata. It
does not depend on live production data.

Angular authority and Nuxt comparison cover matching 1440×1000 desktop and
iPhone 13 Chromium states:

1. a closed middle page with a distinct current-part label and enabled
   previous/next-part plus first/last controls; and
2. the same page with the contents modal open through `?innehall`.

The authority ledger permits only the exact shell, authors, metadata, page,
stylesheet, font, and declared static requests. Nuxt request ledgers prove one
metadata request and one page body/image request, with no extra request when the
dialog opens or closes.

Existing Reader-hit and faksimil desktop/mobile screenshots are immutable. All
ten existing Nuxt Reader comparisons and their Angular authority hashes must
remain byte-identical; no masking, baseline replacement, CSS redesign, or
threshold relaxation is allowed. New screenshots use the established Reader
settings: full page, animations disabled, CSS scale, threshold `0.1`, and at
most `100` differing pixels.

Unit, fixture, SSR, browser, visual, typecheck, build, exact-schema API, and diff
checks close the slice. Live smoke testing uses both media types and a real work
with multiple parts but does not replace deterministic parity evidence.

## Explicitly deferred

- slider interaction and keyboard shortcuts;
- source-info and `om-boken` routes/dialog;
- in-Reader search form/options and first/last/goto-hit controls;
- faksimil OCR overlays and faksimil search hits;
- focus/fullscreen, bottom bar, font scaling, and night mode;
- parallel e-text/faksimil view and image expansion;
- downloads, analytics, page/error logging, and editorial commands;
- `/editor/:lbid/ix/:ix/:mediatype` and all editor-only behavior.
