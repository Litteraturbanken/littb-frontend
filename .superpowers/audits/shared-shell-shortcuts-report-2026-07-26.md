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
