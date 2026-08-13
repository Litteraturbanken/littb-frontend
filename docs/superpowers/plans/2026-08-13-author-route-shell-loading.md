# Author Route Shell Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount ordinary, Dramawebben, and Biblinfo author shells immediately on client navigation while preserving complete SSR, canonical redirects, and response ownership.

**Architecture:** Keep the existing author loaders and identity-checked result models. Make their `useAsyncData` resources lazy for client navigation but still awaited by SSR, expose a page-owned pending status while the accepted identity is absent, and leave canonical redirect watches and single-use handoffs authoritative.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, generated OpenAPI client, Playwright, SSR test harness, Yarn 4, Node.js 22.

## Global Constraints

- The old route must disappear before the author request settles.
- Render exactly one polite author-page loading status and no profile-derived content while pending.
- Preserve ordinary-to-Dramawebben and Dramawebben-to-ordinary redirects and single-use handoffs.
- Preserve direct-request SSR content and 404/503 mappings.
- A stale author response must not publish data or redirect a newer route identity.
- Do not add an application-level author result cache.
- Follow RED/GREEN TDD and commit each task independently.

---

### Task 1: Ordinary and Dramawebben profile entry

**Files:**
- Modify: `nuxt/test/e2e/author-profiles.behavior.spec.ts`
- Modify: `nuxt/app/pages/författare/[author]/index.vue`
- Modify: `nuxt/app/pages/författare/[author]/dramawebben.vue`
- Verify: `nuxt/test/ssr/author-profiles.spec.ts`

**Interfaces:**
- Consumes: `ProfileResponse`, `currentIdentity`, `response`, `redirectToCanonical`, and `author-profile-handoffs`.
- Produces: lazy client entry and a status named `Laddar författarsidan` in both profile variants.

- [ ] **Step 1: Write the delayed-navigation browser test**

Import Playwright `Route`, add an explicit route gate for `**/api/v2/authors/**`, then start on `/bibliotek` and push `/författare/StrindbergA`. Before releasing the route, assert:

```ts
await expect(page).toHaveURL("/författare/StrindbergA")
await expect(page.locator("body")).toHaveClass(/page-authorInfo/u)
await expect(page.getByRole("status", { name: "Laddar författarsidan" })).toHaveCount(1)
await expect(page.getByRole("heading", { name: "Botanisera i biblioteket" })).toHaveCount(0)
await expect(page.locator(".introtext")).toHaveCount(0)
```

Release and assert August Strindberg content. Repeat for `/författare/StrindbergA/dramawebben`. Release every pending route and unregister the gate in `finally`.

- [ ] **Step 2: Run the test and verify RED**

```bash
yarn playwright test test/e2e/author-profiles.behavior.spec.ts --project=desktop-chromium --grep "mounts the author shell before profile data settles" --workers=1 --reporter=line
```

Expected: the Library remains mounted and no author status exists.

- [ ] **Step 3: Implement lazy resources and pending markup**

Pass this third argument to both profile `useAsyncData` calls:

```ts
{ lazy: true }
```

Insert this first template branch in both pages:

```vue
<div v-if="!response" class="searching" role="status" aria-live="polite">
  <div class="preloader">
    <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
    <span class="sr-only">Laddar författarsidan</span>
  </div>
</div>
```

Keep identity filtering and the current redirect watcher unchanged.

- [ ] **Step 4: Run GREEN and redirect/SSR authority**

```bash
yarn playwright test test/e2e/author-profiles.behavior.spec.ts --project=desktop-chromium --grep "mounts the author shell|canonical|handoff" --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/author-profiles.spec.ts
```

- [ ] **Step 5: Commit Task 1**

```bash
git add nuxt/app/pages/författare/'[author]'/index.vue nuxt/app/pages/författare/'[author]'/dramawebben.vue nuxt/test/e2e/author-profiles.behavior.spec.ts
git commit -m "Mount author profile shells before data"
```

### Task 2: Biblinfo sequential initial pipeline

**Files:**
- Modify: `nuxt/test/e2e/author-biblinfo.behavior.spec.ts`
- Modify: `nuxt/app/pages/författare/[author]/biblinfo.vue`
- Verify: `nuxt/test/ssr/author-biblinfo.spec.ts`

**Interfaces:**
- Consumes: `loadInitial(author, identity)`, `InitialResult`, `accepted`, and the existing pending markup.
- Produces: a reachable `Laddar bibliografisk databas` status spanning both initial requests.

- [ ] **Step 1: Write the two-stage browser test**

Gate both `**/api/v2/authors/**` and `**/api/v2/bibliography/entries**`. From `/om/ide`, push `/författare/StrindbergA/biblinfo` and assert:

```ts
await expect(page).toHaveURL("/författare/StrindbergA/biblinfo")
await expect(page.locator("body")).toHaveClass(/page-authorInfo/u)
await expect(page.getByRole("status", { name: "Laddar bibliografisk databas" })).toHaveCount(1)
await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toHaveCount(0)
```

Release the author request, wait until bibliography is gated, and prove the same status remains. Release bibliography and assert the author heading and `3 träffar`.

- [ ] **Step 2: Run the test and verify RED**

```bash
yarn playwright test test/e2e/author-biblinfo.behavior.spec.ts --project=desktop-chromium --grep "mounts Biblinfo while its initial pipeline is pending" --workers=1 --reporter=line
```

- [ ] **Step 3: Make the existing aggregate resource lazy**

Add `{ lazy: true }` to `useAsyncData<InitialResult>`. Keep `loadInitial` sequential and atomic. Add `role="status"` to the existing `!accepted` outer element; retain its hidden text.

```ts
const { data } = await useAsyncData<InitialResult>(asyncKey, async () => {
  const identity = currentIdentity.value
  return await loadInitial(authorId.value, identity)
}, { lazy: true })
```

- [ ] **Step 4: Run GREEN and complete owner suites**

```bash
yarn playwright test test/e2e/author-biblinfo.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/author-biblinfo.spec.ts
yarn eslint app/pages/författare/'[author]'/biblinfo.vue test/e2e/author-biblinfo.behavior.spec.ts
```

- [ ] **Step 5: Commit Task 2**

```bash
git add nuxt/app/pages/författare/'[author]'/biblinfo.vue nuxt/test/e2e/author-biblinfo.behavior.spec.ts
git commit -m "Mount Biblinfo before initial data"
```

### Task 3: Verify the author wave

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: a review-ready author wave.

- [ ] **Step 1: Run complete focused gates**

```bash
yarn playwright test test/e2e/author-profiles.behavior.spec.ts test/e2e/author-biblinfo.behavior.spec.ts --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run --config vitest.ssr.config.ts test/ssr/author-profiles.spec.ts test/ssr/author-biblinfo.spec.ts
yarn typecheck
```

- [ ] **Step 2: Verify scope**

```bash
git diff --check HEAD~2..HEAD
git status --short
```

Expected: no uncommitted files and no whitespace errors.
