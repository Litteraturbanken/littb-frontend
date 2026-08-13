# Library Immediate Navigation Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount the real Library shell and its existing accessible loading indicator immediately during client navigation, while keeping direct requests fully server rendered and never retaining completed Library result sets across routes.

**Architecture:** Keep all ownership in `app/pages/bibliotek.vue`. Replace the two unconditional top-level async-data awaits with server-awaited, client-explicit resources: SSR still resolves options and initial results before rendering, while a fresh SPA instance starts from safe URL-derived state and empty response models, then validates option-dependent query values before running the existing versioned page request. Restrict async-data cache reads to hydration and clear both entries on unmount so leaving and returning always creates a fresh request pipeline.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, generated OpenAPI client, Playwright, Vitest/SSR harness, Yarn 4, Node.js 22.

## Global Constraints

- Do not add a route-level skeleton, a Pinia/store cache, navigation prefetching, or a second Library result model.
- Client entry must render the existing Library page components and exactly one existing `[data-library-loading][role="status"]` status with the `Laddar resultat` accessible name.
- A fresh SPA entry must render no result rows until its owned page request succeeds.
- Remote Library options remain authoritative for chronology and About-author query validation; do not forward those values before options settle.
- Direct `/bibliotek` and `/epub` document requests must retain complete SSR results and canonical redirect behavior.
- Existing in-page Library interactions retain their committed-row-under-spinner behavior.
- Leaving the Library must abort or invalidate every option, page, summary, and count request owned by that page instance.
- A later visit must not restore completed Library results from Nuxt payload/client async-data cache.
- Preserve the existing public `/api/v2/library/*` backend contract; this change does not alter route namespaces or generated API shapes.
- Follow strict RED/GREEN TDD: establish the browser regression before changing production code, then keep the mutation-catching assertions in the final suite.

---

## File Map

- Modify `nuxt/app/pages/bibliotek.vue`: own the SSR/client split, hydration-only async-data cache policy, initial client pipeline, shared route-state synchronization, abort/version ownership, and unmount clearing.
- Modify `nuxt/test/e2e/library.behavior.spec.ts`: add a real browser regression that gates Library options, proves immediate shell/spinner behavior, proves validated advanced filters, and proves a second visit creates fresh requests instead of restoring rows.
- Verify `nuxt/test/ssr/library.spec.ts`: the existing `SSR renders the default Library slice from typed private options and search` case remains the authority for complete SSR output.

---

### Task 1: Make fresh Library SPA entry non-blocking without adding a result cache

**Files:**
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: existing `fetchLibraryPageData(state, signal)`, `fetchLibrarySummary(filter, advanced, signal)`, `routeState(path, query)`, `requestState(routeState)`, `runBrowserRequest(state, version)`, `invalidateIntent()`, `syncAdvancedControls(state)`, `disposeLibraryRequest()`, and the existing empty result constructors.
- Produces: `optionsAsyncData` and `initialAsyncData` page-local resources; `libraryOptionsReady`; `syncRouteState(parsedRoute): QueryState`; `requestStateAfterOptions(state, version): Promise<QueryState | null>`; `loadInitialClientState(): Promise<void>`; the same existing rendered result component contract with `loading`, but with `loading === true` for a fresh SPA instance.

- [ ] **Step 1: Add a controllable request gate to the Library browser spec**

Add `Route` to the Playwright type imports and add this helper immediately after `pushRoute`:

```ts
import { expect, test, type APIRequestContext, type Locator, type Route } from "@playwright/test"

function createRequestGate() {
  const releases: Array<() => void> = []
  let requestCount = 0

  return {
    async handle(route: Route) {
      requestCount += 1
      await new Promise<void>(resolve => releases.push(resolve))
      await route.continue()
    },
    count() {
      return requestCount
    },
    releaseNext() {
      const release = releases.shift()
      expect(release, "an owned Library options request is waiting").toBeDefined()
      release?.()
    },
    releaseAll() {
      for (const release of releases.splice(0)) release()
    }
  }
}
```

This gate pauses the real public options request without mocking its response, so the test still exercises the generated client, fixture backend, and real result rendering.

- [ ] **Step 2: Write the failing About-to-Library navigation regression**

Add this test near the existing `SPA navigation between Library and its EPUB alias` test:

```ts
test("fresh SPA Library entry mounts its empty loading shell before options and results settle", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await reset(request)

  const optionsGate = createRequestGate()
  await page.route("**/v2/library/options", route => optionsGate.handle(route))

  try {
    await page.locator(".mainnav")
      .getByRole("link", { name: "Biblioteket", exact: true })
      .click()

    await expect.poll(() => optionsGate.count()).toBe(1)
    await expect(page).toHaveURL("/bibliotek")
    await expect(page.getByRole("heading", {
      level: 1,
      name: "Botanisera i biblioteket"
    })).toBeVisible({ timeout: 1_000 })
    await expect(page.locator("body")).toHaveClass(/page-library/u)
    await expect(page.locator('[data-library-loading][role="status"]')).toHaveCount(1)
    await expect(page.locator('[data-library-loading][role="status"] .sr-only'))
      .toHaveText("Laddar resultat")
    await expect(page.locator('[data-library-loading][role="status"] .spinner'))
      .toHaveAttribute("aria-hidden", "true")
    await expect(page.locator("[data-library-result]")).toHaveCount(0)

    optionsGate.releaseNext()
    await expect(page.locator("[data-library-result]")).toHaveCount(3)
    await expect(page.locator("[data-library-loading]")).toHaveCount(0)

    await page.locator(".mainnav").getByRole("link", { name: "Om LB", exact: true }).click()
    await expect(page).toHaveURL("/om/ide")

    await page.locator(".mainnav")
      .getByRole("link", { name: "Biblioteket", exact: true })
      .click()
    await expect.poll(() => optionsGate.count()).toBe(2)
    await expect(page.getByRole("heading", {
      level: 1,
      name: "Botanisera i biblioteket"
    })).toBeVisible({ timeout: 1_000 })
    await expect(page.locator('[data-library-loading][role="status"]')).toHaveCount(1)
    await expect(page.locator("[data-library-result]")).toHaveCount(0)

    optionsGate.releaseNext()
    await expect(page.locator("[data-library-result]")).toHaveCount(3)
    await expect(page.locator("[data-library-loading]")).toHaveCount(0)
  } finally {
    optionsGate.releaseAll()
    await page.unroute("**/v2/library/options")
  }
})
```

The `finally` block is mandatory: it prevents the intentionally pending RED request from hanging Playwright teardown.

- [ ] **Step 3: Add a failing option-authority regression for SPA entry**

Add this adjacent test. It proves the non-blocking provisional state never becomes the backend request state until remote option authority is available:

```ts
test("fresh advanced Library SPA entry validates remote option filters before searching", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await reset(request)

  const optionsGate = createRequestGate()
  await page.route("**/v2/library/options", route => optionsGate.handle(route))

  try {
    await pushRoute(
      page,
      "/bibliotek?avancerat=1&about_authors=LagerlofS&intervall=1850,1900"
    )
    await expect.poll(() => optionsGate.count()).toBe(1)
    await expect(page.locator('[data-library-loading][role="status"]')).toHaveCount(1)
    await expect(page.locator("[data-library-result]")).toHaveCount(0)

    await page.locator("[data-library-filter]").fill("Selma")
    await page.locator("[data-library-filter]").press("Enter")
    await expect(page.locator('[data-library-loading][role="status"]')).toHaveCount(1)
    expect(optionsGate.count()).toBe(1)
    expect((await libraryV2Requests(request)).search).toEqual([])

    optionsGate.releaseNext()
    await expect.poll(async () => (await libraryV2Requests(request)).search.length).toBeGreaterThan(0)
    expect((await libraryV2Requests(request)).search[0]?.body.filters).toMatchObject({
      query: "Selma",
      about_author_ids: ["LagerlofS"],
      year_from: 1850,
      year_to: 1900
    })
    await expect(page.locator("[data-library-loading]")).toHaveCount(0)
  } finally {
    optionsGate.releaseAll()
    await page.unroute("**/v2/library/options")
  }
})
```

- [ ] **Step 4: Add a failing active-request teardown regression**

Add this adjacent test. It uses the real fixture delay rather than a Playwright route gate so the browser request is genuinely in flight when the page unmounts:

```ts
test("leaving a fresh Library entry aborts its pending result request without stale UI", async ({
  page,
  request
}) => {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (message.type() === "error") problems.push(message.text())
  })
  await setLibraryDelay(request, "search", {
    mode: "all",
    filters: libraryFilters(),
    sort: "relevance",
    reverse: false,
    page: 1
  }, 1_200)
  await page.goto("/om/ide", { waitUntil: "networkidle" })

  await page.locator(".mainnav")
    .getByRole("link", { name: "Biblioteket", exact: true })
    .click()
  await expect(page.getByRole("heading", {
    level: 1,
    name: "Botanisera i biblioteket"
  })).toBeVisible({ timeout: 1_000 })
  await expect(page.locator('[data-library-loading][role="status"]')).toHaveCount(1)

  await page.locator(".mainnav").getByRole("link", { name: "Om LB", exact: true }).click()
  await expect(page).toHaveURL("/om/ide")
  await request.delete(`${fixture}/_library_v2/delays`)
  await page.waitForTimeout(1_300)
  expect(problems).toEqual([])
  await expect(page.locator("[data-library-result]")).toHaveCount(0)

  await reset(request)
  await page.locator(".mainnav")
    .getByRole("link", { name: "Biblioteket", exact: true })
    .click()
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  const ledger = await libraryV2Requests(request)
  expect(ledger.options).toHaveLength(1)
  expect(ledger.search.filter(entry => entry.body.mode === "all")).toHaveLength(1)
})
```

- [ ] **Step 5: Run the three new tests and verify the current suspense behavior is RED**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/library.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "fresh (SPA Library entry|advanced Library SPA entry|Library entry aborts)" \
  --workers=1 \
  --reporter=line
```

Expected: all three tests fail before delayed work settles. The first two must fail because the old About shell remains visible while options are gated; the teardown test must fail because the delayed initial result pipeline also retains the About shell instead of mounting cancellable Library UI. Confirm that no failure is a selector typo, port collision, fixture failure, or accidentally released request.

- [ ] **Step 6: Make the options resource server-awaited and client-explicit**

Replace the current `fetchLibraryOptions` and awaited `useAsyncData` block in `nuxt/app/pages/bibliotek.vue` with:

```ts
async function fetchLibraryOptions(signal?: AbortSignal): Promise<LibraryOptionsResponse> {
    try {
        const { data } = await libraryClient.GET("/library/options", { signal })
        return data ?? { chronology: null, about_authors: null }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error
        return { chronology: null, about_authors: null }
    }
}

const optionsAsyncData = useAsyncData<LibraryOptionsResponse>(
    `library:options:${route.path}`,
    (_nuxtApp, { signal }) => fetchLibraryOptions(signal),
    {
        default: () => ({ chronology: null, about_authors: null }),
        immediate: import.meta.server,
        getCachedData: (key, app) => app.isHydrating
            ? app.payload.data[key] as LibraryOptionsResponse | undefined
            : undefined
    }
)
if (import.meta.server) await optionsAsyncData
const { data: libraryOptionsData } = optionsAsyncData
```

The explicit abort rethrow is required so leaving the page cannot turn an owned cancellation into a successful fallback-options response.

- [ ] **Step 7: Make initial page data server-only and preserve SSR abort/canonical ownership**

Change `fetchInitialData` to accept and forward a signal, then replace its unconditional await with a server-only await:

```ts
async function fetchInitialData(signal?: AbortSignal): Promise<LibraryInitialData> {
    const pagePromise = fetchLibraryPageData(initialState, signal)
    const summaryPromise =
        initialState.standalone || initialState.downloadMode
            ? Promise.resolve(null)
            : fetchLibrarySummary(initialState.filter, initialState.advancedFilters, signal)
    const [page, summary] = await Promise.all([pagePromise, summaryPromise])
    return { page, summary }
}

const initialAsyncData = useAsyncData<LibraryInitialData>(
    `library:${route.path}:${mode}:${initialFilter}:${initialState.sort}:${initialState.page}:${initialState.hide1800}:${initialState.downloadMode}:${JSON.stringify(initialState.advancedFilters)}`,
    (_nuxtApp, { signal }) => fetchInitialData(signal),
    {
        default: emptyInitialData,
        immediate: import.meta.server,
        getCachedData: (key, app) => app.isHydrating
            ? app.payload.data[key] as LibraryInitialData | undefined
            : undefined
    }
)
if (import.meta.server) await initialAsyncData
const { data: initialData } = initialAsyncData
const initialDataWasLoaded = initialAsyncData.status.value === "success"
```

Keep `initialPageData`, the server-only canonical redirect, and all existing result-ref initialization after this block. `initialDataWasLoaded` is captured once: it is `true` on SSR hydration and `false` on a fresh SPA component instance.

- [ ] **Step 8: Initialize the existing spinner only for a fresh SPA instance**

Replace:

```ts
const loading = ref(false)
```

with:

```ts
const libraryOptionsReady = ref(initialDataWasLoaded)
const loading = ref(import.meta.client && !initialDataWasLoaded)
```

Do not conditionally hide or replace the result components. Their existing empty result constructors plus this flag are the intended initial UI.

Also preserve that initial spinner when an early control interaction invalidates the first intent. Change `invalidateIntent` to:

```ts
function invalidateIntent(): number {
    cancelPending()
    loading.value = !libraryOptionsReady.value
    return ++requestVersion
}
```

Once options have settled, `libraryOptionsReady === true` restores the existing in-page behavior where invalidation clears loading until the next owned request begins.

- [ ] **Step 9: Extract one route-state synchronization function for initial and in-page requests**

Immediately before the route-state watcher, add:

```ts
function syncRouteState(parsedRoute: LibraryRouteState): QueryState {
    const state = requestState(parsedRoute)
    syncAdvancedControls(parsedRoute)
    currentMode.value = state.mode
    invalidateLibrarySummary(state.filter, state.advancedFilters)
    invalidateDownloadCounts(state.filter, state.advancedFilters)
    filter.value = state.filter
    currentPage.value = state.page
    hide1800.value = state.hide1800
    downloadMode.value = state.downloadMode
    if (state.mode === "epub" || state.mode === "pdf") {
        selectedEpubSort.value = state.sort as EpubSortKey
    } else if (state.mode === "all") {
        selectedSort.value = state.sort as RelevanceSortKey
    } else if (state.mode === "authors" || state.mode === "works" || state.mode === "parts") {
        selectedBrowseSort.value = state.sort as BrowseSortKey
    }
    return state
}
```

Then replace the duplicate assignments at the top of the existing watcher callback with:

```ts
watch(
    () => {
        const state = requestState(routeState(route.path, route.query))
        return JSON.stringify([
            stateKey(state),
            state.mode === "all" && Object.hasOwn(route.query, "sida"),
            state.mode === "all" ? route.query.sida : null
        ])
    },
    () => {
        const previousStateKey = stateKey(currentState())
        const state = syncRouteState(routeState(route.path, route.query))
        if (ownedNavigation?.key === stateKey(state)) return
        if (
            state.mode === "all"
            && previousStateKey === stateKey(state)
            && !hasCanonicalPageQuery(state.page)
        ) {
            void replaceBrowserRoute(state, requestVersion)
            return
        }
        const version = invalidateIntent()
        void runBrowserRequest(state, version)
    },
    { flush: "sync" }
)
```

- [ ] **Step 10: Gate every fresh-instance page request on the same option authority**

Add this helper immediately before `runBrowserRequest`:

```ts
async function requestStateAfterOptions(
    state: QueryState,
    version: number
): Promise<QueryState | null> {
    if (libraryOptionsReady.value) return state
    await optionsAsyncData.execute({ dedupe: "defer" }).catch(() => null)
    if (version !== requestVersion || optionsAsyncData.status.value !== "success") return null
    libraryOptionsReady.value = true
    return syncRouteState(routeState(route.path, route.query))
}
```

Change the opening of `runBrowserRequest` so it starts the spinner before waiting and replaces any provisional state with the route re-parsed under accepted options:

```ts
async function runBrowserRequest(state: QueryState, version: number) {
    if (version !== requestVersion) return
    loading.value = true
    const acceptedState = await requestStateAfterOptions(state, version)
    if (!acceptedState) return
    state = acceptedState
    const activeController = new AbortController()
    controller = activeController
    const reversed = isSortReversed(state.mode, state.sort)
    const pageData = await fetchLibraryPageData(state, activeController.signal, reversed).catch(
        () => null
    )
    if (!isCurrentLibraryPageRequest(state, version, activeController, pageData)) return
    if (!await reconcileAllResultPage(state, pageData, version, activeController)) return
    assignLibraryPageResult(pageData, pageResultHandlers)
    updatePageModeState(state, pageData)
    updateLibrarySummaryFromPage(state, pageData)
    loading.value = false
    if (controller === activeController) controller = null
    refreshAfterPageRequest(state, pageData)
}
```

Delete the old later `loading.value = true` line after `controller = activeController` so the function has one loading transition. This shared gate means automatic entry, an immediate Enter press, a route watcher, or another early Library intent all dedupe onto one options request and only the latest generation proceeds.

- [ ] **Step 11: Start the client pipeline after mount without suspending navigation**

Add this function immediately before `onMounted`:

```ts
async function loadInitialClientState(): Promise<void> {
    const version = ++requestVersion
    const state = requestState(routeState(route.path, route.query))
    await runBrowserRequest(state, version)
}
```

Replace the current `onMounted` body with:

```ts
onMounted(() => {
    mounted.value = true
    if (!initialDataWasLoaded) {
        void loadInitialClientState()
        return
    }
    if (currentMode.value === "authors" && route.query.sida !== undefined) {
        void router.replace({ path: route.path, query: queryFor(currentState()) })
    }
    const initialFailed = initialPageData.response.failed
    const state = currentState()
    if (!initialFailed) {
        void refreshLibrarySummary(filter.value, state.advancedFilters, state.downloadMode)
    }
    if (!initialFailed && (state.mode === "epub" || state.mode === "pdf")) {
        void refreshInactiveDownloadCount(filter.value, state.advancedFilters, state.mode)
    }
})
```

This makes options the only prerequisite for the initial client result request. The page result clears `loading`; summary/count refresh remains background work exactly as in `runBrowserRequest` today.

- [ ] **Step 12: Clear async-data entries and abort all page-owned work on unmount**

Replace the current unmount hook with:

```ts
onUnmounted(() => {
    disposeLibraryRequest()
    optionsAsyncData.clear()
    initialAsyncData.clear()
})
```

Do not persist the result refs anywhere else. Vue destroys them with the page instance, and the hydration-only `getCachedData` callbacks prevent later SPA instances from reading completed async-data entries.

- [ ] **Step 13: Run the focused browser regressions and verify GREEN**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/library.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "fresh (SPA Library entry|advanced Library SPA entry|Library entry aborts)" \
  --workers=1 \
  --reporter=line
```

Expected: `3 passed`. The first visit and revisit both visibly settle at the gate with zero rows; the advanced test keeps one options request and zero searches through an early Enter press, then forwards the accepted query/author/year values afterward; the teardown test leaves during a real delayed search with no late UI or console error and makes fresh options/search calls on return.

- [ ] **Step 14: Mutation-check the suspense regression**

Temporarily restore the unconditional client await for `optionsAsyncData`:

```ts
await optionsAsyncData
```

Run only the first new test. Expected: FAIL before the gate is released because the About heading remains visible and the Library spinner never mounts. Restore `if (import.meta.server) await optionsAsyncData`, rerun all three tests, and require `3 passed` before continuing.

- [ ] **Step 15: Commit the independently testable behavior**

```bash
git add nuxt/app/pages/bibliotek.vue nuxt/test/e2e/library.behavior.spec.ts
git diff --cached --check
git commit -m "Show Library loading state during navigation"
```

---

### Task 2: Prove direct SSR, in-page behavior, lifecycle safety, and production gates

**Files:**
- Verify: `nuxt/test/ssr/library.spec.ts`
- Verify: `nuxt/test/e2e/library.behavior.spec.ts`
- Verify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: the Task 1 `optionsAsyncData`, `initialAsyncData`, `initialDataWasLoaded`, and `loadInitialClientState()` behavior.
- Produces: release-ready evidence that server rendering remains complete, in-page stale-request ownership is unchanged, and the page passes static/build gates.

- [ ] **Step 1: Confirm the existing SSR authority still directly proves complete initial results**

Search the existing spec:

```bash
rg -n "data-library-result|Botanisera i biblioteket|/bibliotek" test/ssr/library.spec.ts
```

Inspect `SSR renders the default Library slice from typed private options and search` and retain these existing assertions unchanged:

```ts
expect(response.status()).toBe(200)
expect(document.querySelector("h1")?.textContent?.trim()).toBe("Botanisera i biblioteket")
expect(document.querySelectorAll("[data-library-result]")).toHaveLength(1)
expect(document.querySelector('[data-library-result] a[href*="RodaRummet"]')?.textContent?.trim())
  .toBe("Röda rummet")
```

The query is deliberately filtered and therefore owns one fixture result rather than the unfiltered browser fixture's three. These assertions already prove that direct SSR awaited the initial result request instead of emitting the empty client shell.

- [ ] **Step 2: Run direct SSR and the focused Library ownership cases**

Run from `nuxt/`:

```bash
yarn vitest run --config vitest.ssr.config.ts test/ssr/library.spec.ts
yarn playwright test test/e2e/library.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "fresh (SPA Library entry|advanced Library SPA entry)|delayed stale Library request|keeps committed rows visible|SPA navigation between Library" \
  --workers=1 \
  --reporter=line
```

Expected: all direct SSR assertions pass with result HTML; fresh entry shows empty rows under the spinner; stale in-page requests remain rejected; committed EPUB/PDF rows still remain visible for in-page loading; `/bibliotek` and `/epub` shell transitions still work.

- [ ] **Step 3: Run the full Library browser suite serially**

```bash
yarn playwright test test/e2e/library.behavior.spec.ts \
  --project=desktop-chromium \
  --workers=1 \
  --reporter=line
```

Expected: all Library behavior cases pass. Treat any duplicate request-ledger failure as a product regression until shown otherwise; the fresh SPA pipeline must make exactly one options request and one primary page request per entry.

- [ ] **Step 4: Run static, policy, and build gates**

```bash
yarn eslint app/pages/bibliotek.vue test/e2e/library.behavior.spec.ts test/ssr/library.spec.ts
yarn typecheck
yarn policy:check
yarn quality:maintainability
yarn build
git diff --check HEAD~1..HEAD
git status --short
```

Expected: every command exits `0`; maintainability reports zero newly introduced findings; the production build completes; only explicitly intended follow-up test evidence, if any, is dirty.

- [ ] **Step 5: Confirm verification made no incidental changes**

```bash
git status --short
```

Expected: no new changes after the Task 1 commit. Do not create an empty verification commit.

---

### Task 3: Refresh the independent semantic review ledger

**Files:**
- Modify: `nuxt/quality/semantic-review-ledger.json`
- Create or modify: current evidence under `nuxt/quality/semantic-reviews/*.json`

**Interfaces:**
- Consumes: the immutable Task 1 production/test commit and the existing generated semantic packet inventory.
- Produces: an independently reviewed, current, zero-CR semantic ledger required by the frontend release gate.

- [ ] **Step 1: Generate the current inventory and inspect the bounded queue**

Run from `nuxt/` with the repository's Node 22 runtime:

```bash
yarn quality:review:inventory
yarn quality:review:queue
```

Expected: only packets invalidated or introduced by the Library page/test diff are unreviewed or stale; there are zero changes-requested packets before review. If unrelated packets appear, stop and reconcile the working tree/HEAD rather than reviewing unrelated mutable work.

- [ ] **Step 2: Run exactly one established independent reviewer process**

First confirm no existing semantic reviewer is active, then run:

```bash
pgrep -af "run-independent-semantic-review|codex exec.*semantic" || true
node scripts/run-independent-semantic-review.mjs \
  --author implementation-agent \
  --reviewer independent-codex-review
```

Expected: the process reviews packets sequentially and exits `0` with `No independent semantic review work remains`. Never start a second runner while the first is active.

- [ ] **Step 3: Stop on a blocking review finding**

If the runner exits on a Critical or Important finding, do not record approval, do not stage the ledger, and do not deploy. Read the exact evidence file, return to `superpowers:systematic-debugging` and `superpowers:test-driven-development`, establish a focused RED for the concrete consequence, repair only that finding, commit the repair, and restart Task 3 from Step 1. Questions and Minor findings remain recorded according to the existing review contract and do not authorize unrelated production changes.

- [ ] **Step 4: Verify ledger integrity and zero remaining work**

```bash
yarn quality:review:inventory
yarn quality:review:check
yarn quality:review:queue
```

Expected: `approved` equals the current packet count and `unreviewed=0`, `stale=0`, `changes-requested=0`, `oversized=0`; the queue reports no work.

- [ ] **Step 5: Commit only the generated semantic artifacts**

```bash
git status --short
git add quality/semantic-review-ledger.json quality/semantic-reviews
git diff --cached --check
git diff --cached --name-only | rg -v '^quality/semantic-review-(ledger\.json|reviews/)' && exit 1 || true
git commit -m "chore(nuxt): review Library navigation loading"
```

Expected: the artifact commit contains no source, test, generated API, or configuration file.

---

### Task 4: Deploy the verified commit to stage and exercise the real environment

**Files:**
- Verify only: repository deployment configuration and existing stage smoke commands.

**Interfaces:**
- Consumes: the immutable implementation commit from Task 1, the current semantic artifact commit from Task 3, and the repository's established stage deployment workflow.
- Produces: a stage deployment at the exact verified SHA plus live evidence for About-to-Library navigation and direct Library loading.

- [ ] **Step 1: Record the immutable deployment SHA and clean scope**

```bash
git status --short
git rev-parse HEAD
git show --stat --oneline --decorate --no-renames HEAD
git show --check HEAD
```

Expected: the worktree is clean, `git show --check` exits `0`, and the SHA includes only the reviewed Library behavior/test changes plus any separately reviewed SSR assertion commit.

- [ ] **Step 2: Deploy with the repository's established stage workflow**

Run from the repository root; do not substitute a production target:

```bash
git push origin codex/nuxt-v2-statistics
export NOMAD_ADDR=http://nomad.infra.lb.se
scripts/deploy-stage.sh "$(git rev-parse HEAD)"
```

Expected: the remote branch contains the exact local SHA, the multi-architecture image build completes, and the `lb-frontend-stage` Nomad deployment becomes healthy with one running allocation at that SHA.

- [ ] **Step 3: Run a live Playwright smoke against stage**

Use the `playwright` skill against `https://stage.litteraturbanken.se` and exercise this exact navigation:

```text
/om/ide -> click Biblioteket -> /bibliotek
```

Assert the Library heading and `page-library` body appear, the loading status is accessible if captured while a request is pending, results eventually appear, and no browser console/page errors occur. Then leave for `/om/ide`, return to `/bibliotek`, and confirm the navigation succeeds with fresh backend requests.

- [ ] **Step 4: Verify the direct stage route**

Open `https://stage.litteraturbanken.se/bibliotek` as a new document, require HTTP `200`, the Library heading, and initial result rows. Also require successful public backend requests under `/api/v2/library/*`; `/nuxt-api/*` must remain reserved for Nuxt-owned handlers.

- [ ] **Step 5: Report exact evidence**

Report the deployed SHA, stage allocation/revision, focused local test counts, full Library suite count, SSR count, build result, and live stage smoke count. If live timing prevents observing the spinner, report that limitation explicitly while retaining the deterministic gated browser test as the timing authority.
