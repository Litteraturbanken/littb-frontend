# Remaining Nuxt Reader parity audit

Date: 2026-07-26

Scope: the normal Nuxt Reader compared with the checked-in Angular Reader and targeted live/local observations. This audit excludes the already-addressed route/watch navigation, horizontal-scroll preservation, sidebar loading blink, selected-hit marquee, OCR dictionary double-click, similar works, and Drama provenance work. It is read-only and reports only differences supported by source or a reproducible browser observation.

## Summary

Five remaining differences were proven. The faksimil search-result navigation gap is the only high-severity item because it removes the main way to move among text-search hits in a scan. Escape handling, faksimil rotation continuity, internal modal routing, and full-title/error presentation are smaller independent slices.

## 1. Faksimil results lose hit navigation after selecting a text-search row

Severity: **High**

Exact reproduction:

`http://127.0.0.1:3020/författare/AarnsethF/titlar/Rallarliv/sida/58/faksimil?q=kyrka&hit=0&traff=w58_123&traffslut=w58_123&s_query=kyrka&s_lbworkid=lb3203777&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0&s_from=0&s_to=29&s_page=1&s_page_size=30&s_return=%2Fs%25C3%25B6k%3Ffras%3Dkyrka%26avancerad%3D1`

Observed evidence:

- Local `#search_nav` contains only `Stäng träffvisningen` and `Tillbaka till sökningen`.
- The same route on the live site contains `Gå till första träffen`, `Gå till sista träffen`, and `Gå direkt till träff . . .` (plus the icon-only previous/next controls). The selected OCR word itself is now marked locally, so this is specifically a navigation/control gap rather than the already-fixed marquee issue.
- The Nuxt page derives `searchState` only when `etextReader` is active at `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue:699`. Every count, arrow, first/last, and direct-hit control is inside `v-if="searchState"` at lines 2213-2277. A faksimil return therefore renders only the skeletal return/close toolbar.
- The backend contract itself is e-text-only: `/Users/johan/dev/lb-backend/lbapi/v2/reader_search.py:32-33` declares `media_type: Literal["etext"]`, and the response model is also e-text-only.
- The current E2E suite codifies the divergence rather than detecting it: `nuxt/test/e2e/reader.behavior.spec.ts:2011` asserts a search-shaped faksimil route never requests hits, while the selected-row test at line 2037 checks only the one supplied marquee.

Root-cause candidate: the typed `/v2/works/{work_id}/search-hits` slice was deliberately limited to e-text. The selected search row carries enough data to mark one faksimil page, but there is no typed faksimil hit list from which the Reader can derive total/previous/next/direct navigation.

Smallest implementation slice:

1. Extend the backend query and response media type to `Literal["etext", "faksimil"]`, reusing the legacy work-search transformation for faksimil page names and word IDs.
2. Parse one media-neutral canonical hit state in the page and request hits using the current Reader media type.
3. Reuse the existing toolbar and raw-query/history helpers, retaining the `traff`/`traffslut` projection for the selected faksimil page.
4. Replace the current “never requests” E2E with faksimil total, arrows, first/last/direct, Back/Forward, stale-response, and request-ledger cases. Keep a separate malformed-query fail-closed test.

## 2. Escape no longer exits Läsfokus

Severity: **Medium**

Exact reproduction:

`http://127.0.0.1:3020/författare/SöderbergH/titlar/DoktorGlas/sida/5/etext?fokus`

Observed evidence:

- On the local route, `.reader_main.focus` exists before pressing Escape and still exists afterward; the URL remains `?fokus`.
- Angular explicitly handles `case "Escape": ctrl.isFocus = false` in `app/scripts/components/reader/reading_controller.js:313-315`.
- Nuxt's three document key handlers cover paging, production shortcuts, and the source-info toggle, but none handles Escape for focus mode (`.../[mediatype].vue:1718-1850`).
- Existing focus E2E covers the visible close button and query replacement, but there is no Escape assertion.

Root-cause candidate: the focus design intentionally omitted Escape to avoid colliding with modal ownership, despite the Angular controller having an explicit Escape case.

Smallest implementation slice: in the existing page key handler, when `focusMode` is true and no editable target or dialog owns the event, prevent default and call the same `closeFocus()` path as the visible close button. Add e-text/faksimil, editable-field, source/contents/dictionary-dialog, raw-query preservation, and history-length tests.

## 3. Faksimil rotation resets on every page change

Severity: **Medium-low**

Exact reproduction:

`http://127.0.0.1:3020/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil`

Observed evidence:

- Clicking `Höger` produces `matrix(0, 1, -1, 0, 0, 0)` locally. Clicking `Nästa sida` changes the route to page 4 and resets the same image component to the identity matrix.
- Nuxt resets `rotation` in the `pageIdentity` watcher at `nuxt/app/components/reader/ReaderFacsimileImage.vue:47-57`.
- Angular owns `rotateAmount` on the long-lived Reader controller (`app/scripts/components/reader/reading_controller.js:211-218`) and its page-update/load paths never reset it. Rotation therefore continues while paging within the same mounted work/media Reader.
- The current Nuxt test `faksimil page identity resets local rotation and image error state` at `nuxt/test/e2e/reader.behavior.spec.ts:1979` explicitly enforces the non-legacy reset.

Root-cause candidate: rotation and image-error recovery were grouped into one page-identity reset although only the per-image failure flag needs to reset.

Smallest implementation slice: retain rotation at work/media component scope while continuing to clear `imageFailed` for each source/page identity. Reset rotation only when the component represents a different work/media session. Change the existing E2E to assert persistence across Next/Back and reset on leaving/re-entering another work or media type.

## 4. Internal links inside “Mer om boken/pjäsen” bypass Nuxt routing

Severity: **Medium-low**

Exact reproduction surface:

`http://127.0.0.1:3020/författare/SöderbergH/titlar/DoktorGlas/sida/5/etext?om-boken`

Source/API evidence:

- `ReaderSourceInfoDialog.vue:133-138` renders internal author URLs as plain `<a>` elements.
- Its internal `Läs som etext/faksimil` actions are also plain `<a>` elements at lines 159-170.
- The real local source-info response proves these are application-internal URLs, e.g. `/författare/S%C3%B6derbergH` and `/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext`, not downloads or external authorities.
- Similar-work links in the same dialog already use `NuxtLink`, showing the working in-project pattern.
- Existing tests assert href text/content but do not assert that author/read actions avoid a document request or participate in router history.

Root-cause candidate: source-info presentation was ported with the legacy anchors and only the later similar-works addition adopted Nuxt navigation.

Smallest implementation slice: use `NuxtLink` for normalized internal author and read-action URLs; leave downloads, Libris, URN documentation, licenses, and other absolute external URLs as ordinary anchors. Add a document-request ledger plus Back/Forward checks for author and media actions.

## 5. Reader-specific title and missing-page feedback lost legacy detail

Severity: **Low**

Exact routes:

- Title: `http://127.0.0.1:3020/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil`
- Missing page: `http://127.0.0.1:3020/författare/SöderbergH/titlar/DoktorGlas/sida/does-not-exist/etext`

Observed/source evidence:

- The Boye Reader sidebar displays `Ett verkligt jordiskt liv. Brev`; the typed Reader response's `fullTitle` is `Ett verkligt jordiskt liv. Brev. Urval och kommentarer Paulina Helgeson`. The local title anchor has neither `title` nor tooltip content. Angular attaches a Bootstrap tooltip whenever `workinfo.title != workinfo.shorttitle` (`app/scripts/components/reader/reader.html:97-104`).
- A direct invalid local page returns HTTP 404 and the generic Reader/Nuxt not-found presentation (`Reader page not found`; the app page says the address does not exist). Angular's Reader has work-specific copy: `Hittar ingen sida '<page>' i verket.` (`app/scripts/components/reader/reader.html:7-9`).
- Existing Reader tests verify full titles inside dialogs and API models, but not the sidebar hover detail or exact invalid-page copy.

Root-cause candidates: the sidebar consumes only `reader.title`, leaving the already-available `reader.fullTitle` unused; server-side `createError()` delegates missing pages to the global error surface before Reader-specific markup can render.

Smallest implementation slices:

- Add the same delayed, text-only tooltip behavior already used by Library to the existing title anchor when `fullTitle !== title`, without adding wrappers or changing layout.
- Preserve the 404 status but provide Reader-specific missing-page copy through the application's error payload/error renderer. Keep upstream-unavailable (502) and client page-fetch failure messages separate.

## Test gaps, not proven regressions

- Mobile screenshots and behavior tests already cover the main Reader, faksimil controls, focus mode, contents/source dialogs, OCR, and error containment. I did not prove a remaining breakpoint/layout difference in targeted inspection.
- Contents and source dialogs have extensive focus-trap, Escape, backdrop, focus-return, raw-query, and history tests; no remaining dialog lifecycle difference was proven outside the focus Escape shortcut and the internal-link routing issue above.
- Page-input validation, slider keyboard operation, debounced page fetching, rapid page navigation, horizontal history restoration, and editable-target keyboard guards have focused tests. No additional page-input debounce regression was proven.
- Parallel view is present only in commented-out Angular template markup, so it is not reported as a current user-visible parity gap.
- The old image-expansion plumbing exists in the Angular controller/directive, but no enlargement control was visible on the compared live Reader routes; it is therefore not reported as proven parity work.

## Suggested order

1. Faksimil hit navigation (requires the only backend/API expansion).
2. Escape-to-close focus.
3. Rotation continuity.
4. NuxtLink conversion in source-info internal actions.
5. Full-title tooltip and Reader-specific 404 copy.

Each item is independently testable and can be implemented without changing the established Reader visuals.
