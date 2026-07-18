# Nuxt Author “Mera om” (`/semer`) design

## Goal

Port the exact Angular route `/författare/:author/semer` to the hybrid/SSR Nuxt
application without changing its appearance or substituting static placeholder
content. The route must fetch the same managed author HTML as Angular, render it
inside the existing author-document shell, and retain the current typed trust
boundary from FastAPI through generated TypeScript.

This route is distinct from `/författare/:author/mer`: `/mer` remains the typed
works/about-author listing, while `/semer` is the managed editorial document
whose Angular page title is `Mera om`.

## Authority and user-visible contract

Angular registers `/författare/:author/semer` as an `authorInfo` route. After the
author descriptor resolves, it requests exactly:

```text
GET /red/forfattare/{normalized_author_id}/semer/index.html
```

Angular discards the managed document head and injects its body into
`.page_content > .content.unbox`. The visible page uses the ordinary author
background and author heading, with the existing navigation order:
`Introduktion`, `Verk`, optional `Ljud`, optional `Dramawebben`, and optional
`Sök i texterna`. There is no active `semer` tab and no new interactive control.

The managed Presentationer index currently links to five such documents, and
their `/red/.../semer/index.html` sources are live. The public Angular route was
temporarily returning 502 during the audit, so deterministic parity will use a
frozen real managed document and local assets rather than depend on deployment
availability.

## Approaches considered

### A. Extend the typed author-document pipeline — selected

Add `semer` to the existing `presentation | bibliografi` discriminant in
FastAPI, regenerate the client, and extend the existing Nitro loader and dynamic
Nuxt author-document page. This preserves one contract, one sanitizer, one
page-local fetch, one error model, and one visual shell.

### B. Fetch legacy managed HTML directly from the page — rejected

This would be smaller in raw line count, but it would bypass the typed backend
descriptor, allow the route to influence an upstream path too directly, and
duplicate the server-only validation and sanitization boundary. It would also
make SSR errors and generated-contract drift less reliable.

### C. Create a dedicated `semer.vue` page/component — rejected

The visible structure and lifecycle are already implemented by the dynamic
author-document page. A separate page would duplicate route validation,
page-local fetching, error handling, navigation, SEO, and visual parity rules
without introducing a distinct user interaction.

## Backend contract

Expand `AuthorDocumentKind` from:

```text
presentation | bibliografi
```

to:

```text
presentation | bibliografi | semer
```

The existing endpoint remains:

```text
GET /v2/authors/{author_id}/documents/{document_kind}
```

For `semer`, the descriptor must use the same strict shape and derive exactly:

```text
source_path = /red/forfattare/{normalized_author_id}/semer/index.html
document_kind = semer
```

Author identity, normalized identity, lifespan, introduction/Dramawebben flags,
search URL, and nullable audio URL keep their existing definitions. The
provider query, missing/hidden-author behavior, typed provider-failure handling,
and OpenAPI operation remain unchanged except for the enum literal.

Backend tests must prove the new accepted literal and exact source path while
retaining rejection of every other literal, strict response serialization,
typed 404s, redacted provider failures, and a clean exported OpenAPI snapshot.

## Nuxt data flow

The generated client is regenerated from the checked FastAPI schema; generated
types are never edited by hand.

The existing shared `AuthorDocumentKind`, Nitro route validator, descriptor
acceptor, exact expected-source-path validator, and page route validator add
only the `semer` literal. The existing dynamic page continues to own its single
`useAsyncData` fetch to:

```text
/api/author-documents/{encoded_author_id}/semer
```

No composable is introduced. The page keeps its `kind:author` identity,
synchronous stale-data clearing, matching-response acceptance, SSR payload
reuse, and zero duplicate browser fetch after hydration.

The Nitro loader continues to:

1. request the typed descriptor from the private v2 endpoint;
2. verify author ID, document kind, normalized ID, and exact source path;
3. fetch the managed HTML from the server-only content base;
4. extract and sanitize the real body;
5. return the existing `AuthorSupplementalPage` response.

Public query parameters, cookies, authorization headers, provider origins, and
arbitrary redirect targets are not forwarded.

## HTML and security boundary

Real managed HTML is required. The existing sanitizer remains authoritative:
scripts, styles, forms, active subtrees, event handlers, unsafe URLs, and
unsafe attributes are removed; safe headings, prose, images, dimensions,
ordinary author/Reader links, and MP3/PDF/ZIP links remain. `_blank` links are
hardened with `noopener noreferrer`.

The route or provider descriptor must never select an origin. The descriptor
must equal the exact expected `/red/forfattare/{normalized}/semer/index.html`
path before the server joins it to the configured content origin. Absolute,
protocol-relative, traversal, encoded traversal, query, fragment, control, and
wrong-kind paths fail closed.

Duplicate author headings, large legacy image dimensions, and other harmless
corpus oddities are part of the visual authority and are not redesigned.

## Rendering and styling

The existing dynamic author-document page renders `semer`; no new page shell or
component is added. Its label mapping becomes:

```text
presentation -> Presentation
bibliografi  -> Bibliografi
semer        -> Mera om
```

SEO uses `{full_name}, Mera om | Litteraturbanken`. The existing ordinary author
background, body classes, heading, navigation, `.page_content`, and `.unbox`
styles remain unchanged. No `semer`-specific CSS is added unless a strict
Angular screenshot proves a missing inherited rule.

No Headless UI component is needed: the managed body contains static content
and native links/downloads, not a custom menu, dialog, disclosure, or listbox.

## Fixtures and authority

Freeze at least one real, rich managed document; `AlmqvistCJL` is preferred
because it covers headings, prose, portrait/thumbnail images, normalized legacy
author/Reader links, and PDF links. Record its source URL and SHA-256 provenance.
If MP3 and ZIP preservation cannot be proven with that body, add small frozen
Bellman/Ehrensvärd cases or narrow sanitizer fixtures rather than inventing
placeholder content.

Extend the current author-document fixture server and exact request ledgers.
The deterministic successful route must make exactly two private source
requests: one typed descriptor and one exact managed document. Required selected
assets are served locally and no production origin is allowed during visual
tests.

Extend the existing Angular author-document capture with desktop and mobile
`semer` states. Capture the real frozen body inside the Angular shell, assert its
exact request ledger, and commit the resulting immutable baselines. The Nuxt
comparison uses the repository threshold and maximum-difference policy with no
masks or threshold relaxation. Existing presentation/bibliography baselines
must remain unchanged.

## Error and navigation behavior

- Missing author or missing/hidden managed document: 404 with the existing
  local author-document messages.
- Provider, content, malformed descriptor, malformed HTML, or sanitizer-limit
  failure: local redacted 502; no provider detail or origin leaks.
- Direct SSR returns the real status rather than a 200 placeholder.
- Hydration consumes the SSR payload without a duplicate fetch.
- Client transitions among `presentation`, `semer`, and `bibliografi` clear old
  content synchronously; delayed obsolete responses cannot overwrite the current
  route.
- Existing legacy `/forfattare/{normalized}/semer` normalization remains a 307
  with suffix/query preservation and requires no special middleware branch.
- `/mer` continues to render the works/about-author listing and must never fetch
  the managed `semer` document.

## Verification

Tests extend the existing author-document suites rather than creating a parallel
test architecture:

- Backend model/provider/route/OpenAPI tests for the enum and descriptor.
- Nuxt unit tests for strict descriptor/source validation and sanitization of a
  real `semer` body.
- Nitro SSR API tests for the exact two-request ledger, non-forwarding, redirect
  blocking, and 404/502 mapping.
- Page SSR tests for title, background/body classes, author shell/navigation,
  real managed body, sanitization, and absence of origin leakage.
- Browser tests for hydration reuse, presentation → semer → bibliography and
  Back/Forward transitions, stale-response rejection, safe normalized links,
  and native image/media/download behavior.
- Desktop/mobile Angular capture and Nuxt visual comparison, plus unchanged
  presentation/bibliography comparisons.
- Legacy-route, author-profile, author-works, `/mer`, typecheck, production
  build, generated-client drift, and backend full-v2 regression gates.

## Explicitly deferred

This slice does not add cross-document footnote popovers, caching, offline
managed content, `omtexterna`/SLA pages, visual redesign, a new author shell,
placeholder media, or additional Headless UI components. If a future real
managed document requires footnote interaction, that becomes a separately
designed shared author-document interaction slice.
