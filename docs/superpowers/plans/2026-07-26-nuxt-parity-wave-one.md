# Nuxt Feature-Parity Wave One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the confirmed first wave of Nuxt feature-parity regressions without changing Litteraturbanken's visual design.

**Architecture:** Keep route/domain state in the pages and introduce one thin `vue-multiselect` adapter at the component boundary. Separate immediate router history from a client-only 200 ms trailing reader fetch identity, always attach OCR to searchable facsimiles, and restore the missing typed backend dictionary router from its authoritative snapshot.

**Tech Stack:** Nuxt 4.4.8, Vue 3.5.39, TypeScript 5.9.3, `vue-multiselect` 3.5.0, Vitest 4.1.10, Playwright 1.61.1, FastAPI/Pydantic, pytest.

## Global Constraints

- Preserve the existing/legacy visual appearance; this is an architectural migration, not a redesign.
- Use `vue-multiselect` version `3.5.0` for multi-value controls on `/sök` and `/bibliotek`; leave ordinary single-value selects native.
- Keep page-only fetching and state in each page's `<script setup>` rather than adding page-specific composables.
- Reader page loads use a 200 ms trailing debounce on the client while initial SSR remains immediate.
- Reader route changes use normal push navigation so Back returns to the previous page.
- Searchable facsimiles always include transparent OCR; `?ocr` changes presentation only.
- Preserve all existing user changes in both dirty worktrees and stage/commit only task-owned files.

---

### Task 1: Restore the coherent typed FastAPI snapshot

**Files:**
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/dictionary.py`
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/bibliography.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/app.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/models.py`
- Modify: `/Users/johan/dev/lb-backend/openapi/v2.json`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_dictionary.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_bibliography.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_models.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_openapi.py`

**Interfaces:**
- Consumes: RED provider `GET https://red.litteraturbanken.se/so/?word=<word>&strict=true`.
- Produces: the coherent `aed55ae` API surface already represented by the Nuxt generated client: dictionary articles, bibliography entries, and author audio metadata.

- [ ] **Step 1: Restore only the snapshot dictionary tests and run them red**

Extract the dictionary-related tests from commit `aed55ae`, including a mounted `lbapi.web.app` request that distinguishes the typed no-article response from the generic absent-route 404.

Run: `pytest -q test_lbapi/v2/test_dictionary.py test_lbapi/v2/test_openapi.py test_lbapi/v2/test_api.py`

Expected: FAIL because `lbapi.v2.dictionary`, its models, and its registered route are absent.

- [ ] **Step 2: Restore the coherent implementation and schema snapshot**

Restore snapshot commit `aed55ae` completely. Its bibliography and author-audio changes are required by the already-checked-in Nuxt generated client and therefore are contract dependencies, not unrelated extras. Preserve pre-existing dirty operational files.

- [ ] **Step 3: Verify backend green and contract synchronization**

Run: `pytest -q test_lbapi/v2/test_dictionary.py test_lbapi/v2/test_bibliography.py test_lbapi/v2/test_openapi.py test_lbapi/v2/test_api.py test_lbapi/v2/test_models.py test_lbapi/v2/test_authors.py`

Run: `LBAPI_OPENAPI_SCHEMA=/Users/johan/dev/lb-backend/openapi/v2.json yarn api:check` from `nuxt/`.

Expected: all selected pytest tests pass and generated types are up to date.

- [ ] **Step 4: Commit only snapshot-owned backend files**

Commit message: `feat(api): restore Nuxt v2 contracts`

### Task 2: Introduce the shared Vue-Multiselect adapter and migrate Search

**Files:**
- Modify: `nuxt/package.json`
- Modify: `nuxt/yarn.lock`
- Modify: `nuxt/nuxt.config.ts`
- Modify: `nuxt/app/components/search/SearchMultiSelect.vue`
- Modify: `nuxt/app/assets/styles/nuxt.scss`
- Modify: `nuxt/test/e2e/text-search.behavior.spec.ts`
- Modify: `nuxt/test/ssr/text-search.spec.ts`

**Interfaces:**
- Consumes: `modelValue: readonly string[]`, `options: readonly SearchMultiSelectOption[]`, placeholder/search/loading props, `query` event.
- Produces: unchanged string-array model API backed by `vue-multiselect`, stable legacy classes/data hooks, and deterministic option-order emissions.

- [ ] **Step 1: Add failing Search behavior tests**

Add tests that open the real component, filter the title list, select and remove chips by keyboard/click, preserve exact route query order, restore on Back/Forward/reload, and report no hydration warnings.

Run: `yarn playwright test test/e2e/text-search.behavior.spec.ts --project=desktop-chromium --grep "multiselect"`

Expected: FAIL because the current component is a Headless UI combobox and lacks the Vue-Multiselect behavior/DOM contract.

- [ ] **Step 2: Install and configure Vue-Multiselect**

Pin `"vue-multiselect": "3.5.0"`, update `yarn.lock`, and load `vue-multiselect/dist/vue-multiselect.css` before the project override styles.

- [ ] **Step 3: Replace the adapter internals**

Use `<VueMultiselect multiple track-by="value" label="label">`. Convert selected string values to option objects and emit declared-order string values. Map `disabled` to `$isDisabled`, retain `selectionLabel`, forward search text through `@search-change`, and keep accessible labels plus stable Select2-era hooks.

- [ ] **Step 4: Restore legacy visual geometry with focused overrides**

Override `.multiselect*` rules only within the existing filter wrapper so height, chips, fonts, colors, placeholders, focus state, and dropdown geometry match the current/legacy UI.

- [ ] **Step 5: Verify Search green**

Run the focused Playwright command from Step 1, `yarn vitest run test/ssr/text-search.spec.ts`, and `yarn typecheck`.

- [ ] **Step 6: Commit Search multiselect files**

Commit message: `feat(search): use vue-multiselect filters`

### Task 3: Migrate Library multiselects and restore result metadata

**Files:**
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/test/fixtures/library-relevance-data.mjs`
- Modify: `nuxt/test/ssr/library.spec.ts`
- Modify: `nuxt/test/e2e/library-advanced.behavior.spec.ts`
- Modify: `nuxt/test/e2e/library.visual.spec.ts`
- Modify: `test/e2e/playwright_e2e.spec.js`

**Interfaces:**
- Consumes: the Task 2 `SearchMultiSelect` adapter and existing Library string-array filter state.
- Produces: five searchable multi-value Library controls with unchanged URL semantics; relevance results with ellipsis/tooltips and separate contribution suffix spans.

- [ ] **Step 1: Add failing Library control tests**

Replace native `selectOption` expectations with real multiselect interactions for categories, about-author, narrowing, media, and languages. Assert disabled narrowing choices, reset, exact query ordering, Back/Forward/reload restoration, keyboard access, and no hydration warnings.

Run: `yarn playwright test test/e2e/library-advanced.behavior.spec.ts --project=desktop-chromium`

Expected: FAIL against the native multiple selects.

- [ ] **Step 2: Add failing title and contribution tests**

Add a deliberately overflowing relevance fixture with different `shorttitle` and `title`, plus editor and illustrator results. Assert `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`, `scrollWidth > clientWidth`, full-title tooltip, linked name without suffix, and adjacent `(red.)`/`(ill.)` spans.

Run: `yarn vitest run test/ssr/library.spec.ts` and the focused Library visual/behavior tests.

Expected: FAIL because relevance parsing discards full titles and contribution types and its title cell is unconstrained.

- [ ] **Step 3: Replace Library's five native multi-value controls**

Map Library options to the shared adapter, including grouped category labels and disabled narrowing entries. Preserve `data-library-*` hooks and normalize emitted values to declared option order before calling existing commit functions. Keep gender native.

- [ ] **Step 4: Restore relevance title and author metadata**

Retain full title and `main_author.type` in parsed results. Render the short title in a `min-w-0 whitespace-nowrap overflow-hidden text-ellipsis` wrapper with a conditional full-title `title`; render contribution suffix outside the author link.

- [ ] **Step 5: Verify Library green**

Run focused SSR, advanced behavior, visual, and root legacy Playwright cases plus `yarn typecheck`.

- [ ] **Step 6: Commit Library files**

Commit message: `fix(library): restore filter and result parity`

### Task 4: Restore reader debounce, slider track clicks, and automatic OCR

**Files:**
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `test/e2e/playwright_e2e.spec.js`

**Interfaces:**
- Consumes: route page parameters, reader page maps, `ReaderResponse.searchable`, optional OCR overlay source.
- Produces: immediate pushed route history, a client-only 200 ms trailing fetch identity, stable reader shell, click-to-jump slider, and transparent OCR for every searchable facsimile.

- [ ] **Step 1: Add failing rapid-navigation tests**

From a loaded page, issue multiple next-page inputs inside 200 ms. Assert each route is pushed in sequence, only the final content endpoint is fetched after the delay, Back visits the intermediate pages, and the reader sidebar never detaches or shows a loading notice.

Run: `yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --grep "debounce"`

Expected: FAIL because `useAsyncData` currently watches the immediate route identity and navigation reads retained response state.

- [ ] **Step 2: Add failing OCR and slider tests**

For a searchable ordinary facsimile without `?ocr`, assert an OCR request, a transparent selectable overlay, and a visible scan. Assert `?ocr` changes presentation without changing data availability. Assert non-searchable pages do not request OCR. Click the slider track away from its thumb and assert the handle jumps and exactly one route/request commits on release.

Run: `yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --grep "OCR|track click"`

Expected: OCR cases FAIL because data is query-gated; the track test documents whether the current native-range behavior already passes.

- [ ] **Step 3: Separate immediate navigation from debounced content loading**

Keep the route as the authoritative pending page, push normally, and update a client-only fetch identity with a trailing 200 ms timer. Use the immediate identity during SSR. Derive repeated navigation targets from the latest route/page map rather than `retainedReader`.

- [ ] **Step 4: Always fetch searchable facsimile OCR**

Have the reader server route fetch OCR whenever the resolved representation is a searchable facsimile. Render the overlay whenever present; reserve `explicitOcrRequested` for inspection styling and marker queries for highlighting.

- [ ] **Step 5: Implement coordinate-based track fallback only if the red test requires it**

If native range click behavior fails in Playwright, calculate the integer index from `(clientX - rect.left) / rect.width`, clamp it to `[0, sliderMaximum]`, preview immediately, and commit once on pointer release. Preserve drag and keyboard paths.

- [ ] **Step 6: Verify Reader green**

Run focused reader behavior/SSR tests, `yarn typecheck`, and manually compare the supplied Boye URL with the live site in the in-app browser.

- [ ] **Step 7: Commit Reader files**

Commit message: `fix(reader): restore navigation and OCR parity`

### Task 5: Real-stack regression gate and parity sweep

**Files:**
- Modify: `tasks.py`
- Modify: `test/e2e/playwright_e2e.spec.js`
- Modify: focused Nuxt tests/fixtures only when a newly reproduced parity defect requires them.

**Interfaces:**
- Consumes: checked-out FastAPI backend and Nuxt dev server tasks.
- Produces: a repeatable real-stack smoke gate covering dictionary, reader navigation/OCR, Library filters, result metadata, and nearby live-parity defects.

- [ ] **Step 1: Add a failing real-backend dictionary smoke assertion**

Run the root Playwright spec against `invoke dev` and assert a selected reader word opens a non-empty dictionary article instead of a generic 404.

- [ ] **Step 2: Adapt the root parity specification**

Update selectors for Vue-Multiselect and add named regressions for the supplied Boye OCR page, rapid reader flips/history/sidebar stability, slider track click, Library ellipsis, and `(red.)`.

- [ ] **Step 3: Compare critical pages with live**

Use the in-app browser at desktop and mobile widths for `/bibliotek`, advanced `/sök`, the supplied Boye facsimile, a dictionary selection, and rapid page navigation. Convert every reproducible mismatch into a failing focused test before fixing it.

- [ ] **Step 4: Run the full first-wave gate**

Run: `invoke test`, `invoke typecheck`, the focused Nuxt Playwright projects, and `npx playwright test test/e2e/playwright_e2e.spec.js` against the real dev servers.

Expected: all commands pass with no hydration, console, or request errors attributable to the migration.

- [ ] **Step 5: Commit the regression gate**

Commit message: `test(e2e): cover Nuxt parity wave one`
