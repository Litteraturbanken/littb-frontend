# Nuxt Library Filter Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore typed, safe, and visually unchanged Library author counts, lifespan display, EPUB/PDF tab counts, and relevance highlights for filtered searches.

**Architecture:** FastAPI normalizes index sentinels, applies the legacy author-name/pseudonym predicate, and converts OpenSearch highlight HTML into structured text/hit segments. Nuxt consumes regenerated types, loads one initial summary payload for SSR, refreshes summaries under one filter identity after hydration, and renders hits without `v-html`.

**Tech Stack:** Python 3, FastAPI, Pydantic v2, OpenSearch, Ruff, mypy, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright.

## Global Constraints

- Work on the current frontend and backend branches; do not create or switch branches.
- Do not deploy backend or frontend until the user explicitly asks.
- Preserve the Angular/red site's visual appearance and copy.
- Keep `nedladdning=1` as the separate bulk/source-export workflow.
- EPUB and PDF remain ordinary `/bibliotek` tabs and do not require `nedladdning`.
- Keep page-local fetch ownership in `pages/bibliotek.vue`; do not create a one-page composable.
- Do not render backend HTML with `v-html`.
- Treat OpenSearch year `0` as unknown and expose only positive integers or `null`.
- Observe every new test fail for the intended reason before implementation.

---

### Task 1: Define positive lifespans and structured highlights

**Files:**
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_models.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/library_models.py`

**Interfaces:**
- Consumes: `V2Model` and the existing discriminated `LibraryAllResult` union.
- Produces: `LibraryHighlightSegment`, `LibraryHighlightFragment`, `highlights` on every all-mode item, and positive-or-null all-mode author years.

- [ ] **Step 1: Write failing model tests**

Add imports for `LibraryAllAuthorItem` and `LibraryHighlightFragment`, then add:

```python
def test_library_all_author_years_are_positive_or_null() -> None:
    item = LibraryAllAuthorItem.model_validate(
        {
            "kind": "author",
            "author_id": "AuthorA",
            "name_for_index": "Author, Anna",
            "popularity": 1,
            "birth_year": None,
            "death_year": 1901,
            "highlights": [],
        },
    )
    assert item.death_year == 1901
    with pytest.raises(ValidationError):
        LibraryAllAuthorItem.model_validate({**item.model_dump(), "birth_year": 0})


def test_library_highlight_fragment_is_closed() -> None:
    fragment = LibraryHighlightFragment.model_validate(
        {"segments": [
            {"text": "August ", "hit": False},
            {"text": "Strindberg", "hit": True},
        ]},
    )
    assert fragment.segments[1].hit is True
    with pytest.raises(ValidationError):
        LibraryHighlightFragment.model_validate(
            {"segments": [{"text": "x", "hit": True, "html": "<script>"}]},
        )
```

- [ ] **Step 2: Verify the tests fail**

Run: `virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_models.py -k 'positive_or_null or highlight_fragment'`

Expected: FAIL because the highlight models do not exist and zero is allowed.

- [ ] **Step 3: Implement the closed models**

Add to `library_models.py`:

```python
LibraryHighlightText = Annotated[str, Field(min_length=1, max_length=2_000)]


class LibraryHighlightSegment(V2Model):
    text: LibraryHighlightText
    hit: bool


class LibraryHighlightFragment(V2Model):
    segments: list[LibraryHighlightSegment] = Field(min_length=1, max_length=100)
```

Add the required field `highlights: list[LibraryHighlightFragment] = Field(max_length=24)` to `LibraryAllTextItem`, `LibraryAllPdfItem`, `LibraryAllAuthorItem`, and `LibraryAllExternalItem`. Requiring the field keeps generated TypeScript statically precise; the provider always supplies `[]` when OpenSearch has no fragments. Change both `LibraryAllAuthorItem` year fields to `Field(ge=1)`.

- [ ] **Step 4: Run the model suite**

Run: `virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_models.py`

Expected: PASS after exact expected dumps include `"highlights": []`.

- [ ] **Step 5: Commit**

```bash
git add lbapi/v2/library_models.py test_lbapi/v2/test_library_models.py
git commit -m "feat: type library relevance highlights"
```

### Task 2: Preserve and safely segment OpenSearch highlights

**Files:**
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_provider.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/library_provider.py`

**Interfaces:**
- Consumes: mapping and OpenSearch-object envelopes with per-hit `highlight` metadata.
- Produces: `_SearchRow(index, source, highlight)` and `_highlight_fragments(index, highlight) -> list[LibraryHighlightFragment]`.

- [ ] **Step 1: Add failing provider cases**

Extend `SearchMeta`, `SearchHit`, and `raw_search_response` so an optional third row value becomes `hit.meta.highlight`. Add an author case containing:

```python
{
    "intro": [
        "<p>AUGUST <em class='hit'>STRINDBERG</em></p>",
        "<img src=x onerror=alert(1)>safe",
    ],
    "ignored": ["<em class='hit'>do not expose</em>"],
}
```

Assert the result exposes only:

```python
[
    {"segments": [
        {"text": "AUGUST ", "hit": False},
        {"text": "STRINDBERG", "hit": True},
    ]},
    {"segments": [{"text": "safe", "hit": False}]},
]
```

Add a text-item case proving `workintro`, title fallbacks, and part-title fallbacks preserve legacy order. Add a mapping-envelope case proving raw `hit["highlight"]` works too. Include an author with birth/death plain value `"0"` and expect both output years to be `None`.

- [ ] **Step 2: Verify provider tests fail**

Run: `virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_provider.py -k 'highlight or zero_year'`

Expected: FAIL because metadata is discarded and zero survives.

- [ ] **Step 3: Introduce the internal row and parser**

In `library_provider.py`, define:

```python
@dataclass(frozen=True)
class _SearchRow:
    index: str
    source: Mapping[object, object]
    highlight: Mapping[object, object] | None
```

Return `_SearchRow` objects from `_search_mapping_envelope` and `_search_object_envelope`; update every row loop to use `.index` and `.source`. Invalid highlight metadata becomes `None` without invalidating its result row.

Implement an `HTMLParser` that treats only `<em class="hit">` as a hit boundary, ignores all tags/attributes, retains character data, collapses whitespace, merges adjacent equal-hit segments, trims outer whitespace, and discards empty fragments. Use these field groups:

```python
_HIGHLIGHT_FIELDS = {
    "author": (("intro",),),
    "presentations": (("content",),),
    "sol": (("article.ArticleText",),),
    "litteraturkartan": (("free_text",),),
    "wordpress": (("content",),),
    "text": (
        ("workintro",),
        ("title", "title.search", "title_modernized", "title_modernized.search"),
        ("parts.title", "parts.title_modernized"),
    ),
}
```

Apply `"text"` to `etext`, `faksimil`, both part indices, and `pdf`. Prefer `title`; when it is absent include every present title fallback in order. Prefer `parts.title` over `parts.title_modernized`. Cap output at 24 fragments and 100 segments per fragment.

- [ ] **Step 4: Normalize zero and attach fragments**

Add:

```python
def _positive_provider_integer(value: object) -> int | None:
    parsed = _provider_integer(_plain_label(value), default=None)
    return parsed if parsed is not None and parsed > 0 else None
```

Use it for all-mode author birth/death. Pass selected fragments into every `_normalize_all_row` result, including external kinds.

- [ ] **Step 5: Run tests and static checks**

Run: `virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_models.py test_lbapi/v2/test_library_provider.py`

Run: `virtual_env/bin/python -m ruff check lbapi/v2/library_models.py lbapi/v2/library_provider.py test_lbapi/v2/test_library_models.py test_lbapi/v2/test_library_provider.py`

Run: `virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lbapi/v2/library_provider.py test_lbapi/v2/test_library_provider.py
git commit -m "fix: preserve safe library search highlights"
```

### Task 3: Match the legacy author-name and pseudonym predicate

**Files:**
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_provider.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/library_provider.py`

**Interfaces:**
- Consumes: eligible author IDs from matching Works/Parts and joined author documents.
- Produces: `_author_matches_query(source, query) -> bool`; filtered `total_authors`.

- [ ] **Step 1: Write failing author semantics tests**

Create seven required author documents whose full name or pseudonym contains `Strindberg`, plus unrelated eligible authors. Assert `filters={"query": "strindberg"}` returns and counts exactly seven. Add cases proving pseudonym matching, `Sören`/`Søren` folding, normalized punctuation, any-token matching for a multi-token query, and an empty query retaining the complete eligible union.

- [ ] **Step 2: Verify the tests fail**

Run: `virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_provider.py -k 'author_search and (query or pseudonym or folding)'`

Expected: FAIL with the pre-filter eligible count.

- [ ] **Step 3: Implement the predicate before sorting/limiting**

Add:

```python
def _scandinavian_fold(value: str) -> str:
    return value.casefold().replace("æ", "ä").replace("ø", "ö")


def _author_query_tokens(query: str) -> tuple[str, ...]:
    return tuple(token for token in query.split(" ") if token)
```

Build searchable text from `full_name` or `name_for_index` plus valid pseudonym `full_name` values. For each token require both the project's normalized-author comparison and Scandinavian-folded comparison, reproducing Angular `checkForName`; retain an author when any token matches. Validate missing/duplicate required IDs before this content filter. Calculate `total_authors`, sort, and limit after filtering.

- [ ] **Step 4: Run and commit**

Run: `virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_provider.py -k 'author_search'`

Expected: PASS.

```bash
git add lbapi/v2/library_provider.py test_lbapi/v2/test_library_provider.py
git commit -m "fix: match legacy filtered author semantics"
```

### Task 4: Regenerate the end-to-end contract

**Files:**
- Modify: `/Users/johan/dev/lb-backend/openapi/v2.json`
- Modify: `nuxt/app/lib/api/generated/lbapi.ts`
- Modify: `nuxt/test/nuxt/library-contract.ts`
- Modify: `nuxt/test/unit/library-contract.spec.ts`

**Interfaces:**
- Consumes: backend highlight schema.
- Produces: generated `LibraryHighlightFragment`/`LibraryHighlightSegment` TypeScript types.

- [ ] **Step 1: Add a failing compile-time fixture**

Construct an all-mode item in `library-contract.ts` with:

```ts
highlights: [{ segments: [
  { text: "August ", hit: false },
  { text: "Strindberg", hit: true }
] }]
```

- [ ] **Step 2: Verify generated drift**

Run from the frontend root: `invoke codegen.check`

Expected: FAIL because the snapshot/client lack highlights.

- [ ] **Step 3: Regenerate and compile**

Run: `invoke codegen`

Run: `invoke codegen.check`

Run from `nuxt`: `yarn tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --strict test/nuxt/library-contract.ts`

Expected: PASS.

- [ ] **Step 4: Commit generated files in each repository**

Backend:

```bash
git add openapi/v2.json
git commit -m "chore: publish library highlight contract"
```

Frontend:

```bash
git add nuxt/app/lib/api/generated/lbapi.ts nuxt/test/nuxt/library-contract.ts nuxt/test/unit/library-contract.spec.ts
git commit -m "chore: regenerate library api types"
```

### Task 5: Map and render highlights without raw HTML

**Files:**
- Modify: `nuxt/test/unit/library-contract.spec.ts`
- Modify: `nuxt/app/lib/library/view-model.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/ssr/library.spec.ts`

**Interfaces:**
- Consumes: generated `LibraryHighlightFragment[]`.
- Produces: `LibraryResult.highlights`, `data-library-highlight`, and `data-library-highlight-hit`.

- [ ] **Step 1: Write failing mapping and SSR tests**

Assert `toLibrarySearchView` maps segments without a cast. Feed runtime zero years through a defensive test cast and assert blank `yearLabel`/`mobileYearLabel`; assert `1849` plus unknown death becomes `1849–`. Add fixture highlights and SSR assertions for three fragment markers, one hit containing `Strindberg`, and no raw script/image markup.

- [ ] **Step 2: Verify tests fail**

Run: `cd nuxt && yarn vitest run test/unit/library-contract.spec.ts`

Run: `cd nuxt && yarn playwright test test/ssr/library.spec.ts --project=ssr -g "highlight"`

Expected: FAIL because `LibraryResult` lacks highlights and the template renders none.

- [ ] **Step 3: Implement typed mapping and defensive years**

Add:

```ts
export type LibraryHighlightFragment =
  components["schemas"]["LibraryHighlightFragment"]

const knownYear = (value: number | null): string => (
  typeof value === "number" && value > 0 ? String(value) : ""
)
```

Add `highlights: LibraryHighlightFragment[]` to `LibraryResult`, initialize it to `[]` in `baseResult`, and assign `item.highlights` in every all-item branch.

- [ ] **Step 4: Render interpolated segments**

After the main result link, render:

```vue
<ul v-if="item.highlights.length" class="list-none p-0 m-0">
  <li
    v-for="(fragment, fragmentIndex) in item.highlights"
    :key="fragmentIndex"
    data-library-highlight
    class="text-xs relative z-10"
  >
    {{ "”… " }}<template
      v-for="(segment, segmentIndex) in fragment.segments"
      :key="segmentIndex"
    ><em
      v-if="segment.hit"
      data-library-highlight-hit
      class="hit"
    >{{ segment.text }}</em><template v-else>{{ segment.text }}</template></template>{{ " …”" }}
  </li>
</ul>
```

Use existing legacy classes and add only the minimal scoped selector needed for equivalent spacing. Do not add `v-html`.

- [ ] **Step 5: Run focused checks**

Run: `cd nuxt && yarn vitest run test/unit/library-contract.spec.ts`

Run: `cd nuxt && yarn playwright test test/ssr/library.spec.ts --project=ssr`

Run: `cd nuxt && yarn lint && yarn typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add nuxt/app/lib/library/view-model.ts nuxt/app/pages/bibliotek.vue nuxt/test/fixtures/v2-server.mjs nuxt/test/ssr/library.spec.ts nuxt/test/unit/library-contract.spec.ts
git commit -m "fix: render typed library relevance highlights"
```

### Task 6: Load ordinary tab summaries under one filter identity

**Files:**
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Modify: `nuxt/test/ssr/library.spec.ts`
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`

**Interfaces:**
- Consumes: `fetchLibraryPageData`, `fetchLibraryCount`, and the complete `(filter, advancedFilters)` identity.
- Produces: `LibrarySummary` and `refreshLibrarySummary` for Authors/Works/Parts/EPUB/PDF.

- [ ] **Step 1: Add exact Strindberg fixture data**

For `query === "strindberg"`, return Authors `7`, Works `465`, Parts `1039`, EPUB `136`, PDF `265`, seven author rows including one null/null lifespan, and at least one EPUB/PDF row.

- [ ] **Step 2: Write failing SSR/browser tests**

For `/bibliotek?filter=strindberg`, expect `Författare: 7`, `Verk: 465`, `Dikt, novell, etc.: 1039`, `Epub: 136`, and `PDF: 265`. Click EPUB and PDF without `nedladdning` and assert rows. Click Authors and assert seven rows with no `0–0` or `0–`. Assert the request ledger contains:

```ts
{ mode: "authors", filters, sort: "popularity", reverse: false, limit: 150 }
{ mode: "works", filters }
{ mode: "parts", filters }
{ mode: "epub", filters }
{ mode: "pdf", filters }
```

- [ ] **Step 3: Verify tests fail**

Run: `cd nuxt && yarn playwright test test/ssr/library.spec.ts --project=ssr -g "Strindberg"`

Run: `cd nuxt && yarn playwright test test/e2e/library.behavior.spec.ts --project=chromium -g "Strindberg"`

Expected: FAIL with the wrong Authors count and absent format counts.

- [ ] **Step 4: Implement one summary owner**

Replace inferred author counts and ordinary inactive-download state with:

```ts
type LibrarySummary = {
  identity: string
  authors: number | null
  works: number | null
  parts: number | null
  epub: number | null
  pdf: number | null
}
```

`fetchLibrarySummary` uses `Promise.all` for a default Authors search and four count requests. It maps only matching response modes and never derives Authors from Works/Parts author-ID unions. Change initial async data to `{ page: LibraryPageData, summary: LibrarySummary | null }`; ordinary `/bibliotek` fetches page and summary concurrently, `/epub` retains active-plus-inactive format ownership, and `nedladdning=1` omits incompatible summaries.

- [ ] **Step 5: Enforce stale-response ownership**

Use one summary version and `AbortController`. Commit only when version, controller, signal, and the complete filter identity still match. Ordinary tab labels read `summary.epub` and `summary.pdf`; filter changes refresh the summary. Add delayed-Strindberg-then-Selma and failed-inactive-PDF tests proving stale and partial failures cannot replace newer counts or active rows.

- [ ] **Step 6: Run focused checks**

Run: `cd nuxt && yarn vitest run test/unit/v2-server.spec.ts`

Run: `cd nuxt && yarn playwright test test/ssr/library.spec.ts --project=ssr`

Run: `cd nuxt && yarn playwright test test/e2e/library.behavior.spec.ts --project=chromium`

Run: `cd nuxt && yarn lint && yarn typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add nuxt/app/pages/bibliotek.vue nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts nuxt/test/ssr/library.spec.ts nuxt/test/e2e/library.behavior.spec.ts
git commit -m "fix: refresh all ordinary library tab summaries"
```

### Task 7: Run quality and live parity gates

**Files:**
- Modify only when a failing gate exposes a defect in files owned above.

**Interfaces:**
- Consumes: completed backend/frontend work.
- Produces: fresh verification evidence; no deployment.

- [ ] **Step 1: Run backend gates**

Run: `cd /Users/johan/dev/lb-backend && virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_models.py test_lbapi/v2/test_library_provider.py test_lbapi/v2/test_library_api.py`

Run: `cd /Users/johan/dev/lb-backend && virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S`

Run: `cd /Users/johan/dev/lb-backend && virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2`

Run: `cd /Users/johan/dev/lb-backend && virtual_env/bin/python scripts/export_v2_openapi.py --check`

Expected: PASS.

- [ ] **Step 2: Run frontend gates**

Run: `invoke quality.library`

Run: `cd nuxt && yarn lint && yarn typecheck && yarn build`

Expected: PASS.

- [ ] **Step 3: Start local servers and compare authority**

Run `invoke dev`, then compare:

```text
https://red.litteraturbanken.se/bibliotek?filter=strindberg
http://127.0.0.1:3020/bibliotek?filter=strindberg
```

Verify exact tab counts, seven Author rows, blank unknown lifespans, visible hit emphasis, ordinary EPUB/PDF access, unchanged `?nedladdning=1`, and no console/page errors. Do not run `invoke stage`.

- [ ] **Step 4: Record final state**

Run `git status --short --branch` and `git log -5 --oneline` in both repositories. Expected: only intentional commits and no uncommitted implementation files. Report explicitly that staging was not deployed.
