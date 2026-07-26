# OCR dictionary double-click fix report — 2026-07-26

## Outcome

The Nuxt Reader now handles a real double-click on an e-text or OCR `.w` as a
first-class dictionary gesture. When hydration or browser selection timing
leaves `window.getSelection()` collapsed, the handler recovers the same bounded
word from the event target's closest `.w`, positions the existing lookup icon
from that `.w`, and cancels the pending 500 ms mouseup inspection so it cannot
remove the recovered indicator.

The existing delayed mouseup path remains in place for manual and drag
selection. Route changes now also cancel its pending timer before clearing the
dictionary state.

## Scope and safety

- `reader-dictionary.ts` owns one shared trim, length, whitespace, and control
  character policy for native selections and target fallback.
- Target fallback is limited to `.w` elements contained by the current
  `.reader_main`; links, buttons, form controls, and dialogs are rejected.
- `ReaderDictionaryLookup` registers and unregisters a bounded document
  `dblclick` listener alongside its existing listeners.
- The unnecessary Reader `<ClientOnly>` wrapper was removed and listener
  registration moved from `onMounted` to `onBeforeMount`. This reduces the gap
  between the server-rendered OCR becoming visible and the listener becoming
  active without changing rendered visuals.
- No browser application can recover a gesture that finishes before any
  client JavaScript has executed. The earlier registration minimizes that
  irreducible pre-JavaScript interval; the collapsed-selection fallback covers
  gestures that reach the listener while hydration or reflow clears selection.

## TDD evidence

RED:

`cd nuxt && yarn vitest run test/unit/reader-dictionary.spec.ts`

- 4 expected failures, all reporting `readerWordFromTarget is not a function`.
- The 2 pre-existing tests passed.

The first isolated Playwright attempt also documented that the old fixture did
not contain the production OCR node id. The final regression test therefore
uses the fixture OCR `.w`, gives it the reported nested-span shape, and performs
a real Playwright `locator.dblclick()` on that nested span.

GREEN verification:

- `yarn typecheck` — exit 0.
- `yarn vitest run` — 35 files, 1,080 tests passed.
- Focused isolated Reader dictionary Playwright run — 3 tests passed: real
  e-text double-click and dialog, forced-collapsed nested OCR fallback remaining
  visible beyond 650 ms, and retained delayed manual-selection inspection.
- Combined isolated `test/ssr/reader.spec.ts` and full
  `test/e2e/reader-production.behavior.spec.ts` — 95 tests passed.
- `git diff --check` — exit 0.

The Playwright runs used dedicated fixture/Nuxt ports and
`NUXT_IGNORE_LOCK=1`; the shared development servers were not stopped or
changed.
