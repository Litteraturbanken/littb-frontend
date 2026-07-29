# Nuxt author bibliographic database implementation plan

**Design:** `docs/superpowers/specs/2026-07-22-nuxt-author-biblinfo-design.md`

1. Add failing backend model, provider, API, and OpenAPI contract tests.
2. Implement the strict FastAPI bibliography models/router/provider and export
   the updated OpenAPI snapshot.
3. Regenerate the Nuxt API client from that snapshot.
4. Add deterministic provider and author fixtures plus failing SSR/browser
   tests for the route and all interaction states.
5. Implement the page-local Nuxt route, exact Angular markup, stale-response
   guards, NuxtLinks, and typed failures.
6. Capture/compare desktop and mobile authority images and make only parity
   corrections supported by the comparison.
7. Run focused backend/frontend suites, typecheck, OpenAPI/diff checks, then
   request an independent review.
