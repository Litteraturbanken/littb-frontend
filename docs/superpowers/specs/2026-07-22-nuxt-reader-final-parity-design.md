# Nuxt Reader Final Normal-Parity Design

**Date:** 2026-07-22

**Status:** Auto-approved by the requested normal Reader parity audit. This
document is intentionally design-only; production implementation remains gated
on follow-up authorization after focused tests have been observed RED.

## Goal

Close the remaining user-visible gaps in the normal, non-editor Reader without
redesigning it:

- restore the URL-backed `Läsfokus` mode, including its bottom controls,
  e-text size adjustment, e-text night mode, and focus navigation;
- render the normal faksimil OCR overlay when the public route contains `ocr`;
  and
- show the existing Nya vägar logo/link only for works whose exact legacy
  `keyword` array contains `1800`.

Both canonical Reader media routes remain in scope:

- `/författare/:author/titlar/:title/sida/:page/etext`
- `/författare/:author/titlar/:title/sida/:page/faksimil`

Editor routes, parallel reading, faksimil search hits, downloads, analytics,
and any Library change are outside this slice.

## Legacy authority

### Läsfokus

Angular stores focus state in the `fokus` query key through
`setupHashComplex`. Activating or closing focus replaces the current history
entry. The Reader root receives class `focus`; the side corridors disappear,
the content recenters, fixed left/right page covers appear, and a fixed
`bottomBar` appears. Clicking the reading area toggles only the bar's
visibility.

The bottom bar retains the established controls:

- `A a` opens the text menu;
- e-text offers `Mindre text` and `Större text`, changing the whole Reader
  scale by `0.1` per activation around the initial viewport-height factor;
- e-text offers `Nattläge` / `Ljust läge`, toggling body class `night`;
- faksimil offers its existing adjacent `Mindre` / `Större` source sizes and
  no night switch;
- previous/next page links preserve the current query, including `fokus`;
- the parts menu links to `[Start]` and each part start; and
- close removes only `fokus` with history replacement.

Night mode is initialized false on entering the Reader, remains local while
navigating within that mounted Reader, and is not persisted. Text scale is
local for the same lifecycle. Existing keyboard paging continues to work and
continues to yield to editable controls and dialogs.

### OCR

Angular builds the OCR asset name from the logical page index, not the public
page name or scan image number:

`/txt/{lbworkid}/ocr_{pageIndex padded to five digits}.html`

The source root is `body > div`; its `data-size="WIDTHxHEIGHT"` supplies the
coordinate system. The overlay is scaled by `rendered scan width / overlay
width`. Normal faksimil mode keeps the scan visible and OCR text transparent.
The public `ocr` query switches to inspection mode: the Reader receives class
`ocr`, OCR text becomes black, and the scan becomes hidden. OCR is an optional
enhancement; missing or malformed OCR must leave a usable visible scan and must
not fail the page.

This slice fetches the optional overlay only when the route asks for OCR mode.
That is the smallest contract needed for the requested `?ocr` parity and avoids
adding the separately deferred faksimil hit-selection behavior.

### Nya vägar

Angular shows the existing `lb_logga_nyavagar_2.2021.svg` asset only when
`workinfo.keyword.includes("1800")`. The surrounding link is exactly:

`https://litteraturbanken.se/diktensmuseum/nya-vagar-inledning/`

The logo alt text remains `Logotyp för Nya vägar`, and its existing sidebar
position/classes remain unchanged. Works without exact keyword `1800` render no
empty link or list item.

## Chosen architecture

### One page-local Reader model fetch

The canonical page keeps its existing page-local `useAsyncData` fetch in
`<script setup>`. No store, composable, browser-side legacy request, or second
page model is introduced.

The Reader request identity extends its existing route-param tuple with one
boolean: whether the raw public query contains `ocr`. Focus, night, contents,
source-info, size, search, duplicate unknown keys, and fragments remain outside
the model identity. A direct or client-routed OCR transition can therefore
load the overlay, while a focus-only transition never refetches metadata, page
HTML, scan metadata, source info, or search hits.

The same page-sized Nitro endpoint receives an internal `ocr=1` query only when
OCR is requested. It returns one discriminated `ReaderPage` model. The
faksimil arm gains nullable overlay data; the e-text arm does not. The common
Reader base gains only the derived boolean `hasNyaVagar`, never the untrusted
raw keyword list.

### Strict server boundary for OCR

A focused server utility owns normal Reader OCR loading and validation. It uses
the same allowlist and bounds already proven by the editor OCR loader:

- source length is `1..524288` bytes;
- the selected root is exactly `body > div`;
- `data-size` is exactly two integers in `1..10000` separated by `x`;
- allowed elements are `div`, `span`, and `br`;
- allowed classes are `parent` and `w`;
- `id`, event handlers, scripts, links, and all unknown attributes/elements are
  removed;
- style declarations are restricted to the existing coordinate/text
  allowlist and bounded numeric values.

The utility returns `{ html, width, height }` or `null`. Network failures,
missing roots, malformed sizes, oversized bodies, and rejected markup all
return `null`; core metadata failures keep their existing 404/502 behavior.
No raw upstream HTML is exposed without sanitization.

The first implementation may keep the editor endpoint untouched to avoid
cross-slice risk. A later mechanical deduplication can move both callers to the
same utility after editor visual parity is closed.

### Derived Nya vägar eligibility

`reader-source.ts` recognizes a legacy `keyword` only when it is an array of
bounded strings. Eligibility is true only when at least one item is exactly
`1800`; substrings such as `1800-tal`, numbers, and malformed containers are
not eligible. Since this is an optional promotional enhancement, malformed
keyword metadata fails closed to `false` rather than making an otherwise valid
book unreadable.

The Nitro response surfaces only `hasNyaVagar: boolean`. The page imports the
existing logo asset and renders the exact external authority URL. Internal
Reader page/part/focus navigation continues through `NuxtLink` and the existing
router/history helpers; the external project handoff remains an ordinary
absolute link, matching the site-wide Diktens museum convention.

### Focus state and controls

Focus state is derived from presence of the public `fokus` key, so direct SSR
entries and Back/Forward are truthful. A small page-local raw-query helper adds
or removes only that exact key while retaining ordering, duplicate unknown
keys, escape case, bare/empty values, and the fragment. Activation and close use
the existing raw router navigation with replacement.

The canonical page owns the local text scale and night refs because they affect
the Reader root and head/body state. A focused `ReaderFocusControls.vue`
presentation component reuses the legacy `leftCover`, `rightCover`,
`bottomBar`, `text_menu`, `night_switch`, `letters`, `nav`, and `work_parts`
hooks. It consumes already-normalized page/part hrefs and emits adjustments;
it performs no data fetch. Its page links are `NuxtLink` links with real hrefs,
and disabled boundary controls have neither href nor focus target.

The Reader root gets the exact `focus` class and scale transform only in focus
mode. Faksimil continues to use the existing source-size controls instead of
CSS scale. Body class `night` is added only for e-text night mode and composes
with the existing `focus page-reading ready` and `modal-open` classes.

All newly rendered controls are buttons or links with accessible names while
retaining the same visible labels and dimensions. `Escape` is not assigned to
focus mode because dialogs already own it and Angular closes focus only through
the visible control/query change.

## SSR and hydration

- Direct `?fokus` renders a focused Reader root and a truthful fallback label;
  interactive teleported controls mount after hydration without changing the
  primary model.
- Direct faksimil `?ocr` fetches and sanitizes OCR during the page-owned Nitro
  request, so `.ocr` and overlay text exist in SSR HTML.
- A missing overlay renders the ordinary scan both during SSR and hydration.
- `hasNyaVagar` comes from the same SSR model, so the logo never flashes in or
  out during hydration.
- Browser-only viewport measurement, `DOMMatrix`, focus restoration, and
  element width reads are guarded by `import.meta.client` or lifecycle hooks.
- Query-only focus/night UI state cannot allow a late OCR or page response to
  replace a newer request identity.

## Routing and history

- Opening or closing Läsfokus replaces one history entry and changes only the
  exact `fokus` key.
- Focus previous/next/part navigation pushes a canonical Reader page and
  preserves all query bytes, including `fokus` and `ocr`.
- Back/Forward restores the page and focus/OCR modes represented by the URL.
- Focus-only changes do not create `lastPageViews` entries or upstream Reader
  requests.
- OCR page changes fetch exactly the next page's five-digit OCR asset.
- The Nya vägar external link does not pass through Nuxt client routing.

## Error behavior

- Unsupported media and missing pages remain 404.
- Invalid/unavailable core metadata remains 502.
- Missing, unavailable, malformed, unsafe, or oversized OCR becomes
  `ocrOverlay: null`; the scan and navigation remain usable and `.ocr` is not
  applied.
- A malformed legacy keyword field is simply ineligible.
- Text-size controls use bounded scale values so repeated activation cannot
  produce zero, negative, infinite, or unusably large transforms.
- Disabled focus page controls remain inert.

## Deterministic test data

Implementation authorization will add dedicated fixture data, not repurpose
the existing immutable Reader visual works:

1. `NyaVagarReader`, an e-text representation cloned from the deterministic
   Doktor Glas shape with `lbworkid: "lb-reader-nya-vagar"`, exact
   `keyword: ["1800"]`, and the existing three page bodies.
2. `NonNyaVagarReader`, or an existing ordinary Reader work, with
   `keyword: ["1800-tal"]` to prove exact matching fails closed.
3. A valid Gösta Berlings saga OCR body for page index `1`:
   `<body><div data-size="625x900"><div class="parent" style="left: 20px; top: 30px"><span class="w" style="left: 4px; top: 5px">OCR fixture</span></div></div></body>`.
4. A dedicated faksimil work whose OCR route returns 404, plus malformed and
   hostile overlay bodies for server-boundary tests.

The shared fixture/v2 server is deliberately untouched during the RED-only
phase because another implementation is active there.

## Visual authority and verification

Deterministic Angular authority capture will use matching 1440×1000 desktop
and iPhone 13 Chromium viewports, local fixtures/fonts/assets, unique ports,
and a strict external-request firewall. It captures:

- e-text Läsfokus with the bottom bar closed-menu state;
- e-text Läsfokus with text menu/night mode visible;
- faksimil `?ocr`; and
- the eligible Nya vägar sidebar state.

Nuxt comparisons keep the repository settings: full page, animations disabled,
CSS scale, threshold `0.1`, maximum `100` differing pixels, and no masking or
threshold relaxation. Existing normal Reader screenshots are immutable.

Focused unit, SSR, desktop/mobile behavior, desktop/mobile visual, typecheck,
build, request-ledger, hydration-error, and `git diff --check` evidence are
required before completion.

## Explicitly deferred

- parallel e-text/faksimil view;
- faksimil search-hit API and selectable transparent OCR outside `?ocr`;
- persistence of night mode or text scale across Reader sessions;
- new keyboard shortcuts or gestures;
- editor UI/visual changes or editor OCR refactoring;
- Library changes; and
- redesign of Reader layout, controls, labels, or artwork.
