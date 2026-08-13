# Reader and Managed Route Shell Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Reader source-information resolution and managed Home, About, and Presentation content from retaining the preceding page during client navigation.

**Architecture:** Reader aliases follow the established server-prefetch/client-background shorthand pattern. Direct Reader source information becomes lazy without changing primary Reader ownership. Managed-content pages keep complete SSR but expose their stable shell and a localized pending region on client navigation.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, managed HTML loaders, Playwright, Vitest SSR, Yarn 4, Node.js 22.

## Global Constraints

- Preserve Reader canonical redirects and direct-request error mappings.
- Preserve complete Home, About, and Presentation SSR.
- Client redirects occur only for validated, current route identities.
- Managed pending states do not invent document headings or body text.
- Render one localized polite status per pending route; do not add a global overlay.
- Do not add a cross-route content cache.
- Follow RED/GREEN TDD and commit each task independently.

---

### Task 1: Reader source-information aliases

**Files:**
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/index.vue`
- Verify: `nuxt/test/ssr/reader-shorthand.spec.ts`

**Interfaces:**
- Consumes: `resolverPath`, `isExpectedResolution`, `isCurrentIdentity`, and the existing pending template.
- Produces: `resolveReaderSourceInfoAlias(): Promise<void>` with server-prefetch/client-background ownership.

- [ ] **Step 1: Write delayed alias and late-settlement RED cases**

Gate `**/nuxt-api/reader/resolve/**`, navigate from `/bibliotek` to a fixture-backed source-info alias, and assert its URL plus one `Hämtar läsarsidan` status before release and no Library heading. Leave before release in the second case and prove late resolution cannot redirect the newer route.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --grep "source-info alias mounts before resolution|late alias resolution" --workers=1 --reporter=line
```

- [ ] **Step 3: Move resolution into an owned async function**

Replace the top-level request with:

```ts
async function resolveReaderSourceInfoAlias(): Promise<void> {
  try {
    const result = await requestFetch<unknown>(resolverPath, {
      retry: 0,
      signal: resolutionController.signal,
      query: props.mediaType === undefined ? undefined : { media_type: props.mediaType }
    })
    if (!isExpectedResolution(result)) {
      throw createError({ statusCode: 502, statusMessage: "Reader page unavailable" })
    }
    if (!isCurrentIdentity()) return
    await navigateTo(`${result.canonicalPath}?om-boken`, {
      redirectCode: 307,
      replace: true
    })
  } catch (error) {
    if (!isCurrentIdentity()) return
    const statusCode = requestStatus(error)
    throw createError({
      statusCode,
      statusMessage: statusCode === 404 ? "Reader page not found" : "Reader page unavailable"
    })
  }
}
if (import.meta.server) onServerPrefetch(resolveReaderSourceInfoAlias)
else void resolveReaderSourceInfoAlias()
```

Keep route-leave and unmount abort ownership.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --grep "source-info alias|late alias" --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/reader-shorthand.spec.ts
git add nuxt/app/pages/författare/'[author]'/titlar/'[title]'/index.vue nuxt/test/e2e/reader.behavior.spec.ts
git commit -m "Mount Reader alias before resolution"
```

### Task 2: Direct Reader source-information deep link

**Files:**
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Verify: `nuxt/test/ssr/reader.spec.ts`

**Interfaces:**
- Consumes: lazy primary Reader data, `sourceInfoFetch`, and existing dialog pending UI.
- Produces: source-information loading that cannot suspend the primary Reader shell.

- [ ] **Step 1: Write a delayed `?om-boken` RED**

Gate the source-info endpoint, navigate from `/bibliotek` to a fixture Reader URL with `?om-boken`, and before release assert `.reader-page` plus the dialog loading owner are mounted while the Library heading is absent.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --grep "Reader shell mounts before source information" --workers=1 --reporter=line
```

- [ ] **Step 3: Make only source information lazy**

Add `lazy: true` to `sourceInfoFetch` while retaining its immediate predicate, identity checks, watchers, and explicit `execute()` retry. Do not change the already-lazy primary Reader resource.

```ts
{
  immediate: sourceInfoRequested.value,
  lazy: true,
  watch: [sourceInfoRequestIdentity]
}
```

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --grep "Reader shell mounts before source information" --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/reader.spec.ts
git add nuxt/app/pages/författare/'[author]'/titlar/'[title]'/sida/'[page]'/'[mediatype].vue nuxt/test/e2e/reader.behavior.spec.ts
git commit -m "Keep Reader shell during source-info loading"
```

### Task 3: About managed-content pages

**Files:**
- Modify: `nuxt/test/e2e/about-pages.behavior.spec.ts`
- Modify: `nuxt/app/pages/om/[page].vue`
- Verify: `nuxt/test/ssr/about-pages.spec.ts`

**Interfaces:**
- Consumes: `AboutPageShell`, `contentPayload`, and managed-content error state.
- Produces: `aboutContentPending` and `Laddar sidan`.

- [ ] **Step 1: Write a delayed About entry RED**

Gate the managed `/red` document request, navigate from `/bibliotek` to `/om/ide`, and assert `AboutPageShell`, one `Laddar sidan` status, no Library heading, and no managed article body before release.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/about-pages.behavior.spec.ts --project=desktop-chromium --grep "mounts About shell before managed content" --workers=1 --reporter=line
```

- [ ] **Step 3: Make About content client-lazy**

Pass `{ lazy: true }` to `useAsyncData<AboutContentPayload>`, retain `pending: aboutContentPending`, and insert inside `AboutPageShell`:

```vue
<div v-if="aboutContentPending && !contentPayload" class="searching" role="status" aria-live="polite">
  <div class="preloader">
    <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
    <span class="sr-only">Laddar sidan</span>
  </div>
</div>
```

Put existing content and error branches behind `v-else-if` and `v-else`; do not change Help anchor correction ownership.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/about-pages.behavior.spec.ts test/e2e/about-help.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/about-pages.spec.ts
git add nuxt/app/pages/om/'[page].vue' nuxt/test/e2e/about-pages.behavior.spec.ts
git commit -m "Mount About shell before managed content"
```

### Task 4: Home managed content

**Files:**
- Modify: `nuxt/test/e2e/home-page.behavior.spec.ts`
- Modify: `nuxt/app/pages/index.vue`
- Verify: `nuxt/test/ssr/home-page.spec.ts`

**Interfaces:**
- Consumes: the static Home shell and `HomeContent` resource.
- Produces: `homeContentPending` and `Laddar startsidan`.

- [ ] **Step 1: Write a delayed Home navigation RED**

Start at `/om/ide`, gate the Home managed `/red` request, click the real Home logo, and before release assert the Home body owner and stable shell, one `Laddar startsidan` status, and no About article content.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/home-page.behavior.spec.ts --project=desktop-chromium --grep "mounts Home shell before managed content" --workers=1 --reporter=line
```

- [ ] **Step 3: Make Home content lazy**

Pass `{ lazy: true }` to Home `useAsyncData`, retain `pending: homeContentPending`, and render in the editorial region:

```vue
<div v-if="homeContentPending && !content" class="searching" role="status" aria-live="polite">
  <div class="preloader">
    <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
    <span class="sr-only">Laddar startsidan</span>
  </div>
</div>
```

Keep brand/navigation/background policy outside this branch.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/home-page.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/home-page.spec.ts
git add nuxt/app/pages/index.vue nuxt/test/e2e/home-page.behavior.spec.ts
git commit -m "Mount Home shell before managed content"
```

### Task 5: Presentation document and background

**Files:**
- Modify: `nuxt/test/e2e/presentations.behavior.spec.ts`
- Modify: `nuxt/app/pages/presentationer/[...segments].vue`
- Verify: `nuxt/test/ssr/presentations.spec.ts`

**Interfaces:**
- Consumes: `PresentationPageData`, the aggregate document/background request, and existing errors.
- Produces: `presentationPending` and `Laddar presentationen` without a fabricated heading.

- [ ] **Step 1: Write delayed document/background RED**

Gate both managed presentation resources, navigate from `/bibliotek`, and assert the presentation owner plus one `Laddar presentationen` status, no Library heading, and no fetched presentation heading before release.

- [ ] **Step 2: Verify RED**

```bash
yarn playwright test test/e2e/presentations.behavior.spec.ts --project=desktop-chromium --grep "mounts Presentation before document and background" --workers=1 --reporter=line
```

- [ ] **Step 3: Make aggregate Presentation data lazy**

Pass `{ lazy: true }` to the single `useAsyncData<PresentationPageData>`, retain `pending: presentationPending`, and render:

```vue
<div v-if="presentationPending && !data" class="searching" role="status" aria-live="polite">
  <div class="preloader">
    <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
    <span class="sr-only">Laddar presentationen</span>
  </div>
</div>
```

Keep document and background atomic in the existing `Promise.all`; apply no background until the validated aggregate settles.

- [ ] **Step 4: Run GREEN and commit**

```bash
yarn playwright test test/e2e/presentations.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/presentations.spec.ts
git add nuxt/app/pages/presentationer/'[...segments].vue' nuxt/test/e2e/presentations.behavior.spec.ts
git commit -m "Mount Presentations before managed content"
```

### Task 6: Verify the Reader and managed-content wave

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1 through 5.
- Produces: a review-ready final route-shell wave.

- [ ] **Step 1: Run static and production gates**

```bash
yarn eslint app/pages/författare/'[author]'/titlar/'[title]'/index.vue app/pages/författare/'[author]'/titlar/'[title]'/sida/'[page]'/'[mediatype].vue app/pages/om/'[page].vue' app/pages/index.vue app/pages/presentationer/'[...segments].vue'
yarn typecheck
yarn build
```

- [ ] **Step 2: Verify scope**

```bash
git diff --check HEAD~5..HEAD
git status --short
```

Expected: all gates pass and the worktree is clean.
