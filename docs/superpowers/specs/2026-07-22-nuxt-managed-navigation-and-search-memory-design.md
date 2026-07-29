# Managed HTML Navigation and Search Memory Design

## Goal

Restore Angular-equivalent SPA navigation for Nuxt-owned links inside managed HTML and remember the most recent text-search URL in the global navigation, without changing rendered visuals.

## Managed HTML boundary

A shared click classifier will enhance only an unmodified primary-button click on a same-origin, Nuxt-owned route. It will preserve the anchor's query bytes and canonicalize only the historical `/forfattare`, `/författare`, `/sok`, and `/sök` prefixes already handled by `canonicalNuxtHref`.

Native browser behavior remains authoritative for prevented events, modifier or non-primary clicks, `download`, any explicit `target`, fragment-bearing links, non-HTTP schemes, cross-origin URLs, `/red` and `/txt` assets, unknown paths, and deployment/external project prefixes (`/diktensmuseum`, `/litteraturkartan`, `/översättarlexikon`, `/bibliotekariesidor`, `/ljudochbild`, and `/skolan`). Home, About, and Presentation attach the same composable handler to their managed `v-html` root. Static English, Deutsch, and Français links become `NuxtLink` because their destinations are Nuxt-owned.

## Search-memory boundary

`useTextSearchNavigation` owns one request-safe Nuxt `useState` value. Its SSR-safe default is `/s%C3%B6k`. The text-search page records `pathname + search` on initial SSR/setup and on every accepted client route change; unrelated routes cannot overwrite it. The layout consumes the state as the main-nav `NuxtLink` target. This retains exact query ordering/encoding and uses ordinary Nuxt push/Back history.

## Verification

Pure unit tests cover bounded click classification and exact search-URL normalization. SSR tests cover the default and direct-query link. Browser tests use a `window` sentinel to prove managed links and language links avoid document reloads, exercise Back navigation, and verify that a remembered search URL survives a cross-page round trip.
