# Nuxt Presentations implementation plan

**Design:** `docs/superpowers/specs/2026-07-16-nuxt-presentations-design.md`

## Global constraints

- Preserve Angular/editorial visual and behavioral authority exactly.
- Keep `/red` XHTML/CSS/XML as runtime sources; do not copy production content into Nuxt.
- Keep fetch/parser/anchor state page-local in `<script setup>`; no one-use composable.
- Add no FastAPI endpoint, generated-client shape, Angular bridge, or destination migration.
- Pin and use `linkedom` 0.18.13 as a direct SSR-safe XHTML/XML parser dependency; do not use browser-only or regex-only document parsing.
- Follow TDD, commit each task separately, and independently review every task.

### Task 1: Freeze deterministic Presentation authority fixtures

**Frontend files:**
- Add test-only Presentation XHTML/CSS/XML/image/download fixtures
- Extend the content fixture server and its unit tests

1. Freeze full index, ordinary, themed, inline-style/image, and vandring XHTML with checksums and markers.
2. Add ordered exact/wildcard backgrounds XML plus every referenced runtime asset.
3. Add failing fixture-server tests for exact paths, request ledger/reset, independent failure controls, content types, and no production escape.
4. Implement the minimum deterministic fixture behavior and run focused/full unit tests.
5. Commit `test(nuxt): fixture Presentation content`.

### Task 2: Port Presentation SSR routes and parsing

**Frontend files:**
- Create `nuxt/app/pages/presentationer/[[...segments]].vue`
- Add a small server redirect handler for `/p/s|v/:doc`
- Modify `nuxt/package.json` and `nuxt/yarn.lock`
- Add parser, SSR, and routing tests

1. Pin `linkedom` 0.18.13 directly and add failing parser tests for wrapper/script removal, exact body preservation, first-h1 metadata, safe relative URL normalization, unsafe schemes, malformed documents, duplicate-target last-wins, whitespace-split background classes, and exact/wildcard ordering.
2. Add failing SSR tests for the index and both folders; exact requests/head/body/classes; XHTML failure preserving independently resolved background; XML failure preserving valid article/head without dynamic background; both failures without leaks; and invalid traversal/segment forms returning 404 before fetch.
3. Add a syntactically safe unknown `.html` case that is route-valid, requests its exact upstream path, and returns the 200 empty shell on upstream 404; assert `/p/s|v/<unknown>.html` still redirects. Add redirect tests for exact known destinations/query preservation and invalid aliases/syntax.
4. Implement the validated optional page, page-local `useAsyncData`, narrow parsers, computed `useSeoMeta`/`useHead`, and server redirects.
5. Run focused/full unit/SSR, API freshness, typecheck, and build.
6. Commit `feat(nuxt): port Presentation routes`.

### Task 3: Lock anchors, assets, and head cleanup

**Frontend files:**
- Add Presentation browser behavior tests
- Make only demonstrated page-local lifecycle fixes

1. Add failing tests for direct `?ankare`, query changes, back/forward, missing anchors, and index scroll-top behavior without refetch.
2. Add ledger assertions that a hydrated index makes exactly one XHTML/no XML request, a hydrated document makes exactly one XHTML/one XML request, and query/history changes add no request.
3. Assert root-normalized CSS/image/download URLs and ordinary deferred hrefs.
4. Assert document-to-document, document-to-index, and Presentation-to-404 transitions remove stale link/style/background/body classes and restore the new route exactly.
5. Assert no hydration errors or production requests.
6. Run focused/full e2e, SSR, typecheck, and build.
7. Commit `test(nuxt): lock Presentation behavior`.

### Task 4: Lock Angular visual parity

**Frontend files:**
- Add Angular authority capture and Nuxt visual comparison
- Add desktop/mobile index, ordinary, themed, inline-style/image, and vandring baselines

1. Intercept all XHTML/XML/CSS/image/download requests with the same fixtures in Angular and Nuxt.
2. Capture only after fonts, document images, runtime stylesheets, and html background are ready.
3. Inspect shell/logo/nav, index columns, article typography, tables/images/captions, runtime app/style CSS, themed background, vandring layout, `bkg-add-border`, and mobile behavior.
4. Compare at existing near-pixel thresholds and fix only demonstrated migration drift.
5. Run complete Nuxt, unchanged Angular, visual, API freshness, typecheck/build, scope, and diff gates.
6. Commit `test(nuxt): lock Presentation parity`.

## Final review gate

- Compare the complete frontend range with the design.
- Verify all production content and visual configuration still comes from `/red`.
- Verify invalid routes cannot select arbitrary content and dynamic head/body state never leaks across navigation.
- Verify author/library/reader destinations remain exact raw links without new coupling.
- Fix every Critical/Important finding and rerun the clean whole-slice gates.
