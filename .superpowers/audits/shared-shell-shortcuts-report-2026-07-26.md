# Shared shell shortcut parity report — 2026-07-26

## Scope

Restored the public Angular shell shortcuts that were proven missing in the Nuxt port:

- unmodified `h` navigates to `/historik`;
- unmodified `b` navigates to the remembered Library URL;
- an unfocused paste containing one lb-id navigates to `/editor/{id}/ix/0/f`;
- an unfocused paste containing multiple lb-ids navigates to Library works with the legacy ordered `lbworkid:… OR …` filter.

F19/F20, red-editor, and deployment host-switch shortcuts remain excluded.

## Implementation

The default layout owns one client-only `keydown` listener and one client-only `paste` listener. Both are removed when the layout unmounts. Navigation uses the Nuxt router with push semantics, so Back and Forward retain each shortcut transition.

The `b` shortcut consumes the existing `libraryHref`, retaining its canonical `/bibliotek` boundary, remembered repeated query values, and unsafe-URL rejection. Multiple pasted identifiers use the Library navigation boundary to produce:

```text
/bibliotek?filter=lbworkid:lb12%20OR%20lbworkid:lb34&visa=works&sort=popularitet
```

Paste parsing is bounded, preserves identifier order, accepts a case-insensitive `LB` prefix and normalizes it to `lb`, and otherwise retains the legacy word-character identifier shape.

Keyboard and paste navigation are suppressed for inputs, textareas, selects, contenteditable descendants, open native/ARIA modal dialogs, composition/default-prevented events, and modified keyboard events.

## Verification

- `yarn vitest run test/unit/production-shortcuts.spec.ts test/unit/library-navigation.spec.ts`: 23 passed.
- isolated Playwright desktop and mobile shell flow: 2 passed; covers SSR hydration, remembered repeated query values, editable/contenteditable/modal/modifier guards, one/many/invalid/case-normalized paste, SPA identity, duplicate-listener-sensitive history, and Back/Forward.
- `yarn playwright test test/ssr/quick-search.spec.ts --project=ssr`: 1 passed.
- `yarn typecheck`: passed.
- `git diff --check`: passed.

The user-facing Nuxt server on port 3020 and backend server were not stopped or replaced during verification.

## Independent-review follow-up

The first implementation incorrectly allowed paste navigation while a noneditable link or button retained focus, although Angular suppresses paste whenever any element owns focus. Paste navigation now runs only when `document.activeElement` is the body, document element, or absent. The browser suite pastes successfully from a truly unfocused body and proves that a focused shell link suppresses the same paste.

The initial dialog guard also covered only native open dialogs and ARIA modal dialogs. It now suppresses shared shortcuts whenever a rendered `[role="dialog"]` exists. A real Library download-format chooser test proves that the intentionally nonmodal chooser remains open and `h` does not add a history entry or navigate away.

Finally, single pasted IDs had a looser length bound than multi-ID Library filters. Both paths now consume one exported canonical lb-id predicate. Boundary tests cover the maximum accepted identifier and max+1 rejection for both single and multiple paste.

Fresh follow-up verification:

- focused units: 25 passed;
- desktop/mobile shortcut and real format-chooser flows: 4 passed;
- scoped SSR shell test: passed;
- Nuxt typecheck: passed.
