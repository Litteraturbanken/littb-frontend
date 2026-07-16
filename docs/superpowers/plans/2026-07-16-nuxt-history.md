# Nuxt Reading History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/historik` as a small read-only Nuxt page with existing visual fidelity and a strict generated author-summary resolver.

**Architecture:** FastAPI exposes one page-oriented batch operation using exact author-ID terms matching. Nuxt SSR renders the heading-only shell, then page-local mounted code safely reads old Reader storage, resolves distinct authors once, and renders the legacy list. Reader/history writes and every other author operation stay out of scope.

**Tech Stack:** FastAPI, Pydantic v2, OpenSearch DSL, Nuxt 4, Vue 3 `<script setup>`, openapi-fetch, Playwright, Vitest, Tailwind/global legacy CSS.

## Global Constraints

- Keep `/historik` deliberately small; do not port Reader, Editor, history writes, deletion UI, or the global `h` shortcut.
- Preserve the existing markup, copy, body classes, metadata, global CSS, and desktop/mobile appearance; add no page-specific styling unless screenshot evidence proves a migration-only gap.
- Fetch inside the page `<script setup>`; do not add a one-use composable.
- Preserve valid stored URLs byte-for-byte and use plain anchors; never mutate `lastPageViews`.
- Ignore invalid storage/records safely and keep at most the first 50 valid rows.
- Keep Angular production source and legacy backend routes unchanged.
- Generate the checked-in client only from the canonical backend OpenAPI snapshot.

---

### Task 1: Publish the strict batch author resolver

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/models.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/app.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_models.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`

**Interfaces:**
- Consumes: legacy `elasticapi.get_documents(..., and_query=Q("terms", **{"authorid.raw": ids}))` and existing strict `AuthorSummary`/error models.
- Produces: generated operation `v2_post_author_resolve`, request `AuthorResolveRequest { author_ids: string[1..50] }`, response `AuthorSummariesResponse { items: AuthorSummary[] }`.

- [ ] **Step 1: Write failing model tests**

Add tests that accept trimmed distinct IDs and reject an empty list, blank ID,
ID longer than 100 characters, duplicate-after-trimming IDs, 51 IDs, and extra
fields. The implementation contract is:

```python
AuthorId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]

class AuthorResolveRequest(V2Model):
    author_ids: list[AuthorId] = Field(min_length=1, max_length=50)

    @field_validator("author_ids")
    @classmethod
    def require_distinct_ids(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("author IDs must be distinct")
        return value

class AuthorSummariesResponse(V2Model):
    items: list[AuthorSummary]
```

- [ ] **Step 2: Run model tests RED**

Run:

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_models.py -k author_resolve
```

Expected: fail because the new request/response models do not exist.

- [ ] **Step 3: Add provider/transform tests before implementation**

Characterize one selected-field query with `show_only=False`, exact
`authorid.raw` terms, and a limit equal to request length. Test response order
when provider order differs, unknown omission, nullable surname, and generic
malformed handling for non-list data, non-mapping documents, blank required
strings, duplicate provider IDs, and IDs not requested.

The pure transform signature is:

```python
def transform_author_summaries(
    raw: dict[str, Any], requested_ids: list[str]
) -> AuthorSummariesResponse:
    ...
```

- [ ] **Step 4: Run author tests RED**

```bash
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2/test_authors.py
```

Expected: fail because `lbapi.v2.authors` does not exist.

- [ ] **Step 5: Implement the minimal router/provider/transform**

Create `authors.py` with:

```python
router = APIRouter(tags=["authors"])
AUTHOR_RESPONSES = {
    422: {"model": ApiErrorResponse, "description": "Invalid request"},
    500: {"model": ApiErrorResponse, "description": "Unexpected server error"},
    503: {"model": ApiErrorResponse, "description": "Search backend unavailable"},
}

def query_author_summaries(author_ids: list[str]) -> dict[str, Any]:
    return _legacy_api().get_documents(
        "author",
        0,
        len(author_ids),
        includes=("authorid", "full_name", "surname"),
        show_only=False,
        and_query=Q("terms", **{"authorid.raw": author_ids}),
    )

@router.post(
    "/authors/resolve",
    operation_id="v2_post_author_resolve",
    response_model=AuthorSummariesResponse,
    responses=AUTHOR_RESPONSES,
)
def resolve_authors(request: AuthorResolveRequest) -> AuthorSummariesResponse:
    try:
        raw = query_author_summaries(request.author_ids)
    except OpenSearchException as exc:
        raise HTTPException(
            status_code=503,
            detail=ApiError(
                code="author_resolve_unavailable",
                message="Unable to resolve authors",
                details=None,
            ).model_dump(mode="json"),
        ) from exc
    return transform_author_summaries(raw, request.author_ids)
```

The transformer must validate nonblank strings explicitly, build a unique map,
reject provider IDs outside the request, and instantiate fresh `AuthorSummary`
objects in request order.

- [ ] **Step 6: Add endpoint and OpenAPI tests**

Test 200 partial/empty resolution, typed 422, typed nonleaking 503, generic 500,
operation ID, strict `additionalProperties: false`, exact required arrays,
limits, response refs, mounted schema, and the updated exact path set.

- [ ] **Step 7: Register, generate, and verify**

Register `authors_router` in `lbapi/v2/app.py`, then run:

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2
/Users/johan/dev/lb-backend/virtual_env/bin/python scripts/export_v2_openapi.py
/Users/johan/dev/lb-backend/virtual_env/bin/python scripts/export_v2_openapi.py --check
git diff --check
git diff --quiet -- lbapi/elasticapi.py lbapi/web.py
```

Expected: all tests/checks pass; legacy provider/web files remain unchanged.

- [ ] **Step 8: Commit backend resolver**

```bash
git add lbapi/v2/models.py lbapi/v2/authors.py lbapi/v2/app.py \
  test_lbapi/v2/test_models.py test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): resolve author summaries"
```

---

### Task 2: Generate the client and deterministic history fixture

**Files:**
- Modify: `nuxt/app/lib/api/generated/lbapi.ts`
- Create: `nuxt/test/fixtures/history-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: canonical backend `openapi/v2.json` and `v2_post_author_resolve`.
- Produces: generated request/response types plus public/private fixture handling, isolated request ledger/reset, and failure/delay controls.

- [ ] **Step 1: Add failing fixture tests**

Define deterministic summaries for `StrindbergA`, `LagerlofS`, and a long-name
author. Assert `/v2/authors/resolve` and `/private-v2/authors/resolve` accept the
same strict body, return request order despite fixture storage order, omit an
unknown ID, record exact original path/body, and support isolated reset/failure.
Assert empty/duplicate/51-ID/extra bodies return fixture 422.

- [ ] **Step 2: Run fixture tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn vitest run test/unit/v2-server.spec.ts
```

Expected: focused new tests fail with 404/missing controls.

- [ ] **Step 3: Regenerate and implement fixture operation**

```bash
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:generate
```

Implement exact public/private dispatch and these controls:

```text
GET|DELETE /_author_resolve_requests
GET|PUT|DELETE /_author_resolve_failure
```

Keep their state independent of contact, quick-search, work-lookup, content,
map, and generic ledgers. A delay control is unnecessary unless Task 3's
unmount test demonstrates it is needed.

- [ ] **Step 4: Verify generated client and fixture**

```bash
yarn vitest run test/unit/v2-server.spec.ts
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn typecheck
```

- [ ] **Step 5: Commit generated boundary**

```bash
git add nuxt/app/lib/api/generated/lbapi.ts nuxt/test/fixtures/history-data.mjs \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): generate history author client"
```

---

### Task 3: Port the read-only History page

**Files:**
- Create: `nuxt/app/pages/historik.vue`
- Create: `nuxt/test/ssr/history.spec.ts`
- Create: `nuxt/test/e2e/history.behavior.spec.ts`

**Interfaces:**
- Consumes: generated `POST /authors/resolve`, `localStorage.lastPageViews`, existing shell/CSS.
- Produces: exact `/historik` SSR route and mounted legacy list behavior.

- [ ] **Step 1: Add SSR RED test**

Assert status 200, title `History | Litteraturbanken`, body classes
`focus page-history ready`, exact heading/wrapper, standard shell, no rendered
list, and no fixture author request during SSR.

- [ ] **Step 2: Add browser RED tests**

Seed valid, invalid, unsafe, unknown-author, duplicate-author, and oversized
storage before navigation. Assert first 50 valid rows in stored order, one body
containing distinct author IDs, byte-preserved href/query/fragment, blank
unknown author, ordinary anchors, no storage mutation, and no console/page
errors. Add missing/null/invalid JSON/storage-access failure/API failure and
leave-during-request cases; they show only the heading and do not commit late
state.

- [ ] **Step 3: Run route tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn playwright test --project=ssr test/ssr/history.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/history.behavior.spec.ts
```

- [ ] **Step 4: Implement page-local parsing and fetch**

Inside `historik.vue`:

```ts
type StoredHistory = { author: string; label: string; url: string }

function safeHistoryUrl(value: unknown): value is string {
  if (typeof value !== "string" || /[\\\u0000-\u001f\u007f]/.test(value)) return false
  if (!value.startsWith("/") || value.startsWith("//")) return false
  try {
    return new URL(value, "https://history.invalid").origin === "https://history.invalid"
  } catch {
    return false
  }
}
```

Parse/catch in `onMounted`, filter objects with nonblank `author`/`label` and a
safe URL, take 50, deduplicate IDs for one generated-client request, and guard
late completion with an `AbortController` plus an unmounted flag. Keep an
`authorsResolved` flag separate from the author map so successful unknown IDs
still render blank-author rows. Use the exact legacy template:

```html
<div>
  <h1>Senast lästa verk</h1>
  <ul v-if="authorsResolved">
    <li v-for="(pageview, index) in history" :key="`${index}:${pageview.url}`">
      <a :href="pageview.url">
        <span>{{ authorsById[pageview.author]?.full_name ?? "" }}</span> –
        <span class="">{{ pageview.label }}</span>
      </a>
    </li>
  </ul>
</div>
```

Use `useSeoMeta`, `useHead`, `createLbApiClient`, private/public runtime bases,
and no composable/new CSS.

- [ ] **Step 5: Verify behavior and scope**

```bash
yarn playwright test --project=ssr test/ssr/history.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/history.behavior.spec.ts
yarn typecheck
git diff --check
```

- [ ] **Step 6: Commit History page**

```bash
git add nuxt/app/pages/historik.vue nuxt/test/ssr/history.spec.ts \
  nuxt/test/e2e/history.behavior.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): port reading history"
```

---

### Task 4: Lock lean desktop/mobile parity and close the slice

**Files:**
- Create: `nuxt/playwright.history-angular.config.ts`
- Create: `nuxt/test/visual/capture-history-angular.spec.ts`
- Create: `nuxt/test/e2e/history.visual.spec.ts`
- Create: `nuxt/test/visual/baselines/history-populated-desktop.png`
- Create: `nuxt/test/visual/baselines/history-populated-mobile.png`
- Modify only if needed: `nuxt/package.json`
- Modify only with screenshot evidence: `nuxt/app/assets/styles/nuxt.scss`

**Interfaces:**
- Consumes: completed page/fixture and deterministic Angular `/api/get_authors` interception.
- Produces: two inspected authority images and exact Nuxt comparisons.

- [ ] **Step 1: Capture Angular authority reproducibly**

Add a local Angular config based on the Presentation/Home pattern, seed three
records before navigation (including two formats of one work and one long
title), intercept only `/api/get_authors`, block production escape, wait for
fonts/body/list/links, and capture desktop plus iPhone 13 full-page images.

- [ ] **Step 2: Inspect both baselines**

Verify logo colors, corridor geometry, heading/list typography, row order,
long-title wrapping, mobile stacking, and absence of missing names/fonts.

- [ ] **Step 3: Add Nuxt visual comparisons**

Seed identical storage, assert exactly one public resolver request and no
production API escape, then use:

```ts
await expect(page).toHaveScreenshot(baseline, {
  fullPage: true,
  animations: "disabled",
  caret: "hide",
  scale: "css",
  threshold: 0.1,
  maxDiffPixels: 100
})
```

- [ ] **Step 4: Fix only demonstrated visual drift**

Prefer markup/whitespace corrections. Add narrowly scoped `.page-history`
glue only when the image diff proves copied authority CSS cannot express the
same result. Do not edit copied `styles.scss` or Angular source.

- [ ] **Step 5: Run lean closure gates**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
/Users/johan/dev/lb-backend/virtual_env/bin/pytest -q test_lbapi/v2
/Users/johan/dev/lb-backend/virtual_env/bin/python scripts/export_v2_openapi.py --check
git diff --check

cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn vitest run test/unit/v2-server.spec.ts
yarn playwright test --project=ssr test/ssr/history.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/history.behavior.spec.ts test/e2e/history.visual.spec.ts
yarn playwright test --project=mobile-chromium test/e2e/history.visual.spec.ts
yarn typecheck
yarn build
```

- [ ] **Step 6: Commit parity evidence**

```bash
git add nuxt/playwright.history-angular.config.ts \
  nuxt/test/visual/capture-history-angular.spec.ts \
  nuxt/test/e2e/history.visual.spec.ts \
  nuxt/test/visual/baselines/history-populated-desktop.png \
  nuxt/test/visual/baselines/history-populated-mobile.png
git add nuxt/package.json nuxt/app/assets/styles/nuxt.scss  # only if changed
git diff --cached --check
git commit -m "test(nuxt): lock reading history parity"
```

- [ ] **Step 7: Final review**

Review backend commits from `794ee9b`, frontend commits from `f48d8b2`, and the
design/plan. Require Spec PASS, Quality PASS, Ready YES, unchanged Angular and
legacy backend routes, exact generated-client freshness, no composable, two
inspected authority images, and no Reader/history-writer scope.
