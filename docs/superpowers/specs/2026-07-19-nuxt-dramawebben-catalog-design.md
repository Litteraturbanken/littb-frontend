# Nuxt Dramawebben Catalog Design

## Goal

Port `/dramawebben/pjäser` from AngularJS to Nuxt SSR without changing its
visual design or replacing its real backend data. The page must render the
catalog in the initial HTML, fetch the catalog only once, and retain the legacy
client-side filters and Pjäser/Författare views.

## Architecture

FastAPI owns a new final-form `GET /v2/dramawebben/catalog` operation. It makes
one bounded OpenSearch query for Dramawebben drama representations, validates
the sparse legacy documents, groups representations into works, derives the
author list, converts the six numeric drama fields to nullable integers, and
returns only display-ready catalog data and safe first-party URLs.

The OpenAPI snapshot is regenerated and Nuxt consumes the generated operation
directly inside `/dramawebben/pjäser`'s `<script setup>`. No page-only composable
or Angular compatibility layer is introduced. The response is serialized into
the Nuxt payload for hydration; all filters then run locally and make no further
requests.

## Contract

The response contains `works` and `authors`. A work has its display title,
authors, ordered media actions, `Barnlitteratur` state, and nullable values for
acts, roles, pages, female roles, male roles, and other roles. An author has the
ID, indexed/display names, optional surname/gender, and optional birth/death
years. Media actions are ordered exactly as Angular: etext, faksimil, epub, pdf,
infopost. Downloadable PDF/EPUB links retain download behavior; reading links
retain `#dw` in the rendered page.

Provider results are capped at 10,000 representations, sorted by `sortkey`, and
filtered to visible or hidden Dramawebben provenance exactly as the current
`show_all=true` request. Malformed provider data fails the whole response
closed. OpenSearch failures become the standard non-leaking v2 `503` response.

## Route and State

`/dramawebben/pjäser` is a real SSR page and uses the existing Dramawebben
subpage shell and CSS. The shell's Pjäser link is active. Unknown managed names,
including `/dramawebben/författare`, remain 404.

The query owns the current list (`visa=pjäser|författare`) and filters:
`gender`, `author`, `mediatype`, `filterTxt`, `barnlitteratur`, and the six range
keys. Initial SSR applies them. Client changes replace history for filters and
push history for the list toggle, so Back/Forward restores the visible table.
Missing and invalid values use the Angular defaults and are not sent to the API.
Rensa filter returns to the query-free catalog route.

The `om-boken` dialog is deliberately deferred to the next bounded slice. An
infopost link remains a real catalog URL and is not replaced with placeholder
content.

## Components and Visuals

The page reuses the existing `.page-dramaweb` markup and byte-equivalent legacy
SCSS. Headless UI Listbox components provide the author, gender, and media
dropdowns; a Headless UI Menu provides `Akter och roller`. Native range inputs
provide the six bounded ranges inside that menu. Existing legacy class names
remain the visual contract, with only visually hidden accessible labels added.

Angular authority screenshots use a small deterministic populated fixture at
desktop and mobile sizes. The Nuxt comparison must be pixel exact unless a
captured browser-engine difference is explicitly justified. No redesign or
new visual language is allowed.

## Verification

- Backend transform, provider-query, endpoint, strict-model, and OpenAPI tests.
- Deterministic OpenAPI export and generated-client freshness.
- Nuxt SSR tests for populated initial HTML, exact request count, status/error
  behavior, and no legacy/browser catalog requests.
- Browser tests for every filter, list toggle, query ownership, history,
  Headless UI keyboard/focus behavior, clearing, and stale/error isolation.
- Desktop and mobile Angular-authority visual comparisons.
- Live smoke against ports 8010 and 3020 proving the real catalog is populated.

