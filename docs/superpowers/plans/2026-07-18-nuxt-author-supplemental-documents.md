# Nuxt Author Supplemental Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/författare/:author/presentation` and `/författare/:author/bibliografi` to visually faithful, SSR-complete Nuxt pages that continue to render their managed `/red` XHTML and whose normalized legacy links reach canonical Nuxt content.

**Architecture:** FastAPI publishes a narrow author-document descriptor and a typed normalized-route resolver. A same-origin Nitro handler validates the descriptor byte-for-byte, fetches and sanitizes XHTML, while a Nitro middleware permanently canonicalizes safe `/forfattare/**` links; one dynamic Nuxt page fetches its strict payload directly in `<script setup>` and isolates route identity.

**Tech Stack:** FastAPI, Pydantic v2, OpenSearch DSL, requests, Nuxt 4, Nitro/H3, Vue 3 `<script setup>`, openapi-fetch, linkedom, Vitest, Playwright, Tailwind plus copied legacy SCSS.

## Global Constraints

- Architectural migration only: do not redesign, rewrite editorial copy, modify Angular production sources, or modify copied legacy SCSS.
- Continue fetching `/red/forfattare/{authorid_norm}/{presentation|bibliografi}/index.html`; test fixtures are never production content.
- Fetch the page model directly in page `<script setup>` through `useRequestFetch`; do not add a one-use composable.
- Preserve exact heading/navigation order including conditional Ljud, DOM/CSS hooks, metadata, background, ordinary anchors/downloads, and desktop/mobile appearance.
- Preserve safe `/forfattare/**` hrefs and implement Angular-equivalent typed author/title un-normalization; never perform a prefix-only rewrite.
- Only sanitized body children may enter SSR HTML or hydration state.
- Reconstruct the one allowed source path from separately validated normalized ID plus requested kind and require byte-for-byte descriptor equality before contacting content.
- Missing author/document is 404; every non-404 backend/content/schema/body failure is a non-leaking 502 at the Nuxt boundary.
- Route changes clear accepted content synchronously and ignore late responses with stale author/document identity.
- `/semer`, `/omtexterna`, SLA, cross-corpus footnote popovers, caching, and unrelated author-shell refactors remain out of scope.
- No dropdown/modal exists, so do not add Headless UI.
- Observe focused RED before implementation and keep every task independently reviewable/committed.
- Generate the TypeScript client only from the canonical backend OpenAPI snapshot.

---

### Task 1: Publish the strict document descriptor with Ljud parity

**Files:**
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/author_audio.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/author_works.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/authors.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_author_audio.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_author_work_providers.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`

**Interfaces:**
- Consumes: exact author provider, existing Author Works fail-soft audio behavior, `ProfileAuthorId`, and v2 error handlers.
- Produces: `query_optional_author_audio_url(normalized_author_id: str) -> str | None` in a neutral module and `GET /authors/{author_id}/documents/{document_kind}` (`v2_get_author_document`).

- [ ] **Step 1: Write failing audio extraction and regression tests**

Move, do not alter, the established contract:

```python
AUDIO_TIMEOUT_SECONDS = 5
AUDIO_API_URL = "https://litteraturbanken.se/ljudochbild/wp-json/wp/v2/pages"

def query_optional_author_audio_url(normalized_author_id: str) -> str | None:
    slug = normalized_author_id.lower()
    try:
        response = requests.get(
            AUDIO_API_URL,
            params={"slug": slug, "_fields": "slug"},
            timeout=AUDIO_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise TypeError("Malformed author audio response")
        if not payload:
            return None
        if any(
            not isinstance(item, Mapping) or item.get("slug") != slug
            for item in payload
        ):
            raise TypeError("Malformed author audio response")
        return (
            "https://litteraturbanken.se/ljudochbild/författare/"
            f"{quote(slug, safe='')}"
        )
    except (requests.RequestException, TypeError, ValueError):
        return None
```

Test `SoderbergH -> .../soderbergh`, `LagerlofS -> .../lagerlofs`, empty,
network/status/JSON/shape failure -> `None`, exact timeout/params, and unchanged
Author Works output/import behavior after moving the helper.

- [ ] **Step 2: Run audio tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2/test_author_audio.py \
  test_lbapi/v2/test_author_work_providers.py -k audio
```

Expected: new-module import failure.

- [ ] **Step 3: Write failing descriptor model/provider tests**

Add the exact strict model:

```python
AuthorDocumentKind = Literal["presentation", "bibliografi"]

class AuthorDocumentDescriptor(V2Model):
    author_id: str
    normalized_author_id: str
    full_name: str
    birth_year: str | None
    death_year: str | None
    has_introduction: bool
    has_dramawebben: bool
    search_url: str | None
    audio_url: str | None
    document_kind: AuthorDocumentKind
    source_path: str
```

Assert `SöderbergH` returns normalized `SoderbergH`, presentation source,
search, `audio_url`, no Dramawebben; and `LagerlöfS` returns normalized
`LagerlofS`, bibliography source, search, `audio_url`, and Dramawebben true.
Add sparse absent-audio/navigation, audio-failure-is-null, false document flags
still addressable, `0000` years, hidden/missing 404, duplicate exact/mismatched/
unsafe normalized/malformed records, and recursive extra rejection.

- [ ] **Step 4: Run descriptor tests RED**

```bash
pytest -q test_lbapi/v2/test_models.py -k author_document
pytest -q test_lbapi/v2/test_authors.py -k author_document
```

Expected: missing model/transformer failures.

- [ ] **Step 5: Implement the neutral audio helper and descriptor**

The descriptor query is exactly:

```python
AUTHOR_DOCUMENT_FIELDS = (
    "authorid", "authorid_norm", "show", "full_name", "birth.plain",
    "death.plain", "intro", "dramawebben", "searchable",
)

def query_author_document(author_id: str) -> dict[str, Any]:
    return _legacy_api().get_documents(
        "author", 0, 2,
        includes=AUTHOR_DOCUMENT_FIELDS,
        show_only=False,
        and_query=Q("term", **{"authorid.raw": author_id}),
    )
```

`transform_author_document` validates `authorid_norm` as one raw segment using
the same control/percent/slash/backslash/dot/length rules as profile IDs, calls
the neutral audio helper after the exact author is validated, and constructs:

```python
source_path = (
    f"/red/forfattare/{_encoded_segment(normalized_author_id)}/"
    f"{document_kind}/index.html"
)
```

The endpoint catches only OpenSearch as typed 503. Audio failure remains null;
malformed provider data reaches the global redacted 500.

- [ ] **Step 6: Add endpoint/OpenAPI tests and finish GREEN**

Assert both 200 responses, missing 404, author/kind 422, OpenSearch 503 code
`author_document_unavailable`, malformed 500, GET-only, exact operation ID,
response refs, required nullable fields, and stable path. Then run:

```bash
python scripts/export_v2_openapi.py
python scripts/export_v2_openapi.py --check
pytest -q test_lbapi/v2
python -m compileall -q lbapi
git diff --check
git diff --quiet -- lbapi/elasticapi.py lbapi/web.py
```

- [ ] **Step 7: Commit Task 1**

```bash
git add lbapi/v2/author_audio.py lbapi/v2/author_works.py \
  lbapi/v2/models.py lbapi/v2/authors.py \
  test_lbapi/v2/test_author_audio.py \
  test_lbapi/v2/test_author_work_providers.py \
  test_lbapi/v2/test_models.py test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): describe author documents"
```

---

### Task 2: Publish canonical resolution for managed `/forfattare` links

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/models.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/legacy_author_routes.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/app.py`
- Create: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_legacy_author_routes.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`

**Interfaces:**
- Consumes: exact keyword fields `authorid_norm` and `titleid_norm`.
- Produces: `POST /legacy-author-routes/resolve`, operation `v2_post_legacy_author_route_resolve`.

- [ ] **Step 1: Write failing paired model and provider tests**

```python
LegacyMediaType = Literal["etext", "faksimil"]

def validate_legacy_segment(value: str) -> str:
    if (
        value != value.strip() or value in {".", ".."}
        or any(character in value for character in ("%", "/", "\\"))
        or any(unicodedata.category(character) in {"Cc", "Cs"} for character in value)
    ):
        raise ValueError("invalid legacy route segment")
    return value

LegacyNormalizedAuthorId = Annotated[
    str,
    StringConstraints(min_length=1, max_length=100),
    AfterValidator(validate_legacy_segment),
]
LegacyNormalizedTitleId = Annotated[
    str,
    StringConstraints(min_length=1, max_length=200),
    AfterValidator(validate_legacy_segment),
]

class LegacyAuthorRouteRequest(V2Model):
    normalized_author_id: LegacyNormalizedAuthorId
    normalized_title_id: LegacyNormalizedTitleId | None
    media_type: LegacyMediaType | None

    @model_validator(mode="after")
    def validate_title_pair(self):
        if (self.normalized_title_id is None) != (self.media_type is None):
            raise ValueError("title and media type must be supplied together")
        return self

class LegacyAuthorRouteResolution(V2Model):
    author_id: str
    title_id: str | None
```

Assert exact results `SoderbergH -> SöderbergH`, `LagerlofS -> LagerlöfS`, and
`SoderbergH + Forvillelser + etext -> SöderbergH + Förvillelser`. Queries are:

```python
get_documents(
    "author", 0, 2, includes=("authorid", "authorid_norm"),
    show_only=False,
    and_query=Q("term", authorid_norm=normalized_author_id),
)
get_documents(
    media_type, 0, 2, includes=("titleid", "titleid_norm"),
    show_only=False,
    and_query=Q("term", titleid_norm=normalized_title_id),
)
```

Cover no title query when null, missing 404, paired-input 422, unsupported media
422, same canonical duplicate accepted once, distinct duplicate/mismatched/
malformed 500, and either OpenSearch call -> typed 503. Add author lengths
100/101, title lengths 100/101/200/201, whitespace, percent, slash, backslash,
dot, control, DEL/C1, and surrogate boundary cases. Apply the same probes to
provider-returned canonical `authorid`/`titleid`, proving FastAPI rejects them
before publishing a typed response.

- [ ] **Step 2: Run resolver tests RED**

```bash
pytest -q test_lbapi/v2/test_models.py -k legacy_author_route
pytest -q test_lbapi/v2/test_legacy_author_routes.py
```

Expected: missing models/module.

- [ ] **Step 3: Implement and register the isolated router**

Use `APIRouter(tags=["authors"])` and this concrete transform/status boundary:

```python
def one_canonical_value(
    raw: dict[str, Any], normalized_key: str, normalized: str,
    canonical_key: str, maximum: int,
) -> str:
    hits = raw.get("hits")
    rows = raw.get("data")
    if hits == 0 and rows == []:
        raise HTTPException(status_code=404, detail="Legacy route not found")
    if not isinstance(hits, int) or isinstance(hits, bool) or not isinstance(rows, list):
        raise ValueError("Malformed legacy route response")
    values: set[str] = set()
    for row in rows:
        if not isinstance(row, dict) or row.get(normalized_key) != normalized:
            raise ValueError("Malformed legacy route response")
        value = row.get(canonical_key)
        if (
            not isinstance(value, str)
            or not value
            or len(value) > maximum
            or value != value.strip()
            or value in {".", ".."}
            or any(character in value for character in ("%", "/", "\\"))
            or any(
                unicodedata.category(character) in {"Cc", "Cs"}
                for character in value
            )
        ):
            raise ValueError("Malformed legacy route response")
        values.add(value)
    if hits != len(rows) or len(values) != 1:
        raise ValueError("Malformed legacy route response")
    return values.pop()

def transform_legacy_author_route(
    author_raw: dict[str, Any], title_raw: dict[str, Any] | None,
    request: LegacyAuthorRouteRequest,
) -> LegacyAuthorRouteResolution:
    author_id = one_canonical_value(
        author_raw, "authorid_norm", request.normalized_author_id, "authorid", 100
    )
    title_id = None if title_raw is None else one_canonical_value(
        title_raw, "titleid_norm", request.normalized_title_id, "titleid", 200
    )
    return LegacyAuthorRouteResolution(author_id=author_id, title_id=title_id)
```

The POST handler catches either provider's `OpenSearchException` and raises
typed 503 code `legacy_author_route_unavailable`; transform 404 becomes the
typed 404 code `legacy_author_route_not_found`; validation is 422; every
`ValueError` reaches the global redacted 500. Register the router in `app.py`;
do not add a GET path or raw path-string input.

- [ ] **Step 4: Export, verify, and commit Task 2**

```bash
python scripts/export_v2_openapi.py
python scripts/export_v2_openapi.py --check
pytest -q test_lbapi/v2
python -m compileall -q lbapi
git diff --check
git add lbapi/v2/models.py lbapi/v2/legacy_author_routes.py lbapi/v2/app.py \
  test_lbapi/v2/test_models.py test_lbapi/v2/test_legacy_author_routes.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): resolve legacy author routes"
```

---

### Task 3: Generate deterministic descriptor, XHTML, resolver, Reader, and PDF fixtures

**Files:**
- Modify: `nuxt/app/lib/api/generated/lbapi.ts`
- Create: `nuxt/test/fixtures/author-document-data.mjs`
- Create: `nuxt/test/fixtures/author-document-content/SoderbergH-presentation.html`
- Create: `nuxt/test/fixtures/author-document-content/LagerlofS-bibliografi.html`
- Create: `nuxt/test/fixtures/author-document-content/sparse.html`
- Create: `nuxt/test/fixtures/author-document-content/malicious.html`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–2 OpenAPI operations and existing deterministic Reader/PDF assets.
- Produces: realistic optional navigation, exact content/resolver ledgers, usable canonical profile/Reader targets, and deterministic PDF responses.

- [ ] **Step 1: Add failing fixture contracts**

Freeze these exact shells:

```js
export const soderbergPresentation = {
  author_id: "SöderbergH",
  normalized_author_id: "SoderbergH",
  full_name: "Hjalmar Söderberg",
  birth_year: "1869",
  death_year: "1941",
  has_introduction: true,
  has_dramawebben: false,
  search_url: "/sok?forfattare=S%C3%B6derbergH&avancerad",
  audio_url: "https://litteraturbanken.se/ljudochbild/författare/soderbergh",
  document_kind: "presentation",
  source_path: "/red/forfattare/SoderbergH/presentation/index.html"
}

export const lagerlofBibliography = {
  author_id: "LagerlöfS",
  normalized_author_id: "LagerlofS",
  full_name: "Selma Lagerlöf",
  birth_year: "1858",
  death_year: "1940",
  has_introduction: true,
  has_dramawebben: true,
  search_url: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
  audio_url: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs",
  document_kind: "bibliografi",
  source_path: "/red/forfattare/LagerlofS/bibliografi/index.html"
}
```

Add `SparseDocument` with every optional navigation value false/null and a
small valid body. Keep the existing sparse Author Profile authority fixture
unchanged; the document descriptor independently freezes Lagerlöf's real
Dramawebben/search/Ljud values. Add a Söderberg/Förvillelser Reader fixture
sufficient to render canonical page 3 after normalization.

- [ ] **Step 2: Record reproducible XHTML provenance before adding fixtures**

Verify current source bytes:

```bash
curl -fsSL \
  https://red.litteraturbanken.se/red/forfattare/SoderbergH/presentation/index.html \
  | shasum -a 256
# 80bb28b296759b1bc38fc400c6e27ce0ca51bb59e261203e0f901cff00528980

curl -fsSL \
  https://red.litteraturbanken.se/red/forfattare/LagerlofS/bibliografi/index.html \
  | shasum -a 256
# 54d289da89e61225fdfbfc68aed19762614529c06c6f2707ed50a493359d179b
```

Add exactly those response bytes through `apply_patch`. Put both source URLs
and hashes in `author-document-data.mjs` and assert them in fixture unit tests.

- [ ] **Step 3: Add exact fixture controls and PDF boundaries**

Implement/reset independently:

```text
GET|DELETE /_author_document_requests
GET|PUT|DELETE /_author_document_failure
GET|PUT|DELETE /_author_document_delay
GET|DELETE /_legacy_author_route_requests
GET|DELETE /_author_document_pdf_requests
```

Each `/api/v2/authors/.../documents/...` descriptor request and each `/red/...`
content-origin request is recorded with an explicit `kind: "descriptor" |
"content"` discriminator. Zero-content-fetch assertions must filter by this
field rather than treating every author-document ledger entry alike.

Failure values are `descriptor-404`, `descriptor-503`, `content-404`,
`content-503`, `malformed-descriptor`, `unsafe-source-path`, and
`malformed-content`; delay is integer 0–5000. Resolver maps the three exact
normalization cases from Task 2 and returns typed 404 otherwise.

Reuse the checked-in deterministic PDF bytes from
`test/fixtures/presentation-content/Figurdiktensombarockblandkonst.pdf` while
serving:

```text
/red/forfattare/SoderbergH/presentation/SoderbergH_presentation.pdf
  content-type: application/pdf
  content-disposition: attachment; filename="SoderbergH_presentation.pdf"

/red/forfattare/LagerlofS/bibliografi/LagerlofS_bibliografi.pdf
  content-type: application/pdf
  content-disposition: inline; filename="LagerlofS_bibliografi.pdf"
```

Record each exact PDF request; every other author-document asset is rejected.
Extend the fixture response helper with an optional headers object (or add a
dedicated PDF responder) so both `content-type` and `content-disposition` are
actually emitted and asserted without changing existing callers.

- [ ] **Step 4: Run fixture tests RED, generate, implement, and finish GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn vitest run test/unit/v2-server.spec.ts -t 'author document|legacy author route'
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  yarn api:generate
yarn vitest run test/unit/v2-server.spec.ts
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  yarn api:check
yarn typecheck
git diff --check
```

- [ ] **Step 5: Commit Task 3**

```bash
git add nuxt/app/lib/api/generated/lbapi.ts \
  nuxt/test/fixtures/author-document-data.mjs \
  nuxt/test/fixtures/author-document-content \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "test(nuxt): fixture author documents"
```

---

### Task 4: Build the Nitro sanitizer, strict loader, and canonical legacy redirect

**Files:**
- Create: `nuxt/shared/types/author-document.ts`
- Create: `nuxt/server/utils/author-document.ts`
- Create: `nuxt/server/utils/legacy-author-route.ts`
- Create: `nuxt/server/api/author-documents/[author]/[document].get.ts`
- Create: `nuxt/server/middleware/legacy-author-route.ts`
- Create: `nuxt/test/unit/author-document.spec.ts`
- Create: `nuxt/test/unit/legacy-author-route.spec.ts`
- Create: `nuxt/test/ssr/author-documents-api.spec.ts`
- Create: `nuxt/test/ssr/legacy-author-routes.spec.ts`

**Interfaces:**
- Consumes: generated descriptor/resolver, private `apiBase`, private `contentBase`, `linkedom`.
- Produces: `AuthorSupplementalPage`, `/api/author-documents/**`, and exact 307 canonical redirects for `/forfattare/**`.

- [ ] **Step 1: Write failing shared-type, sanitizer, and path-table tests**

```ts
export type AuthorDocumentKind = "presentation" | "bibliografi"
export type AuthorDocumentErrorCode =
  | "author_document_author_not_found"
  | "author_document_not_found"
  | "author_document_unavailable"
export interface AuthorSupplementalAuthor {
  authorId: string
  fullName: string
  lifespan: string
  hasIntroduction: boolean
  hasDramawebben: boolean
  searchUrl: string | null
  audioUrl: string | null
}
export interface AuthorSupplementalPage {
  author: AuthorSupplementalAuthor
  documentKind: AuthorDocumentKind
  bodyHtml: string
}
```

Unit-test `expectedAuthorDocumentSource(descriptor, requestedAuthor, kind)`.
Only this table's first row succeeds; every rejection throws before fetch:

```text
normalized=SoderbergH, kind=presentation,
path=/red/forfattare/SoderbergH/presentation/index.html            ACCEPT
path=//red/forfattare/SoderbergH/presentation/index.html           REJECT
path=https://evil.test/red/...                                     REJECT
path=/red/forfattare/../presentation/index.html                    REJECT
path=/red/forfattare/%2e%2e/presentation/index.html                REJECT
path=/red/forfattare/%252e%252e/presentation/index.html            REJECT
path=/red/forfattare/SoderbergH%2fpresentation/index.html          REJECT
path=/red/forfattare/SoderbergH%5cpresentation/index.html          REJECT
path=/red/forfattare/SoderbergH/presentation/index.html?x=1        REJECT
path=/red/forfattare/SoderbergH/presentation/index.html#x          REJECT
path=/red/forfattare/SoderbergH/bibliografi/index.html             REJECT
path=/red/forfattare/SoderbergH/presentation/extra/index.html      REJECT
path containing control, DEL/C1, malformed %, or wrong author/kind REJECT
```

The pure validator is exactly:

```ts
function validManagedSegment(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1 && value.length <= 100
    && value === value.trim()
    && value !== "." && value !== ".."
    && !/[\\/%\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value)
}

function expectedSourcePath(normalized: string, kind: AuthorDocumentKind) {
  if (!validManagedSegment(normalized)) throw invalidDescriptor()
  return `/red/forfattare/${encodeRfc3986Segment(normalized)}/${kind}/index.html`
}

function invalidDescriptor(): Error {
  return new Error("Invalid author document descriptor")
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}
```

Also reject normalized-segment inputs `../private`, `%2e%2e`,
`SoderbergH/presentation`, `SoderbergH\\presentation`, leading/trailing
whitespace, controls, a lone surrogate, and 101 characters, regardless of the
supplied path.

- [ ] **Step 2: Write failing complete sanitizer tests**

Test both authority documents plus malicious XHTML. The implementation owns
these exact sets:

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
const globalAttributes = new Set(["class", "id", "lang", "title"])
const elementAttributes: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "target", "rel", "name", "download"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan", "headers"]),
  th: new Set(["colspan", "rowspan", "headers", "scope"]),
  col: new Set(["span"]), colgroup: new Set(["span"]),
  ol: new Set(["start", "reversed", "type"]),
  li: new Set(["value"])
}
```

`fullyDecode` makes at most 16 passes and returns null on decode failure or
non-stabilization. `safeUrl(value, "href" | "src")` rejects trim changes,
controls, backslash, protocol-relative, decoded `.`/`..` path segments, and
schemes outside `http/https/mailto/tel` for href or `https` for src. Fragments
are href-only. Relative/root-relative values remain unchanged, including safe
`/forfattare/**`; do not rewrite its prefix. `_blank` gets both rel tokens.
Removed-subtree elements are deleted; unknown benign elements are replaced by
their sanitized children. Comments are removed. Require exactly one parsed
body and return `body.innerHTML`; missing/multiple/malformed bodies throw
`InvalidAuthorDocumentSource`.

```ts
export function parseAuthorDocumentBody(source: string): string {
  const { document } = parseHTML(source)
  const bodies = [...document.querySelectorAll("body")]
  if (bodies.length !== 1) throw new InvalidAuthorDocumentSource()
  const body = bodies[0]!
  for (const child of [...body.childNodes]) sanitizeNode(child)
  return body.innerHTML
}
```

Assert idempotence, no raw malicious marker in output, PDF/download/target
preservation, and `href="/forfattare/SoderbergH/.../Forvillelser/..."` remains
byte-identical for the redirect boundary.

- [ ] **Step 3: Run sanitizer/path tests RED**

```bash
yarn vitest run test/unit/author-document.spec.ts
```

Expected: module import failure.

- [ ] **Step 4: Write failing endpoint tests and implement the complete loader**

Use this local error constructor and translation:

```ts
type AuthorDocumentErrorCode =
  | "author_document_author_not_found"
  | "author_document_not_found"
  | "author_document_unavailable"

function documentError(statusCode: 404 | 502, code: AuthorDocumentErrorCode): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? "Not Found" : "Bad Gateway",
    data: { code }
  })
}

function fetchStatus(error: unknown): number | null {
  if (!isRecord(error)) return null
  if (isRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status
  }
  if (typeof error.statusCode === "number") return error.statusCode
  if (typeof error.status === "number") return error.status
  return null
}

function formatYears(birth: string | null, death: string | null): string {
  const left = birth && birth !== "0000" ? birth : ""
  const right = death && death !== "0000" ? death : ""
  if (left && right) return `${left}-${right}`
  if (left) return `f. ${left}`
  if (right) return `d. ${right}`
  return ""
}

function isAuthorDocumentDescriptor(value: unknown): value is AuthorDocumentDescriptor {
  if (!isRecord(value)) return false
  return typeof value.author_id === "string"
    && typeof value.normalized_author_id === "string"
    && typeof value.full_name === "string" && value.full_name.length > 0
    && (value.birth_year === null || typeof value.birth_year === "string")
    && (value.death_year === null || typeof value.death_year === "string")
    && typeof value.has_introduction === "boolean"
    && typeof value.has_dramawebben === "boolean"
    && (value.search_url === null || typeof value.search_url === "string")
    && (value.audio_url === null || typeof value.audio_url === "string")
    && (value.document_kind === "presentation" || value.document_kind === "bibliografi")
    && typeof value.source_path === "string"
}

function descriptorLinksAreExact(value: AuthorDocumentDescriptor): boolean {
  try {
    const expectedSearch =
      `/sok?forfattare=${encodeRfc3986Segment(value.author_id)}&avancerad`
    const expectedAudio =
      "https://litteraturbanken.se/ljudochbild/författare/"
      + encodeRfc3986Segment(value.normalized_author_id.toLowerCase())
    return (value.search_url === null || value.search_url === expectedSearch)
      && (value.audio_url === null || value.audio_url === expectedAudio)
  } catch {
    return false
  }
}

export async function loadAuthorDocument(
  event: H3Event,
  requestedAuthor: string,
  requestedKind: AuthorDocumentKind
): Promise<AuthorSupplementalPage> {
  const config = useRuntimeConfig(event)
  const client = createLbApiClient(config.apiBase)
  let result
  try {
    result = await client.GET("/authors/{author_id}/documents/{document_kind}", {
      params: { path: {
        author_id: requestedAuthor,
        document_kind: requestedKind
      } }
    })
  } catch {
    return documentError(502, "author_document_unavailable")
  }
  if (result.response.status === 404) {
    return documentError(404, "author_document_author_not_found")
  }
  if (result.response.status !== 200 || !isAuthorDocumentDescriptor(result.data)
      || !descriptorLinksAreExact(result.data)) {
    return documentError(502, "author_document_unavailable")
  }
  const descriptor = result.data
  if (descriptor.author_id !== requestedAuthor
      || descriptor.document_kind !== requestedKind) {
    return documentError(502, "author_document_unavailable")
  }
  let expected: string
  try {
    expected = expectedSourcePath(descriptor.normalized_author_id, requestedKind)
  } catch {
    return documentError(502, "author_document_unavailable")
  }
  if (descriptor.source_path !== expected) {
    return documentError(502, "author_document_unavailable")
  }
  let source: string
  try {
    source = await $fetch<string>(
      `${config.contentBase.replace(/\/$/u, "")}${expected}`,
      { responseType: "text", retry: 0 }
    )
  } catch (error) {
    if (fetchStatus(error) === 404) {
      return documentError(404, "author_document_not_found")
    }
    return documentError(502, "author_document_unavailable")
  }
  let bodyHtml: string
  try { bodyHtml = parseAuthorDocumentBody(source) }
  catch { return documentError(502, "author_document_unavailable") }
  return {
    author: {
      authorId: descriptor.author_id,
      fullName: descriptor.full_name,
      lifespan: formatYears(descriptor.birth_year, descriptor.death_year),
      hasIntroduction: descriptor.has_introduction,
      hasDramawebben: descriptor.has_dramawebben,
      searchUrl: descriptor.search_url,
      audioUrl: descriptor.audio_url
    },
    documentKind: descriptor.document_kind,
    bodyHtml
  }
}
```

The thin handler validates params, sets `cache-control: no-store`, and calls the
loader. Endpoint tests cover both 200s, all three local errors, every status
translation, malformed bodies, identity mismatch, and the full source-path
table. Before each unsafe-path assertion clear the content ledger; afterward
assert it is still empty. Malformed descriptor cases include `javascript:`,
`//evil.test`, wrong HTTPS host/path, wrong author/slug, controls, malformed
percent encoding, and lone surrogates in each link-bearing/source identity;
all return 502 with no link-bearing payload.

- [ ] **Step 5: Write failing middleware tests and implement canonical redirect**

Pure parsing accepts only safe decoded segments and recognizes title resolution
only for the exact Reader shape. Implement these helpers in full:

```ts
type LegacyReaderMatch = {
  title: string
  mediaType: "etext" | "faksimil"
}

function decodeStable(raw: string, maximum: number): string {
  let value = raw
  for (let pass = 0; pass < 16; pass += 1) {
    let next: string
    try { next = decodeURIComponent(value) }
    catch { throw legacyRouteError(404, "legacy_author_route_not_found") }
    if (next.length > maximum) {
      throw legacyRouteError(404, "legacy_author_route_not_found")
    }
    if (next === value) return value
    value = next
  }
  throw legacyRouteError(404, "legacy_author_route_not_found")
}

export function decodeAndValidatePathSegments(pathname: string): string[] {
  if (!pathname.startsWith("/forfattare/")) return []
  const raw = pathname.slice(1).split("/")
  if (raw.length < 2 || raw.some(segment => segment.length === 0)) {
    throw legacyRouteError(404, "legacy_author_route_not_found")
  }
  const decoded = raw.map(segment => decodeStable(segment, 512))
  const readerShape = decoded.length === 7
    && decoded[0] === "forfattare" && decoded[2] === "titlar"
    && decoded[4] === "sida"
    && ["etext", "faksimil"].includes(decoded[6] ?? "")
  return decoded.map((segment, index) => {
    const maximum = index === 1 ? 100
      : readerShape && index === 3 ? 200 : 512
    if (segment.length > maximum || segment === "." || segment === ".."
        || segment !== segment.trim()
        || /[\\/%\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(segment)) {
      throw legacyRouteError(404, "legacy_author_route_not_found")
    }
    return segment
  })
}

export function matchLegacyReaderSegments(segments: string[]): LegacyReaderMatch | null {
  if (segments.length !== 7 || segments[0] !== "forfattare"
      || segments[2] !== "titlar" || segments[4] !== "sida"
      || !["etext", "faksimil"].includes(segments[6] ?? "")) return null
  return {
    title: segments[3]!,
    mediaType: segments[6] as "etext" | "faksimil"
  }
}

export async function resolveLegacyAuthorRoutePrivately(
  event: H3Event,
  request: LegacyAuthorRouteRequest
): Promise<LegacyAuthorRouteResolution> {
  const client = createLbApiClient(useRuntimeConfig(event).apiBase)
  let result
  try {
    result = await client.POST("/legacy-author-routes/resolve", { body: request })
  } catch {
    throw legacyRouteError(502, "legacy_author_route_unavailable")
  }
  if (result.response.status === 404) {
    throw legacyRouteError(404, "legacy_author_route_not_found")
  }
  const value = result.data
  if (result.response.status !== 200 || !isRecord(value)
      || !validCanonicalSegment(value.author_id, 100)
      || ((request.normalized_title_id === null) !== (value.title_id === null))
      || (value.title_id !== null && !validCanonicalSegment(value.title_id, 200))) {
    throw legacyRouteError(502, "legacy_author_route_unavailable")
  }
  return { author_id: value.author_id, title_id: value.title_id }
}

function rawRequestSearch(event: H3Event): string {
  const raw = event.node.req.url ?? ""
  const queryAt = raw.indexOf("?")
  return queryAt < 0 ? "" : raw.slice(queryAt)
}

if (!["GET", "HEAD"].includes(event.method)) return
const pathname = getRequestURL(event).pathname
if (!pathname.startsWith("/forfattare/")) return
const segments = decodeAndValidatePathSegments(pathname)
const reader = matchLegacyReaderSegments(segments)
const resolution = await resolveLegacyAuthorRoutePrivately(event, {
  normalized_author_id: segments[1]!,
  normalized_title_id: reader?.title ?? null,
  media_type: reader?.mediaType ?? null
})
segments[0] = "författare"
segments[1] = resolution.author_id
if (reader && resolution.title_id) segments[3] = resolution.title_id
let canonical: string
try {
  canonical = `/${segments.map(encodeRfc3986Segment).join("/")}${rawRequestSearch(event)}`
} catch {
  throw legacyRouteError(502, "legacy_author_route_unavailable")
}
return sendRedirect(event, canonical, 307)
```

`validCanonicalSegment(value, maximum)` applies the same no-trim, percent,
separator, dot, control, DEL/C1, surrogate, and exact maximum rules.
`legacyRouteError` emits only 404 `legacy_author_route_not_found` or 502
`legacy_author_route_unavailable`.

Assert exact Location/query for Lagerlof profile and Söderberg/Förvillelser
Reader; author 100/101 and title 100/101/200/201 limits; unsupported safe suffix
author-only resolution; single/double-encoded slash, traversal, malformed
percent, control, and surrogate rejection; 404, malformed 200, and 503 mapping;
GET/HEAD only; no `/författare` loop; byte-exact duplicate/ordered raw query;
and one private resolver request. Then follow redirects and assert rendered
Selma profile and Förvillelser Reader text, not only URL changes.

- [ ] **Step 6: Run GREEN and commit Task 4**

```bash
yarn vitest run test/unit/author-document.spec.ts \
  test/unit/legacy-author-route.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3141 \
  yarn playwright test test/ssr/author-documents-api.spec.ts \
  test/ssr/legacy-author-routes.spec.ts --project=ssr
yarn typecheck
git diff --check
git add nuxt/shared/types/author-document.ts \
  nuxt/server/utils/author-document.ts nuxt/server/utils/legacy-author-route.ts \
  'nuxt/server/api/author-documents/[author]/[document].get.ts' \
  nuxt/server/middleware/legacy-author-route.ts \
  nuxt/test/unit/author-document.spec.ts \
  nuxt/test/unit/legacy-author-route.spec.ts \
  nuxt/test/ssr/author-documents-api.spec.ts \
  nuxt/test/ssr/legacy-author-routes.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): proxy author documents"
```

---

### Task 5: Render, compare, and close both pages

**Files:**
- Create: `nuxt/app/pages/författare/[author]/[document].vue`
- Create: `nuxt/test/ssr/author-documents.spec.ts`
- Create: `nuxt/test/e2e/author-documents.behavior.spec.ts`
- Create: `nuxt/test/e2e/author-documents.visual.spec.ts`
- Create: `nuxt/test/visual/capture-author-documents-angular.spec.ts`
- Create: `nuxt/playwright.author-documents-angular.config.ts`
- Create: `nuxt/test/visual/baselines/author-document-presentation-desktop.png`
- Create: `nuxt/test/visual/baselines/author-document-presentation-mobile.png`
- Create: `nuxt/test/visual/baselines/author-document-bibliografi-desktop.png`
- Create: `nuxt/test/visual/baselines/author-document-bibliografi-mobile.png`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: Task 4 page payload and canonical redirect.
- Produces: both public routes with exact SSR/SPA/history/loading/error/PDF/visual behavior.

- [ ] **Step 1: Capture deterministic Angular authority**

Use the same frozen XHTML, exact author shells, Ljud-present WordPress responses,
and PDF URLs for:

```ts
const cases = [
  ["presentation", "/författare/S%C3%B6derbergH/presentation",
   "/red/forfattare/SoderbergH/presentation/index.html"],
  ["bibliografi", "/författare/Lagerl%C3%B6fS/bibliografi",
   "/red/forfattare/LagerlofS/bibliografi/index.html"]
] as const
```

Assert author/list, ten work, audio, map, one XHTML, bootstrap/background/font,
and zero unknown/production requests. Wait for exact body text, Ljud nav, fonts,
background, hidden preloader, and zero console/page errors. Capture desktop and
iPhone 13 baselines:

```bash
yarn playwright test test/visual/capture-author-documents-angular.spec.ts \
  --config=playwright.author-documents-angular.config.ts
```

The dedicated config starts the local Angular authority server on port 9000,
mirroring `playwright.author-works-angular.config.ts`; it must never default to
or silently fall back to the production site. The capture asserts the configured
base URL is local before any request is made.

- [ ] **Step 2: Write failing SSR/page-copy/navigation tests**

For Söderberg assert links exactly `[Introduktion, Verk, Ljud, Sök i texterna]`.
For Lagerlöf assert `[Introduktion, Verk, Ljud, Dramawebben, Sök i texterna]`.
For SparseDocument assert only `Verk`. Assert Ljud's absolute href, `_blank`,
position, exact title/description/background/body classes, heading/lifespan,
no supplemental current tab, managed body structure, preserved `/forfattare`
href, PDF attributes, one private descriptor/content request, sanitized payload,
and no hydration duplicate.

Error assertions use exactly:

```text
author 404: Ett fel har inträffat: författarid {author} kan inte hittas. Kontrollera adressen.
document 404: Ett fel har inträffat: dokumentet kan inte hittas. Kontrollera adressen.
502: Ett fel har inträffat. Författardokumentet kan inte visas just nu.
```

- [ ] **Step 3: Write failing browser, canonical-link, PDF, and visual tests**

Cover direct hydration, presentation <-> bibliography router transitions,
preloader/latest-wins/stale cleanup, history, 404/502 recovery, and zero console/
escape errors. Click the actual normalized Förvillelser link, follow 307, and
assert canonical Reader heading/body. Directly follow `/forfattare/LagerlofS`
and assert the rendered Selma profile.

For PDFs:

```ts
const downloadPromise = page.waitForEvent("download")
await page.locator('a[href$="SoderbergH_presentation.pdf"]').click()
const download = await downloadPromise
expect(download.suggestedFilename()).toBe("SoderbergH_presentation.pdf")

const popupPromise = page.context().waitForEvent("page")
await page.locator('a[href$="LagerlofS_bibliografi.pdf"]').click()
const popup = await popupPromise
await popup.waitForLoadState("domcontentloaded")
expect(new URL(popup.url()).pathname)
  .toBe("/red/forfattare/LagerlofS/bibliografi/LagerlofS_bibliografi.pdf")
```

Assert fixture-unit coverage proves both PDF responses are status 200 with
`application/pdf` and the stated dispositions. Assert the browser PDF ledger
contains each exact path once and no other asset. Visual
comparisons use threshold `0.1`, `maxDiffPixels: 100`, full-page CSS scale, and
the four named baselines.

- [ ] **Step 4: Run page suites RED**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3143 \
  yarn playwright test test/ssr/author-documents.spec.ts --project=ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3145 \
  yarn playwright test test/e2e/author-documents.behavior.spec.ts \
  --project=desktop-chromium
```

Expected: public routes 404 and no author-document shell.

- [ ] **Step 5: Implement complete `loadPageResult` and route-keyed page**

```ts
type PageResult = {
  identity: string
  status: 200 | 404 | 502
  errorCode: AuthorDocumentErrorCode | null
  page: AuthorSupplementalPage | null
}

function isAuthorSupplementalPage(value: unknown): value is AuthorSupplementalPage {
  if (!isRecord(value) || !isRecord(value.author)) return false
  const author = value.author
  return typeof author.authorId === "string"
    && typeof author.fullName === "string"
    && typeof author.lifespan === "string"
    && typeof author.hasIntroduction === "boolean"
    && typeof author.hasDramawebben === "boolean"
    && (author.searchUrl === null || typeof author.searchUrl === "string")
    && (author.audioUrl === null || typeof author.audioUrl === "string")
    && (value.documentKind === "presentation" || value.documentKind === "bibliografi")
    && typeof value.bodyHtml === "string"
}

function localCode(error: unknown): AuthorDocumentErrorCode | null {
  if (!isRecord(error) || !isRecord(error.data)) return null
  const nested = error.data.data
  if (!isRecord(nested) || typeof nested.code !== "string") return null
  return [
    "author_document_author_not_found",
    "author_document_not_found",
    "author_document_unavailable"
  ].includes(nested.code) ? nested.code as AuthorDocumentErrorCode : null
}

async function loadPageResult(
  fetcher: typeof $fetch,
  author: string,
  kind: AuthorDocumentKind,
  identity: string
): Promise<PageResult> {
  try {
    const page = await fetcher<AuthorSupplementalPage>(
      `/api/author-documents/${encodeRfc3986Segment(author)}/${kind}`,
      { retry: 0 }
    )
    if (!isAuthorSupplementalPage(page)
        || page.author.authorId !== author
        || page.documentKind !== kind) {
      return { identity, status: 502,
        errorCode: "author_document_unavailable", page: null }
    }
    return { identity, status: 200, errorCode: null, page }
  } catch (error) {
    const code = localCode(error)
    if (code === "author_document_author_not_found"
        || code === "author_document_not_found") {
      return { identity, status: 404, errorCode: code, page: null }
    }
    return { identity, status: 502,
      errorCode: "author_document_unavailable", page: null }
  }
}
```

Add a regression where the structural segment is encoded as `%74itlar` and a
201-character title is rejected locally with 404 before any FastAPI call. This
proves the 200-character title limit is selected from fully decoded structure,
not from attacker-controlled raw spelling.

Use `useRequestFetch`, route-keyed lazy `useAsyncData`, payload cache identity,
and synchronous accepted clearing exactly like Author Works. SSR calls
`setResponseStatus(accepted.status)`. Render heading/navigation in the Angular
order, Ljud as `_blank`, and `.page_content > .content.unbox` with sanitized
`v-html`; render the exact three error strings above.

- [ ] **Step 6: Run focused GREEN and adjacent regressions**

```bash
yarn vitest run test/unit/author-document.spec.ts \
  test/unit/legacy-author-route.spec.ts test/unit/author-profile.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3143 \
  yarn playwright test test/ssr/author-documents-api.spec.ts \
  test/ssr/legacy-author-routes.spec.ts test/ssr/author-documents.spec.ts \
  test/ssr/author-profiles.spec.ts test/ssr/author-works.spec.ts --project=ssr
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3145 \
  yarn playwright test test/e2e/author-documents.behavior.spec.ts \
  test/e2e/author-profiles.behavior.spec.ts \
  test/e2e/author-works.behavior.spec.ts --project=desktop-chromium
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3147 \
  yarn playwright test test/e2e/author-documents.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

- [ ] **Step 7: Run complete closure and commit Task 5**

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

cd /Users/johan/.codex/worktrees/8c5c/littb
git add 'nuxt/app/pages/författare/[author]/[document].vue' \
  nuxt/test/ssr/author-documents.spec.ts \
  nuxt/test/e2e/author-documents.behavior.spec.ts \
  nuxt/test/e2e/author-documents.visual.spec.ts \
  nuxt/test/visual/capture-author-documents-angular.spec.ts \
  nuxt/playwright.author-documents-angular.config.ts \
  nuxt/test/visual/baselines/author-document-*.png \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): render author documents"
```

Expected: every command exits 0, both real local routes render fetched managed
content, normalized links reach canonical usable pages, both PDF variants stay
inside the deterministic boundary, and the user's existing frontend dev server
is not stopped.
