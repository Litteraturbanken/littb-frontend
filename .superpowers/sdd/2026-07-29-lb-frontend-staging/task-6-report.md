# Task 6 report: whole-site staging smoke

## Outcome

The root Playwright live smoke now contains 13 named, single-worker checks for the
complete staging surface. Twelve checks pass against a fresh local production
Nitro build. The required `/editor/lb12106/ix/0/f` check remains deliberately
blocking because the local backend does not provide that work's editor manifest.
No assertion was weakened or skipped.

The suite was not run against public staging and no deployment work was started.

## TDD evidence

The unmodified five-test suite was first run against production Nitro on isolated
port 3029 with Node 22.22.0:

```text
LITTB_NUXT_LIVE_ORIGIN=http://127.0.0.1:3029 yarn test:e2e:nuxt-live
Error: Nuxt preflight failed: http://127.0.0.1:3029/_nuxt/@vite/client (HTTP 404)
```

This demonstrated the production-targeting gap: the old preflight required the
Vite development client. After changing the preflight to validate the root HTML
hydration shell and same-origin V2 contract, the expanded suite ran on production
Nitro. Its first run reported 11 passing checks, the expected `lb12106` failure,
and one Dramawebben locator ambiguity. Tightening that locator to the exact link
name produced the final result below.

## Implemented coverage

- Home page HTTP 200, hydration, and defining content.
- Advanced Library route, works/popularity state, mount marker, and advanced
  controls toggled closed and open.
- Simple and advanced text-search routes, route query state, hydration markers,
  and advanced panel state.
- Hjalmar Söderberg author route and author navigation.
- Doktor Glas etext Reader content and next-page navigation.
- Boye facsimile Reader image and OCR layer.
- Typed dictionary lookup, same-origin API response status, and article dialog.
- Exact required `lb12106` Editor route as a blocking HTTP-200 assertion.
- Existing `lb238704` Editor next-page interaction retained independently.
- Presentations and Dramawebben landing routes.
- NuxtLink navigation from Reader to author followed by `page.goBack()`, with the
  exact prior Reader route, label/state, and etext content restored.
- Shared per-test collection that fails on every browser console error or
  uncaught page error.

`LITTB_NUXT_LIVE_ORIGIN` remains the configurable browser origin. When
`LITTB_BACKEND_ORIGIN` is absent, preflight checks the public-compatible
same-origin `/api/v2/openapi.json`; the explicit backend origin is still accepted
for the existing local harness contract.

## Verification

Fresh production build/server:

```text
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn build
Build complete; exit 0

PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  HOST=127.0.0.1 PORT=3029 node .output/server/index.mjs
Listening on http://127.0.0.1:3029
```

Full suite, with no backend-origin override:

```text
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  LITTB_NUXT_LIVE_ORIGIN=http://127.0.0.1:3029 yarn test:e2e:nuxt-live
13 tests: 12 passed, 1 failed (29.9s)
Failure: /editor/lb12106/ix/0/f expected HTTP 200, received HTTP 404
```

All non-blocked smoke coverage:

```text
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH \
  LITTB_NUXT_LIVE_ORIGIN=http://127.0.0.1:3029 \
  yarn test:e2e:nuxt-live --grep-invert 'lb12106'
12 passed (20.4s)
```

Harness contract and syntax checks:

```text
python3 test/test_nuxt_live_e2e.py
Ran 4 tests in 2.919s — OK

node --check test/e2e/playwright_e2e.spec.js
node --check test/e2e/nuxt_live_preflight.cjs
node --check playwright.nuxt-live.config.js
git diff --check
All exited 0
```

## Blocking backend/data dependency

The frontend failure is backed by the direct same-origin response:

```text
GET http://127.0.0.1:3029/editor/lb12106/ix/0/f
HTTP 404
{"statusMessage":"Editor page not found"}
```

The underlying backend request gives the precise missing dependency:

```text
GET http://127.0.0.1:8000/v2/works/lb12106/editor-manifest?media_type=faksimil
HTTP 404
{"error":{"code":"editor_manifest_not_found","message":"Editor manifest not found","details":null}}
```

The independently retained `lb238704` Editor interaction passes, confirming that
the Editor smoke harness and production Nitro route work when manifest data is
available. Task 7 must make the exact `lb12106` manifest available before the
complete 13-test staging suite can turn green.

## History status

The strict local history check passes. There is no known local non-critical
history limitation to record; public staging still needs the same check after
deployment.
