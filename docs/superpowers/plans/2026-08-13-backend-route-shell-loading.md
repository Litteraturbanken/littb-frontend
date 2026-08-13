# Backend Route Shell Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount Search, Statistics, Dramawebben catalog, ID lookup, and Editor shells before their initial backend requests settle.

**Architecture:** Convert only initial route-owned resources to client-lazy resources while keeping SSR awaited. Each route exposes an explicit pending state, commits identity-matching results through its existing model, and preserves subordinate request ownership.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, generated OpenAPI client, Playwright, Vitest SSR, Yarn 4, Node.js 22.

## Global Constraints

- Preserve direct-request SSR data and existing 404/502/503 behavior.
- Render one initial page-content status per route; do not add a global overlay.
- Do not forward option-dependent Search values before options are accepted.
- Do not expose partial Statistics sections as complete content.
- Catalog source-info and Editor subordinate requests remain bound to accepted primary data.
- Navigation aborts publish no error and late results remain inert.
- Follow RED/GREEN TDD and commit each task independently.

---

### Task 1: Search chronology and options entry

**Files:**
- Modify: `nuxt/test/e2e/text-search.behavior.spec.ts`
- Modify: `nuxt/app/pages/sök.vue`
- Verify: `nuxt/test/ssr/text-search.spec.ts`

**Interfaces:**
- Consumes: `chronologyAsyncData`, `loadOptions`, `optionsCache`, `primaryPending`.
- Produces: `initialPrerequisitesPending` and `Laddar sökdata`.

- [ ] **Step 1: Write simple and advanced delayed-entry tests**

Use the fixture's `/_text_search/delays/chronology` and `/_text_search/delays/options` controls. From `/om/ide`, begin navigation to `/sök?q=glas` and `/sök?avancerad&fras=glas`. Before release, assert the Search body owner and form, one status named `Laddar sökdata`, no About heading, and no result rows.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/text-search.behavior.spec.ts --project=desktop-chromium --grep "mounts Search before (chronology|advanced options) settle" --workers=1 --reporter=line
```

- [ ] **Step 3: Remove client setup awaits**

Set `lazy: true` on `chronologyAsyncData`. Replace the unconditional options await with:

```ts
const initialOptionsPending = ref(state.value.advanced)
async function loadInitialOptions(): Promise<void> {
  if (!state.value.advanced) return
  try {
    await loadOptions()
  } finally {
    initialOptionsPending.value = false
  }
}
if (import.meta.server) await loadInitialOptions()
else void loadInitialOptions()
```

Read `pending: chronologyPending`, derive:

```ts
const initialPrerequisitesPending = computed(() =>
  state.value.advanced ? initialOptionsPending.value : chronologyPending.value
)
```

Render one `Laddar sökdata` status while true. Suppress the primary result status until prerequisites settle so the page never exposes two initial live regions.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/text-search.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/text-search.spec.ts
git add nuxt/app/pages/sök.vue nuxt/test/e2e/text-search.behavior.spec.ts
git commit -m "Mount Search before prerequisite data"
```

### Task 2: Statistics aggregate

**Files:**
- Modify: `nuxt/test/e2e/statistics.behavior.spec.ts`
- Modify: `nuxt/app/pages/om/statistik.vue`
- Verify: `nuxt/test/ssr/statistics.spec.ts`

**Interfaces:**
- Consumes: the three existing async-data resources and `AboutPageShell`.
- Produces: `statisticsPending`, `statisticsReady`, and `Laddar statistik`.

- [ ] **Step 1: Write a three-request browser RED**

Gate `**/api/v2/stats`, `**/api/v2/works/popular**`, and `**/api/v2/epubs/popular**`. From `/bibliotek`, navigate to `/om/statistik`; before release assert `AboutPageShell`, one `Laddar statistik` status, no Library heading, and no `.content.stats`. Release all and assert the three populated lists.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/statistics.behavior.spec.ts --project=desktop-chromium --grep "mounts Statistics before all resources settle" --workers=1 --reporter=line
```

- [ ] **Step 3: Make all resources lazy and content atomic**

Pass `{ lazy: true }` to each `useAsyncData`, then define:

```ts
const statisticsPending = computed(() => [statsAsync, worksAsync, epubsAsync]
  .some(resource => resource.status.value === "idle" || resource.status.value === "pending"))
const statisticsReady = computed(() => !statisticsPending.value)
```

Inside `AboutPageShell`, render `Laddar statistik` while pending and gate `.content.stats` with `v-else-if="statisticsReady && statsData"`.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/statistics.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/statistics.spec.ts
git add nuxt/app/pages/om/statistik.vue nuxt/test/e2e/statistics.behavior.spec.ts
git commit -m "Mount Statistics before aggregate data"
```

### Task 3: Dramawebben catalog

**Files:**
- Modify: `nuxt/test/e2e/dramawebben.behavior.spec.ts`
- Modify: `nuxt/app/pages/dramawebben/pjäser.vue`
- Verify: `nuxt/test/ssr/dramawebben.spec.ts`

**Interfaces:**
- Consumes: `CatalogResult`, `sourceInfoFetch`, `DramawebbenShell`.
- Produces: client-lazy catalog/source-info and `Laddar Dramawebbens katalog`.

- [ ] **Step 1: Write catalog and initial source-info RED cases**

Gate `**/api/v2/dramawebben/catalog` from `/om/ide` and assert the Dramawebben shell plus one catalog status before release. Add an existing fixture-backed `om-boken` query, gate source info, release catalog first, and prove the catalog remains usable while only dialog loading is pending.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/dramawebben.behavior.spec.ts --project=desktop-chromium --grep "mounts the catalog shell|source information does not suspend" --workers=1 --reporter=line
```

- [ ] **Step 3: Make both entry resources lazy**

Add `lazy: true` to the catalog options while retaining `getCachedData`. Add `lazy: true` to `sourceInfoFetch`. Read catalog `status` and render:

```vue
<div v-if="catalogPending" class="searching" role="status" aria-live="polite">
  <div class="preloader">
    <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
    <span class="sr-only">Laddar Dramawebbens katalog</span>
  </div>
</div>
```

Keep catalog, error, and source-info branches mutually exclusive inside `DramawebbenShell`.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/dramawebben.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/dramawebben.spec.ts
git add nuxt/app/pages/dramawebben/pjäser.vue nuxt/test/e2e/dramawebben.behavior.spec.ts
git commit -m "Mount Dramawebben before catalog data"
```

### Task 4: Initial ID lookup

**Files:**
- Modify: `nuxt/test/e2e/id-lookup.behavior.spec.ts`
- Modify: `nuxt/app/pages/id/[[id]].vue`
- Verify: `nuxt/test/ssr/id-lookup.spec.ts`

**Interfaces:**
- Consumes: `requestLookup`, `items`, `loading`, and current request ownership.
- Produces: initial async-data settlement through the visible lookup pending state.

- [ ] **Step 1: Write the delayed route-lookup RED**

Set `/_work_lookup_delays` for the requested work, navigate from `/om/ide` to `/id/lb123`, and before expiry assert the ID inputs, one `Hämtar resultat` status, no About heading, and zero result rows.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/id-lookup.behavior.spec.ts --project=desktop-chromium --grep "mounts ID lookup before the route lookup settles" --workers=1 --reporter=line
```

- [ ] **Step 3: Make initial lookup lazy and reactive**

Create the initial resource with `{ lazy: true }`, retain `data` and `pending`, initialize `items` empty, then add:

```ts
watch(initialLookupData, candidate => {
  items.value = candidate?.items ?? []
}, { immediate: true, flush: "sync" })
watch(initialLookupPending, pending => {
  if (initialBody) loading.value = pending
}, { immediate: true, flush: "sync" })
```

For `/id` without a request body, use refs initialized to `null` and `false`; do not issue a lookup.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/id-lookup.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/id-lookup.spec.ts
git add nuxt/app/pages/id/'[[id]].vue' nuxt/test/e2e/id-lookup.behavior.spec.ts
git commit -m "Mount ID lookup before route results"
```

### Task 5: Editor initial page

**Files:**
- Modify: `nuxt/test/e2e/editor-reader.behavior.spec.ts`
- Modify: `nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue`
- Verify: `nuxt/test/ssr/editor-reader.spec.ts`

**Interfaces:**
- Consumes: `requestPage`, `loadedPage`, `loadedIdentity`, `page`, and subordinate resources.
- Produces: `editorPagePending` and `Laddar editorsidan`.

- [ ] **Step 1: Write delayed-entry and leave-before-settlement RED cases**

Gate `**/nuxt-api/editor/**`, navigate from `/bibliotek`, and assert `.editor-reader`, one `Laddar editorsidan` status, no Library heading, and no `.reader_main`. In a second case, leave for `/om/ide`, release, and assert no Editor content or console error appears.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/editor-reader.behavior.spec.ts --project=desktop-chromium --grep "mounts Editor before its initial page|late initial Editor" --workers=1 --reporter=line
```

- [ ] **Step 3: Make initial and conditional resources lazy**

Pass `{ lazy: true }` to initial page `useAsyncData`, retain `pending: editorPagePending`, and render:

```vue
<div v-if="editorPagePending && !page" class="searching" role="status" aria-live="polite">
  <div class="preloader">
    <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
    <span class="sr-only">Laddar editorsidan</span>
  </div>
</div>
```

Add `lazy: true` to optional source-info and hit resources while retaining identity and explicit execute guards.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/editor-reader.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/editor-reader.spec.ts
git add nuxt/app/pages/editor/'[lbid]'/ix/'[ix]'/'[mediatype].vue nuxt/test/e2e/editor-reader.behavior.spec.ts
git commit -m "Mount Editor before initial page data"
```

### Task 6: Verify the backend-heavy wave

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1 through 5.
- Produces: a review-ready backend route wave.

- [ ] **Step 1: Run static and production gates**

```bash
yarn eslint app/pages/sök.vue app/pages/om/statistik.vue app/pages/dramawebben/pjäser.vue app/pages/id/'[[id]].vue' app/pages/editor/'[lbid]'/ix/'[ix]'/'[mediatype].vue
yarn typecheck
yarn build
```

- [ ] **Step 2: Verify scope**

```bash
git diff --check HEAD~5..HEAD
git status --short
```

Expected: all gates pass and the tree is clean.
