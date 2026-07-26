# Task 6 report — remembered Library navigation

## Root cause and reproducer

The legacy layout builds the global `Biblioteket` href from
`/bibliotek{{libraryState.queryparams}}`. Nuxt's global layout instead used a
fixed `/bibliotek` link, so leaving a configured Library route discarded its
state. The adjacent text-search navigation was a separate existing pattern and
was not changed.

The RED desktop regression loaded
`/bibliotek?avancerat=1&mediatypes=mediatype%3Aetext&languages=language%3Aswe`,
navigated to Presentationer, and expected the global Library link to retain the
state. Before this task it failed with expected query href and received
`/bibliotek`.

## Change

- Added a bounded, session-only `rememberedLibraryHref` validator. It accepts
  only `/bibliotek` with a well-formed query, strips fragments, and rejects
  external, malformed, unsafe, and unrelated paths.
- Added the shared client-only `useLibraryNavigation` composable. It defaults
  to `/bibliotek`; it does not use cookies or local storage.
- The Library page records `route.fullPath` after route commits, preserving
  router-canonical repeated and unknown query parameters.
- The global Library navigation now uses `NuxtLink` with the remembered href.

## Coverage and evidence

- Helper unit tests: 11 passed, covering canonical repeated/unknown query
  parameters, fragments, and invalid values.
- Library desktop Playwright suite: 45 passed. New coverage verifies clean SSR,
  a hydrated client with no memory, filtered return, selected chips, reload,
  Back/Forward, repeated unknown parameters, and no browser errors.
- Existing global Search-memory regression: 1 passed.
- `yarn typecheck`: passed.

Commands used:

```sh
cd nuxt
NUXT_IGNORE_LOCK=1 yarn vitest run test/unit/library-navigation.spec.ts
NUXT_IGNORE_LOCK=1 LBAPI_FIXTURE_PORT=4260 LITTB_NUXT_TEST_PORT=3160 \
  yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium
NUXT_IGNORE_LOCK=1 LBAPI_FIXTURE_PORT=4261 LITTB_NUXT_TEST_PORT=3161 \
  yarn playwright test test/e2e/text-search.behavior.spec.ts --project=desktop-chromium \
  --grep "global search navigation remembers"
NUXT_IGNORE_LOCK=1 yarn typecheck
```
