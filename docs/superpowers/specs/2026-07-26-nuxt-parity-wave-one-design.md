# Nuxt Feature-Parity Wave One Design

## Scope

This wave restores the confirmed behavioral and visual regressions in the Nuxt application while preserving the existing Litteraturbanken appearance:

- use `vue-multiselect` 3.5.0 for all multi-value filters on `/sök` and `/bibliotek`;
- restore the reader's 200 ms trailing page-load debounce without collapsing browser-history entries;
- preserve click-to-jump behavior on reader slider tracks;
- restore Library title ellipsis/full-title discovery and author contribution labels;
- load selectable OCR for every searchable facsimile page;
- restore the typed FastAPI dictionary endpoint and synchronize the generated frontend contract;
- add a live-parity regression sweep for nearby small defects.

Ordinary single-value selects remain native. No visual redesign is authorized.

## Component boundaries

### Multi-value filters

`SearchMultiSelect.vue` becomes the single adapter around `vue-multiselect`. Its public model remains `readonly string[]`, and its options remain `{ value, label, selectionLabel?, disabled? }`. This keeps page-specific state and fetching in each page's `<script setup>` while containing the package-specific object model, selection removal, accessible naming, legacy Select2-compatible hooks, and styling in one component.

The five Library multi-value controls use the same adapter. Grouped keyword options are flattened with group metadata at the boundary; emitted values are normalized to declared option order so URL bytes and query predicates remain deterministic. Gender and other ordinary single selects stay native.

The package stylesheet loads before project styles. Focused overrides retain the current Select2-era dimensions, typography, colors, chips, placeholders, and menu geometry.

### Reader navigation

Route transitions remain normal Nuxt Router pushes, so every page flip remains in browser history. On the client, the route-derived reader request identity is copied into a 200 ms trailing debounced fetch identity. Initial SSR and first hydration data remain immediate. Navigation targets are calculated from the latest route/pending page, not retained response data, so repeated keys advance through every intended route even while content is loading.

The reader shell and sidebar remain mounted while only page content changes. No loading notice is introduced.

### Reader slider

Track clicks select the position nearest the clicked coordinate and commit once on release/change. The single-handle reader slider therefore jumps to any clicked point on the line. Keyboard and drag behavior remain unchanged. Tests cover a bare track click away from the existing thumb, not only a drag that starts on the thumb.

### Facsimile OCR

Searchable facsimiles always request and render their transparent OCR overlay. The `ocr` query parameter controls only inspection presentation (`.reader_main.ocr`); search-marker query parameters add highlighting but do not determine whether OCR data exists. Non-searchable facsimiles do not request OCR.

### Library results

Relevance-result titles use the same single-line constrained ellipsis behavior as the legacy implementation. The short title remains the visible label and the different full title is available as a tooltip.

Relevance parsers retain `main_author.type`. Editor and illustrator suffixes render as separate muted spans after the linked name: `(red.)` and `(ill.)`.

### Dictionary API

The missing `/v2/dictionary/articles` implementation is restored from backend snapshot `aed55ae` onto the checked-out backend branch. Because the checked-in Nuxt generated client already includes that snapshot's bibliography-entry and author-audio contracts, the complete coherent API snapshot is restored rather than leaving the OpenAPI/client pair knowingly divergent. The dictionary endpoint validates a single bounded word, calls the existing RED dictionary provider with `strict=true`, selects the exact base form or first article, and returns `{ word, base_form, article_html }` with typed 404, 422, and 503 failures.

Backend route/OpenAPI tests and a mounted-application assertion prevent another absent-router regression. The Nuxt generated client is checked against the exact backend schema. At least one smoke test uses the real FastAPI application rather than only the JavaScript fixture.

## Verification

Each behavior is introduced test-first. Focused unit/SSR/Playwright tests run during implementation, followed by type checking, the adapted root Playwright specification, and browser comparison against the local and live pages. Visual assertions target computed layout and stable screenshots where appropriate.
