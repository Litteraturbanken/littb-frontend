# Nuxt Text Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AngularJS `/sök` with a typed, SSR-capable Nuxt page that preserves the current route, search behavior, Reader links, and desktop/mobile appearance.

**Architecture:** FastAPI exposes three strict semantic search operations and hides legacy OpenSearch dictionaries. Nuxt owns route state and all fetch orchestration in the page's `<script setup>`, while pure parsing/rendering helpers and one fetch-free Headless UI multi-select remain independently testable. Angular fixture captures are the visual authority.

**Tech Stack:** FastAPI, Pydantic v2, OpenSearch legacy adapter, Nuxt 4, Vue 3 `<script setup>`, openapi-fetch, Tailwind-compatible legacy CSS, Headless UI, Vitest, Playwright.

## Global Constraints

- Architectural migration only: do not redesign, change Swedish copy, modify Angular production behavior, or replace the existing search data source.
- `app/scripts/components/search/template.html` and `app/scripts/search_controller.js` are the behavioral/DOM authority; `app/views/search.html` is stale.
- Preserve `/sök` query keys and Reader `s_*` return/hit parameters. `/sok` remains a query-preserving permanent redirect.
- Accept only bounded semantic filters in v2; never expose raw Lucene, arbitrary provider fields, provider URLs, cookies, or credentials.
- Keep page-only fetches in `nuxt/app/pages/sök.vue`; do not create a one-use search composable.
- Headless UI may manage interactive multi-select state, but its markup/classes must retain the legacy visual contract.
- Preserve the current `/red/.../sok_bkg.jpg`, existing `.page-search`/search classes, result table geometry, loading fade, pager, and mobile behavior.
- Direct valid searches must render useful SSR HTML and hydrate without a duplicate primary request. The slower count request must never delay results.
- Every state transition is route-identity guarded; superseded options/results/count/more requests cannot mutate the current route.
- Work TDD: observe a focused RED before implementation, then run focused GREEN and diff hygiene before each commit.
- Never stage `.superpowers/`; do not stop the existing frontend or backend development servers.

---

### Task 1: Define and validate the semantic FastAPI search contract

**Files:**
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/text_search.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/app.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_text_search.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`

**Interfaces:**
- Produces `POST /text-search/results` (`v2_post_text_search_results`).
- Produces `POST /text-search/count` (`v2_post_text_search_count`).
- Produces `POST /text-search/options` (`v2_post_text_search_options`).
- All models inherit strict `V2Model`; all error responses use `ApiErrorResponse`.

- [ ] **Step 1: Write failing model/OpenAPI tests**

Cover recursive `additionalProperties: false`, operation IDs, POST-only paths,
422/500/503 response refs, and exact request constraints. The shared semantic
request fields are:

```python
query: str                         # stripped, 1..200
prefix: bool = False
suffix: bool = False
word_form_only: bool = True
include_modernized: bool = True
author_ids: list[SearchIdentifier]
about_author_ids: list[SearchIdentifier]
work_ids: list[SearchIdentifier]
gender: Literal["female", "male"] | None
year_from: int | None
year_to: int | None
languages: list[SearchLanguageOption]
categories: list[SearchCategoryOption]
legacy_filters: list[SearchLegacyFilter]
facet_author_id: SearchIdentifier | None
```

`TextSearchResultsRequest` adds one-based `page`, literal `page_size=30`, and
`highlight_limit` 5..500. `TextSearchOptionsRequest` makes `query` optional,
adds `title_filter` 0..200, selected work IDs, `title_limit` in `{0, 30, 500}`
and `include_static_options`. Reject half year ranges, descending ranges,
years outside 1000..2200, duplicate/empty/unsafe IDs, unknown enums, excessive
list lengths, and extra keys.

- [ ] **Step 2: Run contract tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2/test_text_search.py -k 'model or validation or openapi'
```

Expected: missing module/routes/models.

- [ ] **Step 3: Implement strict models and route skeletons**

Define typed word/highlight/work/facet/title/option/count responses. Word output
contains only display text, `page_name`, and `word_id`; no raw morphology or
provider query metadata. Register the router in `lbapi/v2/app.py`. Route
skeletons call separate provider functions so endpoint tests can monkeypatch
them without contacting OpenSearch.

- [ ] **Step 4: Finish focused contract GREEN**

```bash
pytest -q test_lbapi/v2/test_text_search.py -k 'model or validation or openapi'
pytest -q test_lbapi/v2/test_openapi.py test_lbapi/v2/test_api.py
git diff --check
```

- [ ] **Step 5: Commit Task 1**

```bash
git add lbapi/v2/text_search.py lbapi/v2/app.py \
  test_lbapi/v2/test_text_search.py test_lbapi/v2/test_openapi.py \
  test_lbapi/v2/test_api.py
git diff --cached --check
git commit -m "feat(api): define text search contract"
```

---

### Task 2: Adapt legacy search results and counts behind the strict contract

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/text_search.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_text_search.py`

**Interfaces:**
- Consumes existing `lbapi.elasticapi.search` and `search_count` behavior.
- Produces validated `TextSearchResponse` and `TextSearchCountResponse`.

- [ ] **Step 1: Write failing semantic compiler tests**

Assert exact translation of Angular `buildSearchFilterPayload` choices:
authors, about-authors, works, gender, inclusive imprint range, every language
option, every category/project/source/publisher option, and the allowlisted
legacy `keyword` fields. Assert prefix/suffix/infix, lemma/word-form, and older
spelling flags. Unknown values must fail validation rather than disappear.

- [ ] **Step 2: Write failing provider/transform tests**

Use representative raw `source`, highlight token arrays, totals, and author
aggregations. Cover 30-work offset math, fixed main-author lowercase sort,
fixed includes, `highlight_limit + 1` sentinel removal, one-work “Visa fler”,
faksimil marking, context token partitions, empty results, and deterministic
facet ordering. Reject missing/mismatched IDs, unsupported media, empty match,
unsafe page/word IDs, negative/inconsistent totals, malformed aggregations, and
raw-field leakage.

- [ ] **Step 3: Observe provider tests RED**

```bash
pytest -q test_lbapi/v2/test_text_search.py -k 'compile or result or count or malformed'
```

- [ ] **Step 4: Implement the provider adapter**

Keep fixed provider arguments in code. Normalize the query to lowercase only
at the adapter boundary. Do not use a caller-provided sort/include/raw filter.
Perform result and count operations independently; map provider availability
failures to 503 and let malformed transformations reach the redacted modeled
500 handler.

- [ ] **Step 5: Run focused and v2 GREEN**

```bash
pytest -q test_lbapi/v2/test_text_search.py
pytest -q test_lbapi/v2
python -m compileall -q lbapi
git diff --check
```

- [ ] **Step 6: Commit Task 2**

```bash
git add lbapi/v2/text_search.py test_lbapi/v2/test_text_search.py
git diff --cached --check
git commit -m "feat(api): adapt full text search"
```

---

### Task 3: Provide typed advanced-search options and publish OpenAPI

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/text_search.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_text_search.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`

- [ ] **Step 1: Write failing options tests**

Test exact typed conversion of `/get_authors`, `/get_authorkeywords`,
`/imprint_range`, and `/query_string/etext,faksimil`. Preserve selected titles
not present in the current top 30, expose exact total, and return only bounded
IDs/names/titles/nullable years. Verify `include_static_options=false` skips
authors/about-authors/year calls. Avoid per-facet author lookups.

- [ ] **Step 2: Run RED and implement options aggregation**

```bash
pytest -q test_lbapi/v2/test_text_search.py -k options
```

Compile the same semantic filters as results. Keep title search latest-wins on
the frontend, but make each backend response internally consistent and strict.

- [ ] **Step 3: Export and verify the canonical schema**

```bash
python scripts/export_v2_openapi.py
python scripts/export_v2_openapi.py --check
pytest -q test_lbapi/v2
python -m compileall -q lbapi
git diff --check
```

- [ ] **Step 4: Commit Task 3**

```bash
git add lbapi/v2/text_search.py test_lbapi/v2/test_text_search.py \
  test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): expose text search options"
```

---

### Task 4: Generate Nuxt types and implement pure search-state helpers

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/api/generated/lbapi.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/text-search.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/text-search.spec.ts`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/fixtures/v2-server.mjs`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/v2-server.spec.ts`

- [ ] **Step 1: Regenerate from the backend snapshot**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json npm run api:generate
```

- [ ] **Step 2: Write failing pure-helper tests**

Cover parsing/serializing all legacy keys, one-based pages, unknown-key
preservation, reset rules, malformed/disallowed values, `infix` mapping,
request construction, result identity, Reader RFC 3986 paths and `s_*`
parameters, zero-based `hit_index`, punctuation classes, 40-character left
context compaction, and dropping context tokens of 30+ characters. Runtime
guards must reject extra/malformed fixture payload fields even when generated
compile-time types accept them.

- [ ] **Step 3: Run unit RED**

```bash
npm run test:unit -- test/unit/text-search.spec.ts test/unit/v2-server.spec.ts
```

- [ ] **Step 4: Implement pure helpers and fixture operations**

`text-search.ts` may contain only pure state/model/link/render helpers; it must
not call `$fetch`, `useFetch`, `useAsyncData`, or create a composable. Extend
the fixture with deterministic results/count/options routes and a request
ledger/reset endpoint used by SSR and browser tests.

- [ ] **Step 5: Finish GREEN and commit**

```bash
npm run test:unit -- test/unit/text-search.spec.ts test/unit/v2-server.spec.ts
npm run typecheck
npm run api:check
git diff --check
git add app/lib/api/generated/lbapi.ts app/lib/text-search.ts \
  test/unit/text-search.spec.ts test/fixtures/v2-server.mjs \
  test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): model text search state"
```

---

### Task 5: Capture the Angular search visual authority

**Files:**
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/playwright.search-angular.config.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/fixtures/text-search-data.mjs`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/capture-text-search-angular.spec.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/baselines/text-search-pristine-desktop.png`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/baselines/text-search-results-desktop.png`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/baselines/text-search-advanced-desktop.png`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/visual/baselines/text-search-no-hit-desktop.png`
- Create matching four `*-mobile.png` baselines in the same directory.
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/package.json`

- [ ] **Step 1: Build a fail-closed Angular fixture ledger**

Mock every exact authors, author-keywords, imprint-range, title-query, search,
search-count, shell, font, and `/red/.../sok_bkg.jpg` request. Abort production
escapes. Fixtures must exercise ordinary results, overflow “Visa fler”, author
facets, advanced selections, and zero hits.

- [ ] **Step 2: Capture desktop/mobile authority**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
npm run test:visual:search:capture
```

Capture 1440×1000 and iPhone 13 for pristine, populated simple, populated
advanced, and no-hit states. Record Angular's gender initialization mismatch
and accidental advanced-button submit as authority defects, not desired Nuxt
behavior; do not otherwise normalize the screenshots.

- [ ] **Step 3: Commit Task 5**

```bash
git add playwright.search-angular.config.ts package.json \
  test/fixtures/text-search-data.mjs \
  test/visual/capture-text-search-angular.spec.ts \
  test/visual/baselines/text-search-*.png
git diff --cached --check
git commit -m "test(nuxt): capture Angular text search"
```

---

### Task 6: Render the Nuxt search page with page-local SSR fetching

**Files:**
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/components/search/SearchMultiSelect.vue`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/pages/sök.vue`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/ssr/text-search.spec.ts`
- Modify if required for copied assets only: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/nuxt.config.ts`

- [ ] **Step 1: Write failing SSR tests**

Assert pristine 200 with full form/no search request, direct results SSR with
exact body and visible rows, no-hit copy/toolkit, advanced selected labels,
page metadata/body class/background, no duplicate primary request after
hydration, redacted local 502 on primary failure, and absence of provider
origins/raw fields in HTML/payload. Count may complete later and must not gate
the result response.

- [ ] **Step 2: Run SSR RED**

```bash
npm run test:ssr -- test/ssr/text-search.spec.ts
```

- [ ] **Step 3: Implement the fetch-free Headless UI multi-select**

Use Headless UI combobox/listbox semantics, keyboard navigation, removable
selected values, labels, and legacy `.filter_select` container/classes. Props
and emits are typed. The component never fetches or owns route state.

- [ ] **Step 4: Implement `sök.vue`**

The page directly creates the generated API client with `useRequestFetch()`.
Primary results use route-keyed `useAsyncData`; accepted data is synchronously
cleared on identity change. Count, options, title typeahead, and “Visa fler”
use separate version counters and abort controllers. The advanced toggle is
`type="button"`. Preserve Angular form/result/toolkit/pager/navigator markup,
all exact labels/options, result loading fade, and Reader link construction.

- [ ] **Step 5: Finish SSR GREEN and commit**

```bash
npm run test:unit -- test/unit/text-search.spec.ts
npm run test:ssr -- test/ssr/text-search.spec.ts
npm run typecheck
npm run build
git diff --check
git add app/components/search/SearchMultiSelect.vue app/pages/sök.vue \
  test/ssr/text-search.spec.ts nuxt.config.ts
git diff --cached --check
git commit -m "feat(nuxt): port full text search"
```

Only add `nuxt.config.ts` if it actually changed.

---

### Task 7: Match behavior and visuals, then close the slice

**Files:**
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/e2e/text-search.behavior.spec.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/e2e/text-search.visual.spec.ts`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/fixtures/v2-server.mjs`
- Modify as required: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/pages/sök.vue`
- Modify as required: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/components/search/SearchMultiSelect.vue`

- [ ] **Step 1: Write behavior tests**

Cover submit/reset, simple/advanced toggle, every filter family, chronology,
pagination, Back/Forward atomic restore, keyboard navigation, author facets and
“Visa alla”, “Visa fler”, lazy options, 250ms title typeahead latest-wins,
primary/count/options/more latest-wins, error recovery, hydration, Reader hit
links, and body/background cleanup after navigation away.

- [ ] **Step 2: Write visual comparisons**

Compare all eight Nuxt states to Task 5 authority baselines with the repository
threshold and maximum-difference policy. Diagnose geometry/style differences
against the Angular DOM and existing CSS before changing markup; do not loosen
thresholds to hide drift.

- [ ] **Step 3: Run focused browser RED/GREEN and inspect screenshots**

```bash
npm run test:e2e -- test/e2e/text-search.behavior.spec.ts \
  test/e2e/text-search.visual.spec.ts
```

Open desktop/mobile diffs and correct only parity defects.

- [ ] **Step 4: Run complete backend/frontend verification**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2
python scripts/export_v2_openapi.py --check
python -m compileall -q lbapi
git diff --check

cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
npm run api:check
npm run test:unit
npm run test:ssr
npm run test:e2e
npm run typecheck
npm run build
git diff --check
```

- [ ] **Step 5: Compare live old/new at both viewports**

Use the same deterministic phrase/filter fixtures against Angular and Nuxt,
then smoke the live backend at `/sök?fras=doktor`. Confirm result structure,
toolkit, Reader destination, background, loading completion, and console/network
cleanliness. Keep both dev servers running.

- [ ] **Step 6: Commit Task 7**

```bash
git add app/pages/sök.vue app/components/search/SearchMultiSelect.vue \
  test/e2e/text-search.behavior.spec.ts test/e2e/text-search.visual.spec.ts \
  test/fixtures/v2-server.mjs
git diff --cached --check
git commit -m "test(nuxt): verify text search parity"
```

- [ ] **Step 7: Audit the next Angular-only route**

Re-run the route inventory. Record remaining SLA-specific author pages,
Dramawebben, and deferred Reader/editor features; select the next highest-value
Nuxt-only slice without reopening completed `/sök` compatibility work.
