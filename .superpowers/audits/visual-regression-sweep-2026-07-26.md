# Nuxt visual-regression sweep — 2026-07-26

Read-only audit. Angular baselines were not regenerated or modified. The user-facing
Nuxt server on `127.0.0.1:3020` and backend on `127.0.0.1:8000` were left running;
the deterministic fixture/SSR harness used isolated ports `4100` and `3300`.

## Commands and coverage

The first command needs `NUXT_IGNORE_LOCK=1` whenever the primary dev server is
already running; without it Nuxt aborts the isolated server before Playwright starts.

```sh
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3300 yarn playwright test \
  --config=playwright.config.ts \
  --project=desktop-chromium --project=mobile-chromium \
  test/e2e/reader-final-parity.visual.spec.ts \
  test/e2e/reader-faksimil.visual.spec.ts \
  test/e2e/reader-contents.visual.spec.ts \
  test/e2e/library.visual.spec.ts \
  test/e2e/text-search.visual.spec.ts \
  test/e2e/author-profiles.visual.spec.ts \
  test/e2e/home-page.visual.spec.ts \
  test/e2e/about-pages.visual.spec.ts \
  test/e2e/contact.visual.spec.ts \
  test/e2e/statistics.visual.spec.ts
```

Result: 55 passed, 1 intentionally skipped, 2 screenshot mismatches (both the
same standalone EPUB issue below).

```sh
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3300 yarn playwright test \
  --config=playwright.config.ts --output=test-results-visual-extra \
  --project=desktop-chromium --project=mobile-chromium \
  test/e2e/reader-hit.visual.spec.ts \
  test/e2e/reader-source-info.visual.spec.ts \
  test/e2e/author-works.visual.spec.ts \
  test/e2e/author-documents.visual.spec.ts
```

Result: 18 passed, 8 source-info infrastructure failures described below.
Editor was deliberately not run while its implementation and fixture files were
being edited concurrently.

## Reproducible findings

### [Baseline drift, low] Standalone EPUB baseline omits the restored inactive PDF count

- Route: `/epub?visa=epub&sort=popularitet`
- Reproduction: the first command above, tests named `matches the canonical Angular
  standalone-epub shell at desktop and mobile`.
- Desktop: 325 pixels differ (ratio 0.01), exceeding `maxDiffPixels: 100`.
- Mobile: 344 pixels differ (ratio 0.01), exceeding `maxDiffPixels: 100`.
- Desktop artifacts:
  - expected: `nuxt/test/visual/baselines/standalone-epub-desktop.png`
  - actual: `nuxt/test-results/e2e-library.visual-matches-6b8aa-shell-at-desktop-and-mobile-desktop-chromium/standalone-epub-desktop-actual.png`
  - diff: `nuxt/test-results/e2e-library.visual-matches-6b8aa-shell-at-desktop-and-mobile-desktop-chromium/standalone-epub-desktop-diff.png`
- Mobile artifacts:
  - expected: `nuxt/test/visual/baselines/standalone-epub-mobile.png`
  - actual: `nuxt/test-results/e2e-library.visual-matches-6b8aa-shell-at-desktop-and-mobile-mobile-chromium/standalone-epub-mobile-actual.png`
  - diff: `nuxt/test-results/e2e-library.visual-matches-6b8aa-shell-at-desktop-and-mobile-mobile-chromium/standalone-epub-mobile-diff.png`
- Exact visual delta: the baseline says `PDF`; current output says `PDF: 201`.
  No other pixels materially differ.
- Classification: stale screenshot authority after intentional parity work, not a
  Nuxt layout regression and not dynamic-data noise. Commit `2040a668` deliberately
  restored inactive EPUB/PDF counts; the deterministic fixture supplies `201`.
- Root-cause candidate: the screenshot baselines predate that parity fix. They need
  an explicitly reviewed authority update after the product change is accepted.

### [Test infrastructure, medium] Reader source-info visual suite blocks Nuxt hydration

- Routes:
  - `/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext`
  - `/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext?om-boken`
  - `/författare/AlmlöfN/titlar/Affarer/sida/-2/faksimil?om-boken`
  - `/författare/LongErrataA/titlar/LongErrata/sida/-2/etext?om-boken`
- Reproduction: the second command above; all four cases fail on desktop and mobile.
- First failing request:
  `GET http://127.0.0.1:3300/_nuxt/@fs/Users/johan/.codex/worktrees/8c5c/littb/nuxt/node_modules/nuxt/dist/app/entry.js?t=1785071874909&v=40bb0872`
- Closed-case artifacts:
  `nuxt/test-results-visual-extra/e2e-reader-source-info.vis-94c9d-nfo-closed-normal-authority-{desktop,mobile}-chromium/error-context.md`
- Open-case representative artifacts:
  `nuxt/test-results-visual-extra/e2e-reader-source-info.vis-aeb2d-ource-info-normal-authority-{desktop,mobile}-chromium/error-context.md`
- Failure mode: `isRegisteredNuxtAsset()` accepts a JavaScript asset with a lone
  eight-hex `v` parameter, but the current Vite URL has both `t` and `v`. The route
  interceptor records and aborts it. With the entry module blocked, Headless UI never
  hydrates/portals the server-rendered fallback modal, so the suite subsequently sees
  no accessible `dialog` on desktop or a hidden fallback modal on mobile. No source-info
  screenshots are compared.
- Root-cause candidate: the visual test's strict Nuxt-asset allowlist has not been
  updated for the current Vite/Nuxt development asset URL shape.
- Regression distinction: this is reproducible test-infrastructure breakage, not a
  reproduced product regression. A read-only check against the existing real dev server
  at `http://127.0.0.1:3020/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?om-boken`
  showed the hydrated, visible accessible `Om boken` dialog with its source description,
  provenance, errata and similar-works sections.

### [Test infrastructure, low] Isolated Playwright server requires an undocumented lock bypass

- Reproduction: run either command above without `NUXT_IGNORE_LOCK=1` while port 3020
  is served from the same checkout.
- Exact error: `Another Nuxt dev server is already running` followed by
  `Process from config.webServer was not able to start. Exit code: 1`.
- Root-cause candidate: `playwright.config.ts` starts a second Nuxt dev process but the
  command does not set `NUXT_IGNORE_LOCK=1`; Nuxt 4.4's checkout-wide dev lock is not
  port-scoped.
- Impact: visual tests cannot run alongside the normal development server unless the
  caller already knows and supplies the bypass. This does not affect application visuals.

## Clean sampled authorities

No screenshot/layout mismatch was reproduced in the sampled desktop/mobile authorities
for Reader normal OCR, focus day/night, Nya vägar, facsimile default/large, contents
closed/open, search pristine/results/advanced/no-hit, Library populated/advanced/download,
author profiles/works/documents, Home, About, Contact, or Statistics. Reader hit-marking
ordinary/single-first/phrase-middle also passed. Fixture data was deterministic, so no
dynamic production-data changes were classified as failures.

## Maintenance follow-up

The two actionable harness findings were addressed without changing product visuals:

- The Reader source-info request allowlist now accepts only same-origin JavaScript
  assets carrying the current exact two-parameter Vite shape: a 13-digit `t` value and
  an eight-lowercase-hex `v` value. Unknown, duplicated, malformed, external-origin,
  and traversal-shaped requests remain rejected. The shared helper has focused unit
  coverage, and the visual suite also resolves every internal source-info NuxtLink
  against the runtime router.
- The isolated Playwright Nuxt command supplies `NUXT_IGNORE_LOCK=1`; both fixture and
  Nuxt servers still have `reuseExistingServer: false`, so the checkout lock bypass does
  not weaken test isolation or allow reuse of the developer server on port 3020.
- Unblocking hydration exposed a real product routing defect rather than another
  allowlist gap: source-info author/read URLs used the decoded `/författare` prefix,
  while Nuxt registers `/f%C3%B6rfattare`. Those internal NuxtLinks now pass through the
  existing `canonicalNuxtHref()` boundary. External provenance/license/download anchors
  are unchanged. The source-info visual authority deliberately forces recommendation
  failure because recommendations have separate behavior coverage and predate these
  modal snapshots.
- Only `standalone-epub-desktop.png` and `standalone-epub-mobile.png` were updated. Each
  baseline differs from its prior authority exclusively in the `PDF` tab rectangle,
  whose deterministic fixture text is now `PDF: 201`; unrelated pixels and all Reader
  source-info baselines remain byte-for-byte at their prior authority.

Fresh verification after the follow-up:

```text
Reader source-info visual: 8 passed (desktop + mobile)
Standalone EPUB visual: 2 passed (desktop + mobile)
Focused source-info behavior: 2 passed
Registered-asset + Playwright config unit tests: 15 passed
```

### Review hardening

The follow-up review found two test-boundary gaps, both now covered:

- Asset paths are decoded safely for at most four passes, with backslashes treated
  as separators. Every decoded form must remain below `/_nuxt/` and contain no literal
  `.` or `..` segment. Malformed escapes and residual escapes after the bounded pass
  are rejected. This catches encoded separators, mixed literal-dot/encoded-separator
  traversal, and recursively encoded traversal while retaining Nuxt's legitimate
  queryless encoded virtual-module paths. Query acceptance was not broadened.
- The remaining no-JavaScript and client-history source-info expectations now assert
  the canonical encoded author prefix. A deterministic Söderberg author profile was
  added to the fixture so the author-link test reaches its back/forward and zero
  document-load assertions rather than stopping at a fixture 404.

Fresh follow-up verification: 25 focused unit tests, three source-info navigation
behavior cases, eight source-info visual cases, and two standalone EPUB visual cases
passed; Nuxt typechecking and `git diff --check` also completed successfully.
