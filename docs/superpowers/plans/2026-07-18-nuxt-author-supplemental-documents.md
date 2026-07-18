# Nuxt Author Supplemental Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/författare/:author/presentation` and `/författare/:author/bibliografi` to visually faithful, SSR-complete Nuxt pages that continue to render their managed `/red` XHTML.

**Architecture:** FastAPI publishes one narrow generated descriptor that maps the public author ID and literal document kind to a validated normalized `/red` path. A same-origin Nitro handler fetches that path from the private content origin, extracts and sanitizes the body, and returns one strict page payload; the dynamic Nuxt page fetches that payload directly in `<script setup>` and isolates every route identity.

**Tech Stack:** FastAPI, Pydantic v2, OpenSearch DSL, Nuxt 4, Nitro/H3, Vue 3 `<script setup>`, openapi-fetch, linkedom, Vitest, Playwright, Tailwind plus copied legacy SCSS.

## Global Constraints

- This is an architectural migration only: do not redesign, rewrite editorial copy, change Angular production sources, or change copied legacy SCSS.
- Continue fetching `/red/forfattare/{authorid_norm}/{presentation|bibliografi}/index.html`; fixture copies are test inputs, never production page content.
- Fetch page data directly in the page `<script setup>`; do not add a one-use composable.
- Preserve exact Swedish routes, author heading/navigation, `.page_content > .content.unbox`, body/background hooks, ordinary anchor/download behavior, desktop/mobile appearance, and managed document order.
- Only sanitized body children may enter SSR HTML or a hydration payload.
- Direct document access is governed by the source's status, not the profile's link-visibility flags.
- Map missing author/document to 404 and every non-404 upstream/schema/body failure to a non-leaking 502.
- A route change must synchronously clear accepted content and ignore every late response whose author/document identity is stale.
- `/semer`, `/omtexterna`, SLA documents, Ljud discovery, footnote popovers, deployment caching, and unrelated author-shell refactoring remain out of scope.
- No dropdown or modal exists in this slice, so do not add a Headless UI component.
- Follow strict red-green-refactor: observe focused tests failing before production changes, then keep each task independently reviewable and committed.
- Generate the checked-in TypeScript client only from the canonical backend OpenAPI snapshot.

---

### Task 1: Publish the strict author-document descriptor

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`

**Interfaces:**
- Consumes: existing `ProfileAuthorId`, exact author provider helpers, `ApiErrorResponse`, author router, and global v2 error handlers.
- Produces: `GET /authors/{author_id}/documents/{document_kind}`, operation `v2_get_author_document`, and `AuthorDocumentDescriptor`.

- [ ] **Step 1: Add failing model and transformation tests**

Add the exact contract below to the model tests, including recursive extra-field
rejection and both literal values:

```python
AuthorDocumentKind = Literal["presentation", "bibliografi"]

class AuthorDocumentDescriptor(V2Model):
    author_id: str
    full_name: str
    birth_year: str | None
    death_year: str | None
    has_introduction: bool
    has_dramawebben: bool
    search_url: str | None
    document_kind: AuthorDocumentKind
    source_path: str
```

In `test_authors.py`, add rich fixtures proving these exact results:

```python
assert transform_author_document(raw, "SöderbergH", "presentation") == (
    AuthorDocumentDescriptor(
        author_id="SöderbergH",
        full_name="Hjalmar Söderberg",
        birth_year="1869",
        death_year="1941",
        has_introduction=True,
        has_dramawebben=False,
        search_url="/sok?forfattare=S%C3%B6derbergH&avancerad",
        document_kind="presentation",
        source_path=(
            "/red/forfattare/SoderbergH/presentation/index.html"
        ),
    )
)
```

Repeat for `LagerlöfS` -> normalized `LagerlofS` -> `bibliografi`. Prove
`has_dramawebben` follows a mapping-valued Dramawebben record, `0000` years are
returned as `null`, and a false profile presentation/bibliography flag does not
block descriptor creation. Reject hidden/missing, duplicate exact documents,
wrong returned author ID, blank/malformed required fields, unsafe normalized
IDs, non-mapping Dramawebben data, and unexpected envelopes.

- [ ] **Step 2: Run the model/provider tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2/test_models.py -k author_document
pytest -q test_lbapi/v2/test_authors.py -k author_document
```

Expected: import/collection failures because the model and transformer do not
exist.

- [ ] **Step 3: Add failing exact-query and API/OpenAPI assertions**

Assert one provider call with no auxiliary lookups:

```python
get_documents(
    "author",
    0,
    2,
    includes=(
        "authorid",
        "authorid_norm",
        "show",
        "full_name",
        "birth.plain",
        "death.plain",
        "intro",
        "dramawebben",
        "searchable",
    ),
    show_only=False,
    and_query=Q("term", **{"authorid.raw": author_id}),
)
```

Add endpoint tests for both kinds, missing 404, invalid author/kind 422,
OpenSearch 503 with code `author_document_unavailable`, malformed non-leaking
500, GET-only behavior, exact operation ID, response refs, recursively forbidden
extras, required nullable fields, and the canonical OpenAPI path.

- [ ] **Step 4: Run endpoint tests RED**

```bash
pytest -q test_lbapi/v2/test_api.py -k author_document
pytest -q test_lbapi/v2/test_openapi.py -k 'author_document or stable_path'
```

Expected: 404/schema assertion failures because the operation is absent.

- [ ] **Step 5: Implement the minimal provider, transformer, and route**

Add the model, `AUTHOR_DOCUMENT_FIELDS`, and these typed interfaces in
`authors.py`:

```python
def query_author_document(author_id: str) -> dict[str, Any]:
    return _legacy_api().get_documents(
        "author",
        0,
        2,
        includes=AUTHOR_DOCUMENT_FIELDS,
        show_only=False,
        and_query=Q("term", **{"authorid.raw": author_id}),
    )

def transform_author_document(
    raw: dict[str, Any],
    requested_author_id: str,
    document_kind: AuthorDocumentKind,
) -> AuthorDocumentDescriptor:
    document = _profile_document(raw, requested_author_id)
    normalized_id = _profile_required_string(document.get("authorid_norm"))
    encoded_normalized_id = _encoded_segment(normalized_id)
    encoded_author_id = _encoded_segment(requested_author_id)
    dramawebben = document.get("dramawebben")
    if dramawebben is not None and not isinstance(dramawebben, dict):
        raise ValueError("Malformed author document response")
    return AuthorDocumentDescriptor(
        author_id=requested_author_id,
        full_name=_profile_required_string(document.get("full_name")),
        birth_year=_profile_year(document, "birth"),
        death_year=_profile_year(document, "death"),
        has_introduction=bool(_profile_optional_string(document, "intro")),
        has_dramawebben=dramawebben is not None,
        search_url=(
            f"/sok?forfattare={encoded_author_id}&avancerad"
            if _profile_flag(document, "searchable") else None
        ),
        document_kind=document_kind,
        source_path=(
            f"/red/forfattare/{encoded_normalized_id}/"
            f"{document_kind}/index.html"
        ),
    )
```

Wrap malformed transformation errors consistently with the existing profile
operation. Catch only `OpenSearchException` as a typed 503; let the global 500
handler redact malformed provider details.

- [ ] **Step 6: Export and verify the complete backend contract GREEN**

```bash
python scripts/export_v2_openapi.py
python scripts/export_v2_openapi.py --check
pytest -q test_lbapi/v2
python -m compileall -q lbapi
git diff --check
git diff --quiet -- lbapi/elasticapi.py lbapi/web.py
```

Expected: every v2 test passes, the snapshot is current, compilation succeeds,
and legacy provider/web files are unchanged.

- [ ] **Step 7: Commit the backend task**

```bash
git add lbapi/v2/models.py lbapi/v2/authors.py \
  test_lbapi/v2/test_models.py test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): describe author documents"
```

---

### Task 2: Generate the client and deterministic document fixtures

**Files:**
- Modify: `nuxt/app/lib/api/generated/lbapi.ts`
- Create: `nuxt/test/fixtures/author-document-data.mjs`
- Create: `nuxt/test/fixtures/author-document-content/SoderbergH-presentation.html`
- Create: `nuxt/test/fixtures/author-document-content/LagerlofS-bibliografi.html`
- Create: `nuxt/test/fixtures/author-document-content/malicious.html`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: Task 1's canonical OpenAPI snapshot and generated operation.
- Produces: generated descriptor types and isolated descriptor/content fixtures
  with exact request/failure/delay controls.

- [ ] **Step 1: Add failing fixture-server tests**

Define two complete `AuthorDocumentDescriptor` fixtures with `@satisfies`:

```js
export const soderbergPresentation = {
  author_id: "SöderbergH",
  full_name: "Hjalmar Söderberg",
  birth_year: "1869",
  death_year: "1941",
  has_introduction: true,
  has_dramawebben: false,
  search_url: "/sok?forfattare=S%C3%B6derbergH&avancerad",
  document_kind: "presentation",
  source_path: "/red/forfattare/SoderbergH/presentation/index.html"
}

export const lagerlofBibliography = {
  author_id: "LagerlöfS",
  full_name: "Selma Lagerlöf",
  birth_year: "1858",
  death_year: "1940",
  has_introduction: true,
  has_dramawebben: false,
  search_url: null,
  document_kind: "bibliografi",
  source_path: "/red/forfattare/LagerlofS/bibliografi/index.html"
}
```

Assert public/private descriptor paths, exact original encoded request ledgers,
the two exact content paths, and these isolated controls:

```text
GET|DELETE /_author_document_requests
GET|PUT|DELETE /_author_document_failure
GET|PUT|DELETE /_author_document_delay
```

`failure` accepts exactly `descriptor-404`, `descriptor-503`, `content-404`,
`content-503`, `malformed-descriptor`, or `malformed-content`; `delay` accepts
an integer `milliseconds` from 0 through 5000. Resets must not mutate profile,
Reader, Library, or presentation fixture state.

- [ ] **Step 2: Run fixture tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn vitest run test/unit/v2-server.spec.ts -t 'author document'
```

Expected: missing control/path failures.

- [ ] **Step 3: Generate the client and implement fixture routes**

```bash
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  yarn api:generate
```

Copy the frozen authority XHTML byte-for-byte into the two named fixture files.
The production implementation must never import these files. Serve descriptors
under both `/v2` and `/private-v2`; serve XHTML only at its exact `/red` path;
record each request before applying delay/failure state; and return standard
JSON 404/503 envelopes for descriptor errors.

- [ ] **Step 4: Verify and commit the generated fixture boundary**

```bash
yarn vitest run test/unit/v2-server.spec.ts
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  yarn api:check
yarn typecheck
git diff --check
git add nuxt/app/lib/api/generated/lbapi.ts \
  nuxt/test/fixtures/author-document-data.mjs \
  nuxt/test/fixtures/author-document-content \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "test(nuxt): fixture author documents"
```

---

### Task 3: Build the strict Nitro XHTML boundary

**Files:**
- Create: `nuxt/shared/types/author-document.ts`
- Create: `nuxt/server/utils/author-document.ts`
- Create: `nuxt/server/api/author-documents/[author]/[document].get.ts`
- Create: `nuxt/test/unit/author-document.spec.ts`
- Create: `nuxt/test/ssr/author-documents-api.spec.ts`

**Interfaces:**
- Consumes: generated `v2_get_author_document`, private `apiBase`, private
  `contentBase`, existing `validateAuthorRouteParam`, and `linkedom`.
- Produces: `AuthorSupplementalPage`, deterministic sanitizer/parser functions,
  and the same-origin endpoint used by the page.

- [ ] **Step 1: Write failing parser/sanitizer unit tests**

Define the shared output exactly:

```ts
export type AuthorDocumentKind = "presentation" | "bibliografi"

export interface AuthorSupplementalAuthor {
  authorId: string
  fullName: string
  lifespan: string
  hasIntroduction: boolean
  hasDramawebben: boolean
  searchUrl: string | null
}

export interface AuthorSupplementalPage {
  author: AuthorSupplementalAuthor
  documentKind: AuthorDocumentKind
  bodyHtml: string
}
```

Test `parseAuthorDocumentBody(source: string): string` with the complete frozen
presentation/bibliography bodies and the malicious fixture. Assert preservation
of text order, headings, lists, tables, classes/IDs, PDF `download`, safe images,
and ordinary targets. Assert removal of comments, active subtrees, event/style/
framework attributes, unsafe URLs and raw marker text; `/forfattare/` becomes
`/författare/`; `_blank` gains both rel tokens; the output has no `<body>`;
and parsing the sanitized output wrapped in a body returns the same string.
Missing/duplicate body and parser failure must throw a local invalid-source
error rather than returning the full input.

- [ ] **Step 2: Run parser tests RED**

```bash
yarn vitest run test/unit/author-document.spec.ts
```

Expected: import failure because the parser is absent.

- [ ] **Step 3: Implement the explicit document sanitizer**

Use `linkedom` and explicit sets. The element allowlist is:

```ts
const allowedElements = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code",
  "col", "colgroup", "dd", "del", "div", "dl", "dt", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "i", "img", "ins", "li", "ol", "p", "pre", "q", "s", "small",
  "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot",
  "th", "thead", "tr", "u", "ul"
])
const removedSubtrees = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form",
  "frame", "frameset", "iframe", "input", "link", "math", "meta",
  "noscript", "object", "option", "picture", "script", "select", "source",
  "style", "svg", "template", "textarea", "video"
])
```

Preserve only the attribute policy from the design. Reuse the repository's
repeated-decode, traversal, RFC3986, and blank-target semantics; do not weaken
the existing profile sanitizer. Keep this parser server-only.

- [ ] **Step 4: Write failing endpoint/status tests**

In `author-documents-api.spec.ts`, call the endpoint directly and assert:

```text
SöderbergH/presentation -> 200, exact author identity, sanitized body
LagerlöfS/bibliografi -> 200, exact author identity, sanitized body
unknown author -> 404 author_document_author_not_found
missing source -> 404 author_document_not_found
descriptor/content 503 -> 502 author_document_unavailable
malformed descriptor/source/body -> 502 author_document_unavailable
unsupported kind, invalid/double-encoded/traversal author -> 404
```

For every case assert `cache-control: no-store`, the exact private descriptor
path, the exact content path when applicable, and no public API or production
escape.

- [ ] **Step 5: Run endpoint tests RED**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3141 \
  yarn playwright test test/ssr/author-documents-api.spec.ts --project=ssr
```

Expected: endpoint 404s because the handler is absent.

- [ ] **Step 6: Implement the strict loader and thin handler**

The route handler must remain a one-purpose adapter:

```ts
export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredAuthorParam(event)
  const documentKind = requiredDocumentKind(event)
  return await loadAuthorDocument(event, author, documentKind)
})
```

`loadAuthorDocument` uses `createLbApiClient(config.apiBase)` for the generated
operation, validates every descriptor field at runtime, checks request identity
and exact source-path shape, then fetches `${contentBase}${source_path}` as text
with `retry: 0`. Translate only the three local error codes from the design.
Return `formatAuthorYears(...)` output in the shell and `bodyHtml` only after
sanitization.

- [ ] **Step 7: Verify and commit the server boundary**

```bash
yarn vitest run test/unit/author-document.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3141 \
  yarn playwright test test/ssr/author-documents-api.spec.ts --project=ssr
yarn typecheck
git diff --check
git add nuxt/shared/types/author-document.ts \
  nuxt/server/utils/author-document.ts \
  'nuxt/server/api/author-documents/[author]/[document].get.ts' \
  nuxt/test/unit/author-document.spec.ts \
  nuxt/test/ssr/author-documents-api.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): proxy author documents"
```

---

### Task 4: Render, compare, and close both Nuxt routes

**Files:**
- Create: `nuxt/app/pages/författare/[author]/[document].vue`
- Create: `nuxt/test/ssr/author-documents.spec.ts`
- Create: `nuxt/test/e2e/author-documents.behavior.spec.ts`
- Create: `nuxt/test/e2e/author-documents.visual.spec.ts`
- Create: `nuxt/test/visual/capture-author-documents-angular.spec.ts`
- Create: `nuxt/test/visual/baselines/author-document-presentation-desktop.png`
- Create: `nuxt/test/visual/baselines/author-document-presentation-mobile.png`
- Create: `nuxt/test/visual/baselines/author-document-bibliografi-desktop.png`
- Create: `nuxt/test/visual/baselines/author-document-bibliografi-mobile.png`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: Task 3's `/api/author-documents/{author}/{document}` and
  `AuthorSupplementalPage`.
- Produces: both public Nuxt routes with exact SSR, SPA, history, loading,
  error, accessibility, and visual behavior.

- [ ] **Step 1: Capture frozen Angular authority RED/GOLD**

Create two authority cases using the same descriptor and XHTML fixtures:

```ts
const cases = [
  {
    name: "presentation",
    route: "/författare/S%C3%B6derbergH/presentation",
    sourcePath: "/red/forfattare/SoderbergH/presentation/index.html",
    heading: "Hjalmar Söderberg"
  },
  {
    name: "bibliografi",
    route: "/författare/Lagerl%C3%B6fS/bibliografi",
    sourcePath: "/red/forfattare/LagerlofS/bibliografi/index.html",
    heading: "Selma Lagerlöf"
  }
] as const
```

Intercept and assert the exact Angular author request, author-list request, ten
legacy work requests, audio/map/bootstrap requests, one exact managed XHTML
request, background/fonts, and zero unknown API/content/production escapes.
Wait for the body text, fonts, background, hidden preloader, and zero page/
console errors before writing all four baseline files.

Run:

```bash
yarn playwright test test/visual/capture-author-documents-angular.spec.ts \
  --config=playwright.angular.config.ts
```

Expected: 4 authority captures pass and create only the four named baselines.

- [ ] **Step 2: Add failing SSR page tests**

Assert for both routes: status 200; exact title/description; body classes and
`forf2_bkg.jpg`; balanced heading/lifespan; Introduktion/Verk/Dramawebben/Search
visibility; no active supplemental tab; `.page_content > .content.unbox` with
the expected frozen text/structure; rewritten internal author links; native PDF
`download`/target attributes; one private descriptor and one content request;
sanitized hydration payload; and no duplicate public request.

Add valid-route error cases for author 404, content 404, descriptor/content 503,
malformed descriptor/body, plus invalid kind and malicious author params. Assert
real 404/502 status and exact local Swedish copy, never an empty 200.

- [ ] **Step 3: Add failing browser and visual tests**

Behavior tests must cover:

1. direct hydration of both pages without duplicate work or warnings;
2. native click of an internal author link and a PDF/download anchor;
3. router navigation presentation -> bibliography -> presentation with one
   public request per new identity and back/forward history preserved;
4. delayed author/kind transitions showing `.searching > .preloader`, clearing
   the old heading/body synchronously, and ignoring the late first response;
5. client 404/502 cleanup followed by successful recovery; and
6. no console, page, hydration, unexpected API, or production-escape problems.

Visual tests use the exact authority viewports and names:

```ts
await expect(page).toHaveScreenshot(
  `author-document-${visualCase.name}-${device}.png`,
  {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    maxDiffPixels: 100
  }
)
```

- [ ] **Step 4: Run page suites RED**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3143 \
  yarn playwright test test/ssr/author-documents.spec.ts --project=ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3145 \
  yarn playwright test test/e2e/author-documents.behavior.spec.ts \
  --project=desktop-chromium
```

Expected: Nuxt route 404s and screenshot cases cannot find the author document.

- [ ] **Step 5: Implement the route-keyed page in `<script setup>`**

Validate the two parameters, call the same-origin endpoint with
`useRequestFetch`, and use the established accepted-identity pattern:

```ts
type PageResult = {
  identity: string
  status: 200 | 404 | 502
  errorCode: string | null
  page: AuthorSupplementalPage | null
}

const currentIdentity = computed(
  () => `${authorId.value}:${documentKind.value}`
)
const requestFetch = useRequestFetch()
const { data } = await useAsyncData<PageResult>(
  computed(() => `author-document:${currentIdentity.value}`),
  async () => loadPageResult(
    requestFetch,
    authorId.value,
    documentKind.value,
    currentIdentity.value
  ),
  {
    lazy: true,
    getCachedData: (key, nuxtApp) => {
      const value = nuxtApp.payload.data[key] as PageResult | undefined
      return value?.identity === currentIdentity.value ? value : undefined
    }
  }
)

const accepted = shallowRef<PageResult | null>(null)
watch(currentIdentity, () => { accepted.value = null }, { flush: "sync" })
watch([data, currentIdentity], ([candidate, identity]) => {
  if (candidate?.identity === identity) accepted.value = candidate
}, { immediate: true, flush: "sync" })
```

Render the Angular shell directly in this page; do not introduce a one-use
component or composable. Use `authorProfilePath` and the descriptor booleans for
the ordinary navigation. Set the exact metadata/background/body hooks from the
design. SSR calls `setResponseStatus(404|502)` from the accepted result.

- [ ] **Step 6: Run focused GREEN and adjacent author regressions**

```bash
yarn vitest run test/unit/author-document.spec.ts test/unit/author-profile.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3143 \
  yarn playwright test test/ssr/author-documents-api.spec.ts \
  test/ssr/author-documents.spec.ts test/ssr/author-profiles.spec.ts \
  test/ssr/author-works.spec.ts --project=ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3145 \
  yarn playwright test test/e2e/author-documents.behavior.spec.ts \
  test/e2e/author-profiles.behavior.spec.ts \
  test/e2e/author-works.behavior.spec.ts --project=desktop-chromium
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3147 \
  yarn playwright test test/e2e/author-documents.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: all focused and adjacent author tests pass; all four comparisons are
within the authority threshold.

- [ ] **Step 7: Run the complete closure gate**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3149 yarn test:ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3151 yarn test:e2e
yarn typecheck
yarn build
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  yarn api:check
git diff --check
git diff --quiet -- ../app

cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2
python scripts/export_v2_openapi.py --check
python -m compileall -q lbapi
git diff --check
git diff --quiet -- lbapi/elasticapi.py lbapi/web.py
```

Expected: every command exits 0. While the development servers are live, also
verify the two real URLs resolve with managed content and no browser console or
hydration error; do not stop the user's existing frontend server.

- [ ] **Step 8: Commit the completed frontend slice**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add 'nuxt/app/pages/författare/[author]/[document].vue' \
  nuxt/test/ssr/author-documents.spec.ts \
  nuxt/test/e2e/author-documents.behavior.spec.ts \
  nuxt/test/e2e/author-documents.visual.spec.ts \
  nuxt/test/visual/capture-author-documents-angular.spec.ts \
  nuxt/test/visual/baselines/author-document-*.png \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): render author documents"
```
