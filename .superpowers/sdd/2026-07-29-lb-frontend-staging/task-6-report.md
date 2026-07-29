# Task 6 report: whole-site staging smoke

## Outcome

The root Playwright live smoke contains 14 named, single-worker checks for the
complete staging surface. All 14 pass against a fresh Node 22.22.0 production
Nitro build configured to use the deployed staging backend.

The corrected Editor fixture is `/editor/lb12106/ix/0/e`. It renders the real
etext for *Kejsarn av Portugallien* and exercises client next-page navigation.
A separate same-origin API check requires the nonexistent `lb12106` facsimile
manifest to fail honestly with typed HTTP 404 `editor_manifest_not_found`.

No frontend deployment was performed in this task.

## TDD and debugging evidence

The original five-test suite first failed against production Nitro because its
preflight required the development-only Vite client:

```text
LITTB_NUXT_LIVE_ORIGIN=http://127.0.0.1:3029 yarn test:e2e:nuxt-live
Error: Nuxt preflight failed: http://127.0.0.1:3029/_nuxt/@vite/client (HTTP 404)
```

After the production-compatible preflight and whole-site checks were added, the
first 13-test production run proved the planned facsimile fixture wrong:

```text
/editor/lb12106/ix/0/f must return HTTP 200
Expected: 200
Received: 404
```

Systematic backend investigation then established the root cause as fixture/media
mismatch rather than an Editor implementation defect. The deployed staging API
reports:

```text
GET https://stage.litteraturbanken.se/api/v2/works/lb12106/editor-manifest?media_type=etext
HTTP 200
status=complete, bounds={kind:dense,page_count:304}, display_title="Kejsarn av Portugallien"

GET https://stage.litteraturbanken.se/api/v2/works/lb12106/editor-manifest?media_type=faksimil
HTTP 404
{"error":{"code":"editor_manifest_not_found","message":"Editor manifest not found","details":null}}
```

The first corrected 14-test run produced 13 passes and one scoped test-selector
failure because two legitimate Editor title elements matched. Narrowing the
assertion to the visible metadata title made the focused Editor test green and
the subsequent full run passed 14/14. No application code or assertion strength
was changed.

## Implemented coverage

- Home page HTTP 200, hydration, and defining content.
- Advanced Library route, works/popularity state, mount marker, and advanced
  controls toggled closed and open.
- Simple and advanced text-search routes, route query state, hydration markers,
  and advanced panel state.
- Hjalmar Söderberg author route and author navigation.
- Doktor Glas etext Reader content and next-page navigation.
- Boye facsimile Reader image and OCR layer.
- Typed dictionary lookup, same-origin API status, and article dialog.
- `lb12106` Editor etext content, title, media integrity, and next-page navigation.
- Typed absence contract for the unavailable `lb12106` facsimile manifest.
- Existing `lb238704` Editor facsimile next-page interaction retained.
- Presentations and Dramawebben landing routes.
- NuxtLink navigation from Reader to author followed by `page.goBack()`, with the
  exact prior Reader route, label/state, and etext content restored.
- Shared per-test collection that fails on every browser console error or
  uncaught page error.

`LITTB_NUXT_LIVE_ORIGIN` is the configurable browser origin. Without an explicit
`LITTB_BACKEND_ORIGIN`, preflight checks the public-compatible same-origin
`/api/v2/openapi.json` contract.

## Verification

Production build and staging-backed server:

```text
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn build
Build complete; exit 0

PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  HOST=127.0.0.1 PORT=3029 \
  NUXT_API_BASE=https://stage.litteraturbanken.se/api/v2 \
  NUXT_LIBRARY_API_BASE=https://stage.litteraturbanken.se/api \
  node .output/server/index.mjs
Listening on http://127.0.0.1:3029
```

Complete live suite:

```text
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  LITTB_NUXT_LIVE_ORIGIN=http://127.0.0.1:3029 yarn test:e2e:nuxt-live
14 passed (11.7s)
```

Focused RED/GREEN correction:

```text
# RED: first corrected full run
13 passed, 1 failed: strict-mode ambiguity for .editor-reader-context .title

# GREEN after narrowing to the metadata title
yarn test:e2e:nuxt-live --grep 'lb12106 Editor etext'
1 passed (1.7s)
```

Harness contracts, lint, syntax, and diff hygiene:

```text
python3 test/test_nuxt_live_e2e.py
Ran 4 tests in 2.087s — OK

yarn eslint test/e2e/playwright_e2e.spec.js \
  test/e2e/nuxt_live_preflight.cjs playwright.nuxt-live.config.js
Done in 0.60s

node --check test/e2e/playwright_e2e.spec.js
node --check test/e2e/nuxt_live_preflight.cjs
node --check playwright.nuxt-live.config.js
git diff --check
All exited 0
```

## Remaining concerns

- The public frontend URL still requires its post-deployment run; this task used
  local production Nitro with the deployed staging backend.
- Build output contains pre-existing Sass and browser-data deprecation warnings;
  the build exits 0 and these are outside the smoke-harness scope.
- The strict local history check passes. There is no known local non-critical
  history limitation.
