# Typed Reader Search-Hit State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed stateless within-work hit API and consume canonical `q`/zero-based `hit` state page-locally in Nuxt Reader with SSR-visible exact-range highlighting and previous/next-hit navigation.

**Architecture:** The backend normalizes one complete legacy within-work search into a strict v2 absolute-index window without SSE or temporary search IDs. Generated frontend types and isolated fixtures feed the existing Reader page, which validates canonical query state, fetches one three-hit window, transforms trusted source spans safely, and preserves both page and hit navigation.

**Tech Stack:** FastAPI, Pydantic v2, OpenSearch-backed legacy engine, Nuxt 4, Vue 3, openapi-fetch/openapi-typescript, linkedom, Playwright, Pytest, Vitest.

**Design:** `docs/superpowers/specs/2026-07-17-nuxt-reader-search-hit-state-design.md`

**Audited bases:** backend `17dd77c`; frontend is the reviewed Library/Reader branch at plan execution time.

## Global Constraints

- Canonical Reader URL uses `q` plus absolute zero-based `hit`; only `lemma=1`, `ej_modern=1`, `prefix=1`, and `suffix=1` can alter hit ordering.
- Do not expose legacy `traff`, `traffslut`, arbitrary `s_*`, SSE, `search_id`, temporary-index paging, morphology, or OpenSearch documents.
- Backend request/response models are strict; errors use the established non-leaking typed v2 envelopes; OpenSearch remains 503 and unexpected malformed provider data remains 500.
- Backend API returns absolute indices, human page names, integer page indices, inclusive safe word-ID ranges, exact total, and a bounded 1–20 window.
- Use generated frontend types; do not add a handwritten duplicate response interface.
- Keep Reader search state/model/HTML transform in its page `<script setup>`; add no one-use composable/store and do not make valid Reader content depend fatally on hit enhancement.
- Ordinary page links preserve canonical and unknown query state without forcing the active hit's page; hit links target their own page/absolute index.
- Highlight by exact DOM ID equality and document order; never interpolate word IDs or queries into CSS selectors or markup.
- Preserve Reader history's exact `route.fullPath`, existing ordinary Reader behavior, and visuals outside the proven marker/toolkit rules.
- Full `/sök`, in-Reader search form, first/last/goto controls, faksimil, keyboard/contents/page chooser/focus/editor features remain deferred.

---

### Task 1: Define and normalize the strict backend hit window

**Repository:** `/Users/johan/.codex/worktrees/8c5c/lb-backend`

**Files:**
- Modify: `lbapi/v2/models.py`
- Create: `lbapi/v2/reader_search.py`
- Create: `test_lbapi/v2/test_reader_search.py`
- Modify: `test_lbapi/v2/test_models.py`

**Interfaces:**
- Consumes: `lbapi.elasticapi.search_in_document(doc_types, work_id, query, ...)` full legacy response.
- Produces: `query_work_search_hits(...) -> WorkSearchHitsResponse`, pure `transform_work_search_hits(...)`, strict typed models.

- [ ] **Step 1: Add failing model and transformer tests**

Add strict response-model tests and live-shaped raw fixtures:

```py
SINGLE = {
    "order": 1,
    "highlights": [
        {"ix": "2", "n": "-2", "wid": "w2_2", "lemgram": [], "modernized": "GLAS"}
    ],
}
PHRASE = {
    "order": 1,
    "highlights": [
        {"ix": "2", "n": "-2", "wid": "w2_1"},
        {"ix": "2", "n": "-2", "wid": "w2_2"},
    ],
}

result = transform_work_search_hits(
    {"data": [first, PHRASE, last], "num_highlights": 3},
    query="doktor glas", media_type="etext", offset=0, limit=3
)
assert result.items[1].index == 1
assert result.items[1].page_name == "-2"
assert result.items[1].page_index == 2
assert result.items[1].highlight.from_word_id == "w2_1"
assert result.items[1].highlight.to_word_id == "w2_2"
```

Cover first/middle/tail/out-of-range windows, empty response, strict serialization,
and malformed total/order/highlights/page/index/word-ID/cross-page/reversed range.
Assert raw `lemgram`/`modernized` cannot enter the output.

- [ ] **Step 2: Run RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2/test_reader_search.py test_lbapi/v2/test_models.py -k 'search_hit or search_hits'
```

Expected: imports/models/functions are absent; pre-existing model tests stay green.

- [ ] **Step 3: Add strict models and safe validators**

Add:

```py
class SearchHitHighlight(V2Model):
    from_word_id: str
    to_word_id: str

class WorkSearchHit(V2Model):
    index: int = Field(ge=0)
    page_name: str
    page_index: int = Field(ge=0)
    highlight: SearchHitHighlight

class WorkSearchHitsResponse(V2Model):
    query: str
    media_type: Literal["etext"]
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=20)
    total_hits: int = Field(ge=0)
    items: list[WorkSearchHit]
```

Define a safe lowercase `SearchWorkId` validator (2–100, `lb` prefix, no
percent/slash/backslash/control/dot-segment) and `SearchQuery` (trimmed 1–200).
Validate token IDs with `^w(?P<page>\d+)_(?P<ordinal>\d+)$`.

- [ ] **Step 4: Implement pure normalization and one provider call**

`transform_work_search_hits` must validate `num_highlights == len(data)`, raw
orders exactly match absolute enumerate indices, normalize every raw hit before
slicing, require one page/index per occurrence, and check nondecreasing token
ordinals. It then returns `normalized[offset:offset+limit]` with absolute index.

`query_work_search_hits` lowercases and applies wildcards without importing
`lbapi.web`, calls the legacy engine once with:

```py
elasticapi.search_in_document(
    "etext", work_id, modified_query,
    includes=(), excludes=("*",), number_of_fragments=None,
    word_form_only=not word_forms,
    include_modernized=include_older_spellings,
)
```

Cover exact defaults and all four flags with monkeypatched call assertions.

- [ ] **Step 5: Run GREEN and commit**

Run focused tests, `pytest -q test_lbapi/v2/test_models.py`, and
`git diff --check`. Commit:

```bash
git add lbapi/v2/models.py lbapi/v2/reader_search.py \
  test_lbapi/v2/test_reader_search.py test_lbapi/v2/test_models.py
git commit -m "feat(api): model reader search hit windows"
```

---

### Task 2: Publish the v2 endpoint and OpenAPI contract

**Repository:** `/Users/johan/.codex/worktrees/8c5c/lb-backend`

**Files:**
- Modify: `lbapi/v2/reader_search.py`
- Modify: `lbapi/v2/app.py`
- Modify: `test_lbapi/v2/test_api.py`
- Modify: `test_lbapi/v2/test_openapi.py`
- Modify generated snapshot: `openapi/v2.json`

**Interfaces:**
- Consumes: Task 1 provider/transformer/models.
- Produces: GET `/works/{work_id}/search-hits`, operation `v2_get_work_search_hits`, checked OpenAPI schema.

- [ ] **Step 1: Add failing route/validation/error/OpenAPI tests**

Assert defaults and exact query mapping, explicit options, empty/out-of-range,
GET-only method, malformed path/query/offset/limit/media/extra supported-field
behavior, 503 OpenSearch mapping, non-leaking unexpected 500, operation ID,
strict 200 schema reference, typed 422/500/503 references, and the updated exact
stable v2 path set.

- [ ] **Step 2: Run RED**

```bash
pytest -q test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py -k 'search_hit or stable_path or route_methods'
```

Expected: route/schema are absent while existing endpoints pass.

- [ ] **Step 3: Register the strict endpoint**

Use `APIRouter(tags=["reader"])`, the Task 1 validators, literal `etext`, Query
bounds/defaults, `response_model=WorkSearchHitsResponse`, and existing error
handlers. The route calls the provider once and the transformer once; it does
not catch broad exceptions or leak provider payloads. Include the router in
`v2_app`.

- [ ] **Step 4: Export and verify OpenAPI**

```bash
python scripts/export_v2_openapi.py
python scripts/export_v2_openapi.py --check
pytest -q test_lbapi/v2
git diff --check
```

Expected: full v2 suite passes and snapshot is stable. Commit:

```bash
git add lbapi/v2/reader_search.py lbapi/v2/app.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git commit -m "feat(api): publish reader search hits"
```

---

### Task 3: Regenerate the client and build isolated Reader-hit fixtures

**Repositories:** backend snapshot above; frontend `/Users/johan/.codex/worktrees/8c5c/littb`

**Files:**
- Regenerate: `nuxt/app/lib/api/generated/lbapi.ts`
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: backend `openapi/v2.json` and `/v2/works/{work_id}/search-hits` contract.
- Produces: generated frontend types, deterministic public/private hit routes, isolated ledger/failure/delay controls.

- [ ] **Step 1: Add failing generated-contract and fixture tests**

Require the generated path/operation/schema types. Extend synthetic Reader HTML
to separate `<span id="w2_1">DOKTOR</span>` and `<span id="w2_2">GLAS</span>`.
Add fixture tests for private/public exact path, defaults/options, phrase/single,
pages `-3/-2/-1`, absolute indices, total, empty/out-of-range/malformed/failure,
query-keyed delay, reset, and independence from `_reader_requests`.

- [ ] **Step 2: Run RED**

```bash
cd nuxt
yarn vitest run test/unit/v2-server.spec.ts
```

Expected: generated path and fixture controls are absent.

- [ ] **Step 3: Regenerate types and add fixture state**

```bash
cd nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:generate
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
```

Add `readerSearchHitResponse(workId, query)` and dedicated controls:

```text
GET|DELETE /_reader_hit_requests
GET|PUT|DELETE /_reader_hit_failure
GET|PUT|DELETE /_reader_hit_delays
```

Handle both `/private-v2/works/.../search-hits` and `/v2/works/.../search-hits`
through the server's existing prefix normalization, recording original path and
exact query. Delay identity includes work ID, query, offset, limit, and flags.

- [ ] **Step 4: Run GREEN and commit**

Run fixture tests, full frontend unit suite, `api:check`, and `git diff --check`.
Commit:

```bash
git add nuxt/app/lib/api/generated/lbapi.ts nuxt/test/fixtures/reader-data.mjs \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git commit -m "test(nuxt): model reader search hit windows"
```

---

### Task 4: Parse canonical state and SSR-highlight the Reader safely

**Repository:** frontend

**Files:**
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/lib/reader-routes.ts`
- Modify: `nuxt/test/unit/reader-routes.spec.ts`
- Modify: `nuxt/test/ssr/reader.spec.ts`

**Interfaces:**
- Consumes: generated GET operation and Task 3 private fixture.
- Produces: canonical query parser, one private three-hit window, safe SSR marker, exact page/hit hrefs, bounded status copy.

- [ ] **Step 1: Add failing route-helper and SSR tests**

Prove ordinary Reader makes no hit request. For
`?q=doktor%20glas&hit=1`, assert exact private request:

```text
media_type=etext&query=doktor%20glas&offset=0&limit=3&word_forms=false&include_older_spellings=true&prefix=false&suffix=false
```

Assert SSR body remains populated, `w2_1..w2_2` gain `.markee` and alternating
`.flip`, current/total accessible text, page links preserve canonical state, and
hit links carry adjacent absolute index/page. Add invalid/incomplete/array/flag/
oversized cases with no hit request; out-of-range/failure/page-mismatch/missing
or reversed IDs with readable unmarked content and exact bounded messages.

- [ ] **Step 2: Run RED**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3013 yarn playwright test \
  test/ssr/reader.spec.ts --project=ssr
yarn vitest run test/unit/reader-routes.spec.ts
```

Expected: no hit request/marker/toolkit/query-preserving hrefs exist.

- [ ] **Step 3: Extend safe href construction**

Allow `readerPageHref` to accept a `query: Record<string,string>` and serialize
through `URLSearchParams` after existing segment encoding. Add a separate
`readerHitHref` wrapper that replaces `hit` and page while retaining canonical
flags. Unit-test Unicode, reserved values, and unknown-key preservation.

- [ ] **Step 4: Implement page-local validation/fetch/transform**

Create the generated client with
`import.meta.server ? config.apiBase : config.public.apiBase`. Parse a frozen
canonical state. When valid, call generated GET inside query-inclusive
`useAsyncData`; hit failure is captured as local state rather than thrown.

Use `parseHTML` from `linkedom` to build a list of exact `span[id]` nodes, locate
start/end by string equality, require unique ordered boundaries, add `markee`
through the inclusive range and `flip` to odd marked indices, then serialize the
same trusted fragment container. On mismatch return original HTML.

- [ ] **Step 5: Render accessible SSR state and semantic anchors**

Render marked HTML, current/total text in Reader context, exact error copy, and
previous/next-hit anchors. Preserve the history writer and template structure.
Ordinary page links preserve canonical plus unknown query keys; hit links use
the adjacent hit's page and index.

- [ ] **Step 6: Run GREEN and commit**

Run route units, Reader SSR, existing Reader behavior, typecheck, and diff check.
Commit:

```bash
git add nuxt/app/lib/reader-routes.ts nuxt/test/unit/reader-routes.spec.ts \
  'nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue' \
  nuxt/test/ssr/reader.spec.ts
git commit -m "feat(nuxt): render reader search hits"
```

---

### Task 5: Add hit navigation, history integration, and client toolkit

**Repository:** frontend

**Files:**
- Modify: Reader page above
- Modify: `nuxt/app/assets/styles/reader.scss`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`

**Interfaces:**
- Consumes: Task 4 SSR state/hrefs and Task 3 public fixture.
- Produces: hydrated marker/toolkit, hit navigation/Back, page-navigation preservation, exact history resume state.

- [ ] **Step 1: Add failing browser tests**

Cover no hydration duplicate, phrase/single marker counts, previous/next hit page
and absolute index, first/last boundaries, Back restoration, ordinary next page
preserving cursor but removing page-mismatched marker, public failure isolation,
no page/hydration errors, and Reader history saving exact canonical URL.

- [ ] **Step 2: Run RED**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3013 yarn playwright test \
  test/e2e/reader.behavior.spec.ts --project=desktop-chromium
```

Expected: SSR marker exists after Task 4, but client toolkit/navigation/history
assertions expose missing behavior or styles.

- [ ] **Step 3: Add client toolkit and exact legacy marker rules**

Inside `<ClientOnly>`, teleport `#search_nav` to layout `#toolkit`; use ordinary
anchors from Task 4 and omit unavailable boundaries. Port only proven
`.markee`, `.flip`, `.spinner_search`, and `#search_nav` declarations from
Angular Reader SCSS into existing `reader.scss`, preserving values verbatim.

- [ ] **Step 4: Verify GREEN and commit**

Run Reader browser + SSR + History integration, typecheck, build, and diff check.
Commit page/style/test changes with `feat(nuxt): navigate reader search hits`.

---

### Task 6: Compare Angular/Nuxt hit visuals and close both repositories

**Repositories:** frontend and backend

**Files:**
- Create: `nuxt/test/visual/capture-reader-hit-angular.spec.ts`
- Create: `nuxt/playwright.reader-hit-angular.config.ts`
- Create: `nuxt/test/e2e/reader-hit.visual.spec.ts`
- Create separate deterministic Reader-hit desktop/mobile baselines under
  `nuxt/test/visual/baselines/reader-hit-*.png`.
- Modify bounded implementation only for demonstrated parity defects.

- [ ] **Step 1: Capture deterministic Angular authority**

Intercept metadata, synthetic word-span page HTML, CSS/assets, and the legacy
search SSE with the same hit data. Capture single/phrase and first/middle states
at 1440×1000 and iPhone 13. Abort unexpected external requests and require ready
Reader/toolkit before screenshots.

- [ ] **Step 2: Add Nuxt comparisons without replacing ordinary control**

Compare identical canonical Nuxt states with existing screenshot tolerance.
Keep the ordinary Reader as a no-regression assertion. Correct only evidenced
Nuxt markup/style drift; never regenerate authority from Nuxt or loosen tolerance.

- [ ] **Step 3: Run complete cross-repo verification**

Backend:

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
python scripts/export_v2_openapi.py --check
pytest -q test_lbapi/v2
git diff --check
```

Frontend:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn vitest run
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3013 yarn playwright test test/ssr/reader.spec.ts --project=ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3013 yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3013 yarn playwright test test/e2e/reader-hit.visual.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn typecheck
yarn build
git diff --check
```

- [ ] **Step 4: Live interval check and final review**

Compare the documented live Angular single/phrase URLs with local canonical
Reader URLs. Confirm markers/toolkit/ordinary page links/Back/history and no new
warnings. Run independent final cross-repo review over all six tasks, fix every
Critical/Important finding, re-review, update the durable ledger, and report the
exact URLs/commits/deferred Search work.
