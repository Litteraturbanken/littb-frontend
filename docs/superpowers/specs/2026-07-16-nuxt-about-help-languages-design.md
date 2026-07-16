# Nuxt remaining About content and Help design

## Scope

This slice migrates the remaining Angular About routes whose content is owned by `/red`:

- `/om/mål`
- `/om/english.html`
- `/om/deutsch.html`
- `/om/francais.html`
- `/om/hjalp`
- `/hjalp` as a permanent alias to `/om/hjalp`

`/om/kontakt` is deliberately excluded. It is the next slice because its form should use a typed v2 FastAPI operation and generated client rather than the legacy schema-less GET side effect.

## Invariants

- This is an architectural migration only. Copy, content order, links, typography, shell geometry, and responsive behavior remain Angular-authority exact.
- Production Nuxt never snapshots or owns the managed HTML. It fetches the exact `/red` paths at runtime; byte-locked copies are allowed only in `nuxt/test/fixtures`.
- Page-only mapping, fetch, extraction, submenu derivation, and navigation logic remain in `nuxt/app/pages/om/[page].vue`. No one-use composable is introduced.
- Unknown `/om/:page` values remain real 404s and cannot influence a remote path.
- No Headless UI component is needed for this slice.
- Angular source and the backend remain unchanged.

## Runtime content map

| Route key | `/red` path | Active About tab | Rendering mode |
| --- | --- | --- | --- |
| `mål` | `/red/om/visioner/visioner.html` | none | raw body fragment |
| `english.html` | `/red/om/ide/english.html` | none | raw body fragment |
| `deutsch.html` | `/red/om/ide/deutsch.html` | none | raw body fragment |
| `francais.html` | `/red/om/ide/francais.html` | none | raw body fragment |
| `hjalp` | `/red/om/hjalp/hjalp.html` | Hjälp | Help content + submenu |

The existing private `contentBase` and public same-origin `contentBase` remain the only base configuration. Full XHTML responses are reduced to their `<body>` contents before `v-html`; fragment responses pass through unchanged. Upstream failure returns the About shell with empty content and HTTP 200, matching the already-approved About behavior.

## Help behavior

Angular derives a submenu from every managed element carrying both `id` and `name`. Nuxt derives the same ordered `{ id, label }` list from the fetched fragment with page-local logic. Labels preserve underscore.string `humanize` behavior: camel-case boundaries become spaces, the result is lower-cased except its first character, and literal characters such as `&` remain unchanged.

The submenu is rendered into the existing `#toolkit` shell target with Vue Teleport so its desktop/mobile position remains authoritative. It uses the existing classes `help_submenu sticky`; the content wrapper remains `help_content content unbox page-help`.

Clicking a submenu entry:

1. updates the current URL query to `?ankare=<id>` without leaving the page;
2. scrolls the matching managed anchor to a 40px viewport offset;
3. causes no new `/red` fetch and no hydration warning.

A direct `/om/hjalp?ankare=<id>` load performs the same scroll after hydration. Missing anchor values are ignored without an error. Browser back/forward follows the query and scrolls again.

`/hjalp` redirects with HTTP 308 to `/om/hjalp`, preserving query and browser fragment.

## Styling and head state

All routes keep the existing About title, description, `page-about` body class, and About background. The four unlisted About pages have no active top navigation item, matching Angular. Help activates only Hjälp.

The Help submenu must occupy the legacy toolkit location rather than appearing in the main content column. The slice adds no new visual styling unless an authority comparison proves a concrete migration defect.

## Verification

Test-only authority fixtures lock the live bytes and their reviewed SHA-256 hashes:

- Help: `4a22a93f3df4eb9d484e40737d8c53a18d71026d0c5de19475f31e09cdf9ff54`
- Mål: `a6435d16dd1873085153de303c8f91f7d4da81ec5a6e34c745bb5fe151f650c2`
- English: `83da377e4b1d28c4bd0a84c732762f30cbb8021ce650de7f09f0cc71f46f6755`
- German: `d1ad91210b1d95000908e2b68648e30004c226fe1d6ae6406e2292df02a2c182`
- French: `ce8f869ab7b0a22bf38863c29db98456637014a8b9a6f62af2d8df733e08c962`

SSR tests prove exact path selection, representative beginning/middle/end content, body extraction, failure semantics, alias status/query preservation, and 404/no-request behavior.

Desktop behavior tests prove exact active states, the full submenu order/copy, click/deep-link/back scrolling, URL state, no refetch, and no console/hydration/page errors.

Angular authority capture and Nuxt comparison cover all five routes at desktop and mobile widths. The shared visual readiness helper remains authoritative. Full Nuxt regression gates plus unchanged Angular unit/build gates close the slice.

