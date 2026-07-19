# Nuxt Dramawebben Managed Documents Design

## Goal

Port the exact current Dramawebben start shell and its two managed-document pages to Nuxt SSR without pulling the large plays dataset into this slice or changing the approved visuals.

## Approved Scope

This slice owns exactly these public routes:

- `/dramawebben`
- `/dramawebben/om`
- `/dramawebben/kringtexter`

It explicitly excludes:

- `/dramawebben/pjäser` and its title/author views, filters, ranges, modal, and query model;
- `/dramawebben/författare`;
- `/dramawebben/pjas/:legacyurl` and `/dramawebben/forfattare/:legacyurl` resolvers;
- Reader, Library, and author-profile behavior; and
- FastAPI, OpenAPI, and generated-client changes.

Excluded Dramawebben paths remain unimplemented Nuxt routes in this slice. They must not be silently redirected to one of the managed pages.

## Legacy Evidence and Root-Route Decision

Angular registers the five Dramawebben routes under one component in `app/scripts/app.js:338-372`. `DramawebPageCtrl` derives `showpage` from path segment two and uses `start` for `/dramawebben` (`app/scripts/dramaweb_controller.js:71-81`). The template has cases for `pjäser`, `om`, `kringtexter`, and `sok`, but no `start` body (`app/views/dramaweb.html:37-306`). The start route therefore displays the branded shell, start background, expanded logo/tagline, and navigation around an empty `page_content`.

The controller nevertheless calls `backend.getDramawebTitles()` unconditionally (`app/scripts/dramaweb_controller.js:337-384`). That service requests up to 10,000 Dramawebben records plus an author aggregation from `/api/list_all/etext,faksimil,pdf,infopost` (`app/scripts/services/backend.js:842-889`). The result does not contribute to the start DOM.

Accordingly, `/dramawebben` is included as the exact legacy start shell. It is not redirected and it does not fetch plays. Omitting the unused request removes accidental controller coupling while preserving the route, query, content, and visual behavior.

## Considered Approaches

### 1. Exact shell plus a bounded Nitro document boundary — selected

Render one Vue shell for all three routes. The start page has no data request. The two document pages call a small same-origin Nitro endpoint which exact-maps the requested document, fetches a private configured origin, parses one XHTML body, sanitizes it, and returns typed JSON.

This preserves SSR, keeps source selection and trust enforcement server-side, prevents browser/server policy drift, and avoids any plays request.

### 2. Fetch `/red` directly in the Vue page

This is shorter and resembles the current About-page implementation, but it would require equivalent sanitization in both server and browser environments, expose upstream response variation directly to `v-html`, and make size/content-type/redirect enforcement harder to centralize. It is rejected.

### 3. Redirect `/dramawebben` to `/dramawebben/om`

This would avoid a nearly empty page, but it changes the public URL, start background, logo scale, link labels, and default behavior. It is rejected.

## Routes, Status, and Query Behavior

`/dramawebben` returns `200` and renders the start shell during SSR with no document or plays request.

`/dramawebben/om` and `/dramawebben/kringtexter` return `200` with their sanitized managed bodies in the initial SSR HTML. An upstream `404` becomes a public `404`; an upstream redirect, other status, invalid content type, oversize body, malformed document, or fetch failure becomes `502`. These valid-route source failures retain the stable shell, disclose no upstream body or URL, and use a neutral local message.

Unknown dynamic document names return Nuxt's global `404` before the page is created or any fetch occurs. The excluded `pjäser` and `författare` names are not accepted by the managed-document page. Shell-preserving errors apply only after one of the two valid managed names has passed route validation.

All three routes accept and preserve arbitrary query strings exactly as ordinary Nuxt routing state. Query-only changes do not refetch or change the selected document. This matches Angular's `reloadOnSearch: false` behavior for these pages. Navigation links themselves use the legacy query-free hrefs.

The legacy routes have no configured route title, so Angular sets the document title to `Litteraturbanken`. The Nuxt pages preserve that title and the existing global description rather than deriving metadata from the managed XHTML head.

## Visual and Component Architecture

Create `app/components/dramawebben/DramawebbenShell.vue` with one prop:

```ts
type DramawebbenPage = "start" | "om" | "kringtexter"
```

The component reproduces the meaningful DOM in `app/views/dramaweb.html`: cover, `startpage`/`subpage` wrapper, white Dramawebben logo, start-only tagline/expanded link wording, exact navigation order and hrefs, and a `page_content` slot. Only `Mer läsning` is active on `kringtexter`; legacy Om has no active class and remains that way.

Pages set the authority body classes established by the frozen Angular capture. The exact classes are `focus page-dramaweb ready` for start and `focus page-dramaweb drama-dramasubpage ready` for managed subpages. Existing `styles.scss` already contains the complete `.page-dramaweb` styling and is byte-identical between Angular and Nuxt. Existing Nuxt assets `dramawebben.jpg`, `dramawebben_fade.jpg`, and `dramawebben_vit.svg` are byte-identical to Angular. No visual redesign, Tailwind replacement, or new CSS is part of this slice.

`app/pages/dramawebben/index.vue` owns the start page and performs no fetch. `app/pages/dramawebben/[document].vue` validates the two exact document names and owns its `useAsyncData` call directly in `<script setup>`; no one-use composable is introduced.

## Managed Content Contract

The private upstream is `runtimeConfig.contentBase`, whose production default is `https://red.litteraturbanken.se`. Only this fixed map is legal:

| Document | Source path |
| --- | --- |
| `om` | `/red/dramawebben/om.html` |
| `kringtexter` | `/red/dramawebben/kringtexter/kringtexter.html` |

The upstream return type is raw `text/html; charset=utf-8` containing a complete XHTML document. It is not backend JSON and has no FastAPI domain model. The same-origin Nitro API returns:

```ts
export type DramawebbenDocumentKind = "om" | "kringtexter"

export type DramawebbenManagedDocument = {
  documentKind: DramawebbenDocumentKind
  bodyHtml: string
}

export type DramawebbenDocumentErrorCode =
  | "dramawebben_document_not_found"
  | "dramawebben_document_unavailable"
```

No FastAPI/OpenAPI change is justified: adding the editorial XHTML source to the bibliographic backend would misstate ownership and add codegen without improving type safety. The small Nitro response is typed locally.

## Source and Sanitizer Boundary

`server/utils/dramawebben-document.ts` owns the complete trust boundary:

- accept only the two enum values and exact-map them to paths;
- concatenate only the configured private base and mapped path;
- use GET with `redirect: "manual"`;
- require status `200` and a `text/html` media type;
- stream at most 262,144 bytes, honoring an over-limit `Content-Length` before reading;
- parse exactly one `<body>` from the complete XHTML document;
- remove comments and dangerous subtrees such as script, style, form, iframe, object, SVG, and MathML;
- allow only the structural elements needed by the two documents (`a`, `br`, `div`, `em`, `h2`, `h3`, `i`, `p`, `strong`, `table`, `tbody`, `td`, and `tr`);
- retain `class`, plus `href`, `target`, and `rel` only on anchors;
- allow only fragment, root-relative, or absolute HTTPS hrefs after repeated decoding/traversal/control-character checks;
- retain only `_blank` as a target and add `noopener noreferrer`; and
- return body children only, never upstream doctype, html, head, title, metadata, comments, or error text.

`server/api/dramawebben/documents/[document].get.ts` validates the route parameter, sets `Cache-Control: no-store`, and maps source failures to the local codes/statuses. `nuxt.config.ts` excludes `/api/dramawebben/**` from the legacy API proxy so this Nitro boundary is reachable in development.

The page validates the returned object and matching identity again before assigning it to `v-html`. `v-html` receives only server-sanitized output.

## Live Provenance

Read-only retrieval on 2026-07-19 confirmed the two exact managed sources:

| Source | Status/type | Bytes | SHA-256 | Last-Modified |
| --- | --- | ---: | --- | --- |
| `https://red.litteraturbanken.se/red/dramawebben/om.html` | `200 text/html; charset=utf-8` | 9,892 | `fc43696a050fd4c0390e1e452949b8925fc883ff8ac3f8e155f921984d9237b1` | 2023-09-27 09:29:03 GMT |
| `https://red.litteraturbanken.se/red/dramawebben/kringtexter/kringtexter.html` | `200 text/html; charset=utf-8` | 12,325 | `f63c7aecdbfafdcc4df1a1cbd41b2ceeee6424a32138f551aac2ce7d5c797fd5` | 2025-09-25 08:05:17 GMT |

The main `https://litteraturbanken.se` routes and same-host `/red` paths returned a Cloudflare `502` during the same check. The direct managed origin above is therefore the recorded content provenance. Frozen test fixtures must be copied byte-for-byte from these two successful sources and record these URLs and hashes; implementation continues fetching the live sources at runtime.

## Testing and Visual Authority

The Angular capture uses the real Angular route/template/controller with frozen exact XHTML fixtures. Its route firewall is default-deny and ledgers every admitted request. It must prove that Angular requests the large `list_all` dataset once even on these pages, while the Nuxt SSR/behavior tests prove zero plays/API requests.

Capture six authority images: start, om, and kringtexter at desktop and mobile sizes. Wait for the exact managed heading, fonts, logo, and CSS background before capture. Assert exact body/wrapper classes, active links, link labels, content source request, Angular dataset request shape, and no production or unexpected requests.

Unit tests cover exact mapping, one-body extraction, the current full XHTML fixtures, URL/element/attribute sanitation, dangerous payload removal, redirects, media type, streaming limit, and error mapping. SSR tests cover body-in-initial-HTML, exact request ledgers, no plays endpoint, title/classes, root zero-fetch, query behavior, invalid-name global 404-before-fetch, and valid-route shell-preserving source 404/502 without leaks. Browser behavior tests cover query-only no-refetch, document navigation/stale-response isolation, and exact links. Visual tests require zero-pixel parity where deterministic; any nonzero tolerance requires documented evidence rather than CSS changes by default.

## Success Criteria

- All three scoped routes render through Nuxt SSR with the current visuals.
- `/dramawebben` is the exact start shell and makes no data request.
- Each managed page makes only its one exact private document request through the sanitizer boundary.
- No scoped Nuxt route requests `getDramawebTitles`, `list_all`, authors, filters, or other legacy APIs.
- Query-only navigation does not refetch.
- The six Angular baselines and Nuxt comparisons pass on desktop and mobile.
- Excluded Dramawebben, Library, and Reader behavior remains untouched.
