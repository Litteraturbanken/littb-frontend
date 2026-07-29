# Managed Navigation and Search Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance managed Nuxt-owned links as SPA navigation and restore the last text-search URL in global navigation.

**Architecture:** Pure library functions classify bounded managed-link clicks and validate remembered search URLs. Thin composables connect those functions to `navigateTo` and request-safe `useState`; only the three managed-HTML pages and the shared layout/search consumers integrate them.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, Vitest, Playwright.

## Global Constraints

- Preserve current visuals and exact query bytes/history behavior.
- Leave Reader, Editor, Library, and Quick Search developer files untouched.
- Do not stage or commit.
- Follow red-green-refactor and verify each failing test before implementation.

---

### Task 1: Bounded managed-HTML navigation

**Files:**
- Create: `nuxt/app/lib/managed-html-navigation.ts`
- Create: `nuxt/app/composables/useManagedHtmlNavigation.ts`
- Modify: `nuxt/app/pages/index.vue`
- Modify: `nuxt/app/pages/om/[page].vue`
- Modify: `nuxt/app/pages/presentationer/[...segments].vue`
- Modify: `nuxt/app/layouts/default.vue`
- Test: `nuxt/test/unit/managed-html-navigation.spec.ts`
- Test: `nuxt/test/e2e/home-page.behavior.spec.ts`
- Test: `nuxt/test/e2e/about-pages.behavior.spec.ts`
- Test: `nuxt/test/e2e/presentations.behavior.spec.ts`

**Interfaces:**
- Produces: `managedHtmlNavigationTarget(input): string | null`
- Produces: `useManagedHtmlNavigation(): (event: MouseEvent) => void`

- [x] Write unit cases for Nuxt routes, same-origin absolute URLs, query preservation, and every native-behavior exclusion.
- [x] Run the focused unit test and confirm it fails because the classifier is absent.
- [x] Implement the classifier/composable and attach it to the three `v-html` roots; convert the three language anchors to `NuxtLink`.
- [x] Run the focused unit test and confirm it passes.
- [x] Add SPA-sentinel browser tests with Back behavior for the integrations, run them, and retain their red-green evidence.

### Task 2: Remembered text-search global navigation

**Files:**
- Create: `nuxt/app/lib/text-search-navigation.ts`
- Create: `nuxt/app/composables/useTextSearchNavigation.ts`
- Modify: `nuxt/app/layouts/default.vue`
- Modify: `nuxt/app/pages/sök.vue`
- Test: `nuxt/test/unit/text-search-navigation.spec.ts`
- Test: `nuxt/test/ssr/home-page.spec.ts`
- Test: `nuxt/test/ssr/text-search.spec.ts`
- Test: `nuxt/test/e2e/text-search.behavior.spec.ts`

**Interfaces:**
- Produces: `DEFAULT_TEXT_SEARCH_HREF`
- Produces: `rememberedTextSearchHref(value): string | null`
- Produces: `useTextSearchNavigation()` with readonly `textSearchHref` and `rememberTextSearchHref(value)`.

- [x] Write unit cases for the SSR default, canonical prefixes, exact query preservation, hash removal, and unrelated-route rejection.
- [x] Run the focused unit test and confirm it fails because the helper is absent.
- [x] Implement request-safe shared state, update it from the search route, and bind it in the layout.
- [x] Run the focused unit test and confirm it passes.
- [x] Add SSR default/direct-query assertions and a browser cross-page/Back test, then run them with red-green evidence.

### Task 3: Focused regression verification

**Files:**
- Verify only; no additional production files.

- [x] Run focused unit, SSR, and browser suites for managed navigation and search memory.
- [x] Run lint/type checking for the Nuxt workspace.
- [x] Inspect `git diff` and confirm excluded files were untouched by this task.
