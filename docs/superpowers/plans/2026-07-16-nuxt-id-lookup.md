# Nuxt ID Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/id` and `/id/:id` to Nuxt with the intended legacy lookup behavior, a strict display-ready v2 adapter, and desktop/mobile parity.

**Architecture:** A synchronous FastAPI `POST /v2/works/lookup` endpoint owns the bounded legacy OpenSearch query and a pure grouping/filter transformer. The Nuxt optional route consumes only the generated client and keeps SSR, form, debounce, abort, and latest-wins state page-local.

**Tech Stack:** Python 3, FastAPI, Pydantic v2, OpenSearch DSL, pytest, OpenAPI, openapi-typescript, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright.

**Design:** `docs/superpowers/specs/2026-07-16-nuxt-id-lookup-design.md`

**Backend base:** `e8bc986`

**Frontend audited base:** `5cbd8ca`

## Global Constraints

- Preserve exact legacy routes `/id` and `/id/:id`, control order/copy, four-cell table, `:::` separators, links, loading hooks, body classes `focus page-id ready`, and responsive visuals.
- Correct the current Angular `{ titles, author_aggs, imported_aggs, hits, distinct_hits, suggest }` envelope mismatch to its intended populated-table behavior; do not preserve the accidental empty table.
- Keep raw work documents behind the strict FastAPI transformer and expose only generated display-ready types to Nuxt.
- Accept exactly one strict request mode: ID `{ work_id: <lb value>, titles: [] }` or titles `{ work_id: null, titles: [1..100 values] }`.
- Work IDs trim/lowercase, begin `lb`, and contain 2–100 characters; titles trim to 1–200 characters each.
- Keep the legacy Angular route/service/template and `/query_string/etext,faksimil` operation unchanged.
- Keep page state in `nuxt/app/pages/id/[[id]].vue`; add no composable, Nuxt server API, middleware, Angular bridge, shared store, or destination migration.
- `/id` performs no SSR or hydration lookup; a valid route parameter performs exactly one SSR lookup with no hydration duplicate.
- Typed 422/500/503 responses never leak provider details; OpenSearch uses `work_lookup_unavailable` and `Unable to load ID lookup results`.
- Follow TDD, commit each task separately with the exact listed message, and run an independent spec/quality review after each task.
- Do not include concurrent Home, Presentation, `.superpowers`, or unrelated work in any commit.

---

### Task 1: Characterize, type, and transform ID lookup results

**Files:**
- Modify: `lbapi/v2/models.py`
- Create: `lbapi/v2/work_lookup.py`
- Create: `test_lbapi/v2/test_work_lookup.py`
- Modify: `test_lbapi/v2/test_models.py`

**Interfaces:**
- Consumes: irregular legacy envelope `dict[str, Any]` with a `data` list in `sortkey|asc` order.
- Produces: `WorkLookupRequest`, `WorkLookupResponse`, `query_work_lookup_documents() -> dict[str, Any]`, and `transform_work_lookup(raw: dict[str, Any], request: WorkLookupRequest) -> WorkLookupResponse`.

- [ ] **Step 1: Add failing strict-model tests**

Add tests that validate these exact alternatives and reject extras, blank/over-limit fields, non-`lb` IDs, both modes, and neither mode:

```python
valid_requests = [
    {"work_id": "lb238704", "titles": []},
    {"work_id": None, "titles": ["Röda rummet"]},
]

invalid_requests = [
    {"work_id": None, "titles": []},
    {"work_id": "lb238704", "titles": ["Röda rummet"]},
    {"work_id": "238704", "titles": []},
    {"work_id": "lb" + "x" * 99, "titles": []},
    {"work_id": None, "titles": ["x" * 201]},
    {"work_id": None, "titles": [f"title-{index}" for index in range(101)]},
    {"work_id": "lb238704", "titles": [], "private": True},
]
```

Assert input `"  LB238704  "` normalizes to `"lb238704"`. Assert every response/link/media model rejects unknown fields and media labels outside `etext | faksimil`.

- [ ] **Step 2: Run the model tests and verify RED**

Run:

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_models.py -k 'work_lookup'
```

Expected: FAIL because the lookup request/response models do not exist.

- [ ] **Step 3: Add the strict model interfaces**

Implement the following model boundary in `models.py`, using `AfterValidator` for prefix/lowercase normalization, `Field(min_length=0, max_length=0)` for ID-mode titles, and `Field(min_length=1, max_length=100)` for title mode:

```python
LookupWorkId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=100),
    AfterValidator(validate_and_lower_lookup_work_id),
]
LookupTitle = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]

class WorkLookupByIdRequest(V2Model):
    work_id: LookupWorkId
    titles: list[LookupTitle] = Field(min_length=0, max_length=0)

class WorkLookupByTitlesRequest(V2Model):
    work_id: None
    titles: list[LookupTitle] = Field(min_length=1, max_length=100)

WorkLookupRequest = WorkLookupByIdRequest | WorkLookupByTitlesRequest

class WorkLookupLink(V2Model):
    label: str
    url: str

class WorkLookupMedia(V2Model):
    label: Literal["etext", "faksimil"]
    url: str

class WorkLookupItem(V2Model):
    work_id: str
    author: WorkLookupLink
    title: WorkLookupLink
    media: list[WorkLookupMedia]

class WorkLookupResponse(V2Model):
    items: list[WorkLookupItem]
```

`validate_and_lower_lookup_work_id()` must call `value.lower()`, reject values not starting with `lb`, and return the normalized value.

- [ ] **Step 4: Add failing legacy-transform characterization tests**

In `test_work_lookup.py`, define raw documents that prove:

```python
raw = {
    "data": [
        work_document(lbworkid="lb2", titlepath="B", mediatype="faksimil"),
        work_document(lbworkid="lb1", titlepath="A", mediatype="faksimil"),
        work_document(lbworkid="lb1", titlepath="A", mediatype="etext"),
    ]
}
```

Assert first-seen group order, the exact concatenated `titlepath + lbworkid` key, `etext` before `faksimil` inside a group, `work_titleid || titleid`, `authors[0]`, `shorttitle || title`, exact author/title/media URLs, exact-ID matching, Unicode-lowercase substring matching against `titlepath` or full `title`, OR matching across titles, preserved duplicate queries, and empty no-hit output. Add malformed-envelope/document/media/author/required-string cases that all raise `ValueError("Malformed work-lookup response")` without private data in the message.

- [ ] **Step 5: Run transformer tests and verify RED**

Run:

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_work_lookup.py
```

Expected: FAIL because `transform_work_lookup` and the patchable query seam do not exist.

- [ ] **Step 6: Implement the minimal pure transformer and query seam**

Create these exact boundaries in `work_lookup.py`:

```python
_MALFORMED_RESPONSE = "Malformed work-lookup response"
_MEDIA_ORDER = {"etext": 0, "faksimil": 1}

def _legacy_api():
    from lbapi import elasticapi
    return elasticapi

def query_work_lookup_documents() -> dict[str, Any]:
    response = _legacy_api().query(
        {"query": {"query_string": {"query": "show:true AND *"}}},
        "etext,faksimil",
        0,
        10000,
        includes=[
            "lbworkid", "titlepath", "title", "shorttitle", "titleid",
            "work_titleid", "mediatype", "authors.authorid", "authors.surname",
        ],
        excludes=(),
        sort_field=[{"sortkey": {"order": "asc"}}],
    )
    return {"data": [hit.to_dict() for hit in response]}

def transform_work_lookup(
    raw: dict[str, Any], request: WorkLookupRequest
) -> WorkLookupResponse:
    try:
        documents = raw["data"]
        if not isinstance(documents, list):
            raise ValueError(_MALFORMED_RESPONSE)

        groups: dict[str, list[dict[str, Any]]] = {}
        for document in documents:
            if not isinstance(document, dict):
                raise ValueError(_MALFORMED_RESPONSE)
            key = (
                _required_string(document, "titlepath")
                + _required_string(document, "lbworkid")
            )
            groups.setdefault(key, []).append(document)

        items: list[WorkLookupItem] = []
        for group in groups.values():
            ordered = sorted(
                group,
                key=lambda item: _MEDIA_ORDER[_required_string(item, "mediatype")],
            )
            main = ordered[0]
            if _matches_request(main, request):
                items.append(_to_item(ordered))
        return WorkLookupResponse(items=items)
    except (KeyError, TypeError, IndexError, ValidationError, ValueError) as exc:
        raise ValueError(_MALFORMED_RESPONSE) from exc
```

Implement transformation with small `_required_string`, `_first_author`, `_group_documents`, `_matches_request`, and `_to_item` helpers. Catch only shape/index/Pydantic failures at the transformer boundary and re-raise the single generic `ValueError`; do not catch `OpenSearchException` here.

- [ ] **Step 7: Run focused and complete backend model/transform tests**

Run:

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_models.py test_lbapi/v2/test_work_lookup.py
```

Expected: PASS.

- [ ] **Step 8: Commit the independently testable backend transform**

```bash
git add lbapi/v2/models.py lbapi/v2/work_lookup.py test_lbapi/v2/test_models.py test_lbapi/v2/test_work_lookup.py
git diff --cached --check
git commit -m "feat(api): type ID lookup results"
```

- [ ] **Step 9: Run the Task 1 review gate**

Review `git show --check --stat HEAD` and the full patch against the strict request alternatives and all ten transformer rules. Run the focused tests again. Resolve every Critical/Important finding in a separate `fix(api): harden ID lookup transform` commit before Task 2.

---

### Task 2: Publish the typed v2 lookup endpoint

**Files:**
- Modify: `lbapi/v2/work_lookup.py`
- Modify: `lbapi/v2/app.py`
- Modify: `test_lbapi/v2/test_api.py`
- Modify: `test_lbapi/v2/test_openapi.py`
- Modify: `openapi/v2.json`

**Interfaces:**
- Consumes: Task 1 `WorkLookupRequest`, `query_work_lookup_documents`, and `transform_work_lookup`.
- Produces: synchronous `POST /works/lookup` under the `/v2` mount with operation ID `v2_post_work_lookup`.

- [ ] **Step 1: Add failing endpoint tests**

Add TestClient cases for exact ID/title bodies, normalized IDs, empty results, every boundary, forbidden extras, synchronous `POST`, malformed raw generic 500, unexpected generic 500, and nonleaking OpenSearch 503. The 503 assertion is exact:

```python
assert response.json() == {
    "error": {
        "code": "work_lookup_unavailable",
        "message": "Unable to load ID lookup results",
        "details": None,
    }
}
assert "private upstream detail" not in response.text
```

- [ ] **Step 2: Run endpoint tests and verify RED**

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_api.py -k 'work_lookup'
```

Expected: FAIL with no `/works/lookup` route.

- [ ] **Step 3: Implement and mount the synchronous route**

Add the router with explicit responses:

```python
WORK_LOOKUP_RESPONSES = {
    422: {"model": ApiErrorResponse, "description": "Invalid request"},
    500: {"model": ApiErrorResponse, "description": "Unexpected server error"},
    503: {"model": ApiErrorResponse, "description": "Search backend unavailable"},
}

@router.post(
    "/works/lookup",
    operation_id="v2_post_work_lookup",
    response_model=WorkLookupResponse,
    responses=WORK_LOOKUP_RESPONSES,
)
def post_work_lookup(request: WorkLookupRequest) -> WorkLookupResponse:
    try:
        raw = query_work_lookup_documents()
    except OpenSearchException as exc:
        error = ApiError(
            code="work_lookup_unavailable",
            message="Unable to load ID lookup results",
            details=None,
        )
        raise HTTPException(status_code=503, detail=error.model_dump(mode="json")) from exc
    return transform_work_lookup(raw, request)
```

Include `router` in `lbapi/v2/app.py`. Keep the route a plain `def` so FastAPI runs the blocking query in its thread pool.

- [ ] **Step 4: Add failing OpenAPI contract assertions**

Assert `/works/lookup` is POST-only, has operation ID `v2_post_work_lookup`, request `anyOf` references the two strict alternatives, all schemas set `additionalProperties: false`, both fields are required in each alternative, bounds/literals are exact, response 200 references `WorkLookupResponse`, and 422/500/503 reference `ApiErrorResponse`. Add `/works/lookup` to exact v2 path-set and mounted-isolation assertions; prove it does not appear in legacy OpenAPI.

- [ ] **Step 5: Run OpenAPI tests and verify RED**

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_openapi.py
```

Expected: FAIL until the committed schema is regenerated.

- [ ] **Step 6: Export and verify the canonical schema**

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/python scripts/export_v2_openapi.py
/Users/johan/dev/lb-backend/virtual_env/bin/python scripts/export_v2_openapi.py --check
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2
```

Expected: schema check exits 0 and the complete v2 suite passes.

- [ ] **Step 7: Commit the published API**

```bash
git add lbapi/v2/work_lookup.py lbapi/v2/app.py test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): publish ID lookup"
```

- [ ] **Step 8: Run the Task 2 review gate**

Review the complete Task 1–2 backend range for raw-field containment, exact error envelopes, OpenAPI stability, legacy isolation, and query bounds. Rerun the v2 suite and snapshot check. Resolve every Critical/Important finding in a separate fix commit.

---

### Task 3: Generate the client and deterministic lookup fixtures

**Files:**
- Modify: `nuxt/app/lib/api/generated/lbapi.ts`
- Modify: `nuxt/test/unit/api-client.spec.ts`
- Create: `nuxt/test/fixtures/work-lookup-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: backend `openapi/v2.json` from Task 2.
- Produces: generated `client.POST("/works/lookup", { body, signal })` types and deterministic fixture controls `_work_lookup_requests`, `_work_lookup_failure`, and `_work_lookup_delays`.

- [ ] **Step 1: Add failing generated-client tests**

Add tests that POST the exact body, preserve Unicode JSON, expose typed display rows, and return typed 503:

```ts
const body = { work_id: null, titles: ["Röda rummet", "Gösta Berlings saga"] }
const { data, error } = await client.POST("/works/lookup", { body })
expect(error).toBeUndefined()
expect(data?.items[0].media.map(item => item.label)).toEqual(["etext", "faksimil"])
expect(await fetchMock.mock.calls[0][0].json()).toEqual(body)
```

- [ ] **Step 2: Run client tests and verify RED**

```bash
cd nuxt
yarn vitest run test/unit/api-client.spec.ts
```

Expected: typecheck/test failure because the generated operation is absent.

- [ ] **Step 3: Regenerate from the committed backend snapshot**

```bash
cd nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:generate
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
```

Expected: generation succeeds and freshness check exits 0. Do not hand-edit `lbapi.ts`.

- [ ] **Step 4: Add failing fixture-server tests**

Define fixed rows with exact author/title/media links in `work-lookup-data.mjs`. Add tests for ID and title bodies, request ledger/reset, independent 503 control, per-body delay/latest ordering, CORS, and no effect on existing generic/Quick Search ledgers. Use the serialized request body as the delay key so both modes are deterministic.

- [ ] **Step 5: Run fixture tests and verify RED**

```bash
cd nuxt
yarn vitest run test/unit/v2-server.spec.ts -t 'work lookup'
```

Expected: FAIL with missing fixture routes/controls.

- [ ] **Step 6: Implement the minimum fixture behavior**

Add `POST /v2/works/lookup` plus controls:

```js
let workLookupRequests = []
let workLookupFailure = false
let workLookupDelays = {}

if (request.method === "POST" && url.pathname === "/v2/works/lookup") {
  const body = await readJson(request)
  workLookupRequests.push(body)
  await waitForWorkLookupDelay(JSON.stringify(body))
  if (workLookupFailure) return sendJson(response, 503, {
    error: {
      code: "work_lookup_unavailable",
      message: "Unable to load ID lookup results",
      details: null
    }
  })
  return sendJson(response, 200, workLookupResponse(body))
}
```

Controls must return/reset bodies, failure, and delays without making external requests.

- [ ] **Step 7: Run frontend generation/unit/type gates**

```bash
cd nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn vitest run test/unit/api-client.spec.ts test/unit/v2-server.spec.ts
yarn typecheck
```

Expected: all pass.

- [ ] **Step 8: Commit the client and fixture deliverable**

```bash
git add nuxt/app/lib/api/generated/lbapi.ts nuxt/test/unit/api-client.spec.ts nuxt/test/fixtures/work-lookup-data.mjs nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): generate ID lookup client"
```

- [ ] **Step 9: Run the Task 3 review gate**

Review that the generated file matches only the canonical schema, fixture data is typed/display-ready, every control is deterministic, and no production URL is reachable. Rerun API freshness, focused unit tests, and typecheck; fix all Critical/Important findings separately.

---

### Task 4: Port the page-local SSR form and latest-wins behavior

**Files:**
- Create: `nuxt/app/pages/id/[[id]].vue`
- Create: `nuxt/test/ssr/id-lookup.spec.ts`
- Create: `nuxt/test/e2e/id-lookup.behavior.spec.ts`

**Interfaces:**
- Consumes: generated `POST /works/lookup`, its `WorkLookupResponse`, and fixture controls from Task 3.
- Produces: both ID routes, exact authority markup/body classes, route-param SSR, and page-local interactive lookup state.

- [ ] **Step 1: Add failing SSR route tests**

Assert `/id` has exact body classes, placeholders/control order, `autofocus`, `Hämtar`, `dots_blink`, `table-striped`, and zero lookup requests. Assert `/id/LB238704` posts `{ work_id: "lb238704", titles: [] }`; `/id/RödaRummet` posts `{ work_id: null, titles: ["rödarummet"] }`; each renders exact four-cell rows/links and makes one SSR request with no hydration duplicate. Assert invalid over-limit route values render the shell and make no request.

- [ ] **Step 2: Run SSR tests and verify RED**

```bash
cd nuxt
yarn playwright test --project=ssr test/ssr/id-lookup.spec.ts
```

Expected: FAIL with route 404.

- [ ] **Step 3: Add failing browser behavior tests**

Use fake timers or fixture ledgers to prove:

```ts
await idInput.fill("LB238704")
await expect.poll(workLookupBodies).toEqual([
  { work_id: "lb238704", titles: [] }
])

await titleInput.fill("Röda")
await page.waitForTimeout(499)
expect(await workLookupBodies()).toEqual([])
await page.waitForTimeout(1)
expect(await workLookupBodies()).toEqual([
  { work_id: null, titles: ["Röda"] }
])
```

Cover immediate ID, exact 500 ms title/textarea debounce, `Författare – Titel\nTitel två` normalization to `['Titel', 'Titel två']`, blank removal, first-100 truncation, mode clearing, empty/invalid no-request, loading class/preloader, abort plus version-guard latest wins, no-hit/failure blank table, route changes, unmount cleanup, exact four cells, ordinary anchors, and `:::` only between media links.

- [ ] **Step 4: Run behavior tests and verify RED**

```bash
cd nuxt
yarn playwright test --project=desktop-chromium test/e2e/id-lookup.behavior.spec.ts
```

Expected: FAIL until the page exists.

- [ ] **Step 5: Implement the page-local route and request state**

Use generated component types and these page-local boundaries:

```ts
type LookupBody =
  | { work_id: string; titles: [] }
  | { work_id: null; titles: string[] }

const normalizeTextarea = (value: string) => value
  .split("\n")
  .map(row => (row.split("–")[1] || row).trim())
  .filter(Boolean)
  .slice(0, 100)

async function runLookup(body: LookupBody, signal?: AbortSignal) {
  const version = ++requestVersion
  loading.value = true
  const { data, error } = await api.POST("/works/lookup", { body, signal })
  if (version !== requestVersion) return
  items.value = error ? [] : (data?.items ?? [])
  loading.value = false
}
```

Decode, trim, and lower-case a route param before seeding either mode, then classify it by `startsWith("lb")`. Use page-local `useAsyncData` only for a valid route-param body; do not call it for `/id`. Serialize the SSR response for hydration. Interactive watchers must use one 500 ms timer for title/textarea, immediate valid-ID requests, a fresh `AbortController`, and a monotonically increasing version. Clearing/switching/navigating/unmounting must increment the version, abort, cancel timers, stop loading, and clear rows.

- [ ] **Step 6: Implement authority markup without style redesign**

Render this structure with Vue bindings and exact text:

```vue
<div :class="{ searching: loading }">
  <input v-model="workId" placeholder="lbid" autofocus>
  <input v-model="singleTitle" placeholder="titel">
  <textarea v-model="textarea" placeholder="flera titlar separarade med nyrad" />
  <div class="preloader">Hämtar <span class="dots_blink" /></div>
  <table class="table-striped">
    <tr v-for="item in items" :key="`${item.work_id}:${item.title.url}`">
      <td>{{ item.work_id }}</td>
      <td><a :href="item.author.url">{{ item.author.label }}</a></td>
      <td><a :href="item.title.url">{{ item.title.label }}</a></td>
      <td>
        <template v-for="(media, index) in item.media" :key="media.url">
          <span v-if="index">:::</span><a :href="media.url">{{ media.label }}</a>
        </template>
      </td>
    </tr>
  </table>
</div>
```

Use `useHead({ bodyAttrs: { class: "focus page-id ready" } })`. Do not add CSS unless a later visual test demonstrates a migration-specific need.

- [ ] **Step 7: Run focused and full frontend gates**

```bash
cd nuxt
yarn playwright test --project=ssr test/ssr/id-lookup.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/id-lookup.behavior.spec.ts
yarn test:unit
yarn typecheck
yarn build
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
```

Expected: all pass; `/id` request ledger remains empty.

- [ ] **Step 8: Commit the page deliverable**

```bash
git add 'nuxt/app/pages/id/[[id]].vue' nuxt/test/ssr/id-lookup.spec.ts nuxt/test/e2e/id-lookup.behavior.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): port ID lookup"
```

- [ ] **Step 9: Run the Task 4 review gate**

Review SSR zero-request semantics, route classification, debounce timing, abort/version cleanup, exact copy/markup/links, response error handling, local-only state, and deferred destinations. Rerun focused SSR/browser tests, typecheck, and build; fix all Critical/Important findings separately.

---

### Task 5: Lock corrected Angular visual authority and whole-slice parity

**Files:**
- Create: `nuxt/test/visual/capture-id-lookup-angular.spec.ts`
- Create: `nuxt/test/e2e/id-lookup.visual.spec.ts`
- Create: `nuxt/test/visual/baselines/id-lookup-empty-desktop.png`
- Create: `nuxt/test/visual/baselines/id-lookup-populated-desktop.png`
- Create: `nuxt/test/visual/baselines/id-lookup-empty-mobile.png`
- Create: `nuxt/test/visual/baselines/id-lookup-populated-mobile.png`
- Modify only if demonstrated: `nuxt/app/assets/styles/nuxt.scss`

**Interfaces:**
- Consumes: the same raw legacy fixture and typed Task 3 response, plus the completed Nuxt page.
- Produces: inspected empty/populated desktop/mobile authority and near-pixel Nuxt comparisons with production-escape assertions.

- [ ] **Step 1: Add the failing Angular authority capture**

Intercept only the exact legacy `query_string/etext,faksimil` request and abort unexpected search/API requests. For the populated case, use a test-only browser seam that changes the `getTitles()` resolution from `{ titles, author_aggs, imported_aggs, hits, distinct_hits, suggest }` to its `titles` member before `IdPageCtrl` assigns `data`. Assert production Angular source is untouched and the corrected rows exactly match the backend characterization fixture.

Capture empty and populated states at desktop and mobile only after fonts, `focus page-id ready`, all three controls, loading completion, exact four-cell row count, and links are ready. Assert an interception ledger contains no production escape.

- [ ] **Step 2: Run capture and inspect all four images**

```bash
cd nuxt
yarn playwright test --config=playwright.angular.config.ts test/visual/capture-id-lookup-angular.spec.ts
```

Inspect form geometry, first-input focus, table width/striping, row typography, links, media separators, shell corridors, whitespace, and mobile overflow. Do not bless images with missing rows, fonts, or unresolved loading.

- [ ] **Step 3: Add failing Nuxt visual comparisons**

Use the fixture server only. Assert exact request bodies and readiness, then compare empty/populated desktop/mobile screenshots with the repository's existing near-pixel threshold (`maxDiffPixelRatio: 0.1`, `maxDiffPixels: 100`). Explicitly assert `/id` made no request and populated cases made only the expected v2 POST.

- [ ] **Step 4: Run visual tests and verify RED or exact parity**

```bash
cd nuxt
yarn playwright test --project=desktop-chromium --project=mobile-chromium test/e2e/id-lookup.visual.spec.ts
```

Expected: PASS if authority markup is sufficient; otherwise FAIL with localized screenshot evidence.

- [ ] **Step 5: Fix only demonstrated migration drift**

Prefer correcting markup/state timing. If and only if copied authority styles cannot express the exact result, add narrowly scoped `.page-id` glue to `nuxt.scss`. Do not modify `nuxt/app/assets/styles/styles.scss`, Bootstrap, global shell geometry, or Angular source.

- [ ] **Step 6: Run complete closure gates**

Backend:

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2
/Users/johan/dev/lb-backend/virtual_env/bin/python scripts/export_v2_openapi.py --check
git diff --check e8bc986..HEAD
git diff --quiet e8bc986..HEAD -- lbapi/elasticapi.py lbapi/web.py
```

Frontend:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn test:unit
yarn playwright test --project=ssr test/ssr/id-lookup.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/id-lookup.behavior.spec.ts test/e2e/id-lookup.visual.spec.ts
yarn playwright test --project=mobile-chromium test/e2e/id-lookup.visual.spec.ts
yarn typecheck
yarn build
```

Scope:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git diff --check 5cbd8ca..HEAD
git diff --quiet 5cbd8ca..HEAD -- app
git diff --quiet 5cbd8ca..HEAD -- nuxt/app/assets/styles/styles.scss
rg -n 'lbworkid|work_titleid|titlepath|authors\[0\]|query_string/etext,faksimil' nuxt/app --glob '!assets/styles/fonts/**'
rg -n 'server/api|composables' <(git diff --name-only 5cbd8ca..HEAD)
```

Expected: all gates pass; both `git diff --quiet` commands exit 0; raw-field scan has no production Nuxt hit; no composable/server API file is in the slice.

- [ ] **Step 7: Commit visual parity**

```bash
git add nuxt/test/visual/capture-id-lookup-angular.spec.ts nuxt/test/e2e/id-lookup.visual.spec.ts nuxt/test/visual/baselines/id-lookup-empty-desktop.png nuxt/test/visual/baselines/id-lookup-populated-desktop.png nuxt/test/visual/baselines/id-lookup-empty-mobile.png nuxt/test/visual/baselines/id-lookup-populated-mobile.png
git add nuxt/app/assets/styles/nuxt.scss  # only when Step 5 changed it
git diff --cached --check
git commit -m "test(nuxt): lock ID lookup parity"
```

- [ ] **Step 8: Run the Task 5 and final whole-slice review gates**

Review the exact backend range from `e8bc986` and frontend ID-only commits from `5cbd8ca`. Verify strict raw containment, corrected-envelope intent, exact modes/limits/errors, SSR zero-query behavior, latest-wins cleanup, all links/copy/classes, production-escape ledgers, four inspected authority images, and unchanged legacy scope. Fix every Critical/Important finding in a separate commit and rerun every affected complete gate. The slice is ready only with final `Spec PASS`, `Quality PASS`, and `Ready YES`.
