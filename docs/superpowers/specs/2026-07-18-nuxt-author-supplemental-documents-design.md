# Nuxt Author Supplemental Documents Design

**Date:** 2026-07-18

## Goal and scope

Port these managed author-document routes to Nuxt without changing their
editorial content, layout, navigation, or ordinary link/download behavior:

- `/författare/:author/presentation`;
- `/författare/:author/bibliografi`.

Angular is the authority. It loads the author record, uses `authorid_norm` to
request `/red/forfattare/{authorid_norm}/{document}/index.html`, extracts the
body, and inserts it as `.page_content > .content.unbox` beneath the ordinary
author heading and navigation. Nuxt continues to fetch that managed XHTML from
the same `/red` source; it is not copied into Vue production code.

The slice includes the permanent normalized-link boundary needed by this
managed corpus. XHTML uses legacy URLs such as
`/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext`; Angular resolves both
normalized IDs before changing the prefix. Nuxt must do the same. This is not
an Angular/Vue bridge: `/forfattare/**` remains a supported managed-content
input and redirects to the canonical Nuxt `/författare/**` route.

Ljud discovery is included because both selected authority authors have a live
audio page and Angular displays Ljud between Verk and Dramawebben. `/semer`,
`/omtexterna`, SLA documents, and deployment caching remain separate work. The
footnote popover remains deferred only because the two frozen authority XHTML
documents contain no interactive footnote references and Angular builds no
`noteMapping` for presentation/bibliography. A corpus audit and separate design
are required before claiming every other author document behaviorally complete.
There is no dropdown/modal in this slice, so Headless UI is not added.

## Selected architecture

Three approaches were considered: direct page fetches from `/red`, returning
XHTML through FastAPI, and a typed descriptor plus a Nitro content adapter. The
third remains selected. FastAPI owns public/normalized IDs, conditional author
navigation, Ljud discovery, and legacy-route resolution. Nitro owns the private
content origin, strict source-path equality, XHTML extraction/sanitization, and
local 404/502 translation. The page owns its single page-local fetch and route
identity. This keeps the slice narrow without duplicating model logic or
allowing raw active markup into hydration state.

## FastAPI contracts

### Document descriptor

```text
GET /v2/authors/{author_id}/documents/{document_kind}
operationId: v2_get_author_document

AuthorDocumentKind = "presentation" | "bibliografi"

AuthorDocumentDescriptor
  author_id: string
  normalized_author_id: string
  full_name: string
  birth_year: string | null
  death_year: string | null
  has_introduction: boolean
  has_dramawebben: boolean
  search_url: string | null
  audio_url: string | null
  document_kind: AuthorDocumentKind
  source_path: string
```

Every key is required and extras are forbidden. One exact `authorid.raw` query
selects only `authorid`, `authorid_norm`, `show`, `full_name`, `birth.plain`,
`death.plain`, `intro`, `dramawebben`, and `searchable`. The established
fail-soft audio helper queries the normalized lowercase WordPress slug with a
five-second timeout; any network/status/shape failure produces `audio_url:
null`, never a document failure. The helper moves to a neutral module used by
Author Works and this operation, avoiding circular imports without changing
Author Works behavior.

The descriptor does not gate a direct route on `presentation` or
`bibliography` flags. Angular attempts the file request for any valid direct
route, so the static source's 404 remains authoritative. `normalized_author_id`
is independently validated as a single raw segment. FastAPI constructs:

```text
/red/forfattare/{RFC3986(normalized_author_id)}/{document_kind}/index.html
```

Hidden/missing authors return 404, invalid request values 422, OpenSearch
failure typed 503, and malformed/ambiguous provider data a non-leaking 500.

### Managed legacy-link resolver

```text
POST /v2/legacy-author-routes/resolve
operationId: v2_post_legacy_author_route_resolve

LegacyAuthorRouteRequest
  normalized_author_id: string
  normalized_title_id: string | null
  media_type: "etext" | "faksimil" | null

LegacyAuthorRouteResolution
  author_id: string
  title_id: string | null
```

The title/media fields must be both null or both non-null. The provider resolves
the author with one exact `authorid_norm` keyword query selecting only
`authorid`, and resolves a requested Reader title with one exact
`titleid_norm` keyword query in the literal media index selecting only
`titleid`. No analyzed query or caller-supplied index is accepted. Missing
normalized IDs return 404; distinct duplicate canonical results and malformed
data return non-leaking 500; OpenSearch failure returns typed 503.

Normalized author and title inputs are separate strict segment types. Author
length is 1–100; title length is 1–200, matching the established title-input
contract. Neither type trims: leading/trailing whitespace is rejected. Both
reject `%`, slash, backslash, dot segments, controls, DEL/C1, and unpaired UTF-16
surrogates. Boundary tests cover author 100/101 and title 100/101/200/201.

A Nitro server middleware handles only GET/HEAD paths beginning with the exact
ASCII `/forfattare/` prefix. It accepts one safe author segment and optionally
recognizes Angular's Reader shape
`/forfattare/{author}/titlar/{title}/sida/{page}/{etext|faksimil}`. It calls the
generated resolver privately, RFC3986-encodes returned canonical IDs, replaces
only the identified segments, preserves remaining safe path segments and the
raw query, and sends a 307 replace redirect. Resolver 404 becomes local 404;
every other resolver/schema/identity failure becomes non-leaking 502. It never
redirects `/författare/**`, so loops are impossible.

Path parsing fully decodes each raw segment to stability in at most 16 passes,
then applies the author 100/title 200/other 512-character limits and the same
percent/separator/dot/control/surrogate rejection. Only the exact seven-segment
Reader shape triggers title resolution; all other safe suffixes resolve the
author only and remain unchanged. The private resolver accepts only a strict
response whose title nullability matches the request. The redirect takes its
query suffix byte-for-byte from the original Node request URL, preserving
ordering, duplicate keys, and encoding.

The sanitizer preserves safe `/forfattare/**` hrefs byte-for-byte. It does not
perform the route-breaking prefix-only rewrite. Tests prove:

```text
/forfattare/LagerlofS
  -> /författare/LagerlöfS -> rendered Selma Lagerlöf profile

/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext
  -> /författare/SöderbergH/titlar/Förvillelser/sida/3/etext
  -> rendered Förvillelser Reader content
```

## Strict Nitro document boundary

`GET /api/author-documents/{author}/{document}` is the page's only data source.
It validates the decoded author with the existing route validator and accepts
only the two literal document kinds. It calls the generated descriptor through
private `apiBase`; no request cookie, authorization header, public query, or
caller-controlled origin is forwarded.

The source contract is executable, not pattern-based. Nitro validates
`normalized_author_id` as a raw 1–100-character segment: nonempty, unchanged by
trim, not `.`/`..`, and containing no percent sign, slash, backslash, control,
or DEL/C1 character. It computes:

```text
expected = "/red/forfattare/" + RFC3986(normalized_author_id)
         + "/" + requested_document_kind + "/index.html"
```

`descriptor.author_id` and `descriptor.document_kind` must equal the decoded
request, and `descriptor.source_path` must equal `expected` byte-for-byte.
Only then may Nitro fetch `${serverOnlyContentBase}${expected}` with `retry: 0`.
Thus absolute/protocol-relative paths, queries/fragments, wrong kind/identity,
extra segments, controls, malformed `%`, encoded or repeatedly encoded dot/
slash/backslash variants, and even safe-looking mismatches fail before any
content-origin request.

The other link-bearing descriptor fields also have byte-for-byte contracts:

```text
search_url is null or
  /sok?forfattare={RFC3986(author_id)}&avancerad

audio_url is null or
  https://litteraturbanken.se/ljudochbild/författare/
  {RFC3986(lowercase(normalized_author_id))}
```

JavaScript/protocol-relative/wrong-host/wrong-path/wrong-ID values, controls,
malformed percent encodings, and encoder failures are malformed descriptors and
become local 502 before a page payload is returned. Raw segment validation also
rejects lone surrogates, and the loader catches any RFC3986 encoder `URIError`
inside the same 502 boundary.

The successful shared payload is:

```text
AuthorSupplementalPage
  author
    authorId: string
    fullName: string
    lifespan: string
    hasIntroduction: boolean
    hasDramawebben: boolean
    searchUrl: string | null
    audioUrl: string | null
  documentKind: "presentation" | "bibliografi"
  bodyHtml: string
```

The endpoint sets `cache-control: no-store`. Error codes and status are exact:

- descriptor backend 404 -> 404 `author_document_author_not_found`;
- static content 404 -> 404 `author_document_not_found`;
- backend 422/500/503, network failure, non-404 content failure, malformed
  descriptor/identity/path, or missing/malformed body -> 502
  `author_document_unavailable`.

Only those codes are serialized; upstream paths, bodies, and errors are not.

## Body extraction and sanitizer

`linkedom` must yield exactly one body. Nitro returns only its children and
preserves the corpus's headings, paragraphs, inline emphasis, lists, definition
lists, figures/images, tables/captions, separators, code/quotes, classes, IDs,
and order. Unknown benign elements are unwrapped after their children are
sanitized. Comments and active subtrees (`script`, `style`, forms, frames,
embedded/object content, SVG/MathML, audio/video, templates, and controls) are
removed entirely.

Allowed global attributes are `class`, `id`, `lang`, and `title`. Anchors may
also retain `href`, `target`, `rel`, `name`, and `download`; images `src`, `alt`,
`width`, and `height`; table cells `colspan`, `rowspan`, `headers`, and `scope`;
`col`/`colgroup` `span`; ordered lists `start`, `reversed`, and `type`; list
items `value`. Every event, `srcdoc`, framework directive, and inline style is
removed.

URL validation repeatedly decodes at most 16 times and rejects failure,
non-stabilization, controls, backslashes, traversal segments,
protocol-relative values, and active/custom schemes. `href` accepts fragments,
safe relative/root-relative paths, HTTP(S), `mailto:`, and `tel:`. `src` accepts
only safe relative/root-relative and HTTPS URLs. Safe `/forfattare/**` values
are preserved for the typed redirect boundary. Retained `_blank` anchors gain
`noopener noreferrer`. Sanitization is deterministic and idempotent, and only
sanitized `bodyHtml` reaches SSR or hydration.

## Page, navigation, statuses, and copy

One validated `pages/författare/[author]/[document].vue` owns both routes;
static `mer`, `dramawebben`, and `titlar` remain more specific. It calls the
same-origin endpoint directly in `<script setup>` through `useRequestFetch`—no
one-use composable. A route-keyed lazy `useAsyncData` is awaited by SSR. The
accepted payload includes `{author}:{documentKind}`, clears synchronously when
either parameter changes, and ignores every late mismatched response.

Successful DOM follows Angular exactly: balanced heading/lifespan; Introduktion
when present; Verk always; Ljud when `audioUrl` exists; Dramawebben when present;
Sök i texterna when declared; no supplemental tab/current item; then
`.page_content > .content.unbox` with the managed body. Ljud uses the returned
absolute URL, `target="_blank"`, and Angular's position between Verk and
Dramawebben. Body classes remain `focus page-authorInfo ready`, the `html`
background remains bundled `forf2_bkg.jpg`, and metadata is `{full_name},
Presentation|Bibliografi` with the site suffix only in the title.

Page-local errors are fixed:

```text
author_document_author_not_found:
  Ett fel har inträffat: författarid {author} kan inte hittas. Kontrollera adressen.

author_document_not_found:
  Ett fel har inträffat: dokumentet kan inte hittas. Kontrollera adressen.

author_document_unavailable:
  Ett fel har inträffat. Författardokumentet kan inte visas just nu.
```

SSR sets the real 404/502. Client transitions show the existing
`.searching > .preloader`, clean it up on every outcome, and never show old
heading, navigation, metadata, or body under the new URL.

## Frozen authority and verification

The frozen sources and SHA-256 values are:

```text
https://red.litteraturbanken.se/red/forfattare/SoderbergH/presentation/index.html
80bb28b296759b1bc38fc400c6e27ce0ca51bb59e261203e0f901cff00528980

https://red.litteraturbanken.se/red/forfattare/LagerlofS/bibliografi/index.html
54d289da89e61225fdfbfc68aed19762614529c06c6f2707ed50a493359d179b
```

Both selected shells freeze live reality: Söderberg has introduction, search,
and Ljud but no Dramawebben; Lagerlöf has introduction, Dramawebben, search, and
Ljud. A third sparse fixture has none of those optional links and proves they
do not render spuriously.

The fixture server also serves the exact two PDF URLs with deterministic bytes,
`application/pdf`, request ledgers, and explicit disposition. The Söderberg
`download target="_self"` anchor must emit one Playwright download with suggested
filename `SoderbergH_presentation.pdf`. The Lagerlöf `target="_blank"` inline
anchor must open one new page whose URL is the exact bibliography PDF path and
whose response is 200 `application/pdf`. No PDF request may escape the fixture.

Backend tests cover both strict operations, audio present/absent/failure,
provider exactness, errors, OpenAPI, and snapshot freshness. Nitro/unit tests
cover the complete source-path rejection table, sanitizer policy, and zero
content fetch on descriptor rejection. SSR/browser tests cover the exact shell,
404/502/copy, route races, legacy canonical redirects into usable profile and
Reader pages, PDF variants, and zero duplicate/escape/console errors. Angular
authority and Nuxt comparisons cover Söderberg presentation and Lagerlöf
bibliography at 1440x1000 and iPhone 13. Closure requires backend v2, frontend
unit/SSR/behavior/visual, typecheck, build, generated-client drift, and diff
checks without Angular production or copied legacy SCSS changes.
