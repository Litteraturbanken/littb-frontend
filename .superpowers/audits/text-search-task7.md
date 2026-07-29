# Nuxt full-text search Task 7 closure audit

Status: **not yet closable**. Commit `c15ce52b` already implements most of Task 7, but the progress ledger correctly remains pending: one Important route-identity risk and one explicit browser-behavior gap remain, and there is no recorded focused/full/live closure run.

This was a read-only audit. No tracked files were edited and no test command that could generate workspace artifacts was run.

## Already done

- The Task 7 files exist and are committed in `c15ce52b`: `nuxt/test/e2e/text-search.behavior.spec.ts`, `nuxt/test/e2e/text-search.visual.spec.ts`, plus the required fixture/page/component changes. Tasks 1–6 are separately recorded complete in `.superpowers/sdd/progress.md` under “Nuxt full-text search”.
- The deterministic behavior spec is broad. Its 18 cases cover submit/reset/toggle, all advanced filter families, chronology edits, word modes and allowlisted legacy filters, Back/Forward restoration, page-key navigation, author facets/“Visa alla”, “Visa fler”, lazy/static options, exact 250 ms title latest-wins, primary/count/options/more cancellation, recovery, hydration/Reader navigation, and navigation cleanup (`nuxt/test/e2e/text-search.behavior.spec.ts:76-522`). SSR coverage adds slow-count independence, per-work/per-page Reader indices, primary A→B and A→B→A races, options/title cancellation, range inputs, goto-page bounds, gender distinctions, row geometry, and zero counts (`nuxt/test/ssr/text-search.spec.ts:199-719`).
- Fixture quantity/highlight alignment is done, not pending implementation. Angular authority has seven Strindberg highlights plus one Lagerlöf highlight and a count of eight (`nuxt/test/fixtures/text-search-data.mjs:129-190`). Angular asks for six fragments, using one as the overflow sentinel (`nuxt/test/visual/capture-text-search-angular.spec.ts:168-179`). Nuxt authority mode returns five visible Strindberg highlights, one visible Lagerlöf highlight, one `has_more_highlights` overflow, and count eight (`nuxt/test/fixtures/v2-server.mjs:883-918`, `1002-1010`). The Nuxt visual readiness gate asserts the resulting nine table rows, six matches, one overflow, count eight, and three navigator items (`nuxt/test/e2e/text-search.visual.spec.ts:31-52`).
- All eight visual comparisons are defined: four states at `nuxt/test/e2e/text-search.visual.spec.ts:7-20`, run by both `desktop-chromium` and `mobile-chromium` in `nuxt/playwright.config.ts:29-52`, against the eight tracked Task 5 baselines. The established `threshold: 0.1` and `maxDiffPixels: 100` are unchanged (`nuxt/test/e2e/text-search.visual.spec.ts:99-106`). The only DOM normalization is the recorded Angular gender-initialization defect; Nuxt first asserts its corrected route state (`nuxt/test/e2e/text-search.visual.spec.ts:54-61`).
- The architecture constraints remain intact: fetches are page-local (`nuxt/app/pages/sök.vue:128-182`, `239-405`, `497-559`, `727-764`); the shared multi-select is fetch-free (`nuxt/app/components/search/SearchMultiSelect.vue:1-149`); strict runtime acceptors gate all three response families (`nuxt/app/pages/sök.vue:252-258`, `317-325`, `394-399`, `517-526`, `745-755`); primary SSR stays route-keyed and count is independent/non-awaited (`nuxt/app/pages/sök.vue:187-335`). No one-use composable was added.

## True gaps and risks

### Important: stale options are deliberately exposed across route identities

`lastAcceptedOptions` retains the last successful route’s complete option set and `options` falls back to it whenever the current route has no cache (`nuxt/app/pages/sök.vue:409-419`). Thus a route change followed by a slow, aborted, or failed `/text-search/options` request can display and allow selection of unselected titles/authors from the previous route. Request acceptance itself is identity-guarded (`nuxt/app/pages/sök.vue:378-404`, `497-533`), but this presentation fallback bypasses that isolation. The current “reject stale identity data” test only checks spinner/more-hit state and does not open a selector to assert absence of old choices (`nuxt/test/e2e/text-search.behavior.spec.ts:457-481`).

Bounded fix: add a failing browser case that loads distinguishable options for route A, navigates to route B with its options delayed/failed, opens the title/author controls, and proves no unselected A-only rows are offered. Then make `options` current-identity-only. Preserve selected values through the existing selected-ID fallbacks in `authorChoices`, `aboutAuthorChoices`, and `titleChoices` (`nuxt/app/pages/sök.vue:561-602`) rather than retaining all stale choices. This stays page-local, typed, and fetch-free outside the page.

### Important closure gap: Headless UI keyboard behavior is not exercised

Task 7 explicitly requires keyboard navigation. The behavior spec tests only document-level left/right pagination and its form-control exclusion (`nuxt/test/e2e/text-search.behavior.spec.ts:260-289`). It does not use keyboard input to open, traverse, select, and remove a `SearchMultiSelect` option, nor to choose gender in the Headless UI `Listbox`. Those are the page’s custom interactive controls (`nuxt/app/components/search/SearchMultiSelect.vue:68-148`; `nuxt/app/pages/sök.vue:1153-1185`), so file presence and Headless UI usage do not prove the legacy/accessibility interaction contract.

Bounded fix: add one deterministic e2e case using Tab/Enter or Space/ArrowDown/Enter/Escape to select and remove one multi-select item and select gender; assert URL and semantic request bodies. No component redesign is indicated unless the RED test exposes one.

### Closure evidence is missing

- The eight comparisons are defined, but the repository/progress ledger contains no fresh green 8/8 run or screenshot-diff inspection record after `c15ce52b`. Step 3 therefore still needs execution and human diff inspection.
- The complete backend/frontend verification matrix in Task 7 Step 4 has no recorded post-`c15ce52b` result. Earlier Task 6 numbers do not close the new behavior/visual code.
- Task 7 Step 5 is wholly unrecorded: no deterministic Angular/Nuxt old/new check at desktop and mobile and no live `/sök?fras=doktor` smoke proving result structure, toolkit, Reader destination, background, loading completion, or console/network cleanliness. `docs/superpowers/plans/2026-07-18-nuxt-text-search.md:425-430` remains the authority; `.superpowers/sdd/progress.md` still says “Frontend Task 7: pending”.

## Bounded next sequence

1. In `nuxt/test/e2e/text-search.behavior.spec.ts`, add only the stale-options identity case and the Headless UI keyboard case. If the stale-options test is RED, adjust only `nuxt/app/pages/sök.vue:409-419`; reuse the selected-value fallbacks at `561-602`. Do not add a composable or move fetch ownership.
2. Run the focused Task 7 gate and inspect all eight generated diffs. Correct markup/CSS only for actual parity defects; keep the existing threshold and maximum difference policy. Do not recapture/overwrite Angular baselines unless the authority itself has intentionally changed.

   ```bash
   cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
   npm run test:e2e -- test/e2e/text-search.behavior.spec.ts \
     test/e2e/text-search.visual.spec.ts
   ```

3. Run the complete closure matrix exactly as planned:

   ```bash
   cd /Users/johan/.codex/worktrees/8c5c/lb-backend
   pytest -q test_lbapi/v2
   python scripts/export_v2_openapi.py --check
   python -m compileall -q lbapi
   git diff --check

   cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
   npm run api:check
   npm run test:unit
   npm run test:ssr
   npm run test:e2e
   npm run typecheck
   npm run build
   git diff --check
   ```

4. With the existing Angular and Nuxt development servers left running, compare the same deterministic simple/advanced/no-hit states at 1440×1000 and iPhone 13, then smoke live `/sök?fras=doktor` on Nuxt at both viewports. Record exact old/new URLs, first result/header/highlight geometry, toolkit totals, first Reader href/destination, background readiness, pending completion, console warnings/errors, and unexpected network origins. This is verification only; do not weaken fixtures or visual thresholds to make it pass.
5. Only after 1–4 are green, update `.superpowers/sdd/progress.md` with the focused 8/8 visual result, behavior/full-suite totals, baseline-diff inspection, and live old/new evidence. Task 7 can then be marked complete; Task 7 Step 7 route inventory is follow-on work and must not reopen `/sök` compatibility.
