# Nuxt Author Profiles Design

**Date:** 2026-07-17

## Goal

Port the canonical author introduction and Dramawebben author introduction to
Nuxt without changing their visual or editorial presentation. The pages must be
fully server rendered from a strict FastAPI v2 profile contract, sanitize the
managed HTML before `v-html`, and preserve the existing Swedish routes,
metadata, backgrounds, tabs, portrait boxes, aliases, and responsive layout.

This slice owns:

- `/författare/:author`;
- `/författare/:author/dramawebben`; and
- `GET /v2/authors/{author_id}`.

Works, managed author documents, Search, Reader expansion, Ljud availability,
Litteraturkartan availability, and the wider Dramawebben application remain
separate migration slices. Links to those future Nuxt destinations remain
ordinary links; no Angular compatibility gateway is introduced.

## Backend contract

`GET /v2/authors/{author_id}` uses operation ID `v2_get_author` and returns a
strict `AuthorProfile`:

```text
AuthorProfile
  author_id: string
  full_name: string
  surname: string | null
  birth_year: string | null
  death_year: string | null
  canonical_path: string
  introduction_html: string | null
  introduction_by: AuthorSummary | null
  source_html: string[]
  pseudonyms: AuthorSummary[]
  other_names: string[]
  portrait: AuthorPortrait | null
  search_url: string | null
  related_links: ProfileLink[]
  encyclopedia_links: ProfileLink[]
  dramawebben: DramawebbenProfile | null

AuthorPortrait
  url: string
  caption_html: string | null

ProfileLink
  label: string
  url: string

DramawebbenProfile
  introduction_html: string | null
  introduction_by: AuthorSummary | null
  source_html: string[]
  portrait: AuthorPortrait | null
```

Every object forbids extra fields. Every key is required; absence is represented
with `null` or an empty array.

The provider performs one exact `authorid.raw` term query with selected fields,
`show_only=False`, and a limit of two so duplicate exact records are detected.
It does not call the analyzed legacy `get_author_by_authorid` helper and does not
call a v1 HTTP endpoint. It resolves ordinary and Dramawebben introduction
bylines in one deduplicated exact-summary query. A missing byline becomes
`null`; malformed provider data is a non-leaking 500; OpenSearch failure is a
typed 503.

Unknown authors, hidden authors, and no exact match return the standard v2 404
envelope. The decoded path ID is 1–100 characters and rejects leading/trailing
whitespace, percent signs, slashes, backslashes, controls, and dot segments.
The normalized portrait segment is validated independently before URL
construction.

`canonical_path` preserves Angular's profile routing:

- ordinary introduction present: `/författare/{author}`;
- only a Dramawebben introduction present:
  `/författare/{author}/dramawebben`;
- neither introduction present: `/författare/{author}/titlar`.

Portrait URLs are final live `/red` paths. Related links contain stored
Presentation, Bibliografi, and safe same-origin external references in legacy
order. Encyclopedia links are derived only from allowlisted HTTPS destinations.
The optional search URL keeps the visible legacy destination
`/sok?forfattare={author}&avancerad`.

## Nuxt architecture

The root and Dramawebben pages each fetch the generated profile operation
directly in their own `<script setup>`. There is no one-use model composable.
They share only a presentational `AuthorProfileContent` component and pure
profile/HTML helpers because those are used by both routes.

SSR and browser requests use the established private/public API bases. The
async-data key includes the author ID, and author changes cannot display stale
profile data. A successful root request follows `canonical_path` with a
temporary replace redirect while preserving query state. A direct Dramawebben
route without a Dramawebben block redirects to the ordinary root; it never
pretends a Dramawebben profile exists.

Missing and failed profiles render the existing page-local Swedish author error
inside the standard shell while setting the real 404/503 response status. They
must not become an empty 200 response or leak backend details.

## Managed HTML boundary

The API preserves introduction, source, and caption strings unchanged. Nuxt
parses each field before SSR rendering with one deterministic sanitizer:

- allow benign editorial elements needed by existing content: `a`, `abbr`,
  `b`, `blockquote`, `br`, `cite`, `code`, `div`, `em`, `h2`, `h3`, `h4`, `i`,
  `li`, `ol`, `p`, `q`, `small`, `span`, `strong`, `sub`, `sup`, and `ul`;
- preserve only safe `class`, `id`, `lang`, `title`, and anchor
  `href`/`target`/`rel` attributes;
- remove scripts, forms, frames, embedded active content, SVG/MathML, event
  attributes, `srcdoc`, inline styles, and Angular/Vue directives;
- allow fragments, safe root-relative paths, HTTP(S), `mailto:`, and `tel:`;
  reject protocol-relative, backslash, control, malformed, traversal,
  `javascript:`, `data:`, `file:`, and custom-scheme destinations;
- rewrite legacy `/forfattare/` body links to `/författare/`; and
- add `noopener noreferrer` when `target="_blank"` is retained.

Sanitized output is produced during the SSR view-model transformation so the
server and hydrated client receive identical HTML.

## Visual and interaction contract

Both pages preserve body classes `focus page-authorInfo ready`, the existing
global shell, balanced author heading, lifespan formatting, `.links`,
`.page_content`, `.introtext`, `.introauthor`, source, pseudonym, other-name,
portrait, and external-link classes.

The root uses bundled `forf2_bkg.jpg` on the `html` element. Dramawebben uses
`dramawebben_fade_more.jpg`. The root page title is
`{full_name}, Introduktion | Litteraturbanken`; the variant is
`{full_name}, Introduktion av Dramawebben | Litteraturbanken`. The corresponding
description omits the site suffix.

Lifespan remains `f. YYYY`, `d. YYYY`, or `YYYY-YYYY`, with `0000` treated as
missing. Introduction content is always expanded; the legacy dead “LÄS MER”,
portrait zoom, editor keyboard shortcut, and development Wikimedia fallback are
not revived.

Top navigation renders Introduktion when present, Verk always, Dramawebben when
present, and Search when declared. The active route uses the existing `active`
class and `aria-current="page"`. The root portrait renders the two legacy link
boxes from profile-declared links. The Dramawebben variant uses its own portrait
only, its own sources, and a coherent introduction/byline pair; if the variant
has no introduction, both fall back to the ordinary pair.

## Verification authority

Tests are written and observed failing before implementation. Backend coverage
proves selected exact queries, strict transformation, redirects, links, years,
portrait derivation, byline behavior, all typed errors, OpenAPI shape, and
snapshot freshness. Frontend fixture coverage proves private/public requests,
strict response shapes, failure controls, and generated-client freshness.

Unit tests cover route-segment validation, lifespan formatting, sanitizer
allowlists, malicious probes, URL rewriting, and deterministic output. SSR and
browser tests cover rich, sparse, Dramawebben-only, missing, failed, redirect,
hydration, author-change, and exact request-ledger states.

The visual authority is captured from Angular with frozen profile responses and
the same portrait/background assets, then used unchanged for Nuxt full-page
desktop Chromium at 1440×1000 and mobile Chromium at the iPhone 13 viewport.
Minimum visual states are a rich ordinary `StrindbergA`, a sparse ordinary
`LagerlöfS`, and a Dramawebben variant. Captures wait for fonts, background,
portrait decoding, API completion, and absence of console/page/hydration errors.
