# Nuxt SLA Article Family Design

## Goal

Migrate the complete article family reachable below
`/författare/LagerlöfS/omtexterna` to Nuxt hybrid SSR without changing its
appearance, source authority, links, or currently observable interaction.

This slice includes the 18 Swedish articles linked by the landing page and the
five English pages reachable from `OmSelmaLagerlofArkivet.html`. Omitting the
English branch would leave a visible legacy link broken. It does not implement
generic-author articles, `biblinfo`, or a new footnote popup.

## Authority and corpus

The authority is a closed registry of 23 first-party files below `/red/sla/`:

```text
TextkritiskaRiktlinjer.html       TextkritiskVerkstad.html
OmSelmaLagerlofArkivet.html       Introduktion.html
Adaptioner.html                   ForeGostaBerling.html
BrevOmGBS.html                    SprakandringarGBS.html
AndringarGBS.html                 ForskningOchLitthist.html
TextkritiskGBS.html               ManuskriptGBS.html
Oversattningar.html               IllustrationerOchOmslag.html
Recensioner.html                  OLintroduktion.html
TextkritiskOL1894.html            MsTillOL.html
AboutTheSLagerlofArchive.html     SelmaLagerlofShort.html
SelmaLagerlofEnglish.html         PublishedWorks.html
ScholarlyEditions.html
```

Every member currently returns a direct 200 with
`text/html; charset=utf-8`. The audited Swedish corpus totals 608,574 bytes;
the largest file is `ForeGostaBerling.html` at 100,567 bytes, so the existing
262,144-byte SLA boundary is sufficient. Tests freeze every file byte-for-byte
with its audited SHA-256, rather than reserializing a local copy.

The public article identifier includes the exact `.html` suffix and is
case-sensitive. It is decoded once as a route segment and looked up in an
explicit registry. No request value is ever interpolated into a source path.

## Considered approaches

### Transcribe articles into Vue templates

Rejected. These are managed documents and must continue to be fetched from the
first-party content service. A transcription creates a second content
authority and silently hides provider failures.

### Accept any filename ending in `.html`

Rejected. That reproduces the legacy wildcard and turns the content service
into a user-addressable fetch proxy. The migration uses the audited registry
only, including the five English continuity pages.

### Add a client-side compatibility layer and restore the intended popup

Rejected. The current Angular handler never registers under jQuery 3.7.1
because `a.footnote[href^=#ftn]` is an invalid selector. Observable behavior is
native fragment navigation to an inline note. A Headless UI popover would be a
new product/accessibility behavior, not architectural parity.

### Dedicated typed article descriptor and bounded Nuxt page

Chosen. FastAPI owns the exact article enum and source registry, OpenAPI
generates the frontend union, Nitro validates the descriptor and fetches the
fixed source, and a nested Nuxt page owns its one model in `<script setup>`.

## Backend contract

Add a generated `SlaArticleId` literal containing the 23 exact filenames and a
strict `SlaArticleDescriptor` response. The endpoint is:

```text
GET /v2/authors/{author_id}/documents/omtexterna/articles/{article_id}
```

It guarantees:

- the requested author is exactly `LagerlöfS` after FastAPI path decoding;
- an unsupported author returns the standard non-leaking 404 before an
  OpenSearch/provider query;
- the returned author metadata is the canonical Selma record;
- `document_kind` is exactly `omtexterna`;
- `article_id` echoes the exact registered filename;
- `source_path` is the corresponding fixed `/red/sla/<registered file>` value;
- a Selma provider response with a normalized ID other than `LagerlofS` is a
  malformed-provider internal error, not a missing author;
- an article value outside the 23-member path enum is rejected by FastAPI as
  422 before route logic or a provider query. The public Nuxt page independently
  maps values outside its generated registry to a global 404.

The route and pure transformer both enforce the exact author/article tuple.
The fixed mapping is data, not a formula using the public path value. Existing
author-document contracts remain unchanged.

## Managed-source boundary

The browser calls only the same-origin route:

```text
/api/author-documents/Lagerl%C3%B6fS/omtexterna/<exact article>.html
```

Nitro calls the typed descriptor, validates every field and exact identity,
then fetches only the registered `source_path` from the server-owned
`contentBase`. Public query parameters, cookies, authorization, and origins are
not forwarded. Redirects remain manual, successful content must be exact
`text/html` with an optional charset, and declared and streamed bodies are
limited to 262,144 bytes. Rejected response streams are cancelled.

Parsing requires exactly one `body` and emits only sanitized body children.
Head, title, doctype, comments, processing instructions, and active subtrees do
not enter the response. The article policy permits only the audited elements:

```text
a blockquote br col colgroup div em h1 h2 h3 hr li ol p span strong sup
table tbody td th thead tr ul
```

It retains only audited semantic attributes: safe `class`, `id`, and `lang`;
anchor `href`, `_top`, and hardened `rel`; `ol[type="I"]`; table `border="1"`
and `summary`; and `th[colspan="2"]`. Redundant `xml:lang` is removed.

Only these complete, element-specific inline declarations survive in canonical
form:

- title `h1`/`h2`: `clear: both`;
- `ul.itemizedlist`: `list-style-type: disc`;
- footnote `hr`: `width: 100; text-align: left; margin-left: 0`.

Mixed, duplicated, escaped, commented, `url()`, `var()`, custom-property, or
`!important` declarations drop the entire style attribute.

Href handling accepts safe fragments and these bounded root-relative families:

- `/författare/<safe author>` and `/forfattare/<safe legacy author>` profiles;
- their exact `/titlar/<safe title>/sida/<safe page>/(etext|faksimil)` Reader
  and `/titlar/<safe title>/info` work-information forms;
- the exact 23 canonical SLA corpus routes plus their audited legacy
  `/forfattare/LagerlofS/omtexterna/<registered file>` forms;
- the audited Selma roots `/titlar`, `/jamfor`, `/jamfor.html`, and
  `/SelmaLagerlofEnglish`;
- exactly `/bibliotek?sort=titlar&filter=selma%20lagerlöf`.

Every dynamic segment follows the existing managed-segment restrictions, and
no other query string is accepted. Tests compare the sanitized href ledger for
all 23 bodies against the frozen source ledger, with only the explicitly
malformed `italic` href removed.

The policy also accepts these exact audited first-party PDF paths and ordinary
`http`/`https` external links:

```text
/red/sla/VisualiseringGBSms.pdf
/red/sla/ManuskriptforteckningOL.pdf
/red/sla/TrycktabellOL.pdf
/red/sla/IntVarianterKorkarlen.pdf
/red/om/omtexerna/ManuskriptforteckningOL.pdf
```

The last path is an authority typo and remains exact for continuity. The
sanitizer rejects
control characters, backslashes, protocol-relative values, repeated decoding,
traversal, unregistered corpus filenames, and the malformed relative
`href="italic"` present in one authority file. Fragment targets and backlinks
must remain paired after sanitization.

The response is a dedicated strict `SlaArticlePage` shape containing canonical
author metadata, exact `articleId`, fixed `sourcePath`, and sanitized
`bodyHtml`. It does not widen `AuthorSupplementalPage` with unrelated fields.

## SSR and page ownership

Create a nested page at
`/författare/[author]/[document]/[article]`. It accepts only the exact author,
`document === "omtexterna"`, and a generated registry member. The page fetches
its one same-origin model directly in `<script setup>`; no composable is added.

The page uses a query-free async-data identity and an accepted-identity guard:

- SSR owns the initial request and hydration reuses its payload;
- query-only changes and fragment navigation do not refetch;
- a route identity change clears stale content synchronously;
- a delayed old response cannot replace the current article;
- article transitions fetch only the final exact identity;
- source 404 becomes a redacted 404 and validation/transport failures a
  redacted 502.

The shell remains identical to the SLA landing:

```text
body: focus page-authorInfo site-sla ready
title: Selma Lagerlöf, Om texterna | Litteraturbanken
description: Selma Lagerlöf, Om texterna
background: ordinary author background
author heading: visible
local author links: hidden
portrait: absent
article container: .page_content > .content.unbox
```

The current layout-neutral `.contents` selector boundary is reused. No global
or page CSS is retuned unless a strict Angular/Nuxt diff proves a framework
difference.

## Footnote behavior

Nuxt preserves the article's `sup`, footnote anchors, fragment hrefs, note IDs,
and `.footnotes` subtree. It adds no click handler or component. Clicking a
reference changes the URL hash and scrolls to its inline note; no popover is
rendered. Existing CSS keeps note backlinks pointer-inert. Escape and outside
click have no special meaning.

This matches current stable Angular behavior. A future Headless UI popover must
be separately designed and approved with keyboard, focus restoration, ARIA,
collision, and mobile requirements.

## Proof and closure

Deterministic proof must include:

- all 23 raw files frozen with byte count, SHA-256, media type, one-body check,
  title/link inventory, and registered cross-link closure;
- exact descriptor/source ledgers and negative probes for authors, article
  variants, encoding, traversal, queries, redirects, media type, size, and
  methods;
- direct SSR and hydration with exactly one descriptor and one source request,
  and no legacy author/profile/works/map/audio fan-out;
- query-only and fragment history with zero refetch and stale-result safety;
- native footnote navigation with no popover;
- strict desktop/mobile Angular authority for representative small, English,
  footnote-rich, largest, and table-heavy documents;
- zero-tolerance Nuxt comparison for those cases;
- byte-identical landing and all prior author-document baselines;
- full frontend unit/SSR/type/build suites and full backend v2 tests.

## Deferred work

- a restored accessible footnote popup using Headless UI;
- generic-author `omtexterna` routes without an audited live corpus;
- `biblinfo` and its obsolete external XML dependency;
- visual redesign, content editing, or normalization of legacy prose/links.
