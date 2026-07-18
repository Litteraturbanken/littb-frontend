# Nuxt Author Supplemental Documents Design

**Date:** 2026-07-18

## Goal and scope

Port the two managed author-document routes to Nuxt without changing their
editorial content, layout, or ordinary link behavior:

- `/författare/:author/presentation`;
- `/författare/:author/bibliografi`.

Angular is the behavioral and visual authority. It loads the author record,
uses `authorid_norm` to request
`/red/forfattare/{authorid_norm}/{document}/index.html`, extracts the document
body, and inserts it as `.page_content > .content.unbox` under the ordinary
author heading and navigation. Nuxt will continue to fetch that managed XHTML
from the same `/red` source. The XHTML is not copied into a Vue component and
is not replaced with placeholder copy.

This slice does not include `/semer`, `/omtexterna`, SLA documents, the legacy
footnote popover, Ljud discovery, or any redesign. It adds no dropdown or modal,
so no Headless UI component is needed. Tailwind is used only where the current
author template already uses equivalent utility classes.

## Considered approaches

1. **Recommended: typed descriptor plus a Nitro content adapter.** FastAPI
   returns a narrow, generated descriptor containing the author shell and the
   validated `/red` source path. A same-origin Nitro endpoint fetches the XHTML,
   extracts and sanitizes its body, and returns a strict page payload. This
   keeps `authorid_norm` and the upstream origin server-side, gives SSR and SPA
   navigation one boundary, and prevents raw active markup from entering the
   Nuxt payload.
2. Extend `AuthorProfile` and let the page fetch `/red` directly. This is fewer
   files, but it over-fetches introductions and portraits, exposes the source
   path to two request implementations, and makes status/sanitizer behavior
   easier to diverge between server and browser.
3. Make FastAPI fetch and return the XHTML. This produces one typed operation
   but couples the search API to the static-content service and transfers an
   editorial document through a service that otherwise owns metadata.

Approach 1 is selected. It is the smallest boundary that is strict, SSR-safe,
testable, and faithful to the existing content source.

## Typed backend descriptor

FastAPI adds:

```text
GET /v2/authors/{author_id}/documents/{document_kind}
operationId: v2_get_author_document

AuthorDocumentKind = "presentation" | "bibliografi"

AuthorDocumentDescriptor
  author_id: string
  full_name: string
  birth_year: string | null
  death_year: string | null
  has_introduction: boolean
  has_dramawebben: boolean
  search_url: string | null
  document_kind: AuthorDocumentKind
  source_path: string
```

The model forbids extra fields and requires every key. The provider performs
one exact `authorid.raw` lookup with a limit of two and only the fields needed
above: `authorid`, `authorid_norm`, `show`, `full_name`, `birth.plain`,
`death.plain`, `intro`, the `dramawebben` object, and `searchable`. Hidden, absent,
duplicate-exact, mismatched, or malformed records retain the established author
API behavior: missing is 404, invalid path input is 422, malformed data is a
non-leaking 500, and OpenSearch unavailability is typed 503.

The descriptor does not gate direct access on the profile's `presentation` or
`bibliography` flags. Angular attempts the managed-document request for any
valid direct route; the static source's 404 remains authoritative. The source
path is built only from independently validated `authorid_norm` and the literal
document kind:

```text
/red/forfattare/{RFC3986(authorid_norm)}/{document_kind}/index.html
```

This is also why reconstructing the source from the public route is forbidden:
for example, public `SöderbergH` maps to normalized `SoderbergH` on `/red`.

## Nuxt server boundary and data flow

`GET /api/author-documents/{author}/{document}` is the only page data source.
The handler validates the decoded author segment with the existing author-route
validator and accepts only the two literal document kinds. It calls the
generated FastAPI operation through the private `apiBase`, checks the complete
descriptor at runtime, verifies that `author_id` and `document_kind` match the
request, and verifies that `source_path` has the exact expected `/red` shape.
It then fetches that path from the server-only `contentBase` with `retry: 0`.
No public query string, cookies, authorization header, or caller-supplied origin
is forwarded to either upstream.

On success the handler returns:

```text
AuthorSupplementalPage
  author: AuthorSupplementalAuthor
  documentKind: "presentation" | "bibliografi"
  bodyHtml: string

AuthorSupplementalAuthor
  authorId: string
  fullName: string
  lifespan: string
  hasIntroduction: boolean
  hasDramawebben: boolean
  searchUrl: string | null
```

The response satisfies a shared TypeScript interface used by the handler and
page. The handler sets `cache-control: no-store` for now; deployment caching is
still deferred.

Status mapping is deliberate:

- backend author 404 -> HTTP 404, code `author_document_author_not_found`;
- static document 404 -> HTTP 404, code `author_document_not_found`;
- backend 422/500/503, network failure, wrong identity, malformed descriptor,
  invalid source path, missing/malformed `<body>`, or non-404 content failure ->
  HTTP 502, code `author_document_unavailable`.

Error responses expose only these local codes and Swedish page copy; upstream
URLs, bodies, and exception text are never serialized.

## Body extraction and sanitizer

The Nitro adapter parses the complete XHTML with `linkedom`, requires one body,
and returns only the body's children. It preserves the editorial structures
used by the author corpus, including headings, paragraphs, inline emphasis,
lists, definition lists, figures/images, tables, captions, separators, code,
quotes, and existing CSS classes/IDs. The observed authority documents' nested
heading and bibliography structure is not normalized or rewritten.

Before serialization it:

- removes comments and entire active subtrees such as `script`, `style`,
  `iframe`, `object`, `embed`, `form`, controls, SVG/MathML, audio/video, and
  templates;
- removes event handlers, `srcdoc`, framework directives, inline styles, and
  attributes outside an explicit per-element allowlist;
- retains static global `class`, `id`, `lang`, and `title`; anchor
  `href`, `target`, `rel`, `name`, and `download`; image `src`, `alt`, `width`,
  and `height`; and structural table span/header attributes;
- accepts fragments, safe relative/root-relative URLs, HTTP(S), `mailto:`, and
  `tel:` for links, while image sources are limited to safe relative,
  root-relative, or HTTPS URLs;
- rejects controls, backslashes, repeated-decoding traversal,
  protocol-relative URLs, malformed encodings, and active/custom schemes;
- rewrites legacy `/forfattare/` links to `/författare/`; and
- adds `noopener noreferrer` to retained `target="_blank"` anchors.

Sanitization is deterministic and idempotent. Only sanitized `bodyHtml` reaches
SSR markup or the hydration payload.

## Page rendering and route changes

One validated dynamic page,
`pages/författare/[author]/[document].vue`, owns both routes; Nuxt's static
`mer`, `dramawebben`, and `titlar` pages remain more specific routes. The page
fetches its model directly in `<script setup>` through `useRequestFetch`; there
is no one-use composable. A route-keyed `useAsyncData` request is lazy for SPA
transitions but awaited by SSR.

The request and accepted payload both carry the exact
`{author}:{documentKind}` identity. The accepted value is cleared synchronously
when either route parameter changes, and a late response is ignored unless its
identity still matches. The old author's heading, metadata, navigation, or body
must never appear under a new URL. During client transitions the existing
`.searching > .preloader` is shown; SSR renders the final content or error and
sets the real 404/502 response status.

The successful DOM follows Angular:

- balanced author heading and lifespan;
- ordinary author navigation: Introduktion when present, Verk always,
  Dramawebben when present, and Sök i texterna when declared;
- no supplemental tab and therefore no false `aria-current` item;
- `.page_content > .content.unbox` containing the managed body; and
- ordinary anchors with browser-native navigation/download behavior.

Body classes remain `focus page-authorInfo ready`; `forf2_bkg.jpg` remains the
`html` background. Metadata is exactly
`{full_name}, Presentation | Litteraturbanken` or
`{full_name}, Bibliografi | Litteraturbanken`, with the same text without the
site suffix as the description. Missing authors keep the established author-ID
error. A missing document and a temporary 502 each receive concise page-local
Swedish errors instead of an empty 200.

## Verification

Tests are observed failing before implementation.

- Backend tests cover the exact selected query, normalized Unicode/public IDs,
  both literal kinds, all strict transformations and errors, method/path
  behavior, OpenAPI shape, and snapshot freshness.
- Fixture and unit tests cover private/public isolation, exact request ledgers,
  delayed/failing/missing content, source-path rejection, body extraction,
  the full element/attribute policy, malicious URL probes, `/forfattare/`
  rewriting, blank-target hardening, idempotence, and absence of raw probes in
  returned JSON.
- SSR tests cover both routes, exact headings/navigation/body/metadata, one
  private descriptor call plus one exact content call, no hydration duplicate,
  and the complete 404/502 matrix.
- Browser tests cover hydration, native PDF/download links, direct and router
  navigation between both document kinds and two authors, synchronous stale
  clearing, delayed latest-wins behavior, history, loading/error cleanup, and
  absence of console/page/hydration errors.
- Frozen Angular authority and Nuxt comparisons cover Hjalmar Söderberg's
  presentation and Selma Lagerlöf's bibliography at 1440x1000 and the iPhone 13
  Chromium viewport. Both use the same frozen XHTML and block production
  escapes.

The slice closes only after the backend v2 suite, frontend unit/SSR/behavior/
visual suites, typecheck, build, generated-client drift check, and diff checks
all pass without changing Angular production sources or copied legacy SCSS.
