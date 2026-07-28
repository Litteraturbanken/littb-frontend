# Reader and Editor v2 Manifest Contract Design

**Status:** Approved by auto-approval on 2026-07-28

## Context

The Reader and Editor are the last large Nuxt surfaces whose bibliographic
metadata still crosses an untyped legacy boundary. The canonical Reader and
media shorthand resolver call `get_work_info`, while the Editor calls both
`get_work_info` and `count_pages`. Nitro then validates and normalizes raw
provider dictionaries into handwritten TypeScript models.

That implementation has useful security bounds and currently preserves the
site's behavior, but it leaves the contract invisible to FastAPI OpenAPI and
duplicates backend transport knowledge in Nuxt. A backend schema change can
therefore compile cleanly and fail only at runtime.

The broader end-to-end contract design requires strict FastAPI/Pydantic
responses, deterministic OpenAPI generation, generated TypeScript ownership,
and local types only at explicit presentation or asset boundaries. This
design applies that policy to the Reader and Editor without changing routes,
appearance, interaction, or source-asset behavior.

## Goals

1. Make FastAPI v2 the sole authority for Reader and Editor work metadata.
2. Expose complete, closed, bounded Pydantic contracts for public Reader and
   internal Editor manifest use cases.
3. Generate the transport types from the committed OpenAPI snapshot and use
   them throughout the Nitro metadata path.
4. Remove Nuxt's legacy metadata parsing, legacy metadata fallback, and
   duplicate transport models.
5. Preserve exact Reader and Editor feature, route, history, SSR, asset,
   visual, and degraded-editor behavior.
6. Make contract drift fail in focused and full quality commands.

## Non-goals

- Moving HTML, OCR, images, or stylesheets into the bibliographic OpenAPI
  contract. They remain separately validated asset boundaries.
- Adding a compatibility bridge between AngularJS and Nuxt. This intermediate
  application is not intended for deployment.
- Adding page-specific composables. Fetching used by one page remains in that
  page's `<script setup>`.
- Redesigning the Reader, Editor, sidebar, controls, labels, or loading state.
- Changing public routes or replacing router history pushes with URL
  replacement.
- Cleaning unrelated legacy backend endpoints.

## Authority boundary

FastAPI v2 is the only metadata authority. Nuxt must make no Reader or Editor
request to legacy `get_work_info` or `count_pages` endpoints, and FastAPI must
not aggregate metadata by calling both old HTTP sources. FastAPI may reuse
internal provider and filesystem logic, but raw provider records are private
implementation data and never cross the v2 response boundary.

The ownership chain is:

```text
OpenSearch and internal filesystem/provider functions
                         |
                         v
        typed FastAPI v2 provider and normalization
                         |
                         v
          closed, bounded Pydantic manifest DTOs
                         |
                         v
              committed OpenAPI snapshot
                         |
                         v
          generated openapi-typescript contracts
                         |
                         v
       typed Nitro manifest client and UI projection
                         |
                         v
 separately validated HTML, OCR, image, and stylesheet assets
```

The existing v2 `source-info` operation remains the authority for the
bare-title/source-information shorthand because it already has a generated,
purpose-built contract. The media-specific shorthand resolver moves to the
new Reader manifest.

## API surface

### Public Reader manifest

```http
GET /works/{author_id}/{title_path}/manifest?media_type=etext|faksimil
```

Stable operation ID: `v2_get_reader_work_manifest`.

The endpoint requires the exact public author, title path, and media type. It
returns one complete discriminated Reader manifest; it never chooses another
media representation merely because the requested one is absent.

### Internal Editor manifest

```http
GET /works/{work_id}/editor-manifest?media_type=etext|faksimil
```

Stable operation ID: `v2_get_editor_work_manifest`.

The endpoint is addressed by work ID and requested media type. It returns a
discriminated `complete` or `page_bounds_only` response so assets remain
useful when optional metadata is unavailable, matching the established
Editor behavior without representing partial metadata as trustworthy.

Both operations use the existing shared v2 error envelope for every declared
failure status. All public models inherit the closed v2 model policy with
unknown fields forbidden.

## Shared contract models

Public schema names are stable because generated TypeScript contract tests
refer to them. The core names are `ManifestContributionRole`,
`WorkManifestContributor`, `WorkManifestPage`,
`WorkManifestFacsimilePage`, `WorkManifestPart`, `DenseEditorPageBounds`,
`SparseEditorPageBounds`, `ReaderEtextManifest`,
`ReaderFacsimileManifest`, `EditorCompleteManifest`, and
`EditorPageBoundsOnlyManifest`. Serialized fields and meanings are fixed here.

### Contribution role

Contributor type and role normalize source-language variants to this public
enum:

- `editor`
- `translator`
- `illustrator`
- `photographer`

Unknown or ordinary-author contributions are `null`. The frontend owns the
Swedish display suffixes such as `(red.)`, `(övers.)`, `(ill.)`, and
`(fotogr.)`; the backend owns semantic role normalization.

### Work contributor

`WorkManifestContributor` contains:

- `author_id`: bounded route-safe identifier;
- `full_name`: bounded nonblank display name;
- `author_type`: normalized contribution role or `null`; and
- `role`: normalized contribution role or `null`.

The list is ordered as supplied by the selected representation, contains at
most 100 entries, has unique author IDs, and contains at least one entry for a
complete manifest. For a public Reader manifest, the first contributor's ID
must equal the requested `author_id`.

### Page identities

`WorkManifestPage` contains unique `page_name` and nonnegative `page_index`.
`WorkManifestFacsimilePage` adds a nonnegative `image_number`. Page arrays:

- contain at most 100,000 entries;
- have unique names and indexes;
- are returned in ascending `page_index` order; and
- preserve gaps rather than renumbering or manufacturing pages.

`image_number` is independent from `page_index` and is never inferred for the
canonical public Reader.

### Declared Reader page count

The Reader contract calls the optional source count
`declared_page_count`. It is deliberately not named `page_count` because it
is used to validate slider geometry and can differ from `pages.length`.
Nuxt derives the actual readable count from the page list. It exposes a slider
maximum only when every page index fits the declared zero-based range.

### Editor page bounds

Editor bounds are a discriminated union so contradictory states cannot be
represented:

- `dense`: a positive `page_count`, representing readable indexes
  `0..page_count - 1`; or
- `sparse`: a nonempty, ordered, unique `page_indexes` array.

The first and last readable indexes are derived from the selected arm. They
are not duplicated in the transport response.

### Parts and part authors

`WorkManifestPart` contains source position, full title, nullable navigation
and short titles, nullable title ID, start/end page names and indexes, and at
most 100 bounded part-author references. At most 10,000 parts are returned.

Source order is preserved even when parts overlap, nest, or have equal start
positions. Every part range must resolve against the selected page mapping
and have `start_page_index <= end_page_index`.

A part author contains `author_id`, plus nullable `full_name` and `surname`.
The backend resolves those fields where authoritative data exists. An
unresolved author remains explicit and nullable; Nuxt uses the existing ID
fallback and makes no second metadata request.

### Facsimile sizes

Facsimile size metadata is normalized to size numbers `1..5`, each with a
finite positive width. Sizes are unique and ordered. The preferred size is
`3` when present, otherwise the nearest smaller size, otherwise the smallest
available size. Provider-specific zero-based `faksimil_sizes` values do not
escape the backend.

All identifiers, names, titles, and route segments retain the existing strict
whitespace, control-character, and maximum-length checks. Source metadata is
bounded to 2 MiB before normalization.

## Reader manifest

The response is discriminated by `media_type` with `etext` and `faksimil`
arms. Both arms contain:

- exact `author_id` and `title_path` identity;
- `work_id` and nullable `editor_work_id`;
- ordered contributors and a primary contributor derived from position zero;
- `display_title`, `full_title`, nullable `imprint_year`, and nullable `urn`;
- ordered pages and nullable `declared_page_count`;
- positive bounded `page_step`;
- nullable `start_page_name` and `end_page_name` that must reference known
  pages when present;
- ordered parts;
- `searchable`, `is_drama`, `has_dramawebben`, and `has_nya_vagar` booleans;
  and
- nullable alternate-media metadata containing its media type and validated
  page identities.

The faksimil arm additionally contains facsimile pages, normalized size/width
metadata, and preferred size. The e-text arm contains ordinary page
identities and no asset URLs.

An e-text representation whose `pages` field is absent may inherit pages from
a sibling representation with the same `work_id`. A present but malformed
page field is an error, and faksimil never inherits pages. Alternate media
must match the same title path and validate independently; malformed declared
alternate metadata makes the provider response invalid rather than silently
exposing a misleading toggle.

Duplicate exact representations are contradictory provider data and fail.
The provider projection excludes `content_vector` and requests only fields
needed by this contract.

## Editor manifest

The response is discriminated by `status`.

### Complete

`status: complete` contains:

- exact `work_id` and requested `media_type`;
- one valid Editor page-bounds arm;
- complete work title, title-path, contributor, searchability, and imprint
  metadata;
- validated page identities when supplied by metadata;
- validated parts, which may exist only when all page references resolve;
- normalized facsimile widths when the selected media is faksimil; and
- a nullable structured public-reader close target derived from a validated
  public representation.

A complete manifest may have an empty page-name mapping when valid work
metadata and dense page bounds exist. It may not contain a partly valid title,
contributor, part, identity, or close target.

### Page bounds only

`status: page_bounds_only` contains only:

- `work_id`;
- requested `media_type`; and
- one trustworthy Editor page-bounds arm.

Malformed or unavailable optional metadata degrades atomically to this arm
when bounds can still be established independently. Metadata-dependent
controls remain disabled, but the requested asset and raw-index navigation
remain usable.

For exact visual and behavioral parity, Editor e-text asset identity remains
the zero-based page index, and Editor facsimile image identity remains
`page_index + 1`. The canonical public Reader alone uses metadata
`image_number`; Editor does not silently adopt a different numbering scheme.
Nitro always constructs the established size-3 Editor facsimile source even
when width metadata is unavailable; validated widths add the other available
sizes without changing that fallback.

Bounds are established from a validated exact representation or internal
filesystem-count logic. The backend does not make an HTTP request to the
legacy `count_pages` route. If metadata service availability is unknown and a
filesystem probe returns zero, the endpoint reports unavailable rather than
claiming authoritative absence.

## Failure semantics

### Reader

- `200`: exactly one requested representation completely validates.
- `404`: the exact author/title identity or requested representation does not
  exist.
- `422`: route or query input violates public identifier or media constraints.
- `503`: the metadata provider is unavailable or times out.
- `500`: the provider responds but selected data is contradictory or
  malformed.

Reader responses never degrade. Rendering a public page from incomplete
metadata risks selecting the wrong work, page, or asset.

### Editor

- `200 complete`: exact metadata and bounds validate.
- `200 page_bounds_only`: trustworthy bounds exist but complete metadata does
  not.
- `404`: authoritative sources establish that neither the requested
  representation nor readable pages exist.
- `422`: work ID or media input is invalid.
- `503`: source failure prevents trustworthy bounds from being established.
- `500`: provider data is contradictory and cannot be safely normalized or
  degraded.

Provider transport failures, authoritative absence, and invalid provider
data remain distinct. Errors use the shared typed `ApiErrorResponse`; raw
provider exceptions, queries, hostnames, and bodies are never disclosed.

## Nuxt integration

The generated operation responses own every transport field. Handwritten
aliases may select operation responses or generated component schemas but
may not reproduce their properties.

The current `reader-source.ts` legacy parser becomes a small typed client and
projection module. It:

1. calls `v2_get_reader_work_manifest` through `createLbApiClient`;
2. maps typed API failures to deliberate Nitro errors;
3. derives page, part, alternate-media, navigation, slider, SEO, and asset
   projection data; and
4. loads separately bounded HTML/OCR/image assets.

The canonical Reader endpoint and media-specific resolver share this typed
manifest path. The Editor endpoint calls
`v2_get_editor_work_manifest`, switches exhaustively on `status`, and then
loads the selected asset. Neither path uses `$fetch<unknown>`, a compile-only
`$fetch<T>` assertion for v2 transport, or a fallback representation.

Generated contributor, part, page, size, and bounds types flow directly into
the local view state where their semantics are unchanged. Handwritten
`ReaderWorkContributor`, `ReaderPart`, and page-identity duplicates are
removed or become direct generated aliases.

Local Nuxt types remain only for values Nuxt creates:

- sanitized or branded HTML;
- constructed and authority-checked asset URLs;
- current/previous/next page and part navigation;
- slider percentage and other UI projections;
- SEO description;
- facsimile source URLs and OCR overlay data; and
- final page-specific `ReaderPage` and `EditorReaderPage` view objects.

Page-specific browser fetching stays directly in each page's `<script setup>`.
Existing route-parameter watchers, abort controllers, debounced navigation,
router pushes, Back/Forward behavior, horizontal-scroll retention, and stable
sidebar lifecycle remain unchanged.

Both Reader and Editor Nitro page responses set `Cache-Control: no-store`.
Private backend and asset bases remain server-only.

## Deterministic code generation

The committed backend snapshot is the canonical TypeScript generation input:

1. the backend exports FastAPI/Pydantic output to `openapi/v2.json`;
2. `scripts/export_v2_openapi.py --check` detects backend snapshot drift;
3. Nuxt runs `openapi-typescript` against that committed file;
4. `api:check` detects generated TypeScript drift; and
5. Nuxt typecheck proves consumers remain compatible.

A root Invoke generation task performs backend snapshot export followed by
frontend generation in that order. A check task performs both drift checks
without requiring running dev servers. Generated files are never manually
edited.

A compile-only Reader/Editor contract test derives both operation types
through generated `paths` or `operations`, asserts exact success and error
arms, proves Editor discrimination, and aliases shared nested models. It uses
positive exact-type equality rather than syntax-based checks or broad
`@ts-expect-error` allowlists.

## Verification strategy

Tests protect behavior at the layer that owns it.

### Backend model tests

- bounds, uniqueness, nonblank/control-safe text, and collection limits;
- contribution-role normalization;
- Reader media and Editor status discrimination;
- dense versus sparse Editor bounds; and
- required-nullable versus omitted semantics where applicable.

They do not restate the complete OpenAPI schema or test Pydantic syntax.

### Backend provider tests

- exact identity and media selection;
- duplicate exact representation rejection;
- explicit provider field projection excluding `content_vector`;
- sparse and non-contiguous page preservation;
- e-text sibling inheritance and no facsimile inheritance;
- independent facsimile image numbers;
- size/width normalization and preferred-size selection;
- contributor precedence and normalized roles;
- part source order, overlap, nesting, equal starts, and unresolved authors;
- complete versus atomic Editor degradation;
- dense, sparse, and filesystem-derived Editor bounds; and
- unavailable, absent, malformed, and contradictory sources.

Provider tests assert observable query and normalization requirements, not
private helper call order.

### Backend API and OpenAPI tests

- method, route, operation ID, parameters, serialized success arms, declared
  errors, and redaction;
- exact status classification for not found, invalid input, unavailable
  provider, and invalid provider data;
- committed snapshot drift; and
- cross-cutting schema closure and typed-error invariants.

### Nuxt unit and SSR tests

- generated-type consumption and exhaustive union handling;
- Reader and Editor view projection from each generated arm;
- alternate-media mapping, slider bounds, page/part navigation, contributor
  suffixes, and close targets;
- branded HTML and asset authority boundaries;
- SSR response, `no-store`, private-base redaction, and typed error mapping;
- media-specific shorthand resolution; and
- zero metadata calls to legacy `get_work_info` and `count_pages` routes.

### Browser and visual tests

- canonical e-text and faksimil navigation;
- sparse Editor navigation and degraded Editor assets;
- OCR rendering and word-selection dictionary affordance;
- alternate media, search-hit marquee, dialogs, sliders, focus mode, and
  Back/Forward history;
- stale response cancellation, debounced page flipping, retained horizontal
  scroll, and stable sidebar lifecycle; and
- existing desktop/mobile visual authorities with no baseline updates,
  masking, or threshold relaxation.

## Quality commands

A focused `quality.reader-editor` Invoke task runs:

1. backend manifest model, provider, and API tests;
2. backend OpenAPI snapshot check;
3. frontend generated-client check;
4. the compile-only manifest contract;
5. focused Nuxt unit and SSR tests;
6. Nuxt typecheck; and
7. Nuxt ESLint.

After focused work is green, the existing full release gate remains the
completion authority: complete backend tests, backend static analysis,
frontend lint/type/build/contracts, all SSR cases, all Playwright E2E cases,
immutable visual comparisons, request-ledger checks, and clean diff checks.

## Implementation sequence

1. Add backend models, typed provider normalization, endpoints, and focused
   tests.
2. Export the OpenAPI snapshot and regenerate TypeScript.
3. Add compile-time contract assertions and deterministic Invoke tasks.
4. Migrate the Reader manifest path and delete its legacy transport parser.
5. Migrate the Editor manifest path and preserve typed bounds-only behavior.
6. Run focused browser parity checks and repair only evidenced regressions.
7. Run the complete release gate and update architecture documentation.

Each vertical slice is test-driven. Existing user changes and unrelated dirty
files are preserved, and no branch integration, push, or deployment is part
of this design.

## Superseded assumptions

This focused design supersedes earlier Reader/Editor documents only where
they treated Nitro's direct legacy metadata calls as the long-term boundary
or allowed a missing-media fallback. Their visual, routing, asset,
interaction, security, and parity requirements remain controlling.

It also narrows the umbrella design's statement that legacy endpoints may
remain during local migration: they may continue to exist for other clients,
but Nuxt Reader and Editor must have zero runtime dependency on them when this
tranche completes.
