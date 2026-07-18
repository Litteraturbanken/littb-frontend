# Nuxt Text Search Design

## Goal

Replace the AngularJS `/sök` route with a Nuxt 4 hybrid/SSR page while
preserving the current page's appearance, URL contract, search semantics,
Reader links, filters, pagination, and loading/error behavior. This is an
architectural port, not a redesign.

The legacy `/sok` spelling remains a permanent redirect to `/sök`, preserving
the raw query string. Search remains a first-class Nuxt route and does not
embed, mount, or coordinate with AngularJS.

## Fixed project decisions

- Render useful direct `/sök?fras=...` responses on the server.
- Keep page-only request orchestration in the page's `<script setup>`; do not
  create a one-use composable.
- Use Tailwind-compatible legacy classes and Headless UI only where an
  interactive dropdown needs accessible state management.
- Do not change copy, layout, colors, type, spacing, result order, or link
  behavior except where a browser-accessibility requirement needs an invisible
  label or semantic attribute.
- Continue fetching current search data from the backend; do not freeze HTML or
  results into the Nuxt bundle.
- Define strict FastAPI v2 request/response models and regenerate the Nuxt
  OpenAPI TypeScript client before the frontend consumes the operation.

## Approaches considered

### 1. Typed semantic v2 search API and native Nuxt page — selected

FastAPI owns conversion from a bounded public search request into the existing
OpenSearch provider calls and returns a small, strict response containing only
what `/sök` renders. Nuxt uses the generated schema, route-keyed SSR data, and
page-local client requests. This gives the final Nuxt-only architecture, keeps
provider details private, and makes malformed search data fail locally.

### 2. Proxy the legacy `/api/search*` JSON directly

This is faster initially but retains arbitrary dictionaries, JSON-in-query
parameters, raw provider fields, and frontend knowledge of OpenSearch filters.
It works against the backend typing/code-generation direction and is rejected.

### 3. Keep Angular search mounted as an island

This preserves behavior temporarily but adds router, history, style, and state
compatibility work for an intermediate application that will not be deployed.
It contradicts the requested Nuxt-only destination and is rejected.

## Route and URL contract

The canonical route is `/sök`. The query keys below retain their Angular names
so existing links, bookmarks, Reader return links, and browser history remain
valid:

| Query key | Meaning |
| --- | --- |
| `fras` | Search text. Empty means the pristine search page. |
| `traffsida` | One-based work-result page; defaults to `1`. |
| `avancerad` | Advanced controls are open when present and truthy. |
| `forfattare` | Comma-separated author IDs. |
| `titlar` | Comma-separated `lbworkid` values. |
| `kön` | `all`, `female`, or `male`. |
| `languages` | Comma-separated values from the legacy language selector. |
| `keywords` | Comma-separated values from the legacy category/project/source/publisher selector. |
| `authorkeyword` | Comma-separated authors whom works concern. |
| `intervall` | Inclusive `from,to` imprint-year interval. |
| `sok_filter` | Result-side author facet. |
| `prefix`, `suffix`, `infix`, `lemma`, `ej_modern`, `fuzzy` | Legacy search-mode flags. |
| `keyword` | Legacy field/value filter links; accepted only through a strict field allowlist. |

Repeated values, empty values, malformed UTF-8/percent encoding, over-limit
strings, invalid years/pages, unsupported options, and unsafe IDs are
normalized or discarded locally. Unknown query keys are preserved when Nuxt
updates a known search key. `infix` is represented as both prefix and suffix,
matching Angular. `fuzzy` remains URL-compatible even though the legacy backend
currently ignores it.

Submitting a new search resets `traffsida` and `sok_filter`. Pagination changes
only `traffsida`. Filters retain the current phrase and reset the page. Back and
Forward restore one atomic URL state without duplicate requests.

## FastAPI v2 contract

### `POST /text-search/results`

The request model is semantic rather than a pass-through OpenSearch query:

```python
class TextSearchRequest(BaseModel):
    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    page: Annotated[int, Field(ge=1, le=10000)] = 1
    page_size: Literal[30] = 30
    prefix: bool = False
    suffix: bool = False
    word_form_only: bool = True
    include_modernized: bool = True
    author_ids: list[SearchIdentifier] = []
    about_author_ids: list[SearchIdentifier] = []
    work_ids: list[SearchIdentifier] = []
    gender: Literal["female", "male"] | None = None
    year_from: int | None = None
    year_to: int | None = None
    languages: list[SearchLanguageOption] = []
    categories: list[SearchCategoryOption] = []
    legacy_filters: list[SearchLegacyFilter] = []
    facet_author_id: SearchIdentifier | None = None
    highlight_limit: Annotated[int, Field(ge=5, le=500)] = 5
```

Lists are deduplicated in order and have explicit item/count limits. The year
pair is either both absent or a valid ascending pair between 1000 and 2200.
The backend compiles known options into the same `search_filters` and
`text_filter` semantics as Angular's `buildSearchFilterPayload`; the browser
never sends a Lucene expression or arbitrary field dictionary.

The provider performs the existing result query with fixed includes, fixed
main-author sorting, 30 works per page, and `highlight_limit + 1` requested
fragments. The sentinel fragment is removed and becomes the overflow signal.
When `facet_author_id` is present it adds the same author restriction Angular
uses for its result navigator without changing the base totals stored in the
URL state. A one-work request with `highlight_limit=100` implements “Visa
fler” through this same operation.

The strict response is:

```python
class TextSearchWord(BaseModel):
    word: str
    page_name: str
    word_id: str

class TextSearchHighlight(BaseModel):
    left_context: list[TextSearchWord]
    match: list[TextSearchWord]
    right_context: list[TextSearchWord]

class TextSearchWork(BaseModel):
    lbworkid: str
    author_id: str
    author_name: str
    title: str
    title_id: str
    mediatype: Literal["etext", "faksimil"]
    highlights: list[TextSearchHighlight]
    has_more_highlights: bool

class TextSearchResponse(BaseModel):
    query: str
    page: int
    page_size: Literal[30]
    total_work_hits: int
    works: list[TextSearchWork]
    author_facets: list[TextSearchAuthorFacet]
```

Provider dictionaries are transformed and validated before serialization.
Wrong identities, missing source fields, empty matches, unsafe page/word IDs,
unsupported media, inconsistent counts, and malformed aggregation rows produce
a modeled 500 response instead of leaking provider data.

### `POST /text-search/count`

This operation accepts the same semantic query/filter/search-mode fields but no
paging or highlight controls. It returns strict nonnegative
`total_highlights` and `total_documents` counts. It remains independent because
the legacy count provider scans every matching document and can be much slower
than the result page. Nuxt must not delay result rendering on this enhancement;
the count is route-identity guarded and fills the toolkit when it arrives.

### `POST /text-search/options`

This operation returns typed title options, typed author selector rows, the
subset of authors used by “Om ett författarskap”, and the global imprint-year
floor/ceiling. Rows
contain only `author_id`, `name_for_index`, and nullable display years. Nuxt
loads this during SSR only when advanced controls are requested or selected
filters need labels; otherwise it is fetched lazily when advanced search opens.

The request accepts the current semantic filters, a bounded title filter
string, selected work IDs, `title_limit` of `0`, `30`, or the explicit
all-results cap, and an `include_static_options` flag. Repeated typeahead calls
omit the static author/about-author/year-range lists.
The response's title total and author facets back the title Headless UI
combobox while preserving selected rows across searches and enforcing
latest-request-wins.

All three operations model 422, 500, and 503 responses with the existing v2
`ApiErrorResponse`. OpenSearch failures become 503. No operation accepts
cookies, authorization, an origin URL, a raw query string, or an arbitrary
provider field name.

## Nuxt page architecture

Create `nuxt/app/pages/sök.vue`. Its `<script setup>` owns:

- parsing and serializing the route query;
- `useRequestFetch()` and route-keyed `useAsyncData()` for the primary result,
  with a separate non-blocking count request;
- the payload identity check used by the existing author/Reader pages;
- an accepted-result ref cleared synchronously on route identity changes;
- request-version guards for primary results, options, title options, and
  additional highlights;
- `AbortController` cleanup on superseding requests and unmount;
- direct `router.push`/`router.replace` updates for controls and Back/Forward;
- SSR 200 for valid empty/results states and local 502 for unavailable search.

Do not create a search composable. Pure route/request/response helpers may live
in `nuxt/app/lib/text-search.ts` because they are independently unit-testable,
but all fetch calls stay in the page.

Create `nuxt/app/components/search/SearchMultiSelect.vue` for the repeated
Headless UI multiple-combobox interaction. It owns only accessible selection,
keyboard navigation, and legacy-compatible dropdown markup/classes; it never
fetches. The page supplies options and handles filter changes.

The chronology control uses the existing markup/classes with two bounded range
inputs and the exact visible year text inputs. It commits the URL when a drag
ends or a valid text pair changes, matching Angular's search timing.

## Rendering and Reader links

The page keeps the existing `.page-search`, form, `.results_container`, table,
toolkit, pager, and navigator structure so the already-migrated stylesheet is
authoritative. Search-page background/body/head state must match Angular and be
removed on client navigation away.

Each work renders one header followed by up to five highlight rows. Context is
trimmed exactly as Angular does: left context is compacted toward 40 characters,
tokens of 30 or more characters are dropped from both contexts, and the known
punctuation set receives `.punct`. Faksimil rows keep `.is_faksimil`.

Header and match links target the canonical Reader route. They carry the
existing `traff`, `traffslut`, serialized `s_*` search state, `s_lbworkid`, and
zero-based `hit_index` parameters so the already-ported Reader hit marker can
render the exact result. Paths use RFC 3986 encoding and never trust a provider
URL.

The result author navigator uses `sok_filter`. “Visa alla” restores the base
response. “Visa fler” replaces only the selected work's current header/result
block after a successful latest response.

## Loading, empty, and error behavior

- The pristine route renders the complete form and no result/toolkit data.
- Direct valid searches render results in the SSR HTML and hydrate without a
  duplicate public request.
- While a client request is pending, the URL changes atomically, the spinner is
  shown, committed result cells receive the existing faded loading style, and
  stale responses cannot replace the current route.
- A valid zero-hit response renders “Din sökning gav inga träffar”, zero work
  rows, and the legacy toolkit count structure.
- A failed client request clears the pending state and shows a bounded Swedish
  page-local error without retaining results under the wrong URL.
- A failed SSR request returns a local 502 page. Provider messages, paths,
  query bodies, and private origins never enter HTML or Nuxt payload data.
- Options/title-option failures leave those controls usable with selected
  values but do not destroy valid primary results.

## Visual authority and testing

Use a dedicated Angular Playwright capture configuration pinned to the local
Angular server. Capture at 1440×1000 and iPhone 13 dimensions:

1. pristine simple search;
2. populated simple results;
3. populated advanced filters;
4. no-hit results.

The live Angular authority is
`app/scripts/components/search/template.html`; `app/views/search.html` is stale
and must not be used for DOM decisions. The capture fixture must mock and
ledger every Angular request: authors, author
keywords, imprint range, title lookup, search, search count, background assets,
fonts, and shell bootstrap calls. It blocks production escapes and records any
known Angular authority defect separately from unexpected browser problems.

Test layers:

- FastAPI provider-transform and endpoint tests for exact requests, every
  filter, boundaries, malformed rows, counts, failures, and OpenAPI schemas.
- Nuxt unit tests for route normalization, query preservation, Reader link
  construction, context trimming, punctuation, and strict runtime validation.
- SSR tests for pristine/results/no-hit/error HTML, exact private request body,
  metadata/body/background state, and no provider leakage.
- Browser behavior tests for submission, filter and page URL ownership,
  Back/Forward, keyboard pagination, author facets, “Visa fler”, lazy advanced
  options, title latest-wins, primary latest-wins, error recovery, hydration,
  and navigation cleanup.
- Desktop/mobile screenshot comparisons against the four Angular authorities
  with the established threshold and maximum-difference policy.

The slice closes only when backend tests/OpenAPI export, Nuxt generation check,
unit tests, SSR tests, full browser tests, typecheck, production build, diff
hygiene, and live old/new checks all pass.

## Explicitly separate later work

This slice does not add the Reader's own inline search form, editor route,
faksimil tool controls, or Dramawebben search. Those are separate remaining
migration slices. It does preserve the URL/link contract those consumers need.
