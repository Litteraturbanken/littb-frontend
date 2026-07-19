# Nuxt Reader Contents and Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Nuxt Reader's inert current-part, part-navigation, first/last, goto-page, and contents placeholders with a typed page-local implementation that matches Angular without changing existing closed Reader visuals.

**Architecture:** Extend the existing strict Nitro `get_work_info` normalization with source-ordered parts and a page-specific navigation projection shared by e-text and faksimil. The canonical Reader page owns query/history transitions and exact-name goto behavior, while a focused Headless UI component renders the `?innehall` dialog from the already-fetched model.

**Tech Stack:** Nuxt 4, Nitro/H3, Vue 3, TypeScript, Headless UI, SCSS, Vitest, Playwright.

**Design:** `docs/superpowers/specs/2026-07-19-nuxt-reader-contents-navigation-design.md`

**Audited base:** `bf10cd43`

## Global Constraints

- Preserve the current Angular layout and all ten existing Reader-hit/faksimil desktop/mobile comparisons. Do not replace existing baselines, mask regions, redesign controls, or relax screenshot thresholds.
- Keep the existing page-local `useAsyncData` and params-only primary Reader identity. Opening or closing contents must make no metadata, page-body, image, or hit request.
- Reuse the exact existing `/api/get_work_info` call. Add no FastAPI operation, generated API type, second Nitro endpoint, client store, or one-use composable.
- Support only the existing canonical and shorthand public `etext | faksimil` routes. Do not add `/editor` or source-info routes.
- Preserve canonical search state, faksimil size state, repeated unknown query values, query ordering, Reader history, stale-response ownership, and current error status semantics.
- Treat absent, `null`, or empty parts as a valid partless work. Reject a present malformed nonempty parts graph before fetching a page asset.
- Preserve source order for contents. Allow duplicate, nested, overlapping, and same-start part ranges; do not deduplicate them.
- Use Headless UI `Dialog`, `DialogPanel`, and `DialogTitle`; do not implement custom focus trapping or Escape handling.
- The visible slider and keyboard-help copy remain decorative and `aria-hidden`. Source-info, focus, search-entry, and author-search labels remain individually inert.
- Follow strict RED → verify RED → minimal GREEN → verify GREEN cycles. Do not write production behavior before its focused test fails for the expected missing feature.
- Do not restart or reuse existing local development servers outside the test commands' managed servers.
- Do not stage `.superpowers/`, `nuxt/nuxt.config.ts`, `nuxt/test/ssr/legacy-route-redirects.spec.ts`, `docs/superpowers/plans/2026-07-18-nuxt-author-supplemental-documents.md`, or any other unrelated dirty path.

## File map

- `nuxt/shared/types/reader.ts`: public normalized Reader navigation, part, and part-author types shared by both media arms.
- `nuxt/server/utils/reader-source.ts`: strict legacy part/page normalization and pure nested/overlapping part navigation.
- `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`: page-specific navigation projection on the existing Reader response.
- `nuxt/app/lib/reader-routes.ts`: pure contents href/query helpers alongside existing canonical page/hit hrefs.
- `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`: page-owned goto, navigation targets, query state, history-safe transitions, and sidebar rendering.
- `nuxt/app/components/reader/ReaderContentsDialog.vue`: focused Headless UI contents presentation and close/select events.
- `nuxt/app/assets/styles/nuxt.scss`: layout-neutral Headless UI modal glue only; existing legacy chapter styles remain authoritative.
- Reader fixtures/tests: deterministic part graphs, request ledgers, SSR/browser behavior, Angular authority, and strict Nuxt visual comparison.

---

### Task 1: Normalize a strict Reader part graph and freeze legacy selection semantics

**Files:**
- Modify: `nuxt/test/unit/reader-source.spec.ts`
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/server/utils/reader-source.ts`

**Interfaces:**
- Consumes: exact legacy representation `pages`, optional `startpagename`, optional `endpagename`, optional `parts`, and representation-local `authors`.
- Produces: shared `ReaderPartAuthor`, `ReaderPart`, and Reader base navigation fields; server `resolveReaderPartNavigation(parts, pageIndex)` returning source-array indexes/page names.

- [ ] **Step 1: Write failing page and part normalization tests**

Add table-driven tests that prove e-text, like faksimil, rejects duplicate page
names and indexes. Add valid partless cases for absent, `null`, and `[]` parts.
Add one exact normalized part assertion:

```ts
expect(metadata.parts).toEqual([{
  sourceIndex: 0,
  startPageName: "-3",
  startPageIndex: 1,
  endPageName: "-1",
  endPageIndex: 3,
  title: "Doktor Glas",
  navTitle: "Romanen",
  shortTitle: null,
  titleId: "part-doktor-glas",
  authors: [{
    id: "SöderbergH",
    name: "Hjalmar Söderberg",
    surname: "Söderberg"
  }]
}])
```

Add independent malformed cases for a non-array container; non-record item;
missing/wrong-type title, start, end, or optional title field; unknown endpoint;
reversed indexes; non-array authors; and a missing/wrong-type author ID. Assert
`normalizeReaderMetadata` throws status `502`. Assert an unknown but structurally
valid part author normalizes to `{ id, name: null, surname: null }`.

- [ ] **Step 2: Write failing nested/overlapping navigation tests**

Build source-ordered parts containing an outer range, nested range, partial
overlap, equal-start tie, later part, and gaps. Freeze all branches:

```ts
expect(resolveReaderPartNavigation(parts, 4)).toEqual({
  currentPartIndex: 2,
  previousPartPageName: "2",
  nextPartPageName: "6"
})
```

Assert exact-start chooses the first stable start/source entry; inside a range
chooses the last active stable entry; a gap has `currentPartIndex: null`; prior
navigation uses the last start at or before `p - 1`; next navigation uses the
first start at or after `p + 1`; pages before/after all parts have bounded nulls.

- [ ] **Step 3: Run focused unit tests and verify RED**

Run:

```bash
cd nuxt && npm run test:unit -- test/unit/reader-source.spec.ts
```

Expected: FAIL because navigation types, part normalization, duplicate e-text
page rejection, and `resolveReaderPartNavigation` do not exist. Confirm the
failure is behavioral rather than a fixture syntax error.

- [ ] **Step 4: Add the shared normalized contract**

Add these exact public shapes and fields to `shared/types/reader.ts`:

```ts
export interface ReaderPartAuthor {
  id: string
  name: string | null
  surname: string | null
}

export interface ReaderPart {
  sourceIndex: number
  startPageName: string
  startPageIndex: number
  endPageName: string
  endPageIndex: number
  title: string
  navTitle: string | null
  shortTitle: string | null
  titleId: string | null
  authors: ReaderPartAuthor[]
}
```

Extend `ReaderPageBase` with `pageNames`, `startPageName`, `endPageName`,
`parts`, `currentPartIndex`, `previousPartPageName`, and
`nextPartPageName`. Keep both existing media arms otherwise unchanged.

- [ ] **Step 5: Implement minimal strict normalization**

In `reader-source.ts`, keep contents source order, create a page-name/index map,
and implement exact optional-string and part-author parsers. Use high explicit
bounds (100,000 pages, 10,000 parts, 100 part authors, 100 characters for IDs
and page names, and 2,000 characters for titles); reject rather than truncate.
Treat absent/`null` `parts` as `[]`, but reject any malformed present value.

Resolve part-author names only from well-formed representation-local author
records. Do not call another service. Preserve duplicate ranges and equal starts.

- [ ] **Step 6: Implement the exact stable navigation helper**

Implement the pure helper with a decorated stable ordering:

```ts
export function resolveReaderPartNavigation(
  parts: readonly ReaderPart[],
  pageIndex: number
): {
  currentPartIndex: number | null
  previousPartPageName: string | null
  nextPartPageName: string | null
} {
  const ordered = [...parts].sort((left, right) =>
    left.startPageIndex - right.startPageIndex || left.sourceIndex - right.sourceIndex
  )
  const starting = ordered.find(part => part.startPageIndex === pageIndex)
  const active = ordered.filter(part =>
    part.startPageIndex <= pageIndex && pageIndex <= part.endPageIndex
  )
  const previous = ordered.filter(part => part.startPageIndex <= pageIndex - 1).at(-1)
  const next = ordered.find(part => part.startPageIndex >= pageIndex + 1)
  return {
    currentPartIndex: (starting ?? active.at(-1))?.sourceIndex ?? null,
    previousPartPageName: previous?.startPageName ?? null,
    nextPartPageName: next?.startPageName ?? null
  }
}
```

Return indexes only after asserting normalized `sourceIndex` equals the part's
position in the source-ordered public array.

- [ ] **Step 7: Run focused and adjacent units to GREEN**

Run:

```bash
cd nuxt && npm run test:unit -- test/unit/reader-source.spec.ts test/unit/reader-routes.spec.ts
```

Expected: PASS with every malformed graph rejected, every valid overlapping
graph preserved, and existing route helpers unchanged.

- [ ] **Step 8: Commit Task 1**

```bash
git add nuxt/shared/types/reader.ts nuxt/server/utils/reader-source.ts nuxt/test/unit/reader-source.spec.ts
git commit -m "feat(nuxt): model reader contents navigation"
```

### Task 2: Publish the page-specific navigation projection without another fetch

**Files:**
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/ssr/reader-shorthand.spec.ts`
- Modify: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`

**Interfaces:**
- Consumes: Task 1 `ReaderWorkMetadata.parts`, exact ordered pages, optional declared boundaries, and `resolveReaderPartNavigation`.
- Produces: complete `ReaderPageBase` navigation projection for both media arms; deterministic `DoktorGlasParts` fixture and separate request ledgers.

- [ ] **Step 1: Extend deterministic fixtures with unchanged and part-rich models**

Add `endpagename` and the exact single part already used by Angular authority to
the existing Doktor Glas and Gösta Berling base fixtures. Their author/title
labels must equal current placeholders so closed screenshots do not move.

Add a separate `DoktorGlasParts` representation using the existing local page
bodies/work CSS and a source-ordered graph with an outer part, nested middle
part, later part, same-start tie, overlap, and two-author row. Route metadata by
exact `titlepath`; do not alter production constants or existing work routes.

- [ ] **Step 2: Add failing fixture-boundary tests**

Assert the fixture returns the part-rich graph only for exact encoded
`titlepath=DoktorGlasParts`; ledger one exact metadata request; reject query
extras; and expose independent malformed titles for every Task 1 boundary.

Run:

```bash
cd nuxt && npm run test:unit -- test/unit/v2-server.spec.ts
```

Expected: FAIL on the missing fixture cases, then PASS after the fixture server
implements them.

- [ ] **Step 3: Add failing canonical API and SSR expectations**

For a middle `DoktorGlasParts` page, assert the API response includes source
ordered parts, exact `pageNames`, declared start/end, current source index, and
previous/next part start names. Add separate assertions for e-text and faksimil
base fixtures, partless metadata, a page gap, and a same-start tie.

Assert malformed parts return `502` before any `/txt/.../res_`, OCR, or JPEG
request. Assert an unknown canonical page remains `404`. Assert shorthand with
`?innehall&repeat=one&repeat=two` remains a raw-preserving `307` and still makes
no page-body request.

- [ ] **Step 4: Run focused SSR and verify RED**

```bash
cd nuxt && npm run test:ssr -- test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts
```

Expected: FAIL because the canonical DTO lacks the navigation projection while
existing content and shorthand assertions continue to pass.

- [ ] **Step 5: Add the minimal endpoint projection**

After resolving the requested page, calculate:

```ts
const partNavigation = resolveReaderPartNavigation(metadata.parts, currentPage.pageIndex)
const knownNames = new Set(metadata.pages.map(page => page.pageName))
```

Add `pageNames` in sorted page order, include declared start/end only when found
in `knownNames`, copy normalized parts, and spread `partNavigation` into the
shared `commonPage`. Do not alter the e-text HTML fetch or faksimil source arm.

- [ ] **Step 6: Run Task 2 tests to GREEN**

```bash
cd nuxt && npm run test:unit -- test/unit/v2-server.spec.ts
cd nuxt && npm run test:ssr -- test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts
```

Expected: PASS, exactly one metadata and one media-appropriate page asset for a
successful canonical page, zero page assets for malformed metadata, and zero
assets for shorthand.

- [ ] **Step 7: Commit Task 2**

```bash
git add nuxt/test/fixtures/reader-data.mjs nuxt/test/fixtures/v2-server.mjs \
  nuxt/test/unit/v2-server.spec.ts nuxt/test/ssr/reader.spec.ts \
  nuxt/test/ssr/reader-shorthand.spec.ts \
  'nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts'
git commit -m "feat(nuxt): project reader part navigation"
```

### Task 3: Make the closed sidebar navigation truthful and query-safe

**Files:**
- Modify: `nuxt/test/unit/reader-routes.spec.ts`
- Modify: `nuxt/app/lib/reader-routes.ts`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`

**Interfaces:**
- Consumes: Task 2 Reader navigation fields and the existing canonical `readerPageHref`/`readerTarget` ownership.
- Produces: real current-part context, part/start/end targets, exact-name goto behavior, and pure contents-open href/query parsing for Task 4.

- [ ] **Step 1: Write failing pure route/query tests**

Add exact tests for:

```ts
readerContentsIsOpen(null) === true
readerContentsIsOpen("") === true
readerContentsIsOpen("1") === false
readerContentsIsOpen([null, null]) === false
```

Add `readerContentsHref` cases that remove an existing invalid/repeated
`innehall`, preserve repeated unknown values in order, preserve canonical hit
and `storlek`, and append one bare `innehall` without `=`.

- [ ] **Step 2: Run route units and verify RED**

```bash
cd nuxt && npm run test:unit -- test/unit/reader-routes.spec.ts
```

Expected: FAIL because the contents parser/href helper is absent.

- [ ] **Step 3: Implement minimal pure query helpers**

Keep `ReaderRouteQuery` compatible with existing page/hit serialization. Add a
scalar parser for Vue's `LocationQueryValue | LocationQueryValue[]`, clone the
query while omitting only `innehall`, build the ordinary canonical href, then
append `?innehall` or `&innehall`. Do not normalize any other key/value.

- [ ] **Step 4: Write failing browser tests for closed sidebar behavior**

On the part-rich middle page, assert:

- current part uses the exact part label and one/multiple-author display rule;
- current part `titleId` produces exact `meta[name=part]`, and a page without it
  removes that metadata;
- previous/next part and first/last controls have exact public hrefs;
- disabled boundaries have no href or focus target;
- all targets preserve `q`, `hit`, `storlek`, and repeated unknown values;
- valid goto `-1` pushes one canonical navigation and updates history;
- invalid, trimmed-only, and wrong-case goto values do not change URL/content and
  expose one bounded status;
- rapid navigation never shows the previous part model under the new URL; and
- the decorative slider and keyboard-help remain `aria-hidden`.

- [ ] **Step 5: Run focused browser cases and verify RED**

```bash
cd nuxt && npm run test:e2e -- test/e2e/reader.behavior.spec.ts
```

Expected: new cases FAIL on the current inert anchors/form while all existing
Reader content, hit, faksimil, and history cases remain green.

- [ ] **Step 6: Implement the minimal sidebar behavior**

Derive `currentPart` from `reader.parts[reader.currentPartIndex]`, render exact
author links and `navTitle ?? shortTitle ?? title`, and use ordinary canonical
hrefs plus Nuxt custom navigation for real controls. Render disabled anchors as
noninteractive legacy-styled elements.

Replace the inert goto markup with a button-like anchor, conditionally rendered
text input, and submit handler:

```ts
function submitGoto(): void {
  if (!reader.value || !reader.value.pageNames.includes(gotoPage.value)) {
    gotoMessage.value = "Sidan finns inte i verket."
    return
  }
  gotoMessage.value = ""
  showGotoInput.value = false
  void router.push(readerTarget(gotoPage.value))
}
```

Reset local input/message on Reader identity change. Preserve all existing query
values. Emit the current part's `titleId` through `useHead` only when present.

Remove `aria-hidden` only from controls made real. Keep slider, keyboard help,
and deferred subnav items individually hidden from accessibility APIs.

- [ ] **Step 7: Run route and behavior suites to GREEN**

```bash
cd nuxt && npm run test:unit -- test/unit/reader-routes.spec.ts
cd nuxt && npm run test:e2e -- test/e2e/reader.behavior.spec.ts
```

Expected: PASS on desktop and mobile; query-only and page transitions keep
existing request/history ledgers exact.

- [ ] **Step 8: Commit Task 3**

```bash
git add nuxt/app/lib/reader-routes.ts nuxt/test/unit/reader-routes.spec.ts \
  nuxt/test/e2e/reader.behavior.spec.ts \
  'nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue'
git commit -m "feat(nuxt): activate reader sidebar navigation"
```

### Task 4: Add the query-owned Headless UI contents dialog

**Files:**
- Create: `nuxt/app/components/reader/ReaderContentsDialog.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/assets/styles/nuxt.scss`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`

**Interfaces:**
- Consumes: Task 3 `readerContentsIsOpen`, `readerContentsHref`, canonical page targets, normalized source-ordered parts, and existing global chapter/modal styles.
- Produces: `ReaderContentsDialog` props `{ open, authorName, title, imprintYear, parts, partHrefs }` and emits `close`/`select-page`.

- [ ] **Step 1: Add failing SSR accessibility and href assertions**

Assert a partful Reader SSR response exposes one accessible
`Innehållsförteckning` anchor whose href appends bare `innehall` while preserving
repeated unknown query state. Assert a partless response has no trigger. Assert
the client-only dialog does not create a second hidden SSR navigation tree.

- [ ] **Step 2: Add failing browser dialog/query tests**

Cover these exact transitions:

1. trigger click pushes `?innehall`, opens one dialog, traps focus, and performs
   zero additional Reader/hit requests;
2. Browser Back closes and Forward reopens after a trigger-open;
3. direct `?innehall` and `?innehall=` open after hydration;
4. `?innehall=1` and repeated `?innehall&innehall` remain closed and preserved;
5. Escape, backdrop, and `Stäng` each replace away only `innehall` and restore
   trigger focus;
6. selecting a nested part pushes its exact start page, removes only
   `innehall`, preserves `q`, `hit`, `storlek`, and repeated unknown values, and
   updates `lastPageViews`; and
7. multi-author rows use comma-separated surnames while single-author rows use
   full name and every author has an exact encoded profile href.

- [ ] **Step 3: Run focused SSR/browser tests and verify RED**

```bash
cd nuxt && npm run test:ssr -- test/ssr/reader.spec.ts
cd nuxt && npm run test:e2e -- test/e2e/reader.behavior.spec.ts
```

Expected: FAIL because no real trigger/dialog/query transitions exist.

- [ ] **Step 4: Implement the focused Headless UI component**

Use the installed primitives:

```vue
<Dialog v-if="open" :open="open" as="div" class="modal chapters fade in" @close="$emit('close')">
  <div class="modal-backdrop fade in" aria-hidden="true" @click="$emit('close')" />
  <div class="modal-dialog">
    <DialogPanel class="modal-content">
      <div class="chapters-modal modal-body">
        <button class="close_btn submit btn pull-right" type="button" @click="$emit('close')">Stäng</button>
        <DialogTitle class="sr-only">Innehållsförteckning</DialogTitle>
        <!-- exact legacy header and source-ordered part_menu rows -->
      </div>
    </DialogPanel>
  </div>
</Dialog>
```

Render ordinary hrefs for every row and emit its page name after preventing the
client click. Do not fetch or own router state inside the component.

- [ ] **Step 5: Implement page-owned open/close/select transitions**

Derive open state from the exact parser. Trigger with `router.push` and a bare
query value. Close with `router.replace` after deleting only `innehall`. Select
with `router.push` to the part page after deleting only `innehall`. Keep raw
shorthand preservation unchanged and primary Reader identity params-only.

Remove `aria-hidden` from the subnav container, expose only the real contents
trigger, and leave the other labels individually `aria-hidden`. Add only the
layout-neutral `.modal.chapters { display: block }` and z-index glue required to
activate existing `_modals.scss`; do not restyle the legacy dialog. Add
`modal-open` to the existing Reader body classes only while contents is open.

- [ ] **Step 6: Run Task 4 tests to GREEN**

```bash
cd nuxt && npm run test:ssr -- test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts
cd nuxt && npm run test:e2e -- test/e2e/reader.behavior.spec.ts
```

Expected: PASS with exact history/query transitions, one dialog, no hydration
warnings, and no request-count changes when toggling contents.

- [ ] **Step 7: Commit Task 4**

```bash
git add nuxt/app/components/reader/ReaderContentsDialog.vue nuxt/app/assets/styles/nuxt.scss \
  nuxt/test/ssr/reader.spec.ts nuxt/test/e2e/reader.behavior.spec.ts \
  'nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue'
git commit -m "feat(nuxt): open reader contents dialog"
```

### Task 5: Capture part-rich Angular authority and enforce no-visual-change parity

**Files:**
- Create: `nuxt/playwright.reader-contents-angular.config.ts`
- Create: `nuxt/test/visual/capture-reader-contents-angular.spec.ts`
- Create: `nuxt/test/e2e/reader-contents.visual.spec.ts`
- Create: `nuxt/test/visual/baselines/reader-contents-closed-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-contents-closed-mobile.png`
- Create: `nuxt/test/visual/baselines/reader-contents-open-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-contents-open-mobile.png`
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`

**Interfaces:**
- Consumes: Tasks 1–4 part-rich fixture, exact Angular `readingModule`, existing Reader authority font/static firewall helpers, and shared legacy modal styles.
- Produces: four immutable part-rich authority baselines and strict Nuxt comparison tests while retaining all ten existing baselines unchanged.

- [ ] **Step 1: Build a closed exact-request Angular authority capture**

Use `/författare/SöderbergH/titlar/DoktorGlasParts/sida/-2/etext` and the same
page HTML/font/CSS assets as existing Doktor Glas. Fulfill only exact
`get_work_info`, `get_authors`, page, stylesheet, font, background, and shell
requests. Add negative probes for extra/repeated metadata params, undeclared
authors, unlisted page/style/static assets, faksimil/OCR/search endpoints, and
reordered/duplicated shell queries. Require an empty unexpected ledger.

Assert the current part, enabled/disabled navigation targets, and part authors
before capturing desktop/mobile closed authority.

- [ ] **Step 2: Capture direct Angular `?innehall` authority**

Open the exact query-backed Angular modal, wait for fonts and modal layout, then
assert one `.chapters.modal`, exact header, source-ordered rows, authors, hrefs,
close control, `body.modal-open`, backdrop, and no extra data request. Capture
matching desktop/mobile full-page images.

Run:

```bash
cd nuxt && npx playwright test --config=playwright.reader-contents-angular.config.ts
```

Expected: 4 PASS and four new authority images. Record their SHA-256 hashes in
the capture test or adjacent provenance comments, following existing Reader
authority practice.

- [ ] **Step 3: Add strict Nuxt closed/open comparisons**

For the same route and devices, assert model/request readiness, exact current
part and navigation, zero forbidden external requests, no console/page/hydration
problems, and the exact contents-open semantics. Compare with:

```ts
await expect(page).toHaveScreenshot(name, {
  fullPage: true,
  animations: "disabled",
  caret: "hide",
  scale: "css",
  threshold: 0.1,
  maxDiffPixels: 100
})
```

Do not use masks, alternate viewports, screenshot clipping, or threshold
changes.

- [ ] **Step 4: Run the new comparison and close any proven visual delta**

Run immediately after the behavior-green component. If legacy styles already
match, record the clean run and change nothing. If it fails, confirm a real
wrapper/layout mismatch rather than a missing fixture, use that comparison as
RED, and adjust only layout-neutral Headless UI glue proven by the diff.

```bash
cd nuxt && npx playwright test test/e2e/reader-contents.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected final result: 4 PASS within the established tolerance.

- [ ] **Step 5: Prove all existing Reader visuals are immutable**

Run:

```bash
cd nuxt && npx playwright test test/e2e/reader-hit.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
cd nuxt && npx playwright test test/e2e/reader-faksimil.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: 10 PASS with no generated actual/diff images and byte-identical
committed baseline hashes. If a prior baseline changes, fix production markup or
wrapper glue; never update that baseline in this slice.

- [ ] **Step 6: Commit Task 5**

```bash
git add nuxt/playwright.reader-contents-angular.config.ts \
  nuxt/test/visual/capture-reader-contents-angular.spec.ts \
  nuxt/test/e2e/reader-contents.visual.spec.ts \
  nuxt/test/visual/baselines/reader-contents-*.png \
  nuxt/test/fixtures/reader-data.mjs nuxt/test/fixtures/v2-server.mjs \
  nuxt/app/assets/styles/nuxt.scss
git commit -m "test(nuxt): lock reader contents parity"
```

### Task 6: Whole-slice review, live smoke, and closure

**Files:**
- Modify only in-scope files listed above when a newly failing regression test demonstrates a defect.

**Interfaces:**
- Consumes: the complete typed contents/navigation slice and all prior Reader contracts.
- Produces: independently reviewed, fully verified closure evidence with unrelated workspace changes excluded.

- [ ] **Step 1: Request independent spec and quality review**

Ask one reviewer to compare implementation against the design, focusing on exact
public routes; `404`/`502` boundaries; partless/malformed graphs; source/stable
ordering; nested/overlapping/same-start semantics; query/history preservation;
Headless UI focus/close behavior; stale transitions; no extra requests; and
visual authority integrity. Address every Critical/Important finding by adding a
failing regression test before production changes, then request re-review.

- [ ] **Step 2: Run focused deterministic verification**

```bash
cd nuxt && npm run test:unit -- \
  test/unit/reader-source.spec.ts test/unit/reader-routes.spec.ts test/unit/v2-server.spec.ts
cd nuxt && npm run test:ssr -- \
  test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts
cd nuxt && npm run test:e2e -- test/e2e/reader.behavior.spec.ts
cd nuxt && npx playwright test --config=playwright.reader-contents-angular.config.ts
cd nuxt && npx playwright test test/e2e/reader-contents.visual.spec.ts \
  test/e2e/reader-hit.visual.spec.ts test/e2e/reader-faksimil.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: all focused unit/SSR/behavior checks pass; 4 Angular contents captures,
4 new Nuxt comparisons, and all 10 pre-existing Reader comparisons pass; no
unexpected requests, warnings, actual images, or diff images remain.

- [ ] **Step 3: Run full frontend and contract gates**

```bash
cd nuxt && npm run test:unit
cd nuxt && npm run test:ssr
cd nuxt && npm run typecheck
cd nuxt && npm run api:check
cd nuxt && npm run build
```

Expected: every command exits 0. `api:check` must report the checked generated
client unchanged because this slice adds no FastAPI contract.

- [ ] **Step 4: Run deterministic live smoke without widening scope**

Using the existing local Nuxt/backend servers only when already available, open
one real multi-part e-text and its faksimil sibling. Verify current/prev/next
part, first/last, exact goto, direct `?innehall`, dialog close/select, history,
Back/Forward, and no new browser warnings. Record provider unavailability as
integration state; do not substitute live screenshots for deterministic gates.

- [ ] **Step 5: Inspect diff and artifact hygiene**

```bash
git diff --check
git status --short
find nuxt/test -type f \( -name '*-actual.png' -o -name '*-diff.png' \) -print
```

Expected: no whitespace errors, no actual/diff artifacts, and no unrelated path
staged. Explicitly leave `.superpowers/` and every pre-existing dirty file
unstaged.

- [ ] **Step 6: Commit closure fixes and report**

Stage only in-scope files changed since Task 5, inspect `git diff --cached
--name-only`, and commit with a scoped message such as:

```bash
git commit -m "fix(nuxt): close reader contents navigation"
```

Report exact commits, testable canonical and shorthand URLs, focused/full test
counts, four new authority hashes, confirmation that ten existing Reader hashes
are unchanged, live-smoke outcome, and the explicitly deferred Reader program.
