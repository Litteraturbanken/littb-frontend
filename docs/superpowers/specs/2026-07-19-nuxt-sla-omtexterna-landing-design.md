# Nuxt SLA Om texterna Landing Design

## Goal

Migrate the exact legacy route
`/författare/LagerlöfS/omtexterna` to Nuxt hybrid SSR without changing its
appearance or replacing its real managed content with a placeholder.

This slice covers only the Selma Lagerlöf archive landing document. The linked
article family, its footnote popovers, and the obsolete `biblinfo` application
remain separate follow-on work.

## Authority

The content authority is the fixed first-party document:

```text
https://red.litteraturbanken.se/red/sla/omtexterna.html
GET /red/sla/omtexterna.html
Content-Type: text/html; charset=utf-8
Content-Length: 7225
SHA-256: ca4812e8f5a88342f1699b3a41471da556ba27760bcd51bb635c0c0e20485928
```

Its body contains no images, scripts, forms, embedded stylesheets, or remote
assets. It contains 18 links to the later SLA article family and three native
Reader links. Nuxt must preserve those hrefs and link text exactly.

The visual authority is a deterministic Angular capture of the route at
desktop and mobile widths. It must freeze the exact source above, the existing
Selma author metadata, ordinary author background, fonts, and every legacy
request needed to make Angular ready. Incidental Angular author-work, map,
audio, and author-list requests are authority inputs only; Nuxt must not copy
that fan-out.

## Considered approaches

### Static Vue transcription

Rejected. The XHTML is managed content and must continue to be fetched from its
first-party source. Copying its rendered words into a Vue template would hide
source failures and create two content authorities.

### A standalone untyped Nitro route

Rejected. It would duplicate the already proven author-document pipeline and
would lose the typed author metadata used by the legacy shell. The project is
deliberately moving provider response knowledge into FastAPI/OpenAPI.

### Extend the typed author-document contract

Chosen. Add the exact `omtexterna` document kind to the FastAPI descriptor,
but make it available only for the exact requested author `LagerlöfS`. Its
source path is the fixed `/red/sla/omtexterna.html`, never a user-derived or
normalized-author-derived path. Regenerate the frontend client, then extend the
existing bounded Nitro loader and page-local Nuxt page.

This keeps one typed metadata contract, one same-origin frontend boundary, and
one page-local owner while leaving a clean later seam for an explicit article
allowlist.

## Backend contract

`AuthorDocumentKind` gains the literal `omtexterna`.

For `GET /v2/authors/{author_id}/documents/omtexterna`:

- `author_id` must be exactly `LagerlöfS` after FastAPI path decoding;
- any other requested author returns the standard non-leaking 404 before an
  OpenSearch provider query;
- the returned descriptor retains the canonical Selma author metadata;
- `document_kind` is exactly `omtexterna`;
- `source_path` is exactly `/red/sla/omtexterna.html`;
- no generic `/red/forfattare/{author}/omtexterna/index.html` fallback exists.

The pure transformer also rejects an `omtexterna` request for any other
requested author, so direct callers cannot bypass the route guard. If the exact
Selma provider record returns a normalized ID other than `LagerlofS`, that is a
malformed provider response and follows the existing non-leaking internal-error
path rather than being misreported as a missing author. Existing document kinds
keep their exact current source mapping and behavior. OpenAPI and generated
TypeScript must make the new literal visible; no handwritten frontend copy may
be treated as the canonical transport type.

## Managed-source boundary

The browser calls only the same-origin route
`/api/author-documents/Lagerl%C3%B6fS/omtexterna`. Nitro calls the typed FastAPI
descriptor, validates every descriptor field and the requested identity, then
fetches only the descriptor's exact fixed source path from the server-owned
`contentBase`.

The boundary uses a 262,144-byte declared and streamed limit for this kind (the
authority is 7,225 bytes; the largest currently linked article is 100,567
bytes) and keeps the existing manual redirect policy. It additionally verifies
the exact `text/html` media type case-insensitively, with an optional charset,
and cancels rejected response bodies before returning a local error. It
does not forward public query parameters, cookies, authorization headers, or
request-controlled origins upstream.

Successful source parsing requires exactly one body element and serializes only
its sanitized children. Head, title, doctype, processing instructions, and
comments never enter the payload. The landing accepts only the authority
elements `a`, `div`, `h1`, `h2`, `hr`, `li`, `p`, `span`, and `ul`; active
subtrees are removed and unknown inert elements are unwrapped. Attributes are
limited to global `class`, `id`, and `lang`, plus `href`, `target`, and hardened
`rel` on anchors. Redundant `xml:lang` is removed. Hrefs are restricted to safe
root-relative paths below `/författare/LagerlöfS/`; repeated decoding, control
characters, backslashes, protocol-relative URLs, and traversal are rejected.
Only `_top` is retained as a target value.

The landing source requires two narrowly bounded inline declarations for exact
legacy layout:

- `h1` and `h2`: only `clear: both`;
- `ul`: only `list-style-type: disc`.

They are accepted only for the `omtexterna` kind, only when the complete style
attribute normalizes to that single declaration, and are emitted in canonical
form. A mixed or unknown declaration drops the entire style attribute. All
other kinds continue to strip every inline style.

The response remains the existing strict `AuthorSupplementalPage` shape, with
`documentKind: "omtexterna"` and sanitized `bodyHtml`.

## SSR and client ownership

The existing dynamic author-document page gains the new exact kind; no
composable is introduced. Its `<script setup>` remains the sole page-model
owner.

The route is accepted only when the author segment is exactly `LagerlöfS` and
the document segment is `omtexterna`. Other authors using that document name
must be a global 404 before page fetching. Existing kinds retain their current
generic author validation.

The page keeps the proven query-free `useAsyncData` key and accepted-identity
guard:

- SSR owns the first fetch and serializes the result into the hydration payload;
- hydration reuses that result without a browser API request;
- public query-only changes do not refetch;
- stale responses from earlier identities cannot replace the current route;
- source 404 maps to the existing redacted 404 state;
- upstream, descriptor, media-type, size, parse, or validation failures map to
  the existing redacted 502 state.

## Exact shell and metadata

For the SLA landing, the page applies exactly:

```text
body: focus page-authorInfo site-sla ready
html background: existing ordinary author background
title: Selma Lagerlöf, Om texterna | Litteraturbanken
description: Selma Lagerlöf, Om texterna
```

The existing author-document DOM is reused: direct author heading and `.links`
navigation remain present but are hidden by the established `.site-sla`
authority CSS, exactly as Angular does. The managed body renders at:

```text
.page_content > .content.unbox
```

No global or page CSS is tuned. A DOM-only adjustment is permitted only when a
strict Angular/Nuxt screenshot diff proves a framework rendering difference.

## Request and visual proof

Deterministic tests must prove:

- Angular desktop/mobile capture uses the exact frozen XHTML hash;
- the source request is exactly one query-free GET;
- Angular's required incidental fan-out is fully enumerated and every
  unrecognized local or production request is blocked;
- Nuxt SSR makes exactly one descriptor request and one content request;
- hydration makes no browser API/content request;
- the general, author-profile, author-works, Library, Reader-search, managed
  asset, and excluded legacy-data ledgers remain empty;
- query-only history changes do not refetch;
- other-author and malformed route variants fetch nothing;
- the 18 article links and three Reader links remain exact;
- unsafe style, URL, active subtree, head, and oversized-source probes are
  rejected or stripped without source leakage;
- desktop and mobile screenshots match Angular at zero tolerance;
- all previously committed author-document baselines remain byte-identical.

## Deferred work

- `/författare/LagerlöfS/omtexterna/:article.html` and its exact corpus allowlist;
- delegated footnote popovers, focus/keyboard behavior, and back/forward article
  transitions;
- generic `/författare/:author/omtexterna` until a live corpus proves it exists;
- `/författare/:author/biblinfo`, whose obsolete external XML provider requires
  a separate product/backend decision.
