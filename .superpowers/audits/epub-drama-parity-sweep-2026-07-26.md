# EPUB and Dramawebben parity sweep — 2026-07-26

Read-only comparison of the Nuxt app at `http://localhost:3020` with the live
Angular site and the checked-in Angular implementation. Excluded from this
sweep: restored OpenSearch data, multiselect migration, library ellipsis/editor
labels, and the Dramawebben bare-track slider work already in progress.

## Proven gaps

### 1. EPUB/PDF count is missing from the inactive format tab

**Reproduction**

1. Open local `http://localhost:3020/epub?visa=epub&sort=popularitet&filter=kyrka`.
2. Compare with live `https://litteraturbanken.se/epub?visa=epub&sort=popularitet&filter=kyrka`.
3. Local shows `Epub: 1` and an uncounted `PDF` tab. Live shows `Epub: 1` and
   `PDF: 61`.
4. Open local
   `http://localhost:3020/epub?visa=pdf&sort=popularitet&filter=kyrka`.
   The inverse occurs: local shows only `PDF: 62`, while `Epub` has no count.
   (The one-result difference between local and live PDF indexes is data drift;
   the proven UI bug is that the inactive count is absent altogether.)

The same happens without a text filter: local initially shows `Epub: 1618` and
bare `PDF`, while live shows both format counts.

**Root cause**

- `nuxt/app/pages/bibliotek.vue:1953-1970` fetches only the active standalone
  mode during SSR.
- `nuxt/app/pages/bibliotek.vue:2099-2104` initializes the inactive result set
  to an empty response.
- `nuxt/app/pages/bibliotek.vue:2341-2399` refreshes only author/work/part
  counts; there is no equivalent count-only refresh for EPUB/PDF.
- `nuxt/app/pages/bibliotek.vue:3470-3490` renders each badge from the full
  result object, so the inactive badge stays absent until that tab itself has
  been loaded.
- The Angular `refreshData()` path fetches EPUB and PDF in parallel on the
  standalone page (`app/scripts/library_controller.js:606-613`), which is why
  both badges remain populated live.

**Bounded fix/test**

Add abortable, identity-checked count requests for the inactive EPUB/PDF mode
(or SSR-fetch both standalone counts without fetching both row sets), refresh
them whenever text/advanced/date filters change, and keep the active result rows
unchanged. Add SSR and Playwright tests asserting both count badges on initial
EPUB and initial PDF URLs, and after a debounced filter change.

### 2. Dramawebben infopost modal drops provenance and renders a broken license sentence

**Reproduction**

1. Open local
   `http://localhost:3020/dramawebben/pjäser?mediatype=infopost&om-boken&authorid=WahlenbergA&titlepath=Cendrillon#dw`.
2. Compare with live
   `https://litteraturbanken.se/dramawebben/pjäser?mediatype=infopost&om-boken&authorid=WahlenbergA&titlepath=Cendrillon#dw`.
3. Live shows the Dramawebben provenance logo/link and its Public Domain text
   says to cite `Dramawebben` and `Litteraturbanken.se`.
4. Local omits the provenance block and renders the grammatically broken text:
   `Vid användning ber vi att du hänvisar till och Litteraturbanken.se.`

The local projection endpoint confirms the problem:
`GET /api/reader/source-info/WahlenbergA/Cendrillon` returns
`"provenance": []`, while the typed backend response at
`GET http://127.0.0.1:8000/v2/works/WahlenbergA/Cendrillon/source-info`
contains `{ "library": "Dramawebben" }`.

**Root cause**

- `nuxt/server/utils/reader-source-info.ts:767-783` maps only `etext`,
  `faksimil`, and `pdf` to a provenance text key and immediately returns an
  empty provenance array for `infopost`.
- `nuxt/server/utils/reader-source-info.ts:829-845` then interpolates the empty
  array into the license's `{{provenance}}` token, leaving the dangling
  conjunction.
- The Angular projector retains the provenance identity/image/link even when
  its media-specific prose is empty (`app/scripts/services/backend.js:511-548`),
  so live can interpolate `Dramawebben` into the license.

**Bounded fix/test**

For `infopost`, project known provenance entries with identity, image, and link
and an empty display-text string; use those entries for license interpolation.
Render the provenance paragraph only when text is non-empty, while retaining
the linked logo. Add a unit test for the exact Cendrillon-shaped payload and a
Playwright assertion that the dialog contains the Dramawebben link and the
complete attribution sentence.

### 3. Dramawebben source facts are in the wrong order

**Reproduction**

Using the same Cendrillon modal as above:

- Live orders the first two facts as `Svensk premiär`, then `Urpremiär`.
- Local orders them as `Urpremiär`, then `Svensk premiär`.

All fact values are present; only their visible order differs.

**Root cause**

- The typed backend explicitly emits `first_staged` before
  `first_staged_in_sweden` in `_DRAMA_FACT_ORDER`
  (`/Users/johan/dev/lb-backend/lbapi/v2/source_info.py:34-43`, consumed at
  lines 320-334).
- The Angular `Dramaweb` ordering list omits `first_staged_in_sweden`; lodash
  assigns it index `-1`, so it sorts before `first_staged`
  (`app/scripts/controllers.js:185-200`). This is the live order.

**Bounded fix/test**

Move `first_staged_in_sweden` before `first_staged` in the typed response order
and freeze the complete fact order in a backend projection test plus one modal
DOM-order assertion.

### 4. Opening a Dramawebben infopost modal preserves filters locally but clears them live

**Reproduction**

1. Open local and live `/dramawebben/pjäser?mediatype=infopost`.
2. Select the `Cendrillon` title row.
3. Local navigates to
   `/dramawebben/pjäser?mediatype=infopost&om-boken&authorid=WahlenbergA&titlepath=Cendrillon#dw`.
4. Live navigates to
   `/dramawebben/pjäser?om-boken&authorid=WahlenbergA&titlepath=Cendrillon#dw`,
   dropping `mediatype=infopost` (and similarly any other catalogue filters).

This means closing the dialog restores the filtered list locally but the full
list live. Local behavior is arguably friendlier, but it is not exact parity.

**Root cause**

- `nuxt/app/pages/dramawebben/pjäser.vue:285-295` starts modal navigation from
  `{ ...route.query }`, retaining all filters.
- The legacy title/media `ng-href` is constructed with only `om-boken`,
  `authorid`, and `titlepath`, as visible in the live DOM and
  `app/scripts/services/backend.js:36`.

**Bounded fix/test**

This needs an explicit product decision because the Nuxt behavior preserves
user context. If literal parity wins, build the open query from only the three
modal keys and have close return to bare `/dramawebben/pjäser`; add a
navigation/back-button E2E test. If preserving filters is intentional, record
this as an approved divergence instead of changing it.

### 5. EPUB pagination window does not match the live 10-slot pagination

**Reproduction**

1. Open local and live `/epub?visa=epub&sort=popularitet` on page 1.
2. Live exposes numeric pages `1 2 3 4 5 6 7 8 9 10 …` followed by `Nästa`.
3. Local exposes `1 2 3 4 5 6 7 8 9 … 17` followed by `Nästa`.

The destinations work, but the visible controls and direct-jump affordances do
not match.

**Root cause**

- Angular uses `uib-pagination` with `max-size="10"` and
  `force-ellipses="true"` (`app/scripts/components/library/works_list.html:207-219`).
- Nuxt's custom `paginationItems()` always reserves page 1 and the final page,
  then fills eight interior positions (`nuxt/app/pages/bibliotek.vue:3103-3120`).
  That is a different window algorithm.

**Bounded fix/test**

Port the exact UI Bootstrap pagination window behavior for page 1, a middle
page, and the final page. Unit-test the page-token arrays for 17 pages and add a
small E2E assertion over the rendered accessible labels.

## Surfaces checked without a further proven gap

- Dramawebben landing page and shell links.
- Pjäser and Författare list content/counts (462 works and 147 authors locally,
  matching live during the audit).
- Gender, author, media, free-text, children-play and range-filter structures
  (excluding the separately assigned bare-track slider implementation).
- Infopost row selection and modal payload beyond the provenance/order issues
  above.
- `/dramawebben/kringtexter` and `/dramawebben/om` managed HTML content and
  internal links.
- EPUB row content, author/title/download links, sort controls, active-format
  count, basic text filtering, advanced disclosure, and chronology controls.
