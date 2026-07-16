# Nuxt Presentations design

## Scope

This slice ports the AngularJS Presentationer routes while preserving their editor-owned XHTML, assets, backgrounds, links, scrolling, and exact existing visual hooks:

- `/presentationer`;
- `/presentationer/specialomraden/<document>.html`;
- `/presentationer/vandringar/<document>.html`;
- legacy `/p/s/<document>.html` and `/p/v/<document>.html` redirects.

It does not migrate author, library, search, epub, or reader destinations linked by those documents. `/författare/:author/presentation` remains with the author-domain migration.

No FastAPI v2 endpoint or generated client type is required. Presentation content remains owned by `/red` and must continue updating independently of Nuxt deployments.

## Routing and validation

One optional catch-all page owns the canonical family. It accepts either:

- zero segments for the index; or
- exactly two segments where the folder is `specialomraden | vandringar` and the document is one safe filename ending `.html`.

Decoded slashes, backslashes, dot segments, encoded traversal, empty filenames, extra segments, and any other folder return a real 404 before a content request. Document names are not hardcoded so editorial additions remain possible within the two authority folders.

The legacy `/p/s/:doc` and `/p/v/:doc` routes return server 308 redirects to their canonical folders and preserve the query string. Unknown legacy folder aliases remain 404.

## Runtime content contract

The index fetches `/red/presentationer/presentationerForfattare.html`. A document fetches its validated canonical `/red/presentationer/<folder>/<doc>` path. These sources are trusted first-party XHTML documents, not backend JSON.

The page keeps a local typed representation in `<script setup>`:

```ts
type PresentationDocument = {
  bodyHtml: string
  title: string
  description: string
  stylesheets: string[]
  inlineStyles: string[]
}

type BackgroundRule = {
  target: string
  imagePath: string | null
  className: string | null
  styleText: string | null
}
```

The page uses the pinned SSR-safe `linkedom` 0.18.13 `DOMParser` for both XHTML and backgrounds XML; browser-only `DOMParser`, regex-only document parsing, and an unpinned transitive parser are not acceptable. The narrow parser:

- extracts the body without rendering the upstream doctype, html, head, title, meta, or script elements;
- extracts stylesheet links and inline head styles;
- rejects executable scripts;
- root-normalizes safe relative `href` and `src` attributes against `/`, matching Angular's `<base href="/">` behavior;
- preserves absolute `/red/`, main-site, fragment, mail, telephone, and external URLs;
- rejects unsafe executable URL schemes;
- otherwise preserves trusted editorial body markup.

The index metadata is exact: `Presentationer | Litteraturbanken` and `Litteraturbankens presentationer.`. For documents, title and description reproduce Angular's actual rule: concatenate the first `h1` text, take its first five space-separated words, use that string as the description, and set `<string> | Litteraturbanken` as the title.

Unavailable content leaves the Presentation shell with an empty body and no leaked upstream error. Invalid routes remain real 404 responses.

## Background and head ownership

The index uses the already-copied bundled `presentations.jpg` background and does not fetch background configuration.

Documents also fetch `/red/bilder/bakgrundsbilder/backgrounds.xml`. A local parser keeps the ordered rules for `/presentationer/*`; exact target matches win, followed by the first XML-order wildcard match, reproducing the legacy service. Repeated exact targets use the last declaration, matching the legacy object assignment. Whitespace-separated `class` values become multiple `bkg-<token>` body classes. The chosen rule can contribute:

- an editor-owned background image;
- a `bkg-<class>` body class;
- trusted inline background style text.

All dynamic stylesheet links, inline styles, background styles, `subpage`, and `bkg-*` classes are computed page head/body state and must be removed when navigating between documents, back to the index, or to a 404. SSR serializes both requests so hydration makes no duplicate fetch. A direct hydrated index makes exactly one XHTML request and no XML request; a direct hydrated document makes exactly one XHTML and one XML request. Anchor/query/history changes make neither request again.

The two document requests fail independently. XHTML failure yields the valid shell, empty body, and no document-owned head assets while still applying an independently resolved background rule. Background XML failure keeps the valid article and its extracted head assets but applies no dynamic background image, style, or `bkg-*` class. Neither error leaks upstream details or suppresses the independently successful resource.

## Markup and interaction

The index renders the parsed body as `.doc.main`. Documents render it as `.content` with the exact legacy `position:relative` style. Body classes remain `focus page-presentation ready`, plus `subpage` and the selected `bkg-*` class for documents.

The index preserves `?ankare=<id>` behavior: after content readiness an absent value scrolls to the top; a present exact id scrolls its top to the viewport top. Direct load, query changes, and history navigation all use the same behavior without refetching the document.

Raw editorial anchors and download attributes remain ordinary markup. Their deferred destinations are neither fetched nor validated by this slice.

## Styling

The copied parity stylesheet already owns `.page-presentation`, `.doc.main`, `.content`, tables, authors, bibliography, images, captions, `subpage`, and `bkg-add-border`. Runtime XHTML/CSS/XML remains visual authority. No Tailwind or Headless UI primitive is needed because the route adds no component interaction.

## Verification

- Frozen full fixtures cover the index, ordinary article, themed article, inline-style/image article, a vandring, runtime CSS/images/downloads, and ordered backgrounds XML.
- Parser tests cover wrapper/script removal, exact metadata, URL normalization, unsafe schemes, malformed input, duplicate-target last-wins, whitespace-split classes, and background exact/wildcard order.
- SSR tests cover every valid/invalid/legacy route, exact requests/head/body/classes, independent XHTML/XML failure, and a syntactically safe unknown document that requests upstream and returns the 200 empty shell rather than route 404.
- Browser ledger tests prove exact hydrated request counts and zero query/history refetch; behavior tests cover `ankare`, root-normalized assets/downloads, and complete cleanup across document/index/404 transitions.
- Desktop/mobile Angular authority and Nuxt comparisons cover the index, ordinary article, themed article, inline-style/image article, and a vandring after fonts, images, dynamic stylesheets, and backgrounds are ready.
- Complete Nuxt, unchanged Angular, API freshness, typecheck/build, scope, and diff gates close the slice.
