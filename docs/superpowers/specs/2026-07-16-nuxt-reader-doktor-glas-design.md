# Nuxt Doktor Glas Reader Vertical Slice

**Date:** 2026-07-16

## Goal

Make the currently empty Nuxt route
`/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext` a real,
server-rendered e-text reader page. It must resolve current metadata and one page
fragment at request time, preserve the established Litteraturbanken reader look,
and leave an honest seam for later reader work without attempting the whole
Angular feature.

## Legacy and live-source evidence

The Angular reader routes all title/page/media variants into `readingModule`.
For an e-text page, `reading_controller.js` asks `/api/get_work_info` for work
metadata, maps the requested page name to a page index, then fetches
`/txt/{lbworkid}/res_{five-digit-page-index}.html`. The template also loads the
shared `/red/css/etext.css` and work-specific
`/txt/css/{lbworkid}-etext.css` styles.

A live browser check of the target state on 2026-07-16 resolved Doktor Glas to
`lb1728740`, page name `-2`, page index `2`, and displayed the title-page text
"DOKTOR GLAS / ROMAN / AF / HJALMAR SÖDERBERG". These identifiers are evidence,
not values to hard-code in Nuxt.

## Chosen design

### Page-sized Nitro boundary

A narrow Nitro endpoint receives author, title, page, and media type. It calls
the configured legacy source base for `/api/get_work_info`, selects the requested
representation, resolves exactly one page, and downloads exactly one `/txt`
HTML fragment. Its response is a small normalized reader-page object containing:

- author/title/work/media metadata required by this page;
- current, previous, and next page names;
- the work-specific stylesheet URL; and
- the one requested HTML fragment.

The endpoint does not cache content, expose the large legacy response, or return
other page bodies. It translates missing works, unsupported media types, missing
pages, and unavailable upstream content into appropriate HTTP errors.

This same-origin boundary keeps SSR and in-app client navigation consistent,
isolates legacy response quirks from the Vue page, and can later grow media-type
adapters without putting shared state into a one-use composable.

### Nuxt route and rendering

A catch-all page under the existing Swedish author/title path validates the
four reader path segments, fetches the normalized endpoint with page-local
`useAsyncData`, and renders trusted Litteraturbanken source markup with `v-html`.
It sets the legacy-compatible document title and reading body class, loads the
shared and work-specific e-text CSS, and supplies ordinary anchor links for the
available previous and next pages. Those links retain normal browser behavior
and work without client JavaScript.

The visual shell is deliberately compact: the book text is the primary panel,
with author/title/page context and basic page navigation beside it. Reader SCSS
is ported only where needed for this state and reuses the existing responsive
layout rules.

### Runtime configuration

A private runtime source base points Nitro at the legacy Litteraturbanken origin.
Tests override it with the existing local fixture server. Published CSS URLs stay
same-origin (`/red/...` and `/txt/...`) so the normal dev/deployment proxy can
serve them; the Playwright fixture supplies deterministic equivalents.

## Testing

Tests are written before implementation:

1. An SSR test requests the exact Unicode URL and asserts meaningful source text,
   title metadata, page context, links, and no loading-only shell.
2. A browser test asserts the hydrated exact state, visible title-page text,
   legacy-compatible typography hooks, previous/next URLs, and that the fixture
   observed one metadata request plus one page-fragment request.
3. Focused error coverage verifies that a missing page does not render a false
   successful reader.

The fixture contains small synthetic metadata/HTML/CSS responses. It is test
data only; live page HTML is never copied or cached in the repository.

## Explicitly deferred

This slice does not add faksimil, history/local-storage writes, analytics logging,
parts or contents sidebars, page chooser, first/last controls, keyboard paging,
search, reading focus, notes, text corrections, SO highlighting, editor routes,
or the author/library pages. It also does not add deployment hardening or an
Angular/Vue compatibility layer.
