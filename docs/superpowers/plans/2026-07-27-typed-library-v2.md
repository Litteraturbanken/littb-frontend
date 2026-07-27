# Typed Library v2 Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every JSON Library request in `bibliotek.vue` with three strict FastAPI v2 operations and generated TypeScript types while preserving the current Library's exact rendering, query semantics, cancellation, partial-option/count availability, and desktop/mobile behavior.

**Architecture:** Extract the existing legacy relevance and query-string execution into shared backend functions so the legacy routes and v2 adapter have one query-semantics authority. The v2 adapter compiles closed Library filters, validates raw provider objects, groups representations, and emits normalized discriminated DTOs. `bibliotek.vue` keeps page-local generated-client calls and request ownership; pure request/view-model transforms move to `app/lib/library/` without introducing a fetching composable.

**Tech Stack:** Python 3.13, FastAPI 0.119, Pydantic 2.12, strict mypy 2.3.0, Ruff 0.15.22, pytest 8.4, OpenAPI, openapi-typescript 7.13, openapi-fetch 0.17, Nuxt 4.4, Vue 3.5, TypeScript 5.9, Vitest 4.1, Playwright 1.61.

## Global Constraints

- Work in `/Users/johan/.codex/worktrees/8c5c/littb` and `/Users/johan/dev/lb-backend`; they are separate Git repositories on the existing `codex/nuxt-v2-statistics` branch.
- Preserve unrelated dirty and untracked files. Stage only files explicitly owned by the current task.
- Preserve exact visuals, Swedish copy, routes, query-string behavior, sorting, paging, grouping, tooltips, download names, loading states, cancellation, and stale-result ownership.
- Keep every page-specific request in `nuxt/app/pages/bibliotek.vue` `<script setup>`; do not create a fetching composable.
- Public v2 request/success/error bodies are strict Pydantic models with `extra="forbid"`; required nullable fields distinguish `null` from omission.
- Raw OpenSearch fields (`_index`, `_source`, aggregation objects, provider exports, suggestions, and query-string expressions) never cross the v2 boundary.
- Legacy/provider returns begin as `object` and are narrowed at runtime. Do not add production `Any`, untyped containers, broad casts, `# type: ignore`, `# noqa`, or ESLint suppressions.
- Preserve row-level legacy parity: malformed top-level envelopes and required aggregation structures fail closed, while malformed or unknown individual result rows are omitted.
- Do not change `_id` cardinality to `lbworkid`; existing `distinct_hits` behavior is intentionally preserved behind normalized count names.
- Preserve the legacy quirk that author search fetches all authors without the user's text/advanced query, then intersects them with filtered work/part author IDs.
- Preserve partial auxiliary availability: chronology and about-author options are independently nullable; EPUB, PDF, work, and part counts are independently requested and may fail without gating primary results.
- Correct the current SSR coupling in accordance with the approved design: primary EPUB/PDF rows and their active count render without awaiting the inactive format count; hydration may fill the inactive count later. Do not otherwise change loading behavior.
- The native `POST /api/download` archive form is a non-JSON streaming boundary and remains unchanged in this tranche. Tranche three must either add an explicit v2 streaming operation or document a generated-contract exception before the overall goal can complete.
- Generate `/Users/johan/dev/lb-backend/openapi/v2.json` only with `scripts/export_v2_openapi.py`; generate `nuxt/app/lib/api/generated/lbapi.ts` only with the pinned `api:generate` script.
- Node commands use `/Users/johan/.nvm/versions/node/v22.22.0/bin` before the ambient `PATH`.
- Tranche-one gates remain mandatory: strict backend mypy, blocking Ruff `E4,E7,E9,F,S`, v2 pytest, OpenAPI drift, and generated-client drift.
- Existing Library visual baselines are immutable unless the user separately approves a visual change.

## Contract Decisions

### Request models

Create one nested `LibraryFilters` model and these discriminated unions:

```python
LibrarySearchRequest = Annotated[
    LibraryAllSearchRequest
    | LibraryAuthorsSearchRequest
    | LibraryWorksSearchRequest
    | LibraryPartsSearchRequest
    | LibraryLatestSearchRequest
    | LibraryEpubSearchRequest
    | LibraryPdfSearchRequest,
    Field(discriminator="mode"),
]

LibraryCountRequest = Annotated[
    LibraryEpubCountRequest
    | LibraryPdfCountRequest
    | LibraryWorksCountRequest
    | LibraryPartsCountRequest,
    Field(discriminator="mode"),
]
```

`/library/counts` accepts one mode per request. Nuxt therefore retains separate controllers and `Promise.all` calls, so a failed part count cannot erase a successful work count. Work and part responses expose normalized `author_ids`; Nuxt derives the author count from their current-set union exactly as it does now.

### Response models

Every `/library/search` response repeats the matching `mode` discriminator. Success DTOs contain normalized semantic records and canonical application actions/URLs, not provider structures. Nuxt may convert snake-case generated records to its existing camel-case render models and derive `RouteLocationRaw`, Swedish date labels, and tooltip strings at one explicit local view-model boundary.

### Failure behavior

- Invalid requests produce typed `422 validation_error`.
- Primary search OpenSearch failures produce typed `503 library_unavailable`.
- Malformed provider structures raise `ValueError`; the global handler logs and emits the generic typed 500 envelope.
- `GET /library/options` returns required nullable `chronology` and `about_authors` sections so either source can remain usable when the other is unavailable.
- `POST /library/counts` catches provider unavailability and returns the selected response with required nullable `total`/`author_ids`; it never gates primary search.
- Nuxt maps a primary typed/transport failure to the existing local `failed` state, but an abort does not alter committed state or render an error.

---

### Task 1: Define Closed Library Request and Response Models

**Files:**
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/search_facets.py`
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/library_models.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/text_search.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_models.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_text_search.py`

**Interfaces:**
- Consumes: `V2Model`, current `SearchCategoryOption`/language literals, and the exact Library route option sets in `bibliotek.vue`.
- Produces: strict `LibraryFilters`, `LibrarySearchRequest`, `LibrarySearchResponse`, `LibraryCountRequest`, `LibraryCountResponse`, `LibraryOptionsResponse`, and normalized record models used by all later tasks.

- [ ] **Step 1: Write failing model tests for every discriminated request partition**

Create tests that instantiate one valid request for each of `all`, `authors`, `works`, `parts`, `latest`, `epub`, and `pdf`, then assert rejection of a mode-incompatible sort/field, an extra key, duplicate category/media/language/about-author values, page 0/101, author limits 149/10001, half-present/reversed years, control characters, unsafe identifiers, and more than the declared list maxima.

Use these exact successful bodies as the positive partitions:

```python
VALID_FILTERS = {
    "query": "Selma Lagerlöf",
    "gender": "female",
    "categories": ["texttype:roman"],
    "narrowing_categories": ["keyword:SLS-FI"],
    "about_author_ids": ["StrindbergA"],
    "media": ["mediatype:etext", "has_epub:true"],
    "languages": ["language:swe", "proofread:true"],
    "year_from": 1850,
    "year_to": 1950,
}

VALID_SEARCHES = [
    {"mode": "all", "filters": VALID_FILTERS, "sort": "relevance", "reverse": False},
    {"mode": "authors", "filters": VALID_FILTERS, "sort": "popularity", "reverse": False, "limit": 150},
    {"mode": "works", "filters": VALID_FILTERS, "sort": "popularity", "reverse": False, "page": 1, "source_only": False},
    {"mode": "parts", "filters": VALID_FILTERS, "sort": "title", "reverse": False, "page": 1},
    {"mode": "latest", "filters": VALID_FILTERS, "reverse": False, "page": 1, "hide_1800": False},
    {"mode": "epub", "filters": VALID_FILTERS, "sort": "popularity", "reverse": False, "page": 1},
    {"mode": "pdf", "filters": VALID_FILTERS, "sort": "popularity", "reverse": False, "page": 1},
]
```

Run and expect import failure:

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_models.py
```

- [ ] **Step 2: Extract shared closed facet literals without changing text search**

Move the exact `SearchCategoryOption` and shared language/media literals from `text_search.py` into `search_facets.py`, import them back into text search, and reuse them in Library models. Do not widen either endpoint with `str`. Run:

```bash
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_text_search.py
```

Expected: all existing text-search tests remain green and its OpenAPI fragment remains byte-identical before adding Library schemas.

- [ ] **Step 3: Implement the strict request models**

Implement these exact fields and bounds:

```python
class LibraryFilters(V2Model):
    query: Annotated[str, Field(max_length=500)] = ""
    gender: Literal["female", "male"] | None = None
    categories: list[SearchCategoryOption] = Field(default_factory=list, max_length=38)
    narrowing_categories: list[SearchCategoryOption] = Field(default_factory=list, max_length=38)
    about_author_ids: list[LibraryIdentifier] = Field(default_factory=list, max_length=50)
    media: list[LibraryMediaFilter] = Field(default_factory=list, max_length=4)
    languages: list[SearchLanguageOption] = Field(default_factory=list, max_length=13)
    year_from: int | None = Field(default=None, ge=1000, le=3000)
    year_to: int | None = Field(default=None, ge=1000, le=3000)

class LibraryAllSearchRequest(V2Model):
    mode: Literal["all"]
    filters: LibraryFilters
    sort: Literal["relevance", "author", "title", "chronology"] = "relevance"
    reverse: bool = False

class LibraryAuthorsSearchRequest(V2Model):
    mode: Literal["authors"]
    filters: LibraryFilters
    sort: Literal["name", "popularity", "chronology"] = "popularity"
    reverse: bool = False
    limit: int = Field(default=150, ge=150, le=10_000)

class LibraryWorksSearchRequest(V2Model):
    mode: Literal["works"]
    filters: LibraryFilters
    sort: Literal["author", "title", "popularity", "chronology"] = "popularity"
    reverse: bool = False
    page: int = Field(default=1, ge=1, le=100)
    source_only: bool = False

class LibraryPartsSearchRequest(V2Model):
    mode: Literal["parts"]
    filters: LibraryFilters
    sort: Literal["author", "title"] = "title"
    reverse: bool = False
    page: int = Field(default=1, ge=1, le=100)

class LibraryLatestSearchRequest(V2Model):
    mode: Literal["latest"]
    filters: LibraryFilters
    reverse: bool = False
    page: int = Field(default=1, ge=1, le=100)
    hide_1800: bool = False

class LibraryEpubSearchRequest(V2Model):
    mode: Literal["epub"]
    filters: LibraryFilters
    sort: Literal["author", "title", "popularity", "chronology"] = "popularity"
    reverse: bool = False
    page: int = Field(default=1, ge=1, le=100)

class LibraryPdfSearchRequest(V2Model):
    mode: Literal["pdf"]
    filters: LibraryFilters
    sort: Literal["author", "title", "popularity", "chronology"] = "popularity"
    reverse: bool = False
    page: int = Field(default=1, ge=1, le=100)
```

Add model validators requiring both years or neither, `year_from <= year_to`, and uniqueness in every list. `LibraryIdentifier` accepts 1–100 Unicode letters/numbers/underscore/hyphen and rejects controls, dots, separators, and whitespace.

- [ ] **Step 4: Implement normalized response models**

Define the following exact public families, all deriving from `V2Model`:

```text
LibraryChronology(year_from, year_to)
LibraryAboutAuthor(author_id, label)
LibraryOptionsResponse(chronology: LibraryChronology | None,
                       about_authors: list[LibraryAboutAuthor] | None)
LibraryAuthor(author_id, full_name, surname, role, birth_year, death_year)
LibraryAllTextItem(kind="text", index, source_label, title, short_title,
                   imprint_year, reader_author_id, title_id, page_name,
                   media_type, main_author)
LibraryAllPdfItem(kind="pdf", source_label, title, short_title,
                  imprint_year, work_id, main_author)
LibraryAllAuthorItem(kind="author", author_id, name_for_index,
                     popularity, birth_year, death_year)
LibraryAllExternalItem(kind="presentation" | "translator_lexicon" |
                       "literature_map" | "wordpress", source_label,
                       title, url, byline)
LibraryTitleItem(title, full_title, year, author, title_url, author_url,
                 route_author_id, route_title_id, route_media_type)
LibraryDownloadItem(all LibraryTitleItem fields plus download_url,
                    download_filename)
LibraryAction(kind, label, url, download_filename)
LibrarySourceExport(work_id, media_type, format, size)
LibraryBrowseItem(key, title_path, all LibraryTitleItem fields, actions,
                  source_exports)
LibraryLatestItem(all LibraryTitleItem fields plus imported_on)
LibraryLatestGroup(imported_on, source_count, items)
```

Define `LibraryAllResult` as the four-family annotated union discriminated by `kind`; do not create one sparse object with fields that are meaningless for most result kinds. Use closed literals for `kind`, `index`, role, media type, action kind, and export format. Bound public strings to their current provider limits (identifier/route pieces 100, names/labels 500, URLs 2,000), lists to the largest observable legacy windows (items 10,000, actions 8, exports 32, groups 10,000), and every count/size to nonnegative integers.

Define the response union members and count union exactly:

```text
LibraryAllSearchResponse(mode="all", items, total_hits)
LibraryAuthorsSearchResponse(mode="authors", items, total_authors,
                             total_works, total_parts)
LibraryWorksSearchResponse(mode="works", items, total_hits, total_works)
LibraryPartsSearchResponse(mode="parts", items, total_parts)
LibraryLatestSearchResponse(mode="latest", groups, total_hits, total_works)
LibraryEpubSearchResponse(mode="epub", items, total_hits, total_works)
LibraryPdfSearchResponse(mode="pdf", items, total_hits, total_works)
LibraryEpubCountRequest/LibraryPdfCountRequest/
LibraryWorksCountRequest/LibraryPartsCountRequest(mode, filters)
LibraryDownloadCountResponse(mode="epub" | "pdf", total: int | None)
LibraryBrowseCountResponse(mode="works" | "parts", total: int | None,
                           author_ids: list[LibraryIdentifier] | None)
```

Annotate both response unions with `Field(discriminator="mode")`. Do not add `failed`, `suggest`, raw hit names, or raw aggregations to success DTOs.

- [ ] **Step 5: Prove model tests, strict mypy, and Ruff pass**

```bash
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_models.py test_lbapi/v2/test_text_search.py
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
```

- [ ] **Step 6: Commit the closed contract types**

```bash
git add lbapi/v2/search_facets.py lbapi/v2/library_models.py lbapi/v2/text_search.py \
  test_lbapi/v2/test_library_models.py test_lbapi/v2/test_text_search.py
git commit -m "feat(v2): define Library contracts"
```

---

### Task 2: Extract One Legacy Query-Semantics Authority

**Files:**
- Create: `/Users/johan/dev/lb-backend/lbapi/library_legacy.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/web.py:1750-2040`
- Modify: `/Users/johan/dev/lb-backend/lbapi/web.py:2042-end-of-relevance-handler`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/test_library_legacy.py`
- Modify: existing legacy query-string/relevance API tests under `/Users/johan/dev/lb-backend/test_lbapi/`

**Interfaces:**
- Consumes: current `query_string` and `relevance` handlers plus `lbelasticapi.query`.
- Produces: `query_string_search(...) -> object` and `relevance_search(...) -> object`, used by both legacy HTTP routes and Task 3's strict v2 provider.

- [ ] **Step 1: Characterize the legacy handlers before extraction**

Add focused tests capturing the `lbelasticapi.query` arguments and serialized results for: empty query, nested Library predicate, relevance quoted phrase, author/imported aggregations, reversed first sort with stable tie-breakers, cross-index suggestion retry, and provider `RequestError`. Each test must assert observable query semantics or response behavior, not source structure.

Run the focused tests and confirm they pass before refactoring.

- [ ] **Step 2: Extract capability-minimal functions**

Create these exact public interfaces:

```python
def query_string_search(
    *, doc_types: str, query: str, from_hit: int, to_hit: int,
    includes: tuple[str, ...], excludes: tuple[str, ...],
    sort_fields: tuple[object, ...], author_aggregation: bool,
    imported_aggregation: bool,
) -> object: ...

def relevance_search(
    *, doc_types: str, query: str | None, from_hit: int, to_hit: int,
    includes: tuple[str, ...], excludes: tuple[str, ...],
    sort_fields: tuple[object, ...], show_all: bool,
) -> object: ...
```

Move the existing query construction, visibility filtering, boosts, aggregation definitions, suggestion retry, and OpenSearch execution without semantic edits. The functions return the raw provider response as `object`; serialization remains in `web.py`, and strict validation remains in v2.

- [ ] **Step 3: Make both legacy routes delegate to the shared functions**

Keep FastAPI request parsing, source include/exclude parsing, sort parsing, `JSONResponse`, status codes, and legacy debug behavior in `web.py`. Replace only duplicated execution/query construction with calls to `library_legacy`. Ignore the undeclared legacy `vectorize`, `sid`, `suggest`, and `partial_string` parameters exactly as before.

- [ ] **Step 4: Prove no legacy behavior drift**

```bash
virtual_env/bin/python -m pytest -q test_lbapi/test_library_legacy.py
virtual_env/bin/python -m pytest -q test_lbapi -k 'query_string or relevance or library'
virtual_env/bin/python -m ruff check lbapi/library_legacy.py lbapi/web.py --select E4,E7,E9,F,S
```

- [ ] **Step 5: Commit the shared executor**

```bash
git add lbapi/library_legacy.py lbapi/web.py test_lbapi/test_library_legacy.py test_lbapi
git commit -m "refactor: share Library query execution"
```

Before committing, inspect `git diff --cached --name-only` and unstage any unrelated legacy tests selected by the broad `git add test_lbapi` command.

---

### Task 3: Implement Library Filters and Partial Options

**Files:**
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/library_provider.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_provider.py`
- Modify: `/Users/johan/dev/lb-backend/docs/v2-contract-test-matrix.md`

**Interfaces:**
- Consumes: Task 1 models, Task 2 executor, `elasticapi.get_documents`, `get_authorkeywords`, and `get_imprint_range`.
- Produces: `compile_library_predicate(filters) -> str` and `load_library_options() -> LibraryOptionsResponse` plus object-first primitives used by Tasks 4–5.

- [ ] **Step 1: Write exact RED tests for the filter compiler**

Cover sanitization, gender, paired chronology, about-author nesting, media OR, EPUB, grouped language values, translation, original-language negation, foreign-language two-clause OR, ordinary category field grouping, narrowing-category AND, and combined ordering. Use the exact expected predicate already asserted by Library Playwright tests:

```text
(sort_date_imprint.date:[1900 TO 1910] OR birth.date:[1900 TO 1910] OR death.date:[1900 TO 1910]) AND (language:swe OR proofread:false) AND (mediatype:etext OR has_epub:true)
```

Also prove `SLS-FI` remains one literal, only letter-to-letter dashes become spaces in free text, and `.,!"“'”` are removed.

- [ ] **Step 2: Write RED tests for independent options**

Test valid chronology and author/keyword intersection, deterministic Swedish label sorting, unsafe IDs, duplicate author rows, duplicate keyword IDs, one unavailable source with the other preserved, both unavailable, malformed non-provider values raising `ValueError`, year format/range validation, and exact provider arguments including the current author exclude tuple.

- [ ] **Step 3: Implement object-first providers and predicate compilation**

Define a private Protocol whose methods return `object`. Narrow mappings as `Mapping[object, object]`, lists/iterables structurally, and callable response methods before use. Port `sanitizeFilter`, category/language/media/about-author predicate logic exactly once from `bibliotek.vue`. Do not accept raw query fragments from the request.

- [ ] **Step 4: Implement partial options**

Call the chronology source and the two about-author sources independently. Provider unavailability sets only its section to `None`; malformed returned data raises `ValueError`. The about-author section is `None` if either of its two sources is unavailable, and otherwise contains the validated intersection.

- [ ] **Step 5: Verify and commit**

```bash
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_provider.py -k 'filter or options'
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
git add lbapi/v2/library_provider.py test_lbapi/v2/test_library_provider.py docs/v2-contract-test-matrix.md
git commit -m "feat(v2): normalize Library options"
```

---

### Task 4: Normalize Relevance and Author Searches

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/library_provider.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_provider.py`

**Interfaces:**
- Consumes: `LibraryAllSearchRequest`, `LibraryAuthorsSearchRequest`, and the shared relevance executor.
- Produces: `search_library_all(...) -> LibraryAllSearchResponse` and `search_library_authors(...) -> LibraryAuthorsSearchResponse`.

- [ ] **Step 1: Write RED tests for all-result families and relevance arguments**

Cover text, part, PDF, author, presentation, translator lexicon, literature map, and WordPress rows; canonical internal/external URL safety; editor/illustrator contribution; unknown/malformed row omission; malformed envelope failure; exact document types/window/excludes/sort; reverse affecting only the first sort direction; and OpenSearch failure propagation.

- [ ] **Step 2: Implement the all-mode adapter**

Use `relevance_search` with the exact current document-type list and `0..100` window. Normalize accepted rows to `LibraryAllItem`; never expose `_index`. Preserve the current URL encodings and safe Litteraturbanken-host validation.

- [ ] **Step 3: Write RED tests for author intersection and atomicity**

Prove that the author relevance query is always empty, uses `0..10_000`, filtered work/part author IDs determine membership, duplicates are removed, name/popularity/chronology sorts and reverse are stable, limit 150/10,000 is honored, missing union members fail the whole response, and returned counts preserve work `distinct_hits` versus part raw `hits`.

- [ ] **Step 4: Implement author mode through the shared count primitives**

Run work count, part count, and unfiltered author relevance calls. Require both count aggregations and the full matching author set, then sort and slice exactly as the current page does.

- [ ] **Step 5: Verify and commit**

```bash
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_provider.py -k 'all or author'
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
git add lbapi/v2/library_provider.py test_lbapi/v2/test_library_provider.py
git commit -m "feat(v2): normalize Library relevance search"
```

---

### Task 5: Normalize Browse, Latest, Download, and Count Modes

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/library_provider.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_provider.py`

**Interfaces:**
- Consumes: remaining search/count request models and shared query-string executor.
- Produces: `search_library(request) -> LibrarySearchResponse` dispatch and `count_library(request) -> LibraryCountResponse` covering works, parts, latest, EPUB, and PDF.

- [ ] **Step 1: Write RED tests for exact query translation**

Assert the cross-fields prefix, document types, include/exclude projections, 100-row windows, source-only export predicate, `NOT keyword:1800`, fixed latest tie-breakers, EPUB and PDF predicates, author/imported aggregation flags, and zero-window count calls. Assert that `reverse` changes only the first sort component.

- [ ] **Step 2: Write RED tests for works and parts normalization**

Cover `(titlepath, work_id)` grouping, media order `etext > faksimil > pdf`, part display/reader-author precedence, read/download/search/about action order, EPUB/direct-PDF/export-PDF selection, source export filtering/deduplication/size, unsafe path omission, work count from `_id` cardinality, part count from raw hits, and validated/deduplicated author IDs.

- [ ] **Step 3: Write RED tests for latest, EPUB, and PDF normalization**

Cover latest grouping, newest representation date, source aggregation count, ISO/millisecond dates, Swedish-label inputs, EPUB `has_epub` plus export requirement, PDF direct-versus-public-export precedence, filename-author precedence, editor/illustrator suffix metadata, and malformed-row omission.

- [ ] **Step 4: Implement the remaining adapters and fail-soft counts**

Port grouping/precedence logic from `bibliotek.vue` into object-first Python transforms. Primary modes raise provider errors; count mode catches provider unavailability and returns its matching discriminator with `total=None` and `author_ids=None`. Malformed provider data remains a 500-boundary `ValueError`, not a nullable count.

- [ ] **Step 5: Verify complete provider behavior and commit**

```bash
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_provider.py
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 --select E4,E7,E9,F,S
git add lbapi/v2/library_provider.py test_lbapi/v2/test_library_provider.py
git commit -m "feat(v2): normalize Library browse modes"
```

---

### Task 6: Expose the Three v2 Operations and Regenerate the Contract

**Files:**
- Create: `/Users/johan/dev/lb-backend/lbapi/v2/library.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/app.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_library_api.py`
- Generate: `/Users/johan/dev/lb-backend/openapi/v2.json`
- Generate: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/api/generated/lbapi.ts`

**Interfaces:**
- Consumes: Task 5 provider dispatch and all Task 1 unions.
- Produces: `GET /library/options`, `POST /library/search`, and `POST /library/counts` with stable generated operations.

- [ ] **Step 1: Write RED API tests**

Test exact methods/paths, serialized discriminator for every search/count mode, partial options, typed 422, redacted 500, redacted 503, and rejection of undeclared query/body fields. Patch provider dispatch at the router boundary; do not restate every schema property already owned by the snapshot.

- [ ] **Step 2: Implement the thin router**

Use prefix `/library`, tag `library`, and exact operation IDs:

```text
v2_get_library_options
v2_post_library_search
v2_post_library_counts
```

Declare explicit response models and shared typed 422/500/503 metadata. Include the router in `v2_app`. Do not catch `ValueError` or OpenSearch exceptions in the primary handlers; existing global handlers own redaction.

- [ ] **Step 3: Regenerate and inspect OpenAPI**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/python scripts/export_v2_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py --check
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_library_api.py test_lbapi/v2/test_openapi.py
```

Inspect the generated schema to confirm all Library objects are closed, both request/response unions are discriminated, required nullable fields remain required, and all error responses reference `ApiErrorResponse`.

- [ ] **Step 4: Regenerate the TypeScript client from the committed snapshot**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  LBAPI_OPENAPI_SCHEMA=/Users/johan/dev/lb-backend/openapi/v2.json yarn api:generate
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  LBAPI_OPENAPI_SCHEMA=/Users/johan/dev/lb-backend/openapi/v2.json yarn api:check
```

- [ ] **Step 5: Commit both repositories separately**

Backend:

```bash
git add lbapi/v2/library.py lbapi/v2/app.py test_lbapi/v2/test_library_api.py openapi/v2.json
git commit -m "feat(v2): expose Library operations"
```

Frontend root:

```bash
git add nuxt/app/lib/api/generated/lbapi.ts
git commit -m "chore: generate Library API types"
```

---

### Task 7: Add Generated Library Aliases, Pure View Models, and v2 Fixtures

**Files:**
- Create: `nuxt/app/lib/library/index.ts`
- Create: `nuxt/app/lib/library/view-model.ts`
- Modify: `nuxt/app/lib/library-tooltip.ts`
- Create: `nuxt/test/unit/library-contract.spec.ts`
- Create: `nuxt/test/nuxt/library-contract.ts`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Modify: `nuxt/test/unit/api-client.spec.ts`

**Interfaces:**
- Consumes: generated `components`, `operations`, and `paths` from Task 6.
- Produces: generated aliases, exhaustive request builders, current camel-case render models, and fixture implementations of all three v2 operations.

- [ ] **Step 1: Write compile-time contract assertions**

In `library-contract.ts`, select the three operations by both path and operation ID, assert their equality, select every 200 request/response type, and use `satisfies` fixtures for all seven search modes and four count modes. Assert typed 422/500/503 envelopes from the generated operations; do not handwrite transport interfaces.

- [ ] **Step 2: Write RED unit tests for request and view-model transforms**

Test exact Swedish-to-API sort mapping, route-state-to-`LibraryFilters`, all seven request discriminators, single-kind counts, canonical URLs, `RouteLocationRaw`, tooltip inputs, contribution suffixes, browse action order, source-export labels/sizes, latest Swedish date labels, and exhaustive mode switching with `assertNever`. Add one `api-client.spec.ts` case proving the generated Library POST sends the exact JSON body and forwards its `AbortSignal`.

- [ ] **Step 3: Implement generated aliases and pure transforms**

Start `index.ts` with aliases such as:

```ts
import type { components, operations } from "~/lib/api/generated/lbapi"

export type LibraryFilters = components["schemas"]["LibraryFilters"]
export type LibrarySearchRequest =
  operations["v2_post_library_search"]["requestBody"]["content"]["application/json"]
export type LibrarySearchResponse =
  operations["v2_post_library_search"]["responses"][200]["content"]["application/json"]
export type LibraryCountRequest =
  operations["v2_post_library_counts"]["requestBody"]["content"]["application/json"]
export type LibraryCountResponse =
  operations["v2_post_library_counts"]["responses"][200]["content"]["application/json"]
```

Define only local presentation types not present in transport, and make each converter consume a generated response member. Update `library-tooltip.ts` to accept normalized author fields rather than `Record<string, unknown>`.

- [ ] **Step 4: Implement strict fixture endpoints and ledgers**

Add `/v2/library/*` and `/private-v2/library/*` handlers plus operation/body ledgers at `/_library_v2/requests`, `/_library_v2/failures`, and `/_library_v2/delays`. Validate exact body keys, discriminators, list limits, and mode-only fields before returning fixture data. Canonicalize complete typed bodies for delay keys so mode/filter/sort/reverse/page/`hide_1800`/`source_only` intents remain distinguishable. Options must simulate chronology/about-author partial nullability; counts must fail/delay independently by mode. Retain the existing legacy Library routes, raw fixtures, controls, and ledgers for Angular-authority and fixture-unit tests until their own audit removes them.

- [ ] **Step 5: Verify and commit**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/library-contract.spec.ts test/unit/v2-server.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
git add app/lib/library/index.ts app/lib/library/view-model.ts app/lib/library-tooltip.ts \
  test/unit/library-contract.spec.ts test/nuxt/library-contract.ts \
  test/fixtures/v2-server.mjs test/unit/v2-server.spec.ts test/unit/api-client.spec.ts
git commit -m "feat: add typed Library client boundary"
```

---

### Task 8: Migrate `bibliotek.vue` to Generated Options and Search Operations

**Files:**
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/test/ssr/library.spec.ts`
- Modify: focused Library SSR fixtures/helpers only where endpoint bodies change

**Interfaces:**
- Consumes: Task 7 aliases/transforms and `createLbApiClient`.
- Produces: SSR and browser primary Library data loaded only through generated `/library/options` and `/library/search` operations.

- [ ] **Step 1: Convert SSR endpoint assertions to RED v2 assertions**

Update focused SSR tests to expect `/private-v2/library/options` and `/private-v2/library/search` with exact typed bodies. Keep rendered HTML assertions unchanged. Add explicit cases for chronology-only availability, about-author-only availability, empty successful results, and typed primary failure. Delete frontend assertions about missing/null/non-array raw `suggest`, malformed legacy envelopes/rows, duplicate raw metadata records, malformed raw imprint objects, and exact legacy PDF include/exclude predicates; Tasks 3–5 replace each with an object-first backend provider test. Retain one frontend options-unavailable case and one typed search failure per request owner.

- [ ] **Step 2: Replace page transport declarations and parsers**

Import `createLbApiClient` plus Task 7 aliases/transforms. Delete page-local transport types, `UnknownRecord`, raw record helpers, all legacy response parsers, raw include/exclude/query constants, predicate compiler, URL builders, and `$fetch<unknown>` search/options functions. Keep route state and presentation-only types where they are not duplicated transport shapes.

- [ ] **Step 3: Load options and initial search through the generated client**

Create the client in `<script setup>` using `config.apiBase` on the server and `config.public.apiBase` in the browser. Call `GET("/library/options")` and `POST("/library/search", { body, signal })` directly in the page. Convert successful generated responses at the explicit view-model boundary; map non-abort errors to the existing failed empty models. For SSR EPUB/PDF, return the primary response immediately with the inactive count null; do not retain the current `Promise.all(search, inactiveCount)` gate.

- [ ] **Step 4: Preserve browser request ownership**

Replace the seven-mode branch in `runBrowserRequest` with one exhaustive typed request builder and one `client.POST`. Preserve the 300 ms debounce, `requestVersion`, abort controller, route-update ordering, owned-navigation suppression, committed-row loading behavior, and author “show all” atomicity. Remove all `as ResponseType` mode casts by narrowing on the response discriminator.

- [ ] **Step 5: Prove SSR and types**

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/ssr/library.spec.ts --project=ssr
```

- [ ] **Step 6: Commit the primary migration**

```bash
git add app/pages/bibliotek.vue test/ssr/library.spec.ts
git commit -m "refactor: use generated Library search API"
```

---

### Task 9: Migrate Independent Counts and Prove Browser Parity

**Files:**
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/test/e2e/library.behavior.spec.ts`
- Modify: `nuxt/test/e2e/library-advanced.behavior.spec.ts`
- Modify: `nuxt/test/e2e/library-multiselect-parity.behavior.spec.ts` only if fixture setup changes
- Modify: `nuxt/test/e2e/library.visual.spec.ts` only if fixture setup changes
- Modify: `nuxt/test/ssr/library.spec.ts`

**Interfaces:**
- Consumes: generated single-kind count union.
- Produces: no Library JSON call outside the generated client and exact current count/cancellation/stale-response behavior.

- [ ] **Step 1: Convert count ledgers to RED v2 bodies**

Update request-ledger helpers to record `POST /v2/library/counts` bodies. Preserve assertions that work/part counts run independently, EPUB/PDF inactive counts are cached by filter identity, author count appears only after current work+part author IDs exist, stale delayed responses are ignored, and counts never gate primary rows.

Add `Library modes use only generated v2 operations`: exercise all seven modes, assert the v2 options/search/count ledgers, and assert that the retained legacy relevance/query/options ledgers remain empty for the Nuxt page.

- [ ] **Step 2: Replace all count fetchers**

Delete `countOnlyRequestUrl`, `fetchBrowseCountResponse`, `fetchEpubCountResponse`, and `fetchPdfCountResponse`. Issue one generated count request per mode with the existing count controller/version. Narrow response by `mode`; treat `total:null` as unavailable and retain prior successful sibling counts.

- [ ] **Step 3: Prove no legacy JSON Library requests remain**

Run:

```bash
rg -n '\$fetch<unknown>|libraryApiBase|/relevance/|/query_string/|/get_authors|/get_authorkeywords|/imprint_range' app/pages/bibliotek.vue
```

Expected: no matches. The native `/api/download` form remains the single documented streaming exception and is covered by its existing form/download tests.

- [ ] **Step 4: Run focused behavior and immutable visual tests**

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/e2e/library.behavior.spec.ts \
  test/e2e/library-advanced.behavior.spec.ts \
  test/e2e/library-multiselect-parity.behavior.spec.ts \
  test/e2e/library.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: all behavior tests pass and every committed visual baseline hash remains unchanged.

- [ ] **Step 5: Commit the count/parity migration**

```bash
git add app/pages/bibliotek.vue test/e2e/library.behavior.spec.ts \
  test/e2e/library-advanced.behavior.spec.ts \
  test/e2e/library-multiselect-parity.behavior.spec.ts \
  test/e2e/library.visual.spec.ts test/ssr/library.spec.ts
git commit -m "refactor: type Library count ownership"
```

---

### Task 10: Add Quality Gates, Documentation, and Full Tranche Verification

**Files:**
- Modify: `tasks.py`
- Modify: `test/test_tasks.py`
- Modify: `docs/quality.md`
- Modify: `/Users/johan/dev/lb-backend/docs/v2-contract-test-matrix.md`
- Modify: `/Users/johan/dev/lb-backend/docs/v2-quality.md`

**Interfaces:**
- Consumes: all preceding commits and existing quality commands.
- Produces: Library contract checks included in deterministic quality commands plus a requirement-to-test map and final parity evidence.

- [ ] **Step 1: Write RED task tests for the focused Library and complete contract gates**

Require a green `quality.library` task to run the focused backend Library model/provider/API tests, generated contract check, Nuxt typecheck, Library unit tests, and Library SSR project. Extend `quality.contract` to run snapshot check, generated-client check, compile-time generated contract files including `library-contract.ts`, backend Library API/provider tests, and focused Nuxt Library contract tests. Preserve deterministic file-based codegen. Tranche four will add `quality.frontend` only when `yarn lint --max-warnings 0` is genuinely green; do not add an intentionally failing public quality task here.

- [ ] **Step 2: Implement the task wiring and documentation**

Add the focused `quality.library` subtask and document the remaining global lint baseline exactly. Add Library ownership rows for filter compilation, provider normalization/grouping, API envelopes, generated client use, SSR state, browser ownership, and visual parity.

- [ ] **Step 3: Run backend and contract gates**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.backend
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.contract
python -m pytest -q test/test_tasks.py
```

Expected: strict mypy/Ruff pass, the full v2 backend suite passes, both artifacts are clean, and task tests pass.

- [ ] **Step 4: Run the complete frontend release gate**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn test:unit
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn build
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn test:ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn test:e2e
```

Measure `yarn eslint . --format json` before and after. No new rule/file finding is allowed; tranche four still owns global zero lint. Run `git diff --check` and confirm unrelated dirty files are unchanged in both repositories.

- [ ] **Step 5: Commit documentation/task wiring**

Root:

```bash
git add tasks.py test/test_tasks.py docs/quality.md
git commit -m "chore: gate typed Library contracts"
```

Backend:

```bash
git add docs/v2-contract-test-matrix.md docs/v2-quality.md
git commit -m "docs(v2): map Library contract tests"
```

## Requirement-to-Test Matrix

| Requirement | Primary evidence |
| --- | --- |
| Closed discriminated request/response contracts | backend model tests, generic OpenAPI closure/snapshot tests, generated compile-time contract file |
| Exact legacy query semantics | shared-executor characterization tests and provider exact-argument tests |
| Object-first normalization and redaction | provider malformed-boundary tests and API 500/503 tests |
| All/author family parity | provider family/intersection tests plus unchanged SSR/E2E rendered assertions |
| Works/parts grouping/actions/exports | provider grouping tests, Library SSR, source-download browser tests |
| Latest/EPUB/PDF precedence and counts | provider tests plus existing SSR/E2E per-mode assertions |
| Partial options and counts | provider/API tests plus SSR/browser failure-isolation tests |
| Generated type propagation | generated aliases, compile-time contract file, Nuxt typecheck, absence audit for handwritten transport shapes |
| Cancellation and stale-result ownership | existing Library delayed-request Playwright cases updated to v2 ledgers |
| Exact visuals and interaction | immutable desktop/mobile visual baselines and full Library Playwright suite |
| No legacy JSON Library boundary | source audit plus fixture ledgers showing only `/v2/library/*` JSON traffic |

## Plan Self-Review

- Spec coverage: all three approved operations, strict DTOs, shared legacy semantics, generated code, page-local fetching, partial count behavior, full quality gates, and visual parity are assigned to tasks.
- Intentional later scope: the native streaming archive form is explicitly carried into tranche three; it is not misrepresented as a generated JSON client call.
- Placeholder scan: no `TBD`, `TODO`, generic “handle errors,” or undefined later interface remains.
- Type consistency: request/response/count discriminator names and operation IDs are identical in backend, generated aliases, fixture, page, and tests.
- Test ownership: model tests own validation partitions; provider tests own normalization/query semantics; API tests own envelopes; SSR/E2E own rendered behavior and request ownership; OpenAPI snapshot owns exact schema serialization.
