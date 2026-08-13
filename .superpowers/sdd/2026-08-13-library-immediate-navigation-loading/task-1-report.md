# Task 1 report: immediate Library SPA loading shell

## Implementation

- Replaced awaited Library options and initial-page `useAsyncData` resources with page-local `optionsAsyncData` and `initialAsyncData` resources that await only during SSR. Their cache readers return Nuxt payload data only during hydration, and both entries are cleared on unmount.
- Forwarded async-data abort signals into the options, initial search, and initial summary requests. Options rethrows an `AbortError` so cancellation does not turn into accepted fallback options.
- Captured `initialDataWasLoaded` once, so hydrated SSR retains its loaded result state while a newly created SPA instance starts with the existing empty result constructors and visible loading state.
- Added an options-authority gate for every browser page request. It deduplicates options loading, ignores superseded generations, then re-parses route state against accepted remote options before searching.
- Extracted `syncRouteState`, used it from route watching and post-options request handling, and started fresh client loading after `onMounted` without suspending navigation.
- Added browser regressions for immediate loading shell/re-entry, remote option authority during an early search interaction, and aborting an in-flight fresh-entry request on unmount.

## Files

- `nuxt/app/pages/bibliotek.vue`
- `nuxt/test/e2e/library.behavior.spec.ts`

## RED evidence

Command (from `nuxt/`):

```sh
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "fresh (SPA Library entry|advanced Library SPA entry|Library entry aborts)" --workers=1 --reporter=line
```

Result before production edits: `3 failed`.

- The immediate-shell and teardown cases timed out waiting for the Library heading because the old About page remained visible while the route setup waited for options/initial work.
- The advanced-entry case timed out waiting for the Library loading status because the Library component had not mounted.
- The request gate emitted `route.continue: Route is already handled!` during test cleanup after the old suspended navigation had been discarded. This was teardown fallout from the expected old suspense behavior; the behavioral assertion failures were not selector, port, or fixture failures.
- Existing Playwright server `NO_COLOR`/`FORCE_COLOR` warnings were present and treated as known baseline warnings.

## GREEN evidence

Focused regressions, run after implementation and again after restoring the mutation:

```sh
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "fresh (SPA Library entry|advanced Library SPA entry|Library entry aborts)" --workers=1 --reporter=line
```

Result: `3 passed`.

Existing focused Library coverage:

```sh
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium --grep "(SSR starts global Library navigation|SPA navigation between Library and its EPUB alias)" --workers=1 --reporter=line
```

Result: `2 passed`.

Static checks:

```sh
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/yarn eslint app/pages/bibliotek.vue test/e2e/library.behavior.spec.ts --max-warnings 0
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/yarn typecheck
```

Results: both exited `0`.

## Mutation check

The requested temporary mutation changed `if (import.meta.server) await optionsAsyncData` to `await optionsAsyncData` and ran the first new test. Contrary to the task brief's expected result, it **passed** (`1 passed`). With `immediate: import.meta.server`, the fresh client resource remains idle; awaiting that idle resource does not start its request, so the mutation does not restore the prior suspense behavior. The intended conditional await was restored immediately, and the full three-test focused suite passed afterward. This mutation result is therefore not positive evidence for the regression; the RED run against the original implementation and the three behavioral tests provide that evidence.

## Self-review

- Confirmed no cross-route result cache was added: results remain component refs and async-data lookup is hydration-only.
- Confirmed SSR still awaits both page-local resources and retains the existing canonical redirect path.
- Confirmed fresh SPA entry initially renders the existing empty result components with `loading === true`, and later clears loading only after its owned result request commits.
- Confirmed an early intent preserves loading while options are pending, deduplicates the options request, and revalidates remote author/year filters before the search request.
- Confirmed unmount cancels owned page/summary/count requests and clears both async-data entries.
- `git diff --check` was clean before staging.

## Concerns

The specified mutation check did not fail in this Nuxt/runtime configuration for the reason recorded above. No other concerns found.
