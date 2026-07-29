# Nuxt author bibliographic database design

**Status:** Auto-approved under the active full-site Nuxt migration goal.

## Scope

Port the registered AngularJS route
`/författare/:author/biblinfo` to the independent hybrid/SSR Nuxt app without
changing its visible author shell, form, result columns, or toolkit controls.
The obsolete browser-side cross-origin XML request is replaced by a typed
FastAPI v2 boundary and generated TypeScript client.

## Angular authority

Angular first loads the ordinary author record and renders the standard author
heading/navigation. `sla-biblinfo` then immediately searches the global SLA
bibliographic provider, optionally sending repeated `resurs` values and `wf`.
It renders one result initially, permits next/previous/all, splits the four
ordered fields into two columns, and uses `[tom]` for empty values. The route is
registered for every valid author even though the database itself is global.

The provider currently configured by Angular is an obsolete plain-HTTP origin.
Nuxt must not call it from the browser and must not pretend that an unavailable
provider means that the route or author is missing.

## Typed API

Add:

```text
GET /v2/bibliography/entries
operationId: v2_get_bibliography_entries
```

Query parameters:

- `resource`: zero or more unique values from `manus`, `tryckt_material`,
  `annat_tryckt`, `forskning`, in canonical legacy order;
- `whole_text`: optional trimmed text, maximum 200 characters.

The provider URL is configured through `BIBLINFO_PROVIDER_URL`, defaulting to
the recorded legacy URL only for compatibility. FastAPI performs one bounded
GET with `username=app`, repeated `resurs`, and `wf` when present. Redirects,
non-XML responses, oversized bodies, timeouts, malformed XML, unexpected
elements, or more than 10,000 entries fail closed as `503`.

The strict response is:

```text
BibliographyEntriesResponse { items: BibliographyEntry[] }
BibliographyEntry {
  title: string
  isbn: string
  issn: string
  archive: string
}
```

Values preserve the provider's bounded inner-XML string, matching Angular's
`getInnerXML`, but Vue renders them with ordinary escaped interpolation exactly
as Angular's `{{v}}` did. They are never passed to `v-html`; active provider
markup therefore cannot enter the page DOM. No provider URL or body appears in
errors.

## Nuxt route

Add a dedicated `biblinfo.vue` beside the current author pages. It validates the
author segment, fetches the existing typed author profile and the bibliography
response directly in `<script setup>`, and uses request identities so stale
responses cannot cross route/search changes. The initial SSR request uses no
filters. Interactive submissions push no route state, matching Angular's
in-memory form; they replace the visible result atomically when complete.

The template preserves the Angular DOM classes and wording. Internal author,
works, Dramawebben, and Search destinations use `NuxtLink`; the audio handoff
remains an external anchor. Next/previous clamp at the available bounds. “Visa
alla sökträffar” renders every item in source order. Empty success shows “Inga
träffar”; failure keeps the author shell and displays a local unavailable state.

## Verification

- Backend unit/API/OpenAPI tests cover exact query forwarding, strict XML
  transformation, limits, redirect/status/media/size/malformed failures, and
  error envelopes.
- Regenerate the checked-in OpenAPI snapshot and Nuxt client.
- Nuxt SSR and browser tests cover initial hydration, all filter combinations,
  free text, empty/error states, next/previous/all, stale requests, internal
  Nuxt navigation, and no browser provider requests.
- Capture Angular and Nuxt desktop/mobile fixtures at matching viewports and
  compare the stable shell/form/result/toolkit geometry. The obsolete live
  provider is never required by the visual test.
