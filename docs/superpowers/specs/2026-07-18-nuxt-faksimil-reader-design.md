# Nuxt Faksimil Reader Vertical Slice

**Date:** 2026-07-18

## Goal

Make the existing canonical and shorthand Reader URLs support `faksimil` as a
server-rendered image Reader while preserving the current Angular appearance and
interaction model. The work extends the Nuxt-only Reader architecture; it does
not introduce an Angular bridge or redirect scans to another application.

The first slice includes scan rendering, page navigation, Reader history,
legacy size controls, and rotation. OCR overlays and within-work faksimil search
are a later typed-backend slice.

## Source and visual authority

The Angular Reader obtains the exact `faksimil` representation from
`/get_work_info`. Its page records keep three distinct values:
`pagename` for the public URL, `pageindex` for ordering, and `imagenumber` for
the JPEG filename. A scan at logical size `N` is served from:

`/txt/{lbworkid}/{lbworkid}_{N}/{lbworkid}_{N}_{imagenumber-padded-to-four-digits}.jpeg`

The legacy `faksimil_sizes` array contains zero-based indexes `0...4`; these map
to logical URL sizes `1...5`. Widths come from `width.size_N`. The default is
logical size 3. When logical size `N + 2` is available, the image uses the
current source at `1x` and `N + 2` at `2x`.

The scan is intentionally not fluid on narrow screens. Angular applies the
metadata width to both `.img_area` and `img.faksimil`, so a large scan can
horizontally overflow on mobile. Nuxt must retain that behavior instead of
adding `max-width: 100%` or otherwise redesigning the Reader.

Visible authority controls are `Ändra storlek` with `Mindre` and `Större`, plus
desktop-only `Rotera` controls with `Vänster` and `Höger`. Rotation changes by
90 degrees and remains local to the current hydrated page.

## Chosen architecture

### One Reader route with a discriminated media contract

The canonical Reader route, shorthand resolver, and page-sized Nitro endpoint
remain shared. Their transport types become a discriminated union:

- common identity, description, page position, and sibling-page links live in a
  base Reader page;
- the existing `etext` arm retains its HTML and stylesheet fields unchanged;
- a new `faksimil` arm contains the image number, validated available image
  sources, preferred size, and their source widths.

Media-specific fields are not made optional on one broad object. Branching on
`mediaType` must make it impossible for the faksimil renderer to consume e-text
HTML or for the e-text renderer to assume scan metadata.

The existing page-local `useAsyncData` and same-origin Nitro boundary stay in
place. A one-page feature does not gain a composable merely to hold its model
fetch.

### Strict legacy normalization

The Nitro source adapter accepts only exact `etext` or `faksimil` media types
before upstream I/O. It selects the exact requested author, title path, and
representation without falling back between media.

Faksimil normalization requires:

- a nonempty work identity and existing common author/title fields;
- distinct, nonempty page names;
- distinct, safe nonnegative integer page indexes;
- a safe nonnegative integer image number for every scan page;
- a nonempty, duplicate-free subset of source size indexes `0...4`; and
- a positive finite `width.size_N` for every advertised logical size.

Pages and sources are returned in numeric order. Logical size 3 is preferred;
if old metadata lacks it, the closest lower size is selected, or otherwise the
smallest higher size. URL construction is a pure tested helper that separately
encodes path segments and pads only the image number.

Nitro does not probe or download JPEGs. The metadata response can be rendered
during SSR, while a later browser image failure is contained within the image
panel and does not remove the Reader shell or navigation.

### Rendering and controls

A focused `ReaderFacsimileImage` component owns scan presentation and local
load-error state. It receives only the faksimil union arm and renders an
SSR-visible image with the legacy `.img_area` and `.faksimil` hooks, exact fixed
width, useful alternative text, and the legacy `1x`/`2x` source pairing.

The canonical page continues to own shared title/context, navigation, query
preservation, Back/Forward behavior, and `lastPageViews` history. Its template
branches after data resolution:

- `etext` keeps the current trusted HTML and stylesheet loading;
- `faksimil` renders the image component, adds `type-faksimil`, and omits all
  e-text HTML and CSS.

The selected scan size is represented by `?storlek=N`. A valid direct size is
server-rendered. `Mindre` and `Större` move only to an adjacent advertised size
and replace the current history entry; page navigation continues to push a new
entry and preserve duplicate and unknown query keys. Rotation is client-local
and resets on page identity change, matching the old Reader's page lifecycle.

The existing e-text hit request, marker logic, and hit controls are gated on
`mediaType === "etext"`. Faksimil URLs retain `q`, `hit`, and other query keys in
navigation but perform no misleading e-text search-hits request.

### Shorthand and error behavior

`/författare/:author/titlar/:title/faksimil` resolves the exact faksimil
representation's `startpagename`, returns the existing 307 redirect to its
canonical `/sida/:page/faksimil` URL, and preserves the raw query spelling and
order. Unknown media fails before upstream I/O.

Missing exact representations, identity mismatches, and missing requested pages
are 404 responses. Unavailable or malformed legacy metadata is a 502 response.
No page asset is requested when metadata or page resolution fails. A JPEG that
fails after SSR produces a bounded in-page alert while metadata and navigation
remain usable.

## Testing and visual comparison

Tests are written before implementation.

1. Unit tests cover media validation, exact representation selection,
   zero-based size conversion, widths, duplicate/unsafe page data, JPEG URL
   construction, source pairing, and preferred-size fallback.
2. SSR tests cover the discriminated API response, canonical page markup,
   shorthand redirect/query preservation, strict error statuses, one metadata
   request, and zero e-text fragment/OCR requests.
3. Browser tests cover hydration, previous/next and Back/Forward identity,
   query preservation, history, size replace semantics, rotation, image failure,
   and isolation from the e-text search-hits endpoint.
4. A deterministic Angular fixture supplies a middle scan whose page name,
   page index, and image number differ. Strict desktop and mobile authority
   screenshots cover default size 3 and direct size 4. Existing e-text Reader
   screenshots remain unchanged.

The visual fixture uses local synthetic or public-domain scan assets. Production
availability is not part of deterministic parity testing.

## Explicitly deferred

This slice does not fetch or render `/txt/{work}/ocr_NNNNN.html`, scale selectable
OCR text over the scan, widen the typed FastAPI `/search-hits` contract to
`faksimil`, or add faksimil hit navigation. Those capabilities belong together:
the backend must first accept and validate faksimil provider results, after which
Nuxt can consume the OCR overlay and word-ID range safely.

Also deferred are the remaining large Reader features already absent from the
Nuxt e-text slice: focus/fullscreen modes, bottom bar, contents and page chooser,
keyboard shortcuts, parallel view, editor tools, source modal, analytics, and
logging.
