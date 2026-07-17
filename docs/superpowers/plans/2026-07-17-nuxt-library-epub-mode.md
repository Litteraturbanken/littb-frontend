# Nuxt Library EPUB Mode and Standalone EPUB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one live, SSR-capable EPUB listing shared by `/bibliotek?visa=epub` and `/epub`, with exact legacy rows/downloads, durable sorting/search/pagination, and unchanged visual authority.

**Architecture:** The existing `pages/bibliotek.vue` becomes a Nuxt route alias for `/epub` and owns an atomic relevance-or-EPUB route state. A separate deterministic query-string fixture proves the strict legacy boundary; the page retains one server-private or browser-public active-mode request, latest-intent cancellation, and ordinary links.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, `$fetch`, Playwright, Vitest, existing Tailwind/legacy SCSS.

**Design:** `docs/superpowers/specs/2026-07-17-nuxt-library-epub-mode-design.md`

**Audited base:** `c786a15`

## Global Constraints

- Preserve the exact Angular visual language; do not redesign or modify copied authority SCSS/Angular source.
- `/bibliotek` without `visa=epub` must retain the existing relevance behavior and immutable desktop/mobile baselines.
- `/epub` defaults to EPUB/`popularitet`; `/epub` and Library EPUB share one aliased page/model but keep different title, heading, body class, background, tabs, and legacy mobile overflow.
- Fetch the live legacy query-string operation page-locally; add no one-use composable, store, backend endpoint, dependency, inactive count fan-out, or author aggregation.
- Make exactly one active-mode request per committed state; server uses private `libraryApiBase`, browser uses public `libraryApiBase` without private-key access.
- EPUB page size is 100; use `distinct_hits`; persist one-based `sida`; reset it on filter/sort changes; preserve newest-intent-wins behavior.
- Accept absent/null/array `suggest`, reject any other top-level `suggest`, reject malformed envelopes, omit malformed rows, and synthesize only validated/encoded safe paths.
- Keep PDF and all other deferred tabs disabled; add no modal/dropdown/listbox and therefore no unnecessary Headless UI primitive.
- EPUB download is an ordinary `download target="_self"` anchor at `/txt/epub/{author}_{title}.epub`.

---

### Task 1: Build the deterministic EPUB query-string boundary

**Files:**
- Create: `nuxt/test/fixtures/library-query-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Add fixture asset: `nuxt/test/fixtures/library-content/ljudlandskap.jpg`

**Interfaces:**
- Consumes: public `/api/query_string/etext,faksimil,pdf` and private `/legacy-api/query_string/etext,faksimil,pdf`.
- Produces: `libraryQueryStringResponse(query)`, isolated request ledger, failure flag, exact-state delays, page/filter variants, and deterministic background asset.

- [ ] **Step 1: Write failing fixture-server tests**

Add helpers for `/_library_query_requests`, `/_library_query_failure`, and
`/_library_query_delays`. Add tests equivalent to:

```ts
const path = "/api/query_string/etext,faksimil,pdf"
const response = await fetch(`${origin}${path}?q=${encodeURIComponent(
  "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (has_epub:true)"
)}&sort_field=popularity%7Cdesc&from=0&to=100`)
expect(response.status).toBe(200)
expect(await response.json()).toMatchObject({
  hits: 201,
  distinct_hits: 201,
  data: expect.any(Array)
})
expect((await libraryQueryRequests()).requests[0]).toMatchObject({
  path,
  query: { from: "0", to: "100", sort_field: "popularity|desc" }
})
```

Prove both prefixes, page two (`from=100&to=200`), filtered rows, absent and
null `suggest`, malformed top-level, malformed individual rows, independent
503 failure controls, exact delay keys (`q|sort_field|from|to`), and reset.

- [ ] **Step 2: Run the fixture tests and verify RED**

Run:

```bash
cd nuxt
yarn vitest run test/unit/v2-server.spec.ts
```

Expected: new requests/controls return 404 because the fixture operation does
not exist; all pre-existing fixture tests remain green.

- [ ] **Step 3: Add complete representative EPUB data**

Create a small reusable work factory with the exact live field types:

```js
function epubWork({
  id = "DoktorGlas",
  authorId = "SöderbergH",
  fullName = "Hjalmar Söderberg",
  surname = "Söderberg",
  year = "1905",
  role,
  title = "Doktor Glas"
} = {}) {
  return {
    _index: "etext",
    lbworkid: `lb-${id}`,
    titlepath: id,
    titleid: id,
    work_titleid: id,
    shorttitle: title,
    title: `${title}. Roman`,
    texttype: "roman",
    mediatype: "etext",
    startpagename: "-2",
    has_epub: true,
    sort_date_imprint: { plain: year },
    main_author: {
      authorid: authorId,
      full_name: fullName,
      surname,
      ...(role ? { type: role } : {})
    },
    work_authors: [{ authorid: authorId, surname }],
    export: [{ type: "epub", size: 530557 }]
  }
}
```

Export page-one, page-two, filtered, malformed-row, empty, malformed-envelope,
absent-suggest, and null-suggest responses. Keep counts deterministic at 201
without generating 100 DOM rows; response arrays may be small while
`distinct_hits` drives pagination.

- [ ] **Step 4: Implement isolated fixture state and handlers**

In `v2-server.mjs`, add independent variables and controls analogous to the
relevance fixture, with exact delay identity:

```js
function waitForLibraryQueryDelay(query) {
  const key = [query.q || "", query.sort_field || "", query.from || "", query.to || ""].join("|")
  return new Promise(resolve => setTimeout(resolve, libraryQueryDelays[key] || 0))
}
```

Handle only the exact query-string pathname for both prefixes, record the
original pathname/query, await delay, return 503 when enabled, otherwise return
`libraryQueryStringResponse(query)`. Serve
`/red/bilder/bakgrundsbilder/ljudlandskap.jpg` from the new fixture asset.

- [ ] **Step 5: Run GREEN and commit**

Run `yarn vitest run test/unit/v2-server.spec.ts`, `git diff --check`, and commit
only the fixture boundary as:

```bash
git add nuxt/test/fixtures/library-query-data.mjs \
  nuxt/test/fixtures/library-content/ljudlandskap.jpg \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git commit -m "test(nuxt): model library epub responses"
```

Expected: all fixture-server tests pass and the existing relevance ledger/state
remain isolated.

---

### Task 2: Add aliased EPUB SSR state, strict rows, and downloads

**Files:**
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/test/ssr/library.spec.ts`

**Interfaces:**
- Consumes: Task 1 private query-string fixture and existing private/public Library bases.
- Produces: aliased `/epub`, atomic `all | epub` route state, strict EPUB view rows, exact shells/sorts/downloads, and SSR page selection.

- [ ] **Step 1: Add failing SSR contract tests**

Reset both Library ledgers in `beforeEach`. Add exact assertions for:

```ts
const library = parseHTML(await (await request.get(
  "/bibliotek?visa=epub&sort=popularitet&filter=Selma"
)).text()).document
expect(library.title).toBe("Biblioteket – Titlar och författare | Litteraturbanken")
expect(library.body.className).toBe("focus page-library ready")
expect(library.querySelector("h1")?.textContent?.trim()).toBe("Botanisera i biblioteket")
expect(library.querySelector('[data-library-tab="epub"]')?.getAttribute("aria-current")).toBe("page")

const standalone = parseHTML(await (await request.get("/epub")).text()).document
expect(standalone.title).toBe("E-böcker för nedladdning | Litteraturbanken")
expect(standalone.body.className).toBe("focus page-epub ready")
expect(standalone.documentElement.getAttribute("style")).toContain("ljudlandskap.jpg")
expect(standalone.querySelector("h1")?.textContent?.trim()).toBe("Hämta e-böcker")
```

Assert Library EPUB and bare/canonical standalone EPUB render the same EPUB
row model but different shell/tab visibility. Assert the private request has
the exact include/exclude strings, prefixed `has_epub:true` query,
`partial_string=true`, `suggest=true`, sort, and offsets; relevance ledger is
empty.

Add cases for all four sort expressions, `sida=2`, invalid pages normalized to
1 while preserving unrelated query keys, absent/null suggestions, malformed
envelope error, valid empty response, malformed row omission, and unsafe
identifier omission. Assert exact destinations:

```ts
expect(titleHref).toBe("/författare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken")
expect(authorHref).toBe("/författare/S%C3%B6derbergH")
expect(downloadHref).toBe("/txt/epub/S%C3%B6derbergH_DoktorGlas.epub")
expect(download.getAttribute("download")).not.toBeNull()
expect(download.getAttribute("target")).toBe("_self")
```

- [ ] **Step 2: Run SSR RED**

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3012 yarn playwright test \
  test/ssr/library.spec.ts --project=ssr
```

Expected: `/epub` is 404 and Library ignores EPUB mode/query-string fixture.

- [ ] **Step 3: Implement the atomic mode boundary**

Add `definePageMeta({ alias: ["/epub"] })`. Define local `LibraryMode`,
`EpubSortKey`, `LibraryRouteState`, `EpubResult`, and `EpubResponse` types. Parse
path/mode/filter/sort/page together:

```ts
function routeState(path: string, query: LocationQuery): LibraryRouteState {
  const standalone = path === "/epub"
  const mode: LibraryMode = standalone || queryValue(query.visa) === "epub" ? "epub" : "all"
  const parsed = Number(queryValue(query.sida))
  return {
    standalone,
    mode,
    filter: queryValue(query.filter),
    sort: mode === "epub" ? epubSortKey(query.sort) : relevanceSortKey(query.sort),
    page: Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
  }
}
```

Keep relevance request/parsing unchanged. Add the exact EPUB include/exclude,
sort map, prefixed query builder, `from/to`, top-level guard, row validator,
path-segment validator, and path synthesis from the design. The initial
`useAsyncData` key includes path/mode/filter/sort/page and dispatches one mode
request using the existing compile-time private/public base selection.

- [ ] **Step 4: Render exact route-owned shell and EPUB rows**

Branch `useSeoMeta`, `useHead`, heading, and visible tabs from `standalone` and
`mode`. Give each tab `data-library-tab="<mode>"`; EPUB is enabled and active,
PDF remains disabled. Retain every existing relevance DOM/class string.

Add EPUB sort links and the four-column work rows using existing authority
classes and data hooks:

```html
<a data-library-epub-title :href="item.titleHref">{{ item.title }}</a>
<span data-library-epub-year>{{ item.year }}</span>
<a data-library-epub-author :href="item.authorHref">{{ item.surname }}{{ item.roleSuffix }}</a>
<a data-library-epub-download :href="item.downloadHref" download target="_self">Hämta</a>
```

Render semantic pagination from `distinctHits`, page size 100, maximum ten
numeric buttons, forced ellipses, `Föregående`/`Nästa`, active `aria-current`,
and disabled boundaries. At this task boundary SSR anchors may use exact query
hrefs; Task 3 wires SPA intent.

- [ ] **Step 5: Run SSR GREEN and regressions**

Run the focused SSR suite, `yarn typecheck`, and the existing Library relevance
SSR tests as the same file. Expected: every new EPUB contract passes and all
existing relevance assertions remain green.

- [ ] **Step 6: Commit the SSR slice**

Run `git diff --check`, inspect the diff for no style/baseline changes, and
commit:

```bash
git add nuxt/app/pages/bibliotek.vue nuxt/test/ssr/library.spec.ts
git commit -m "feat(nuxt): render library epub mode"
```

---

### Task 3: Make EPUB search, sorts, pagination, and history fully interactive

**Files:**
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`

**Interfaces:**
- Consumes: Task 2 atomic route state, request builders, view models, and SSR controls.
- Produces: one public request per client state; URL-backed mode/filter/sort/page; stale-safe Back/Forward; exact downloads.

- [ ] **Step 1: Add failing browser tests**

Add tests that enter Library EPUB by clicking its enabled tab and standalone
EPUB both directly and by SPA navigation. Assert:

- tab click writes `visa=epub&sort=popularitet`, resets `sida`, makes exactly
  one `/api/query_string/...` request, and renders the expected row;
- bare `/epub` has the EPUB default without redirecting and no private-config
  warning/client hydration duplicate;
- input waits 300 ms, resets page 1, retains mode/sort, and sends the exact
  sanitized `has_epub:true AND (...)` query;
- each sort resets page 1 and emits its exact expression;
- Next/page 2 writes `sida=2`, emits `from=100&to=200`, changes marker rows,
  and keeps exact title/author/download anchors;
- Back/Forward restores filter/sort/page/rows once per route state;
- delayed filter, sort, and page requests cannot replace the latest intent;
- direct download has exact `href`, `download`, and `target="_self"`;
- relevance behavior, reset, and default SPA-entry tests remain unchanged.

Use isolated delay keys such as:

```ts
await request.put(`${fixture}/_library_query_delays`, {
  data: {
    [`${prefixedSelma}|popularity|desc|0|100`]: 900
  }
})
```

- [ ] **Step 2: Run browser RED**

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3012 yarn playwright test \
  test/e2e/library.behavior.spec.ts --project=desktop-chromium
```

Expected: SSR rows exist, but tab/page controls do not yet own route intent and
the public request ledger/state assertions fail.

- [ ] **Step 3: Generalize existing latest-intent state without a composable**

Replace relevance-only `QueryState` with the atomic route state. `stateKey`,
`queryFor`, `runBrowserRequest`, `persistAndRequest`, `beginIntent`, and the
route watcher must carry the complete mode/filter/sort/page snapshot. Select
the public request builder by mode and retain the existing abort/version guard.

Add intent handlers with these exact state changes:

```ts
selectMode("epub")  // mode epub, sort popularitet, page 1
scheduleSearch()    // same mode/sort, new filter, page 1, 300 ms
selectSort(key)     // same mode/filter, new sort, page 1
selectPage(page)    // same mode/filter/sort, bounded page
```

For standalone `/epub`, omit `visa=epub` only when building its URL; retain it
on `/bibliotek`. Omit `sida` at page 1 and write it at page 2+. Preserve every
route query key not owned by `visa`, `filter`, `sort`, or `sida`.

- [ ] **Step 4: Wire semantic controls and verify GREEN**

Prevent default on enabled mode/sort/page anchors and call the handlers. Keep
ordinary download/title/author anchors untouched. Run the focused browser suite
until all old and new cases pass without warnings/errors or duplicate requests.

- [ ] **Step 5: Run integration and commit**

Run:

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3012 yarn playwright test \
  test/ssr/library.spec.ts --project=ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3012 yarn playwright test \
  test/e2e/library.behavior.spec.ts --project=desktop-chromium
yarn typecheck
git diff --check
```

Commit only page/browser behavior:

```bash
git add nuxt/app/pages/bibliotek.vue nuxt/test/e2e/library.behavior.spec.ts
git commit -m "feat(nuxt): navigate library epub results"
```

---

### Task 4: Lock Angular/Nuxt EPUB parity and close the slice

**Files:**
- Create: `nuxt/test/visual/capture-library-epub-angular.spec.ts`
- Create: `nuxt/playwright.library-epub-angular.config.ts`
- Modify: `nuxt/test/e2e/library.visual.spec.ts`
- Create baselines only from deterministic Angular authority:
  - `nuxt/test/visual/baselines/library-epub-desktop.png`
  - `nuxt/test/visual/baselines/library-epub-mobile.png`
  - `nuxt/test/visual/baselines/standalone-epub-desktop.png`
  - `nuxt/test/visual/baselines/standalone-epub-mobile.png`
- Modify Task 1 fixture/page markup only if a demonstrated bounded parity defect requires it.

**Interfaces:**
- Consumes: the identical Task 1 EPUB work fixture in Angular interception and Nuxt fixture server.
- Produces: immutable desktop/mobile authority captures, Nuxt visual assertions, and a complete regression gate.

- [ ] **Step 1: Add Angular capture with strict request isolation**

Create a dedicated config using the existing Angular capture server pattern at
1440×1000 and iPhone 13 widths. In the capture test, intercept the exact
query-string operation with Task 1 data. Fulfill known Angular fan-out
(`get_authors`, `get_authorkeywords`, `imprint_range`, `log_library`, inactive
count calls, background XML/assets, and fonts) deterministically; abort and
record every unexpected network request.

Capture canonical states only:

```text
/bibliotek?visa=epub&sort=popularitet
/epub?visa=epub&sort=popularitet
```

Assert ready body, exact active tabs, result count, and background before saving
full-page authority images. Do not use broken bare Angular `/epub` as a golden.

- [ ] **Step 2: Capture authority and inspect it**

Run:

```bash
cd nuxt
yarn playwright test --config=playwright.library-epub-angular.config.ts
```

Inspect all four generated images. Expected: Library and standalone shells keep
their distinct backgrounds/corridors; standalone mobile retains legacy
horizontal overflow; no unexpected requests or Angular errors.

- [ ] **Step 3: Add Nuxt visual assertions and verify RED/GREEN honestly**

Extend `library.visual.spec.ts` with Library EPUB and standalone EPUB cases at
both projects. Block nonlocal traffic, require exact data hooks/download rows,
wait for assets, check background CSS, and compare to the new authority images
with the established screenshot settings:

```ts
await expect(page).toHaveScreenshot(filename, {
  fullPage: true,
  animations: "disabled",
  caret: "hide",
  scale: "css",
  threshold: 0.1,
  maxDiffPixels: 100
})
```

If comparison fails, inspect the image diff and correct only evidenced Nuxt
markup/class drift. Never regenerate authority from Nuxt and never loosen the
tolerance to hide drift.

- [ ] **Step 4: Run the complete slice closure gate**

```bash
cd nuxt
yarn vitest run test/unit/v2-server.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3012 yarn playwright test \
  test/ssr/library.spec.ts --project=ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3012 yarn playwright test \
  test/e2e/library.behavior.spec.ts --project=desktop-chromium
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3012 yarn playwright test \
  test/e2e/library.visual.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn typecheck
yarn build
git diff --check
```

Expected: fixtures, all Library SSR/browser behavior, original relevance visual
baselines, new EPUB parity, typecheck, and build pass with no baseline drift
outside the four authority additions.

- [ ] **Step 5: Live interval check and commit**

With the shared dev server, inspect `/bibliotek`,
`/bibliotek?visa=epub&sort=popularitet`, bare `/epub`, canonical `/epub`, and
page 2 in the in-app browser. Confirm live rows/downloads, exact shell changes,
Back/Forward, and no fresh errors/warnings. Compare canonical Angular and Nuxt
at the same viewport as a sanity check; volatile live counts are not asserted.

Commit capture config/tests/baselines and any demonstrated bounded parity fix:

```bash
git add nuxt/playwright.library-epub-angular.config.ts \
  nuxt/test/visual/capture-library-epub-angular.spec.ts \
  nuxt/test/e2e/library.visual.spec.ts \
  nuxt/test/visual/baselines/library-epub-desktop.png \
  nuxt/test/visual/baselines/library-epub-mobile.png \
  nuxt/test/visual/baselines/standalone-epub-desktop.png \
  nuxt/test/visual/baselines/standalone-epub-mobile.png
git commit -m "test(nuxt): match library epub visuals"
```
