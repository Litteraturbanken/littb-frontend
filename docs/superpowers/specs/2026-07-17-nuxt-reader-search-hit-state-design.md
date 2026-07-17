# Typed Reader Search-Hit State Design

**Date:** 2026-07-17

## Goal

Give Nuxt Reader URLs a stable, typed within-work search cursor so the later
native `/sök` page can link to a real highlighted hit. This slice adds a
stateless v2 hit-window endpoint, regenerates the frontend client, and consumes
the result page-locally in the existing Reader. It does not port the full Search
page or the in-Reader search form.

The canonical URL is:

```text
/författare/{author}/titlar/{title}/sida/{pageName}/etext?q={query}&hit={zeroBasedWorkHit}
```

Optional nondefault match-order flags are `lemma=1`, `ej_modern=1`, `prefix=1`,
and `suffix=1`.

## Why a typed stateless API

AngularJS replays a large `s_*` query into an SSE endpoint, receives temporary
timestamp-like search IDs, and pages later hits through an ephemeral OpenSearch
index. That contract is unsuitable for SSR, generated types, durable URLs, or
Back/Forward.

Three approaches were considered:

1. **Selected: typed stateless v2 hit window.** It exposes only absolute
   within-work hit indices, page identity, word-ID range, and total. It is
   deterministic, SSR-capable, code-generatable, and can later be optimized
   without changing clients.
2. **Nitro adapter over legacy SSE/search IDs.** This avoids a backend route but
   makes Nuxt own temporary backend state and still lacks an authoritative
   OpenAPI contract.
3. **Direct browser EventSource replay.** This most closely copies Angular but
   cannot SSR highlights, duplicates data rules in the client, and bakes legacy
   temporary state into the new architecture.

## Backend v2 contract

### Operation

```text
GET /v2/works/{work_id}/search-hits
```

Operation ID: `v2_get_work_search_hits`.

Path and query parameters:

| Parameter | Type/validation | Default |
| --- | --- | --- |
| `work_id` | trimmed safe string, 2–100 chars, no `%`, `/`, `\`, controls, `.` or `..`; must begin `lb` case-insensitively and normalizes lowercase | required |
| `media_type` | literal `etext` | required |
| `query` | trimmed nonblank string, 1–200 chars | required |
| `offset` | integer 0–1,000,000 | `0` |
| `limit` | integer 1–20 | `3` |
| `word_forms` | boolean | `false` |
| `include_older_spellings` | boolean | `true` |
| `prefix` | boolean | `false` |
| `suffix` | boolean | `false` |

Unknown query parameters are rejected through a strict FastAPI query model if
the installed FastAPI version supports it without weakening the existing v2
error contract; otherwise route/OpenAPI tests enumerate the only supported
parameters.

The endpoint maps options to the legacy engine exactly:

- `word_form_only = !word_forms`
- `include_modernized = include_older_spellings`
- `prefix` appends `*`; `suffix` prepends `*`; both form an infix query
- `includes=()` and `excludes=("*",)` because no source document fields are
  returned
- `number_of_fragments=None` so the endpoint can calculate an exact total and
  absolute window

The initial implementation performs one synchronous within-work search and
slices normalized hits in memory. It does not write a temporary search index or
return a `search_id`. Performance is bounded by query length and response window;
instrumenting or optimizing the engine later must preserve this public response.

### Response

```json
{
  "query": "doktor glas",
  "media_type": "etext",
  "offset": 0,
  "limit": 3,
  "total_hits": 5,
  "items": [
    {
      "index": 1,
      "page_name": "-2",
      "page_index": 2,
      "highlight": {
        "from_word_id": "w2_1",
        "to_word_id": "w2_2"
      }
    }
  ]
}
```

All models inherit the strict v2 base model. Numeric values are actual integers;
item `index` is the absolute zero-based order within this work; `page_name` is
the route segment; `page_index` is the source index. Items are sorted by index,
bounded by the requested window, and an out-of-range offset returns an empty
array with the correct total.

Each raw hit must contain a nonempty highlight list on one page, with a single
integer `ix`, one nonblank `n`, and safe word IDs matching
`w{page_index}_{nonnegativeOrdinal}`. The first and last token IDs define an
inclusive range; ordinal order must not reverse. Missing fields, cross-page
tokens, inconsistent page indices, unsafe IDs, or malformed engine totals fail
through the existing non-leaking v2 500 handler. OpenSearch failures retain the
existing typed 503 response.

No `lemgram`, `modernized`, raw OpenSearch document, source HTML, or temporary
search ID crosses the v2 boundary.

## Generated frontend contract and fixture

The backend OpenAPI snapshot is regenerated and checked. The frontend generated
client is regenerated from that snapshot and used for the hit request; no
handwritten duplicate response interface is added.

The deterministic Reader fixture gains:

- separate word spans such as `w2_1` and `w2_2` in the existing synthetic page;
- hit windows spanning pages `-3`, `-2`, and `-1`;
- single-token, phrase, first/middle/last, empty, out-of-range, delayed,
  malformed, and failed variants;
- isolated private/public hit ledgers and controls, separate from Reader
  metadata/page-asset requests.

This separation proves one Reader content request plus one optional hit request
without conflating them.

## Canonical Reader query state

The Reader parses query state inside its existing `<script setup>`; no composable
or store is introduced.

| Browser key | Canonical validation | API mapping |
| --- | --- | --- |
| `q` | one trimmed nonempty string, max 200 | `query` |
| `hit` | one canonical decimal integer `>=0`, no sign/whitespace/fraction | active absolute hit |
| `lemma` | absent or exactly `1` | `word_forms=true` |
| `ej_modern` | absent or exactly `1` | `include_older_spellings=false` |
| `prefix` | absent or exactly `1` | `prefix=true` |
| `suffix` | absent or exactly `1` | `suffix=true` |

`q` and `hit` must be present together. Any array, missing partner, invalid
flag, oversized query, or invalid hit causes the ordinary Reader to render with
no hit request. Unknown query keys remain in ordinary page URLs but never affect
the API request.

For active hit `h`, the Reader requests `offset=max(h-1, 0)` and `limit=3`. It
selects `items.find(item.index === h)` and the immediate adjacent indices when
present. An out-of-range cursor or failed hit request never destroys a valid
Reader page; it renders a compact bounded search-state message while ordinary
text and page navigation remain usable.

## Highlight transform

The existing Reader page receives trusted source HTML from its Nitro boundary.
A page-local transform uses the already-installed `linkedom` parser to locate
`span[id]` nodes by exact attribute equality—not by interpolating IDs into CSS
selectors.

When the active hit's `page_name` equals the visible `reader.pageName`, the
transform walks source spans in document order from `from_word_id` through
`to_word_id`, inclusive. It adds `.markee` to every node and `.flip` to
alternating nodes, matching Angular's marker language. Both boundary nodes must
exist in the correct order. Missing, duplicated, reversed, or page-mismatched
ranges leave the source HTML unchanged. No query or word ID is inserted as
markup.

The marked HTML remains SSR-visible and hydrates identically. Search-hit failure
does not turn the Reader into a loading-only shell.

## Navigation and toolkit

Ordinary previous/next-page anchors preserve the canonical keys (`q`, `hit`,
and nondefault flags) plus unknown existing query keys. They do not redirect the
user back to the hit's page; if the selected hit is absent from the newly visible
page, the search cursor/toolkit remains but the page is unmarked.

Previous/next-**hit** anchors target the adjacent hit's own `page_name` and
absolute `index`, preserving the canonical match flags. They are omitted at the
first/last boundary. First/last/goto-hit controls are deferred.

The visual search navigation uses the legacy `#search_nav` position in layout
`#toolkit`, teleported on the client. SSR also contains accessible current/total
search text in the Reader context so information is not client-only. The compact
toolkit shows current one-based position, total, and ordinary previous/next-hit
anchors.

Only the proven `.markee`, `.flip`, `.spinner_search`, and `#search_nav` rules
are ported from Reader SCSS. Existing Reader context/layout is not redesigned.

## Reader history interaction

The history writer continues to store exact `route.fullPath`. Therefore a visit
with canonical search state resumes to the same hit; a query-free visit stores
the existing query-free URL. Hit-request failure does not suppress history for
an otherwise valid Reader page because content remains primary.

## Error behavior

- Invalid/incomplete URL search state: ordinary Reader, no hit request/message.
- Valid query with zero or out-of-range hit: Reader remains visible with
  `Ingen sådan sökträff.` and no marker.
- Hit backend/transport/malformed response failure: Reader remains visible with
  `Sökträffen kunde inte hämtas.` and no marker.
- Missing/reversed word IDs in a valid typed response: Reader remains visible,
  current/total state remains, but source is unmarked.
- Reader metadata/page failure: retains the existing Reader error behavior and
  makes no history write.

## Visual contract and comparison

Deterministic Angular and Nuxt captures compare desktop 1440×1000 and iPhone 13
states for a single-token hit, two-token phrase, first/middle navigation state,
and ordinary Reader no-regression control. Authority includes translucent
primary marker color, alternating rotation, current/total typography, left
toolkit alignment, arrows, and mobile overflow.

Separate Reader-hit baselines are added; existing ordinary Reader assertions are
not replaced. The live comparison URLs are the verbose legacy Angular hit URL
and the canonical local `?q=...&hit=...` URL documented in reconnaissance.

## Verification gate

The slice is complete only when:

1. Backend validation, option mapping, normalization, windows, errors, route,
   method, OpenAPI, and full v2 tests pass.
2. Backend OpenAPI snapshot and generated frontend client are current.
3. Fixture ledgers prove private SSR/public browser selection and no hydration
   duplicate.
4. Ordinary, highlighted, malformed, out-of-range, failed, page-mismatch,
   navigation, Back/Forward, history, and injection tests pass.
5. Angular/Nuxt desktop/mobile hit visuals match while ordinary Reader remains
   unchanged.
6. Backend full v2 suite, frontend unit/SSR/browser/visual suites, typecheck,
   build, API check, and both repositories' `git diff --check` pass.

## Explicitly deferred

- full `/sök` result listing, filters, counts, sort, and pagination
- in-Reader search form/options
- first/last/goto-hit controls
- faksimil hit overlays and faksimil Reader
- legacy `traff`, `traffslut`, `hit_index`, and arbitrary `s_*` compatibility
- raw morphology display
- keyboard paging, page chooser, contents/parts/source info/focus/editor routes
- performance optimization that changes only the endpoint internals
