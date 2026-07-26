# Nuxt Reader page-position slider implementation plan

> **Constraints:** Preserve the Angular-derived visuals; use page-local `<script setup>` state; use Nuxt router push; do not add a composable, store, Angular compatibility layer, stage, or commit.

## Task 1: Add failing Reader slider behavior coverage

**Files:**
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify only if needed for a deliberately sparse map: `nuxt/test/fixtures/reader-data.mjs`

Add focused desktop tests for the accessible raw-index slider contract, Arrow/Page/Home/End preview with key-up commit, raw-query preservation, Back restoration, one navigation after pointer release, no navigation during pointer moves, sparse-hole no-op, search-hit query retention, absent-count inert state, and a one-page boundary. Record RED evidence before production changes.

## Task 2: Project valid legacy positions in the typed Reader DTO

**Files:**
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`
- Modify relevant Reader API/unit assertions if the response shape is asserted exactly.

Add `sliderMaximum: number | null` from valid explicit `page_count - 1`. Do not derive it from `pageMap.length`, and do not change the current page's settled `sliderPercent` or geometry helper.

## Task 3: Make the existing pointer interactive

**Files:**
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/assets/styles/reader.scss` only for a focus-visible outline that leaves unfocused layout unchanged.

Overlay a transparent native range without changing the decorative geometry. Add identity-bound page-local raw-index draft state, pointer input/change handling, keyboard preview/key-up commit, page-name translation, and a single `router.push(pageHref(target.pageName))` commit after exact page-index lookup. Keep the server fallback unchanged. Do not add a route watcher.

## Task 4: Verify and review

Run the focused RED/GREEN test, the full desktop Reader suite, typecheck, and `git diff --check`. Compare unfocused computed geometry/screenshot with the current authority. Request a fresh code review, resolve all Critical/Important findings, then exercise pointer/keyboard, Back, and route reactivity in the in-app browser.
