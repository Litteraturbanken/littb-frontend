# Nuxt editor Reader route design

## Scope

Restore Angular's registered `/editor/:lbid/ix/:ix/:mediatype` route. It is an internal Reader entry point addressed by work id and raw zero-based page index, with compact media aliases `f` and `e`. No other editor route is registered.

## Legacy authority

- The Angular route feeds the ordinary Reader controller with `isEditor=true`.
- `f` maps to faksimil and displays `/txt/{lbid}/{lbid}_{size}/{lbid}_{size}_{ix+1 padded 4}.jpeg`; `e` maps to e-text and displays `/txt/{lbid}/res_{ix padded 5}.html`.
- It requests `get_work_info?lbworkid=...` to obtain metadata, but gracefully falls back to page assets plus `count_pages/{lbid}/{media}` if metadata is unavailable.
- The editor sidebar is the Reader sidebar with page-index navigation, a raw-index slider, and a `Stäng editor` target pointing to the ordinary work media URL when metadata supplies one.

## Nuxt boundary and SSR

- Add a strict server endpoint that validates IDs/index/media aliases, proxies metadata and the chosen asset through existing configured source bases, and returns a typed DTO. The browser never receives source-base authority.
- SSR the page when metadata/assets are available. For an unavailable metadata response, retain the legacy useful editor fallback: return the asset plus typed count if available; otherwise a clear 404/502.
- Keep all page state local to the route. Navigation is `router.push()` with raw route strings; no Angular compatibility bridge, store, or composable.

## Visual and interaction contract

Reuse the current Reader shell/Reader facsimile asset styling and the existing slider geometry. Editor-specific visible affordance is only the legacy `Stäng editor` action. It must not claim normal Reader author/part/search controls when editor metadata is unavailable.

## Verification

Use a deterministic work-id fixture for faksimil/e-text assets, metadata, page counts, invalid aliases/indexes, internal raw-index navigation, and `Stäng editor`. Add SSR and desktop/mobile visual comparison if the existing Reader visual harness can target the standalone route.
