# Nuxt Reader page-position slider design

## Goal

Restore the Angular Reader's page-position slider as a real Nuxt control without changing its resting appearance. Moving the slider updates the displayed thumb while the gesture is active; releasing it pushes one canonical Reader page route. Back and Forward must restore both the page and the Reader scroll history.

## Legacy authority

Angular renders `rzslider` with an integer page index, shows a selection bar, and calls `setPage(pageix)` only from `onEnd`. The Reader route changes after the gesture, not on every drag event. The existing Nuxt `.rzslider`, `.rz-bar`, `.rz-selection`, and `.rz-pointer` spans and their CSS already reproduce the legacy unfocused visual and remain the visual authority.

## Interaction model

- Keep the existing decorative slider DOM and CSS unchanged. Overlay a fully transparent native `<input type="range">` with `aria-label="Gå till sida"`; the existing bars, pointer, and active bubble remain the visual layer.
- Preserve Angular's raw-index contract: minimum `0`, maximum the explicit backend `page_count - 1`, step `1`, and value the current `pageIndex`. Add typed `sliderMaximum: number | null` to the Reader response; do not substitute `pageMap.length` because sparse maps and legacy holes are meaningful.
- Pointer input changes only page-local draft geometry and the translated page-name bubble. Pointer change/release commits at most once. If the released raw index is absent from `pageMap`, clear the draft and do not navigate, matching Angular.
- ArrowLeft/ArrowDown and ArrowRight/ArrowUp preview raw index `-1/+1`; PageDown/PageUp preview a rounded ten-percent step; Home and End preview `0` and the maximum. Prevent the native per-key `change`, commit once on key-up, and keep events inside the input so the Reader's document-level paging shortcuts do not also run.
- Commit with the existing raw-preserving `pageHref(pageName)` string and Nuxt router push. This creates one history entry and routes through the existing Reader horizontal-scroll plugin.
- Settled state is derived from the reactive Reader response. No page-param watcher, store, or composable is added. A draft is accepted only while its captured `readerRequestIdentity` still matches.
- If explicit `page_count` is absent/invalid, the slider remains decorative and inert. A one-page explicit range remains focusable at its boundary, as in Angular. Active search-hit mode keeps its established forced-end visual while navigation preserves the search query.
- The transparent overlay must not alter any unfocused bounding box, color, or spacing. A focus-visible indication and the legacy active page-name bubble are the only interaction-only visual changes.

## SSR and failure behavior

The interactive sidebar remains inside the existing `ClientOnly`; the server fallback remains unchanged. A route or Reader request failure clears the draft through identity mismatch and cannot leave stale page content under a new URL.

## Verification

- A sparse fixture proves raw-index preview, no navigation for a hole, and exact Home/End, Back, and Forward behavior.
- Pointer tests prove multiple moves create no requests and pointer-up creates one push/request.
- Raw bare, repeated, mixed-case percent-escaped query fields and fragments survive exactly.
- The existing nonzero horizontal-scroll history test remains green for slider-triggered navigation.
- Existing slider geometry and Reader visual assertions remain unchanged when the control is unfocused.
