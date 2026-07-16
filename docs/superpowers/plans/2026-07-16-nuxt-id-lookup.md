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
- Fully validate and normalize/group the complete 10,000-document catalog before request filtering; cache only successful immutable catalogs with a process-local 60-second monotonic TTL and single-flight refresh.
- Accept exactly one strict request mode: ID `{ work_id: <lb value>, titles: [] }` or titles `{ work_id: null, titles: [1..100 values] }`.
- Work IDs trim/lowercase, begin `lb`, and contain 2–100 characters; titles trim to 1–200 characters each.
- Keep the legacy Angular route/service/template and `/query_string/etext,faksimil` operation unchanged.
- Keep page state in `nuxt/app/pages/id/[[id]].vue`; add no composable, Nuxt server API, middleware, Angular bridge, shared store, or destination migration.
- `/id` performs no SSR or hydration lookup; a valid route parameter performs exactly one SSR lookup with no hydration duplicate.
- Select the client base with the exact expression `import.meta.server ? config.apiBase : config.public.apiBase` and prove route-param SSR uses the private base.
- Preserve Angular's coupled controls: ID clears `titles` but not textarea text; title changes only `titles[0]`; textarea replaces `titles` and therefore mirrors its first normalized row into the title input.
- Set exact page title `Litteraturbanken`, default description `På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis.`, and body classes `focus page-id ready`.
- Typed 422/500/503 responses never leak provider details; OpenSearch uses `work_lookup_unavailable` and `Unable to load ID lookup results`.
- Follow TDD, commit each task separately with the exact listed message, and run an independent spec/quality review after each task.
- Do not include concurrent Home, Presentation, `.superpowers`, or unrelated work in any commit.

---

### Task 1: Characterize, type, normalize, and cache ID lookup results

**Files:**
- Modify: `lbapi/v2/models.py`
- Create: `lbapi/v2/work_lookup.py`
- Create: `test_lbapi/v2/test_work_lookup.py`
- Modify: `test_lbapi/v2/test_models.py`

**Interfaces:**
- Consumes: irregular legacy envelope `dict[str, Any]` with a `data` list in `sortkey|asc` order.
- Produces: `WorkLookupRequest`, `WorkLookupResponse`, patchable `query_work_lookup_documents() -> dict[str, Any]`, `build_work_lookup_catalog(raw) -> tuple[WorkLookupCatalogItem, ...]`, `filter_work_lookup_catalog(catalog, request) -> WorkLookupResponse`, pure `transform_work_lookup(raw, request)`, and process-local `get_work_lookup_catalog()`.

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
    media: list[WorkLookupMedia] = Field(min_length=1)

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

Assert first-seen group order, the exact concatenated `titlepath + lbworkid` key, `etext` before `faksimil` inside a group, `work_titleid || titleid`, `authors[0]`, `shorttitle || title`, non-empty media, exact author/title/media URLs, exact-ID matching, Unicode-lowercase substring matching against `titlepath` or full `title`, OR matching across titles, preserved duplicate queries, and empty no-hit output. Use a fixture where `titlepath != work_titleid` so the title and media URL contracts cannot accidentally pass with the same segment. Add malformed-envelope/document/media/author/required-string cases that all raise `ValueError("Malformed work-lookup response")` without private data in the message. Put a malformed row after a valid row that matches neither the ID nor titles and assert the whole transform still fails, proving validation completes before filtering.

Add deterministic cache tests:

```python
def test_sequential_lookups_share_one_successful_catalog(monkeypatch):
    calls = []
    monkeypatch.setattr(work_lookup, "query_work_lookup_documents", lambda: calls.append(1) or raw)
    work_lookup.get_work_lookup_catalog()
    work_lookup.get_work_lookup_catalog()
    assert calls == [1]

def test_concurrent_lookups_single_flight(monkeypatch):
    entered, release = Event(), Event()
    calls = []
    def query():
        calls.append(1)
        entered.set()
        assert release.wait(timeout=1)
        return raw
    monkeypatch.setattr(work_lookup, "query_work_lookup_documents", query)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(work_lookup.get_work_lookup_catalog) for _ in range(2)]
        assert entered.wait(timeout=1)
        release.set()
        assert futures[0].result() == futures[1].result()
    assert calls == [1]
```

Also patch the monotonic seam to prove reuse at 59.999 seconds and one refresh at 60 seconds after successful completion. Prove a provider exception and a malformed catalog are fanned out to waiters but not cached, the in-flight marker clears, and the next request retries successfully. Reset cache state in an autouse fixture so tests are isolated.

- [ ] **Step 5: Run transformer tests and verify RED**

Run:

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_work_lookup.py
```

Expected: FAIL because the catalog builder/filter, single-flight cache, and patchable query seam do not exist.

- [ ] **Step 6: Implement the pure catalog boundary and single-flight cache**

Create these exact boundaries in `work_lookup.py`:

```python
from concurrent.futures import Future
from dataclasses import dataclass
from threading import Lock
from time import monotonic

_MALFORMED_RESPONSE = "Malformed work-lookup response"
_MEDIA_ORDER = {"etext": 0, "faksimil": 1}
_CATALOG_TTL_SECONDS = 60.0

@dataclass(frozen=True)
class WorkLookupCatalogItem:
    item: WorkLookupItem
    work_id: str
    search_title_path: str
    search_title: str

@dataclass(frozen=True)
class _CatalogEntry:
    expires_at: float
    items: tuple[WorkLookupCatalogItem, ...]

_catalog_lock = Lock()
_catalog_entry: _CatalogEntry | None = None
_catalog_build: Future[tuple[WorkLookupCatalogItem, ...]] | None = None

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

def build_work_lookup_catalog(
    raw: dict[str, Any],
) -> tuple[WorkLookupCatalogItem, ...]:
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

        items: list[WorkLookupCatalogItem] = []
        for group in groups.values():
            ordered = sorted(
                group,
                key=lambda item: _MEDIA_ORDER[_required_string(item, "mediatype")],
            )
            main = ordered[0]
            items.append(WorkLookupCatalogItem(
                item=_to_item(ordered),
                work_id=_required_string(main, "lbworkid"),
                search_title_path=_required_string(main, "titlepath").lower(),
                search_title=_required_string(main, "title").lower(),
            ))
        return tuple(items)
    except (KeyError, TypeError, IndexError, ValidationError, ValueError) as exc:
        raise ValueError(_MALFORMED_RESPONSE) from exc

def filter_work_lookup_catalog(
    catalog: tuple[WorkLookupCatalogItem, ...],
    request: WorkLookupRequest,
) -> WorkLookupResponse:
    matches = [entry.item for entry in catalog if _matches_request(entry, request)]
    return WorkLookupResponse(items=matches)

def _matches_request(
    entry: WorkLookupCatalogItem, request: WorkLookupRequest
) -> bool:
    if request.work_id is not None:
        return entry.work_id == request.work_id
    queries = [title.lower() for title in request.titles]
    return any(
        query in entry.search_title_path or query in entry.search_title
        for query in queries
    )

def transform_work_lookup(
    raw: dict[str, Any], request: WorkLookupRequest
) -> WorkLookupResponse:
    return filter_work_lookup_catalog(build_work_lookup_catalog(raw), request)
```

Implement transformation with small `_required_string`, `_first_author`, `_matches_request`, and `_to_item` helpers. The builder must finish every group's validation before `filter_work_lookup_catalog` sees the request. Catch only shape/index/Pydantic failures at the builder boundary and re-raise the single generic `ValueError`; do not catch `OpenSearchException` there.

Add a patchable monotonic seam and the cache algorithm:

```python
def _monotonic() -> float:
    return monotonic()

def get_work_lookup_catalog() -> tuple[WorkLookupCatalogItem, ...]:
    global _catalog_entry, _catalog_build
    with _catalog_lock:
        if _catalog_entry is not None and _monotonic() < _catalog_entry.expires_at:
            return _catalog_entry.items
        if _catalog_build is None:
            build = Future()
            _catalog_build = build
            is_builder = True
        else:
            build = _catalog_build
            is_builder = False

    if not is_builder:
        return build.result()

    try:
        catalog = build_work_lookup_catalog(query_work_lookup_documents())
    except Exception as exc:
        with _catalog_lock:
            if _catalog_build is build:
                _catalog_build = None
        build.set_exception(exc)
        raise

    with _catalog_lock:
        _catalog_entry = _CatalogEntry(
            expires_at=_monotonic() + _CATALOG_TTL_SECONDS,
            items=catalog,
        )
        if _catalog_build is build:
            _catalog_build = None
    build.set_result(catalog)
    return catalog
```

Provide a private cache-reset helper for the autouse test fixture only. Document beside the globals that this state is process-local: each multi-worker process can build once per TTL and no cross-worker sharing is promised.

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

Review `git show --check --stat HEAD` and the full patch against the strict request alternatives, complete-catalog validation, exact grouping/media/link rules, 60-second TTL, single-flight/failure behavior, and multi-worker scope. Run the focused tests again. Resolve every Critical/Important finding in a separate `fix(api): harden ID lookup transform` commit before Task 2.

---

### Task 2: Publish the typed v2 lookup endpoint

**Files:**
- Modify: `lbapi/v2/work_lookup.py`
- Modify: `lbapi/v2/app.py`
- Modify: `test_lbapi/v2/test_api.py`
- Modify: `test_lbapi/v2/test_openapi.py`
- Modify: `openapi/v2.json`

**Interfaces:**
- Consumes: Task 1 `WorkLookupRequest`, `get_work_lookup_catalog`, and `filter_work_lookup_catalog`.
- Produces: synchronous `POST /works/lookup` under the `/v2` mount with operation ID `v2_post_work_lookup`.

- [ ] **Step 1: Add failing endpoint tests**

Add TestClient cases for exact ID/title bodies, normalized IDs, empty results, every boundary, forbidden extras, synchronous `POST`, cached sequential requests, malformed raw generic 500 even when the malformed row would not match, unexpected generic 500, and nonleaking OpenSearch 503. Clear the process-local cache around endpoint tests. The 503 assertion is exact:

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
        catalog = get_work_lookup_catalog()
    except OpenSearchException as exc:
        error = ApiError(
            code="work_lookup_unavailable",
            message="Unable to load ID lookup results",
            details=None,
        )
        raise HTTPException(status_code=503, detail=error.model_dump(mode="json")) from exc
    return filter_work_lookup_catalog(catalog, request)
```

Include `router` in `lbapi/v2/app.py`. Keep the route a plain `def` so FastAPI runs the blocking query in its thread pool.

- [ ] **Step 4: Add failing OpenAPI contract assertions**

Assert `/works/lookup` is POST-only, has operation ID `v2_post_work_lookup`, request `anyOf` references exactly the two strict alternatives, all schemas set `additionalProperties: false`, both request fields are required in each alternative, ID/title bounds are exact, `media.minItems` is 1, the media enum is exactly `etext | faksimil`, response 200 references `WorkLookupResponse`, and 422/500/503 reference `ApiErrorResponse`. Add `/works/lookup` to exact v2 path-set and mounted-isolation assertions; prove it does not appear in legacy OpenAPI.

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
- Produces: generated `client.POST("/works/lookup", { body, signal })` types; deterministic fixture controls `_work_lookup_requests`, `_work_lookup_failure`, and `_work_lookup_delays`; and distinguishable `/private-v2` test aliases for SSR-base proof.

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

Define fixed rows with exact author/title/media links in `work-lookup-data.mjs`. Add tests for ID and title bodies, request path/body ledger/reset, independent 503 control, per-body delay/latest ordering, CORS, and no effect on existing generic/Quick Search ledgers. Use the serialized request body as the delay key so both modes are deterministic. Normalize a test-only `/private-v2/*` alias to the same `/v2/*` fixture handlers while retaining the original path in the ledger; this lets SSR tests distinguish the private base from the public proxy without changing response data.

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

const apiPathname = url.pathname.replace(/^\/private-v2(?=\/|$)/, "/v2")

if (request.method === "POST" && apiPathname === "/v2/works/lookup") {
  const body = await readJson(request)
  workLookupRequests.push({ path: url.pathname, body })
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
Compute `apiPathname` before `resourceFor()` and every v2 route conditional, and use it for dispatch while ledgers retain `url.pathname`; all existing stats/contact/Quick Search SSR fixtures must continue to work through the private alias.

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
- Modify: `nuxt/playwright.config.ts`

**Interfaces:**
- Consumes: generated `POST /works/lookup`, its `WorkLookupResponse`, and fixture controls from Task 3.
- Produces: both ID routes, exact metadata/authority markup/body classes, private-base route-param SSR, and page-local coupled interactive lookup state.

- [ ] **Step 1: Add failing SSR route tests**

Configure the Playwright Nuxt server with `NUXT_API_BASE=http://127.0.0.1:4100/private-v2` while retaining `NUXT_PUBLIC_API_BASE=/api/v2`. Assert `/id` has exact `<title>Litteraturbanken</title>`, the full default description meta, body classes `focus page-id ready`, placeholders/control order, `autofocus`, `Hämtar`, `dots_blink`, `table-striped`, and zero lookup requests. Assert `/id/LB238704` posts `{ work_id: "lb238704", titles: [] }`; `/id/RödaRummet` posts `{ work_id: null, titles: ["rödarummet"] }`; each ledger entry has path `/private-v2/works/lookup`, renders exact four-cell rows/links, and makes one SSR request with no hydration duplicate. Assert no SSR entry uses `/v2/works/lookup`, proving the public base was not selected. Assert invalid over-limit route values render the shell and make no request.

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

Cover immediate ID and these exact coupled-state sequences:

```ts
await textarea.fill("Författare – Titel\nTitel två")
await expect(titleInput).toHaveValue("Titel")
await idInput.fill("lb238704")
await expect(titleInput).toHaveValue("")
await expect(textarea).toHaveValue("Författare – Titel\nTitel två")

await textarea.fill("A – First\nSecond\nThird")
await titleInput.fill("Replacement")
expect(lastLookupBody()).toEqual({
  work_id: null,
  titles: ["Replacement", "Second", "Third"]
})
```

Also prove exact 500 ms title/textarea debounce; textarea replacement of the whole title array; `A – B – C` normalization to `B`; `A – ` fallback to `A –`; preserved empty rows/duplicates in control state but blank removal and first-100 limiting only in the outgoing body; ID clearing titles but retaining textarea; title retaining `titles[1:]`; empty/invalid no-request; loading class/preloader; abort plus version-guard latest wins; typed 503 and a route-aborted/fetch-thrown network failure both yielding a blank table, cleared `searching`, and no `pageerror`/`unhandledrejection`; no-hit; route changes; unmount cleanup; exact title/description/body restoration on hydrated navigation; exact four cells; ordinary anchors; and `:::` only between media links.

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

const requestTitles = (values: string[]) => values
  .map(value => value.trim())
  .filter(Boolean)
  .slice(0, 100)

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError"

async function runLookup(body: LookupBody, signal?: AbortSignal) {
  const version = ++requestVersion
  loading.value = true
  try {
    const { data, error } = await api.POST("/works/lookup", { body, signal })
    if (version !== requestVersion) return
    items.value = error ? [] : (data?.items ?? [])
  } catch (error) {
    if (version !== requestVersion) return
    if (!isAbortError(error)) items.value = []
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
```

Instantiate the client exactly as:

```ts
const config = useRuntimeConfig()
const api = createLbApiClient(
  import.meta.server ? config.apiBase : config.public.apiBase
)
```

Decode, trim, and lower-case a route param before seeding either mode, then classify it by `startsWith("lb")`. Use page-local `useAsyncData` only for a valid route-param body; do not call it for `/id`. Serialize the SSR response for hydration. Interactive handlers use `workId`, `titles`, and `textarea` as the authority state: ID input assigns `titles = []` without touching `textarea`; title input clears `workId` and replaces only a copied `titles[0]`; textarea clears `workId` and assigns `titles = normalizeTextarea(textarea)`, which automatically mirrors `titles[0]` in the title input. Only `requestTitles(titles)` constructs an API body. Use one 500 ms timer for title/textarea, immediate valid-ID requests, a fresh `AbortController`, and a monotonically increasing version. Clearing/switching/navigating/unmounting must increment the version, abort, cancel timers, stop loading, and clear rows.

- [ ] **Step 6: Implement authority markup without style redesign**

Render this structure with Vue bindings and exact text:

```vue
<div :class="{ searching: loading }">
  <input :value="workId" placeholder="lbid" autofocus @input="onWorkIdInput">
  <input :value="titles[0] ?? ''" placeholder="titel" @input="onTitleInput">
  <textarea :value="textarea" placeholder="flera titlar separarade med nyrad" @input="onTextareaInput" />
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

Set exact metadata/body state:

```ts
useSeoMeta({
  title: "Litteraturbanken",
  description: "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
})
useHead({ bodyAttrs: { class: "focus page-id ready" } })
```

Do not add CSS unless a later visual test demonstrates a migration-specific need.

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
git add 'nuxt/app/pages/id/[[id]].vue' nuxt/test/ssr/id-lookup.spec.ts nuxt/test/e2e/id-lookup.behavior.spec.ts nuxt/playwright.config.ts
git diff --cached --check
git commit -m "feat(nuxt): port ID lookup"
```

- [ ] **Step 9: Run the Task 4 review gate**

Review SSR zero-request/private-base semantics, route classification, coupled control state, split-index-1 normalization, debounce timing, `try/catch/finally` abort/version cleanup, thrown-network coverage, exact metadata/copy/markup/links, local-only state, and deferred destinations. Rerun focused SSR/browser tests, typecheck, and build; fix all Critical/Important findings separately.

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

Intercept only the exact legacy `query_string/etext,faksimil` request and abort unexpected search/API requests. For the populated case, use a test-only browser seam that changes the `getTitles()` resolution from `{ titles, author_aggs, imported_aggs, hits, distinct_hits, suggest }` to its `titles` member before `IdPageCtrl` assigns `data`. Populate through the textarea with `Författare – Titel\nTitel två`; assert Angular mirrors `Titel` into the title input while keeping the raw textarea, and assert production Angular source is untouched and the corrected rows exactly match the backend characterization fixture.

Capture empty and populated states at desktop and mobile only after fonts, `focus page-id ready`, exact title/default description, all three coupled control values, loading completion, exact four-cell row count, and links are ready. Assert an interception ledger contains no production escape.

- [ ] **Step 2: Run capture and inspect all four images**

```bash
cd nuxt
yarn playwright test --config=playwright.angular.config.ts test/visual/capture-id-lookup-angular.spec.ts
```

Inspect form geometry, first-input focus, table width/striping, row typography, links, media separators, shell corridors, whitespace, and mobile overflow. Do not bless images with missing rows, fonts, or unresolved loading.

- [ ] **Step 3: Add failing Nuxt visual comparisons**

Use the fixture server only. Populate with the same textarea sequence, assert the raw textarea and mirrored first title before readiness, assert exact request bodies, then compare empty/populated desktop/mobile screenshots with the repository's existing near-pixel threshold (`maxDiffPixelRatio: 0.1`, `maxDiffPixels: 100`). Explicitly assert `/id` made no request and populated cases made only the expected public `/v2/works/lookup` POST.

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

Review the exact backend range from `e8bc986` and frontend ID-only commits from `5cbd8ca`. Re-scan the OpenAPI `anyOf`, forbidden extras, limits, full-catalog-before-filter validation, process-local TTL/single-flight behavior, exact group/media/link contracts, sole envelope intent correction, coupled controls, private-base SSR zero-query behavior, metadata/body contract, interactive `try/catch/finally` latest-wins cleanup, production-escape ledgers, four inspected authority images, and unchanged legacy scope. Fix every Critical/Important finding in a separate commit and rerun every affected complete gate. The slice is ready only with final `Spec PASS`, `Quality PASS`, and `Ready YES`.
