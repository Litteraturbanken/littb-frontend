# Full E2E cleanup report

## Root causes and fixes

- Dramawebben still asserted the legacy ASCII redirect `/sok`, while its
  Nuxt-owned link renders the canonical `/s%C3%B6k` route. The one exact link
  authority now expects the canonical target used by all five affected cases.
- History and ID visual fixtures retain readable Unicode route values, while
  NuxtLink serializes their DOM `href` attributes with percent-encoded path
  segments. Assertions now compare the exact `encodeURI` serialization for all
  author, title, and media links.
- The desktop Playwright project matched every E2E spec, including the
  mobile-only Editor file. Desktop now ignores `*.mobile.behavior.spec.ts`, and
  the mobile project continues to include the Editor mobile spec explicitly.
  An imported-config unit test verifies both sides of this boundary.
- The one-off author-document navigation failure did not reproduce in focused
  runs, so neither its test nor production navigation was changed.

## TDD and verification evidence

- RED: five Dramawebben cases received `/s%C3%B6k` instead of `/sok`.
- RED: desktop `--list` selected all three mobile Editor tests.
- RED: the new config contract received `false` for the desktop ignore.
- `yarn vitest run test/unit/playwright-config.spec.ts`: 1 passed.
- Corrected Dramawebben, History, and ID desktop batch: 19 passed.
- Repeated author navigation and mobile Editor batch: 10 passed; this comprises
  author navigation 4/4 and mobile Editor 6/6.
- `python -m invoke test`: 34 files and 951 tests passed.
- `python -m invoke typecheck`: passed.
- `git diff --check`: passed.
