# Nuxt remaining About content and Help implementation plan

**Design:** `docs/superpowers/specs/2026-07-16-nuxt-about-help-languages-design.md`

**Base:** `370eea510139aa62007accbeaf4c5423907b1316`

## Global constraints

- Architectural migration only; Angular is the visual/editorial authority.
- Runtime `/red` remains content owner; managed HTML copies are test-only.
- Page-specific logic remains in `nuxt/app/pages/om/[page].vue`; no composable.
- Unknown slugs never select a remote path.
- No Headless UI, Angular compatibility layer, iframe, backend, or deployment change.
- Preserve unrelated `.superpowers/` and user changes.
- Follow TDD and commit each task separately. Review each task before proceeding.

### Task 1: Capture five deterministic content fixtures

**Files:**
- Create `nuxt/test/fixtures/about-content/{hjalp,mal,english,deutsch,francais}.html`
- Modify `nuxt/test/unit/about-content-fixtures.spec.ts`
- Modify `nuxt/test/fixtures/v2-server.mjs`

1. Add failing exact-hash/content-marker/security assertions for the five files.
2. Run `yarn --cwd nuxt vitest run test/unit/about-content-fixtures.spec.ts` and record missing-fixture RED.
3. Mechanically capture the exact live URLs listed in the design. Do not normalize whitespace.
4. Add the exact five GET paths to the fixture server as `text/html; charset=utf-8`, preserving request logging and `failure === "content"` behavior.
5. Run the focused test, `yarn --cwd nuxt test:unit`, and a server syntax/smoke check.
6. Commit `test(nuxt): capture remaining About content authority`.

### Task 2: SSR-render the four unlisted About pages

**Files:**
- Modify `nuxt/app/pages/om/[page].vue`
- Modify `nuxt/test/ssr/about-pages.spec.ts`

1. Add failing parameterized SSR cases for `mål`, `english.html`, `deutsch.html`, and `francais.html`. Each must assert HTTP 200, exact representative beginning/middle/end markers, no upstream document head, one exact fixture request, and zero active About links in rendered HTML.
2. Extend the page-owned literal map and validation list. Each entry uses `activePage: null`; no route-derived remote URL.
3. Reuse the existing body extraction/fetch/failure path without abstraction.
4. Run focused SSR, unit, and typecheck gates.
5. Commit `feat(nuxt): render remaining About content`.

### Task 3: Port Help behavior and alias

**Files:**
- Modify `nuxt/app/pages/om/[page].vue`
- Modify `nuxt/nuxt.config.ts`
- Modify `nuxt/test/ssr/about-pages.spec.ts`
- Modify `nuxt/test/ssr/routing-errors.spec.ts`
- Create `nuxt/test/e2e/about-help.behavior.spec.ts`

1. Add failing SSR tests for `/om/hjalp`, content failure, and `/hjalp?ankare=Epub` 308 query preservation.
2. Add failing desktop behavior tests for exact Help active state, full authority submenu labels/order, toolkit placement, no browser errors, click URL+40px scroll, direct query scroll, back/forward scroll, and unchanged one-request log.
3. Add literal `hjalp` mapping and validation. Keep all Help parsing/navigation helpers page-local.
4. Render the content with `help_content content unbox page-help`; Teleport `help_submenu sticky` into `#toolkit`.
5. Synchronize `ankare` with `navigateTo({ query })`, use `nextTick` plus `requestAnimationFrame`, and scroll with `window.scrollTo({ top: elementY - 40 })`. Watch only the route query; do not refetch content.
6. Add `/hjalp` HTTP 308 route rule to `/om/hjalp`.
7. Run focused SSR/behavior, full unit, and typecheck gates.
8. Commit `feat(nuxt): port About help navigation`.

### Task 4: Lock Angular visual parity and close the slice

**Files:**
- Create `nuxt/test/visual/capture-about-help-angular.spec.ts`
- Create `nuxt/test/e2e/about-help.visual.spec.ts`
- Create ten baselines `nuxt/test/visual/baselines/about-{mal,english,deutsch,francais,hjalp}-{desktop,mobile}.png`

1. Extend the existing Angular interception map with the five exact test fixtures.
2. Capture all five Angular routes in desktop/mobile projects. Assert content markers and, for Help, submenu toolkit placement before screenshot.
3. Inspect all ten images for full content, About background, fonts, nav active state, submenu placement, and mobile wrapping.
4. Add Nuxt comparisons using the shared `waitForVisualAssets` helper and existing near-pixel thresholds.
5. Run `yarn --cwd nuxt test:visual:capture` and `yarn --cwd nuxt test:e2e`.
6. Run the complete gate:
   - `yarn --cwd nuxt api:check`
   - `yarn --cwd nuxt test:unit`
   - `yarn --cwd nuxt test:ssr`
   - `yarn --cwd nuxt test:e2e`
   - `yarn --cwd nuxt typecheck`
   - `yarn --cwd nuxt build`
   - `yarn test:unit`
   - `yarn build`
   - `git diff --check` excluding only byte-locked raw HTML fixtures
   - generated-client and Angular `app/` diffs must be empty
7. Commit `test(nuxt): lock remaining About parity`.

## Final review gate

- Compare the whole range with the design.
- Verify production contains no captured managed HTML.
- Verify all six new route/alias behaviors with default live content configuration.
- Request a fresh whole-range review and fix all Critical/Important findings.

