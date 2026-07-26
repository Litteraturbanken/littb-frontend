# Nuxt Full Library Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Angular-authoritative Library category, publisher, about-author, narrowing, recent-project, and source-material batch-download behavior across `/bibliotek`, `/titlar`, and `/epub`.

**Architecture:** Extend the route-owned model in `nuxt/app/pages/bibliotek.vue`; closed allowlists translate URL state into legacy query predicates, and strictly parsed page-local metadata supplies about-author labels. The existing request abort/version pipeline owns all result and count fetches. Download selection is ephemeral client state, while `nedladdning` alone is durable route state and a native form posts validated tokens to the legacy endpoint.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, TypeScript strict mode, Nitro/Vite legacy proxy, Vitest SSR tests, Playwright desktop/mobile/visual tests, deterministic Node fixture server.

## Global Constraints

- Preserve Angular markup classes, copy, order, and existing visuals; do not redesign.
- Keep page-only Library model and fetching code in `nuxt/app/pages/bibliotek.vue`; create no composable.
- Use `NuxtLink` or router navigation for internal routes and preserve browser Back/Forward behavior.
- Fail closed for malformed URL values and backend envelopes; a stale request must never replace newer state.
- Do not edit normal Reader/editor files.
- Preserve unrelated dirty worktree changes; do not stage or commit.
- Use unique test ports for every locally launched fixture/Nuxt/Angular authority process.

---

### Task 1: Closed facet state and exact predicates

**Files:**
- Modify: `nuxt/test/ssr/library.spec.ts`
- Modify: `nuxt/test/e2e/library-advanced.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: existing `LibraryAdvancedFilters`, `routeState`, `advancedPredicate`, `queryFor`, and `pushAdvancedQuery`.
- Produces: validated `keywords`, `aboutAuthorIds`, and `narrowingKeywords` fields plus deterministic `keywordPredicate()` and `aboutAuthorPredicate()` query composition.

- [ ] **Step 1: Write failing SSR tests**

Add assertions that
`?keywords=texttype:roman,provenance.library:SA&keywords_aux=keyword:Humor,texttype:brev;brevsamling&about_authors=LagerlofS,StrindbergA`
emits ordinary OR, nested about-author, and two narrowing AND clauses in the
backend `q`; assert unknown and injected values emit none of those clauses.

- [ ] **Step 2: Run SSR RED**

Run: `cd nuxt && LBAPI_FIXTURE_PORT=4721 NUXT_TEST_PORT=3721 npm run test:ssr -- test/ssr/library.spec.ts`

Expected: FAIL because the new URL keys are not parsed or composed.

- [ ] **Step 3: Write failing desktop/mobile behavior tests**

Select "Romaner", "Svenska Akademien", an about-author, and two narrowing
collections. Assert exact comma-separated route values, page reset, control
restoration through Back/Forward/reload, and the exact final request predicate.

- [ ] **Step 4: Run Playwright RED**

Run: `cd nuxt && LBAPI_FIXTURE_PORT=4722 NUXT_TEST_PORT=3722 npm run test:e2e -- test/e2e/library-advanced.behavior.spec.ts --project=chromium --project=mobile-chromium`

Expected: FAIL because the controls do not exist.

- [ ] **Step 5: Implement minimal closed parsing and controls**

Add the exact Angular option arrays, closed value sets, fields on
`LibraryAdvancedFilters`, predicate builders with OR within `keywords`, nested
OR within `about_authors`, and one clause per `keywords_aux` item. Render native
multi-selects with Angular labels/classes and commit via the existing router
pipeline.

- [ ] **Step 6: Run Task 1 GREEN**

Run the SSR and desktop/mobile commands from Steps 2 and 4.

Expected: both exit 0.

### Task 2: Strict about-author metadata

**Files:**
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Modify: `nuxt/test/ssr/library.spec.ts`
- Modify: `nuxt/test/e2e/library-advanced.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: legacy GET `/get_authorkeywords` and `/get_authors` through private/public Library bases.
- Produces: `AboutAuthorOption { id: string; label: string }[]` from an exact, strict ID join.

- [ ] **Step 1: Add failing fixture contract tests**

Assert deterministic safe responses and request ledgers for both endpoints,
plus independently configurable malformed envelopes.

- [ ] **Step 2: Run fixture RED**

Run: `cd nuxt && npm test -- test/unit/v2-server.spec.ts`

Expected: FAIL because Library metadata controls/routes are absent.

- [ ] **Step 3: Add fixture support and strict page tests**

Implement only the two GET handlers and fixture control endpoints in the
Library handler region. Add SSR/browser assertions that safe joined authors
render while malformed, duplicate, unknown, or unsafe records do not execute
URL filters.

- [ ] **Step 4: Run Task 2 GREEN**

Run: `cd nuxt && npm test -- test/unit/v2-server.spec.ts && LBAPI_FIXTURE_PORT=4723 NUXT_TEST_PORT=3723 npm run test:ssr -- test/ssr/library.spec.ts`

Expected: exit 0 with the new metadata contracts green.

### Task 3: Recent-only 1800 semantics and shared routes

**Files:**
- Modify: `nuxt/test/ssr/library.spec.ts`
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: `routeState`, `latestRequestUrl`, `/titlar` redirect rule, `/epub` alias.
- Produces: `hide1800` execution and UI only for `/bibliotek?visa=latest`.

- [ ] **Step 1: Write and run RED tests**

Assert `/bibliotek?hide1800`, `/bibliotek?visa=works&hide1800`, and
`/epub?hide1800` do not add `NOT keyword:1800` or show its control, while Latest
does. Assert `/titlar?...` redirects with supported query bytes preserved.

Run: `cd nuxt && LBAPI_FIXTURE_PORT=4724 NUXT_TEST_PORT=3724 npm run test:ssr -- test/ssr/library.spec.ts`

Expected: at least the redirect-query assertion fails if parity is missing.

- [ ] **Step 2: Implement minimal route applicability**

Keep `hide1800` derived solely from Latest state and ensure mode switching,
query serialization, and `/epub` never activate it.

- [ ] **Step 3: Run Task 3 GREEN**

Run SSR plus `library.behavior.spec.ts` on desktop and mobile with ports 4725/3725.

Expected: exit 0.

### Task 3A: Encoded author and Reader SPA destinations

**Files:**
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: every Library parser/group that creates an internal author or Reader destination.
- Produces: `/f%C3%B6rfattare/<author>/...` hrefs compatible with Nuxt's client route matcher while visible labels remain unchanged.

- [ ] **Step 1: Write click-through RED tests**

From relevance, Works, Parts, EPUB, PDF, and Latest rows, click representative
author/title links after entering Library through client navigation. Assert the
destination renders hydrated author or Reader content, no routing error appears,
and the page was not recovered by a document reload.

- [ ] **Step 2: Run RED**

Run: `cd nuxt && LBAPI_FIXTURE_PORT=4729 NUXT_TEST_PORT=3729 npm run test:e2e -- test/e2e/library.behavior.spec.ts --project=chromium`

Expected: FAIL because literal `/författare/…` paths do not match the current
client-side route record.

- [ ] **Step 3: Normalize the static path prefix**

Change only generated internal path prefixes in `bibliotek.vue` from literal
`/författare/` to `/f%C3%B6rfattare/`. Keep dynamic segments encoded exactly once,
keep direct download links unchanged, and continue using `NuxtLink` for title
destinations.

- [ ] **Step 4: Run Task 3A GREEN**

Re-run Step 2 on desktop and `mobile-chromium`.

Expected: exit 0 and all click-through assertions remain in-app.

### Task 4: Batch selection model and strict exports

**Files:**
- Modify: `nuxt/test/fixtures/library-query-data.mjs`
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: grouped Works records.
- Produces: validated `SourceExport { lbworkid; mediatype: "etext" | "faksimil"; type: "txt" | "xml" | "workdb" | "pdf"; size: number }`, stable work selection keys, and source-only query clause `export>type:(xml OR txt OR workdb)`.

- [ ] **Step 1: Write failing selection/export tests**

Cover entering/closing `nedladdning`, Works forcing, source-only request query,
checkbox/row selection, visible select/deselect, per-item removal, clear,
cross-page persistence, Back behavior, and malformed export rejection.

- [ ] **Step 2: Run RED**

Run: `cd nuxt && LBAPI_FIXTURE_PORT=4726 NUXT_TEST_PORT=3726 npm run test:e2e -- test/e2e/library.behavior.spec.ts --project=chromium --project=mobile-chromium`

Expected: FAIL because download-mode controls and validated exports are absent.

- [ ] **Step 3: Implement minimal selection model**

Extend `BrowseCandidate`/grouping to retain strict exports. Add route-derived
download mode, source-only request clause, ephemeral selection `Map`, visible
bulk operations, and Angular-shaped row/sidebar markup. Reset selection only on
mode boundary, not paging or filtering.

- [ ] **Step 4: Run Task 4 GREEN**

Re-run Step 2.

Expected: exit 0.

### Task 5: Format chooser and native POST

**Files:**
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: selected validated `SourceExport[]`.
- Produces: selected format state, exact size label, and POST `/api/download` body `files=<encoded comma-separated tokens>`.

- [ ] **Step 1: Write failing POST workflow tests**

Assert Angular count/copy, disabled unavailable formats, KB/MB formatting,
exact token order/de-duplication, submit guard, and the fixture POST ledger.

- [ ] **Step 2: Run RED**

Run the fixture unit test and focused browser test on ports 4727/3727.

Expected: FAIL because POST capture and chooser are absent.

- [ ] **Step 3: Implement fixture ledger and native form submit**

Add a narrow `/download` POST fixture handler accepting URL-encoded `files` and
a reset/read ledger. Render the Angular `downloadPopover.html` copy/classes and
use a programmatically submitted native form whose tokens come only from strict
exports.

- [ ] **Step 4: Run Task 5 GREEN**

Run: `cd nuxt && npm test -- test/unit/v2-server.spec.ts && LBAPI_FIXTURE_PORT=4728 NUXT_TEST_PORT=3728 npm run test:e2e -- test/e2e/library.behavior.spec.ts --project=chromium --project=mobile-chromium`

Expected: exit 0.

### Task 6: Request races, full regression, and Angular comparison

**Files:**
- Modify: `nuxt/test/visual/capture-angular.spec.ts` or create a focused `nuxt/test/visual/capture-library-full-angular.spec.ts`
- Modify: `nuxt/test/e2e/library.visual.spec.ts`
- Create: updated Library authority/baseline PNGs only when freshly captured.

**Interfaces:**
- Consumes: all completed Library behavior.
- Produces: fresh desktop/mobile Angular authority and Nuxt visual evidence.

- [ ] **Step 1: Add stale metadata/result/download-mode race coverage**

Delay an old filtered request, navigate/change facets, and assert the latest
mode, rows, counts, and selected-panel state remain authoritative.

- [ ] **Step 2: Run full focused verification**

Run with unique ports: Library SSR, fixture unit tests, all Library desktop and
mobile behavior, TypeScript typecheck, and Library visual tests.

Expected: every command exits 0 with zero failures.

- [ ] **Step 3: Capture Angular authority at intervals**

Capture pristine, expanded advanced facets, combined filter results, and
download mode/format chooser at desktop and mobile widths against a unique
Angular port. Record exact screenshot paths and dimensions.

- [ ] **Step 4: Compare and correct only parity differences**

Compare Nuxt and Angular screenshots state-by-state. Change only Library markup
or existing-class usage needed for parity, re-running the relevant behavior and
visual test after each correction.

- [ ] **Step 5: Final self-review**

Review `git diff --` for only scoped files, scan the spec/plan for placeholders,
re-check every design requirement against a test, and report RED/GREEN commands,
files changed, Angular comparison evidence, and any remaining gaps without
staging or committing.
