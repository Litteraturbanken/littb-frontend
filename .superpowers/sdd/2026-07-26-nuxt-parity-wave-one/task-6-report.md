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

## Review fix — committed SPA departure prerequisites

Reviewing an archive of the original Task6 commit exposed a staging-only
failure: the working tree's internal `NuxtLink` conversions had made the test
green, but the committed layout still used a native Presentationer anchor. The
departure reloaded the document, cleared the intended session-only module ref,
and reset the Library href to `/bibliotek`.

The regression now asserts that a sentinel survives the Presentationer
departure before checking the remembered Library href. Against the original
commit archive it failed with expected `library-spa`, received `undefined`.

The fix converts Nuxt-owned global destinations to `NuxtLink`: home,
text search, epub, Presentationer, Dramawebben, Om LB, and the language pages.
External and legacy-managed destinations remain native anchors. The staged
Search link uses its canonical static `/s%C3%B6k` target so this Task6 fix does
not absorb the separate unstaged Search-memory implementation.

Verification was run from an archive of the exact staged code snapshot
(`934760ad97c7c733a37965292934b946fef075e4`), not from the dirty working tree:

- Strengthened Library SPA-return regression: 1 passed.
- Full desktop Library behavior suite: 45 passed.
- Library navigation helper: 11 passed.
- `yarn typecheck`: passed.
