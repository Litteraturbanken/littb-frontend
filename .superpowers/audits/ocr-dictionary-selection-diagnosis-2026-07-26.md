# OCR dictionary selection diagnosis — 2026-07-26

## Outcome

The reported failure is reproducible and is not caused by missing OCR, CSS `pointer-events`, the dictionary API, or the popup's visibility CSS. It is a selection/timing gap in the Nuxt implementation:

- The OCR overlay is server-rendered and becomes visible/interactable before the client-only `ReaderDictionaryLookup` has mounted.
- The lookup component only registers its global `mouseup` listener in `onMounted`.
- A native double-click during this interval can have its browser selection collapsed/cleared while Nuxt hydrates. The delayed lookup inspection then sees no valid `Selection` and clears/never creates the icon.
- Once the client-only reader controls have mounted, the same native double-click creates a one-word selection and the icon appears.

There is a second robustness issue in the same path: even after mounting, the implementation depends exclusively on `window.getSelection()` still being non-collapsed 500 ms after the mouseup. The native `dblclick` event already supplies a trustworthy OCR `.w` target, but the Nuxt code does not use it as a fallback.

## Exact reproduction and DOM evidence

URL:

`http://127.0.0.1:3020/f%C3%B6rfattare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil`

Word:

`verkligt`, inner OCR node `#lb8345227_69`, contained by `.reader_main .overlay .w`.

Steps:

1. Reload the URL.
2. As soon as the server-rendered OCR word is present, double-click `verkligt`.
3. Wait longer than the component's 500 ms debounce.

Observed failing state:

- Before the click, `.reader-facsimile-controls` count was `0`, proving the client-only reader subtree had not mounted yet, while the OCR `.w` node was already connected and visible.
- The OCR word had `pointer-events: all`, `user-select: auto`, `visibility: visible`, and a non-zero bounding box. `document.elementFromPoint()` at its center returned `#lb8345227_69` itself.
- Immediately after the double-click, `window.getSelection().toString()` was `""`, `rangeCount` was `1`, and `isCollapsed` was `true` in this run. A separate root reproduction observed the equivalent invalid state with `rangeCount === 0`.
- After 650 ms, the selection remained empty and `.search_dict` was absent.

Control experiment:

1. Reload the same URL.
2. Wait until `.reader-facsimile-controls` is visible (the client-only reader controls have mounted).
3. Double-click the same `#lb8345227_69` node.
4. Wait 650 ms.

Observed working state:

- Selection: `"verkligt"`
- `rangeCount`: `1`
- `.search_dict` exists with `aria-label="Slå upp verkligt i Svensk ordbok"`.

The same settled-page behavior also worked for `KARIN`, `Paulina`, and the far-right `FÖRLAG` OCR words. Therefore the OCR HTML, scaling, hit boxes, and `.w` containment are valid.

## Code path and root cause

1. `ReaderFacsimileImage.vue:65-73` server-renders the OCR overlay with `v-html`.
2. The Reader page wraps `ReaderDictionaryLookup` in `<ClientOnly>` at `[mediatype].vue:1907-1909`.
3. `ReaderDictionaryLookup.vue:118-120` does not register `mouseup`/click handlers until `onMounted`.
4. `ReaderDictionaryLookup.vue:50-55` waits 500 ms after mouseup, then calls `inspectSelection()`.
5. `ReaderDictionaryLookup.vue:35-40` has no event-target fallback. It sets `indicator = null` when `selectedReaderWord(...)` rejects the current selection.
6. `reader-dictionary.ts:49-61` correctly rejects collapsed, absent, multi-range, multi-word, or cross-`.w` selections. In the failing interaction, it necessarily returns `null` because hydration has already invalidated the native selection.

CSS is not the cause:

- `reader.scss:182-198` intentionally makes the container overlay `pointer-events: none`, then restores `pointer-events: all` on each `.w`; inspected computed styles confirm that the word receives pointer input.
- `.search_dict` has `position: absolute` and `z-index: 500`; in successful runs it is in the DOM and visible.

The dictionary API is downstream of this failure: no lookup request can occur because the trigger icon is never created.

## Legacy/live comparison

The Angular implementation attaches `selectionSniffer` directly to the generated `.overlay` (`app/scripts/components/reader/reader.html:50-58`). Its directive registers the overlay `mouseup` listener while linking the client-rendered overlay (`app/scripts/directives.js:329-346`), so Angular does not expose an already-interactive server-rendered OCR overlay before the listener exists.

On the live URL, native double-clicking OCR `BOYE` produced selection `"BOYE"` and appended `.search_dict`. The live target `.w` also had `pointer-events: all` and a valid box.

## Why the existing E2E misses it

`nuxt/test/e2e/reader-production.behavior.spec.ts:23-35` does not perform a real double-click. It manually creates a `Range`, injects it into `window.getSelection()`, and dispatches a synthetic `mouseup` after `networkidle`. That proves sanitization/API/dialog behavior, but bypasses native word selection, client-mount timing, and the actual user gesture.

The final-parity OCR test only drag-selects text and checks `window.getSelection()`; it does not assert that `.search_dict` appears.

## Bounded implementation recommendation

Keep the existing debounced `mouseup` path for drag/manual selection, and add one narrowly scoped native `dblclick` path in `ReaderDictionaryLookup`:

1. On `dblclick`, accept only an `Element` target whose nearest `.w` is contained by the current `.reader_main`.
2. First use `selectedReaderWord(window.getSelection(), root)` when valid.
3. If the selection is absent/collapsed, fall back to the target `.w`'s trimmed text, subject to the same one-word, control-character, and maximum-length rules used by `selectedReaderWord`.
4. Position the indicator from the containing `.w`, not from the nested OCR span.
5. Cancel the pending 500 ms selection timer before showing the fallback indicator; otherwise the later collapsed-selection inspection will remove the indicator.
6. Register/unregister the `dblclick` listener alongside the existing listeners. Do not change OCR pointer-event CSS, overlay HTML, dictionary fetching, or visuals.

This fallback addresses the invalid-selection state without weakening the drag-selection checks or allowing words outside the Reader. It also makes the gesture robust when native selection is lost during a small hydration/reflow window. If an explicit readiness contract is added, expose a stable `data-reader-dictionary-ready` marker after listener registration so browser tests and future UI code can distinguish SSR presence from interactive readiness.

## Required regression tests

1. Replace or supplement the manual-Range production test with a real `locator.dblclick()` on an actual `.w`, then assert the accessible lookup button appears and the API/dialog flow still succeeds.
2. Add a focused fallback test in which a `dblclick` reaches an OCR `.w` while `Selection` is collapsed/empty; assert the lookup button is created from the `.w` text and remains visible beyond 500 ms.
3. Keep a drag-selection test to ensure the existing debounced manual-selection path still works.
4. Negative cases: double-click outside `.reader_main`, on a non-`.w` node, or on `.w` text containing multiple whitespace-separated tokens must not create the icon.
5. Run the test against the Boye page/fixture OCR markup with nested spans and trailing whitespace, since that is the exact reported shape.

No application source files, tests, server processes, or commits were changed during this diagnosis.
