# Library Page Componentization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3,768-line Library page renderer with a route-level controller and focused, typed Vue components while preserving exact behavior and visual output.

**Architecture:** `bibliotek.vue` remains the only owner of route parsing, SSR data loading, API requests, debounce/abort logic, canonical state, history, and href creation. Children receive narrow typed view models, render the existing DOM, and emit semantic user intents; only the source-download workspace owns local selection and popover DOM lifecycle.

**Tech Stack:** Nuxt 4.4.8, Vue 3.5.39, TypeScript 5.9.3, Tailwind CSS 3.4.18, Headless UI 1.7.23, Vue Multiselect 3.5.0, Vitest 4.1.10, Playwright 1.61.1.

## Global Constraints

- Preserve exact visual output, existing DOM order, legacy classes, `data-library-*` hooks, labels, roles, `aria-*` attributes, keyboard order, and tooltip behavior.
- Preserve every URL, query key, SSR href, request body, request count, debounce/abort owner, push/replace history decision, and canonical-page rule.
- `bibliotek.vue` retains all route, router, SSR, fetch, API-client, request-ownership, advanced-query composition, SEO, and expanded-work query state.
- No child may call `useRoute`, `useRouter`, `useAsyncData`, `useFetch`, `$fetch`, `createLbApiClient`, or `useLbApiClient`.
- Do not add a page-only composable. Do not consolidate response ownership or redesign product behavior during extraction.
- Do not introduce one generic results mega-component. Use mode-specific result components and one shared paginator.
- Every navigation control must retain a real SSR-safe `RouteLocationRaw` or href; do not replace links with click-only buttons.
- Move scoped styles with their owning DOM and introduce no layout-affecting wrapper.
- Export no mutable module-level arrays, Sets, Maps, or option objects. Component models are readonly presentation data and discriminated event payloads.
- Normally keep each extracted production component below 600 lines and reduce `bibliotek.vue` to approximately 1,800–2,100 lines.
- Use TDD: capture a focused RED before production edits, then GREEN, refactor, commit, and obtain independent spec/code-quality review before the next task.
- Preserve unrelated `nuxt/quality/semantic-review-ledger.json` and `nuxt/quality/semantic-reviews/*.json` changes; never stage them in this plan.

---

### Task 1: Typed component models and shared pagination

**Files:**
- Create: `nuxt/app/lib/library/component-models.ts`
- Create: `nuxt/app/components/library/LibraryPagination.vue`
- Create: `nuxt/test/unit/library-component-boundaries.spec.ts`
- Modify: `nuxt/vitest.config.ts`
- Modify: `nuxt/vitest.component.config.ts`
- Modify: `nuxt/app/pages/bibliotek.vue:1809-1839,2606-2659,2802-2855,3158-3211,3371-3424`

**Interfaces:**
- Produces `LibraryPaginationModel`, `LibraryPaginationEntry`, and `LibraryPagination.vue` for Tasks 3–6.
- Consumes existing `LegacyPaginationItem` from `app/lib/legacy-pagination.ts` and precomputed page hrefs from the page.

- [ ] **Step 1: Write the failing component and ownership tests**

Add `library-component-boundaries.spec.ts` with a source-boundary helper and an actual mounted pagination contract:

```ts
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const nuxtRoot = resolve(import.meta.dirname, "../..")
const source = (path: string) => readFile(resolve(nuxtRoot, path), "utf8")

describe("Library component ownership", () => {
  test("the page delegates pagination markup to one shared component", async () => {
    const page = await source("app/pages/bibliotek.vue")
    expect(page).toContain("<LibraryPagination")
    expect(page).not.toContain("data-library-pagination-previous")
    expect(page).not.toContain("data-library-pagination-next")
  })
})
```

In the same file, add a component-project test that mounts `LibraryPagination` with current page 2, previous/next targets, numeric entries and an ellipsis; assert exact link/text order, `aria-current`, disabled behavior, data attributes, and emitted `select-page` values. Include the new spec in `vitest.component.config.ts` and exclude it from the node-only project in `vitest.config.ts`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
```

Expected: FAIL because `LibraryPagination.vue` and the page delegation do not exist.

- [ ] **Step 3: Add exact readonly pagination contracts**

Create:

```ts
import type { RouteLocationRaw } from "vue-router"

export type LibraryPaginationEntry = Readonly<{
  key: string
  page: number
  label: string
  to: RouteLocationRaw
  ellipsis: boolean
}>

export type LibraryPaginationModel = Readonly<{
  currentPage: number
  pageCount: number
  previous: RouteLocationRaw | null
  next: RouteLocationRaw | null
  entries: readonly LibraryPaginationEntry[]
}>
```

The page creates mode-specific computed models from `pages`, `allPageHref`, `latestPageHref`, `browsePageHref`, and `epubPageHref`. Keep `selectPage(page)` in the page.

- [ ] **Step 4: Extract the paginator and replace all four blocks**

`LibraryPagination.vue` renders the exact existing `<ul>`/`<li>` structure. It accepts:

```ts
defineProps<{
  model: LibraryPaginationModel
}>()
const emit = defineEmits<{ selectPage: [page: number] }>()
```

Use `NuxtLink` for enabled previous, numbered, and next targets. Preserve `@click.prevent="emit('selectPage', page)"`, all data attributes, disabled text, ellipsis semantics, and `aria-current="page"`.

- [ ] **Step 5: Verify focused and adjacent behavior**

Run:

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts test/unit/library-route-state.spec.ts
yarn playwright test test/ssr/library.spec.ts --project=ssr --grep "pagination|second all-results|canonicalizes"
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "pagination|Back and Forward"
yarn eslint app/lib/library/component-models.ts app/components/library/LibraryPagination.vue app/pages/bibliotek.vue test/unit/library-component-boundaries.spec.ts --max-warnings 0
yarn typecheck
git diff --check
```

Expected: all commands pass with no new warnings.

- [ ] **Step 6: Commit and request independent review**

```bash
git add nuxt/app/lib/library/component-models.ts nuxt/app/components/library/LibraryPagination.vue nuxt/app/pages/bibliotek.vue nuxt/test/unit/library-component-boundaries.spec.ts nuxt/vitest.config.ts nuxt/vitest.component.config.ts
git commit -m "refactor(library): extract shared pagination"
```

Review both specification fidelity and code quality before Task 2.

### Task 2: Mode tabs

**Files:**
- Create: `nuxt/app/components/library/LibraryModeTabs.vue`
- Modify: `nuxt/app/lib/library/component-models.ts`
- Modify: `nuxt/app/pages/bibliotek.vue:1694-1742,2270-2405`
- Modify: `nuxt/test/unit/library-component-boundaries.spec.ts`

**Interfaces:**
- Produces `LibraryModeTab` and `LibraryModeTabs.vue`.
- Consumes page-owned mode/count/href state. It performs navigation only through rendered `NuxtLink`s.

- [ ] **Step 1: Add a RED ownership and rendering contract**

Add a source assertion that `bibliotek.vue` uses `<LibraryModeTabs` and no longer owns `data-library-tab`. Mount the child with ordinary and standalone tab arrays; assert labels, counts, active classes, disabled presentation, exact hrefs, and `aria-current`.

- [ ] **Step 2: Run focused RED**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
```

Expected: FAIL because the tab child is absent.

- [ ] **Step 3: Add the tab model and child**

```ts
import type { LibraryMode } from "./navigation"

export type LibraryModeTab = Readonly<{
  mode: LibraryMode
  label: string
  count: number | null
  to: RouteLocationRaw
  active: boolean
  disabledLook: boolean
  separatorBefore: boolean
}>
```

Build `computed<readonly LibraryModeTab[]>` in the page from existing `stateHref`/mode hrefs and summary counts. Move the current tab markup exactly into `LibraryModeTabs.vue`; do not emit a click event or call `selectMode`, because the real link must remain the navigation owner.

- [ ] **Step 4: Verify tabs, SSR hrefs, and history**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
yarn playwright test test/ssr/library.spec.ts --project=ssr --grep "tabs|standalone EPUB|ordinary Strindberg"
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "tabs retain|tab totals|Författare, Verk, and Dikt|standalone EPUB and PDF tabs"
yarn eslint app/lib/library/component-models.ts app/components/library/LibraryModeTabs.vue app/pages/bibliotek.vue test/unit/library-component-boundaries.spec.ts --max-warnings 0
yarn typecheck
git diff --check
```

- [ ] **Step 5: Commit and request independent review**

```bash
git add nuxt/app/lib/library/component-models.ts nuxt/app/components/library/LibraryModeTabs.vue nuxt/app/pages/bibliotek.vue nuxt/test/unit/library-component-boundaries.spec.ts
git commit -m "refactor(library): extract mode tabs"
```

### Task 3: All and Latest result components

**Files:**
- Create: `nuxt/app/components/library/LibraryAllResults.vue`
- Create: `nuxt/app/components/library/LibraryLatestResults.vue`
- Modify: `nuxt/app/lib/library/component-models.ts`
- Modify: `nuxt/app/lib/library/view-model.ts` to export the existing `LibraryResult` and `LatestResult` types
- Modify: `nuxt/app/pages/bibliotek.vue:2408-2855`
- Modify: `nuxt/test/unit/library-component-boundaries.spec.ts`

**Interfaces:**
- Consumes `LibraryResponse`, `LatestResponse`, typed sort models, typed pagination models, page-precomputed imprint-year targets, and loading state.
- Emits `select-sort`, `toggle-hide-1800`, and `select-page`; the page performs every state/history mutation.

- [ ] **Step 1: Add RED ownership contracts**

Assert that the page uses both components and no longer contains `data-library-result` or `data-library-latest-row`. Add mounted smoke contracts covering failure, empty, loading, one mixed result with highlight markup, and one Latest date group. The production change that makes these tests pass is moving the existing markup into the correct child without changing its attributes.

- [ ] **Step 2: Run focused RED**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
```

- [ ] **Step 3: Add narrow view models and export existing result types**

Define these readonly models:

```ts
export type LibrarySortOption<Key extends string> = Readonly<{
  key: Key
  label: string
  to: RouteLocationRaw
  active: boolean
}>

export type LibraryImprintYearTarget = Readonly<{
  year: string
  to: RouteLocationRaw
}>
```

Do not duplicate response shapes. Export the already defined `LibraryResult` and `LatestResult` from `view-model.ts` and refer to `LibraryResponse`/`LatestResponse` from `page-results.ts`.

- [ ] **Step 4: Extract both renderers**

Import `vLibraryTooltip` locally where used. Preserve mixed external/download/author branching, highlight fragments and hit spans, author contribution suffixes, link/download attributes, group headers, loading-under-committed-results behavior, and exact data hooks. Use `LibraryPagination` inside both children.

- [ ] **Step 5: Verify All/Latest semantics and visuals**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts test/unit/library-contract.spec.ts
yarn playwright test test/ssr/library.spec.ts test/ssr/library-sort-hrefs.spec.ts --project=ssr --grep "default Library|latest|all-results|imprint|sort"
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "Library reset|Nytt|all-results|highlight|tooltip|imprint year"
yarn eslint app/components/library/LibraryAllResults.vue app/components/library/LibraryLatestResults.vue app/lib/library/component-models.ts app/lib/library/view-model.ts app/pages/bibliotek.vue test/unit/library-component-boundaries.spec.ts --max-warnings 0
yarn typecheck
git diff --check
```

- [ ] **Step 6: Commit and request independent review**

```bash
git add nuxt/app/components/library/LibraryAllResults.vue nuxt/app/components/library/LibraryLatestResults.vue nuxt/app/lib/library/component-models.ts nuxt/app/lib/library/view-model.ts nuxt/app/pages/bibliotek.vue nuxt/test/unit/library-component-boundaries.spec.ts
git commit -m "refactor(library): extract mixed and latest results"
```

### Task 4: Author and quick-download result components

**Files:**
- Create: `nuxt/app/components/library/LibraryAuthorResults.vue`
- Create: `nuxt/app/components/library/LibraryDownloadResults.vue`
- Modify: `nuxt/app/lib/library/component-models.ts`
- Modify: `nuxt/app/lib/library/view-model.ts` to export the existing `DownloadResult` type
- Modify: `nuxt/app/pages/bibliotek.vue:2857-2950,3213-3424`
- Modify: `nuxt/test/unit/library-component-boundaries.spec.ts`

**Interfaces:**
- Author component consumes `AuthorBrowseResponse`, author sort targets, loading state, and show-all state; emits `select-sort` and `show-all`.
- Download component consumes EPUB/PDF discriminated mode, `EpubResponse`, sort targets, pagination, and loading state; emits `select-sort` and `select-page`.

- [ ] **Step 1: Add RED component-ownership and mounted rendering tests**

Assert the page delegates `data-library-author-row`, `data-library-epub-row`, and `data-library-pdf-row`. Mount each child with a representative row and assert real title/author/download hrefs, tooltip hooks, `(red.)`, year target, loading, empty, and failed variants.

- [ ] **Step 2: Run RED, then extract exact markup**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
```

Move current markup and local tooltip directive registration. Keep author count/disclosure state and page/sort/history mutations in `bibliotek.vue`. Use the shared paginator for EPUB/PDF.

- [ ] **Step 3: Verify modes and downloads**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts test/unit/library-contract.spec.ts
yarn playwright test test/ssr/library.spec.ts --project=ssr --grep "authors|EPUB|PDF|imprint"
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "Författare|EPUB|PDF|download|role suffix|pagination"
yarn eslint app/components/library/LibraryAuthorResults.vue app/components/library/LibraryDownloadResults.vue app/lib/library/component-models.ts app/lib/library/view-model.ts app/pages/bibliotek.vue test/unit/library-component-boundaries.spec.ts --max-warnings 0
yarn typecheck
git diff --check
```

- [ ] **Step 4: Commit and request independent review**

```bash
git add nuxt/app/components/library/LibraryAuthorResults.vue nuxt/app/components/library/LibraryDownloadResults.vue nuxt/app/lib/library/component-models.ts nuxt/app/lib/library/view-model.ts nuxt/app/pages/bibliotek.vue nuxt/test/unit/library-component-boundaries.spec.ts
git commit -m "refactor(library): extract author and format results"
```

### Task 5: Ordinary Works and Parts results

**Files:**
- Create: `nuxt/app/components/library/LibraryBrowseResults.vue`
- Modify: `nuxt/app/lib/library/component-models.ts`
- Modify: `nuxt/app/pages/bibliotek.vue:2952-3211`
- Modify: `nuxt/test/unit/library-component-boundaries.spec.ts`

**Interfaces:**
- Consumes `{ mode: "works" | "parts", response: BrowseResponse, expandedKey, loading, sort, pagination, imprintYearTargets }`.
- Emits `select-sort`, `select-page`, and `toggle-work(key)`; the page retains `expandedWorkKey` and `title` query synchronization.

- [ ] **Step 1: Add RED ownership and interaction contracts**

Assert the page delegates ordinary `data-library-work-row` and `data-library-part-row`. Mount the child with one Work and one Part in separate cases; assert title/author/year hrefs, tooltip attributes, action disclosure, download filename, and emitted toggle key from Enter/click.

- [ ] **Step 2: Run RED and extract the renderer**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
```

Move the existing work/part blocks and work-toggle scoped styles. Keep link building and expanded query state in the page. Do not include source-selection rows; those belong to Task 6.

- [ ] **Step 3: Verify Works/Parts behavior**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
yarn playwright test test/ssr/library.spec.ts --project=ssr --grep "works|parts|imprint"
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "Works|Dikt|representations|encoded Library Reader link|tooltip"
yarn eslint app/components/library/LibraryBrowseResults.vue app/lib/library/component-models.ts app/pages/bibliotek.vue test/unit/library-component-boundaries.spec.ts --max-warnings 0
yarn typecheck
git diff --check
```

- [ ] **Step 4: Commit and request independent review**

```bash
git add nuxt/app/components/library/LibraryBrowseResults.vue nuxt/app/lib/library/component-models.ts nuxt/app/pages/bibliotek.vue nuxt/test/unit/library-component-boundaries.spec.ts
git commit -m "refactor(library): extract browse results"
```

### Task 6: Source-download workspace

**Files:**
- Create: `nuxt/app/components/library/LibrarySourceDownloadWorkspace.vue`
- Modify: `nuxt/app/lib/library/component-models.ts`
- Modify: `nuxt/app/pages/bibliotek.vue:543-726,1274-1354,1861-1908,2952-3120,3427-3600,3617-3635,3737-3740`
- Modify: `nuxt/test/unit/library-component-boundaries.spec.ts`

**Interfaces:**
- Consumes source-capable `BrowseResponse`, sort model, pagination model, loading state, and page-precomputed imprint targets.
- Owns selected-work `Map`, selected-format `Set`, popover refs/placement/listeners/focus, and native `/api/download` form payload.
- Emits only `select-sort`, `select-page`, `select-imprint-year`, and page-owned expansion intent if retained by source rows.

- [ ] **Step 1: Add RED ownership and lifecycle contracts**

Assert the page no longer contains `data-library-source-checkbox`, `data-library-format-popover`, or `data-library-download-submit`, and uses the workspace once. Add component tests proving separate mounts do not share selections, a result-prop refresh retains only still-valid selections, and unmount closes the popover. Use the existing browser assertions to characterize leaving download mode, the exact `body > [data-library-format-popover]` placement, Escape focus restoration, and document/window listener cleanup.

- [ ] **Step 2: Run focused RED**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
yarn playwright test test/e2e/library-advanced.behavior.spec.ts --project=desktop-chromium --grep "format|popover|download"
```

The structural test must fail before production changes; existing behavior tests establish the compatibility baseline.

- [ ] **Step 3: Move the workspace atomically**

Move source-mode row markup, selection state, format derivation, Teleport, all three DOM refs, inner scrollport, placement, focus handoff/restoration, Escape/resize/capture-scroll listeners, and scoped styles together. Do not split selection and the sidebar across siblings. Reconcile refreshed result props by work identity without discarding still-valid selected works. Keep exact 10px trigger gap and 8px viewport padding, outer overflow visible, and the existing native form field names/tokens.

- [ ] **Step 4: Verify source download and event cleanup**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
yarn playwright test test/ssr/library.spec.ts --project=ssr --grep "download mode"
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium --grep "download-mode|nedladdning|source tokens"
yarn playwright test test/e2e/library-advanced.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium --grep "format|popover|download"
yarn eslint app/components/library/LibrarySourceDownloadWorkspace.vue app/lib/library/component-models.ts app/pages/bibliotek.vue test/unit/library-component-boundaries.spec.ts --max-warnings 0
yarn typecheck
git diff --check
```

- [ ] **Step 5: Commit and request independent review**

```bash
git add nuxt/app/components/library/LibrarySourceDownloadWorkspace.vue nuxt/app/lib/library/component-models.ts nuxt/app/pages/bibliotek.vue nuxt/test/unit/library-component-boundaries.spec.ts
git commit -m "refactor(library): extract source download workspace"
```

### Task 7: Search and advanced controls

**Files:**
- Create: `nuxt/app/components/library/LibrarySearchControls.vue`
- Create: `nuxt/app/components/library/LibraryAdvancedFilters.vue`
- Modify: `nuxt/app/lib/library/component-models.ts`
- Modify: `nuxt/app/pages/bibliotek.vue:525-533,1912-2269,3637-3735,3746-3766`
- Modify: `nuxt/test/unit/library-component-boundaries.spec.ts`

**Interfaces:**
- Search child receives displayed filter/reset/disclosure state and emits `update-filter`, `submit`, `reset`, and `toggle-advanced`.
- Advanced child receives `LibraryAdvancedControlsModel` and emits discriminated `LibraryAdvancedChange` payloads plus download-mode/visible-selection intents.
- Page retains the debounce timer, draft snapshot, route preservation, options-failure fallback, chronology validation, and all commits.

- [ ] **Step 1: Add RED ownership and controlled-input contracts**

Assert the page uses both children and no longer owns `data-library-filter` or `data-library-advanced-panel`. Mount `LibrarySearchControls` and assert exact emitted input/submit/reset/disclosure intents. Mount `LibraryAdvancedFilters` with unavailable about-author options, unavailable chronology, invalid chronology drafts, populated groups, and standalone mode; assert rendered/hidden/disabled controls and field-specific emitted values without any router dependency.

- [ ] **Step 2: Run focused RED**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts
```

- [ ] **Step 3: Define the discriminated control API and extract markup**

Use:

```ts
export type LibraryAdvancedChange =
  | Readonly<{ field: "gender"; value: NonNullable<LibraryFilters["gender"]> | "" }>
  | Readonly<{ field: "keywords"; value: readonly LibraryCategory[] }>
  | Readonly<{ field: "narrowingKeywords"; value: readonly LibraryCategory[] }>
  | Readonly<{ field: "aboutAuthorIds"; value: readonly string[] }>
  | Readonly<{ field: "media"; value: readonly LibraryMedia[] }>
  | Readonly<{ field: "languages"; value: readonly LibraryLanguage[] }>
  | Readonly<{ field: "chronologyDraft"; from: string; to: string }>
  | Readonly<{ field: "chronologyRange"; value: readonly [number, number] }>
```

Import `LibraryFilters` from `app/lib/library/index.ts` and `LibraryCategory`, `LibraryMedia`, and `LibraryLanguage` from `app/lib/library/filter-options.ts`. Move only UI-local multiselect/slider mechanics. The page translates events into the existing `commit*`, draft, `pushAdvancedQuery`, and debounce functions. Move advanced/multiselect/chronology scoped CSS with the panel.

- [ ] **Step 4: Verify search, filters, chronology, and multiselect parity**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts test/unit/library-route-state.spec.ts test/unit/library-filter-options.spec.ts
yarn playwright test test/ssr/library.spec.ts --project=ssr --grep "advanced|chronology|options|standalone"
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium --grep "debounce|submit|reset|advanced chronology"
yarn playwright test test/e2e/library-advanced.behavior.spec.ts test/e2e/library-multiselect-parity.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn eslint app/components/library/LibrarySearchControls.vue app/components/library/LibraryAdvancedFilters.vue app/lib/library/component-models.ts app/pages/bibliotek.vue test/unit/library-component-boundaries.spec.ts --max-warnings 0
yarn typecheck
git diff --check
```

- [ ] **Step 5: Commit and request independent review**

```bash
git add nuxt/app/components/library/LibrarySearchControls.vue nuxt/app/components/library/LibraryAdvancedFilters.vue nuxt/app/lib/library/component-models.ts nuxt/app/pages/bibliotek.vue nuxt/test/unit/library-component-boundaries.spec.ts
git commit -m "refactor(library): extract search controls"
```

### Task 8: Ownership audit and complete verification

**Files:**
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/app/lib/library/component-models.ts`
- Modify: extracted Library components only where dead props/imports/styles remain
- Modify: `nuxt/test/unit/library-component-boundaries.spec.ts`
- Do not modify visual baselines unless the user separately approves a proven intended visual change

**Interfaces:**
- Consumes every component contract from Tasks 1–7.
- Produces the final small page controller and verification report in this plan’s ignored SDD workspace.

- [ ] **Step 1: Add final architectural assertions and capture RED**

Add assertions that:

```ts
expect(page.split("\n").length).toBeLessThanOrEqual(2100)
for (const component of componentSources) {
  expect(component.split("\n").length).toBeLessThanOrEqual(600)
  expect(component).not.toMatch(/\b(useRoute|useRouter|useAsyncData|useFetch|\$fetch|createLbApiClient|useLbApiClient)\s*\(/)
}
```

Also assert every expected child appears exactly once in the page and distinctive owned data hooks no longer appear there. Run the test before cleanup and record any precise failure.

- [ ] **Step 2: Remove only proven dead orchestration glue and styles**

Delete unused imports, computed adapters, handlers, refs, and scoped styles. Do not consolidate remaining fetch or response state. Run the focused boundary test after each cleanup group.

- [ ] **Step 3: Run the complete Library test matrix**

```bash
cd nuxt
yarn vitest run test/unit/library-component-boundaries.spec.ts test/unit/library-route-state.spec.ts test/unit/library-contract.spec.ts test/unit/library-filter-options.spec.ts test/unit/library-tooltip.spec.ts
yarn playwright test test/ssr/library.spec.ts test/ssr/library-sort-hrefs.spec.ts --project=ssr
yarn playwright test test/e2e/library.behavior.spec.ts test/e2e/library-advanced.behavior.spec.ts test/e2e/library-multiselect-parity.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn playwright test test/e2e/library.visual.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Expected: behavior and SSR suites pass. Visual failures must be triaged against pre-refactor/base artifacts; do not update baselines to hide drift.

- [ ] **Step 4: Run the complete static and production gates**

```bash
cd nuxt
yarn lint
yarn typecheck
yarn policy:check
yarn quality:maintainability
yarn quality:review:inventory
yarn quality:review:check
yarn build
git diff --check
```

Confirm the semantic inventory contains no oversized new component packet, no new maintainability finding, and no route/fetch capability in children.

- [ ] **Step 5: Audit scope and commit cleanup**

```bash
git status --short
git diff --stat
git diff -- nuxt/app/pages/bibliotek.vue nuxt/app/components/library nuxt/app/lib/library/component-models.ts nuxt/test/unit/library-component-boundaries.spec.ts
git add nuxt/app/pages/bibliotek.vue nuxt/app/components/library nuxt/app/lib/library/component-models.ts nuxt/test/unit/library-component-boundaries.spec.ts
git commit -m "refactor(library): complete component ownership"
```

Verify semantic-review evidence remains unstaged.

- [ ] **Step 6: Request broad independent review**

Review the complete range from the parent of Task 1 through Task 8 against `docs/superpowers/specs/2026-08-11-library-componentization-design.md`. Require explicit spec-compliance and code-quality verdicts. Fix all Critical/Important findings in one forward-only round, request scoped re-review, and rerun affected plus full final gates.
