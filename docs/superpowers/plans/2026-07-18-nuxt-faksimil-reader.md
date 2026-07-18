# Nuxt Faksimil Reader Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a faithful SSR faksimil image branch to the existing Nuxt Reader, including canonical/shorthand routes, navigation/history, legacy scan size and rotation controls, and strict Angular visual parity without changing the existing e-text branch.

**Architecture:** Keep one page-local Reader fetch and one page-sized Nitro boundary, but replace the e-text-only DTO with a discriminated `etext | faksimil` union. Strict server-side normalization converts legacy scan metadata into safe image sources; a focused Vue component renders fixed-width scans while the canonical page retains shared navigation, history, and query ownership.

**Tech Stack:** Nuxt 4, Nitro/H3, Vue 3, TypeScript, SCSS, Vitest, Playwright.

**Design:** `docs/superpowers/specs/2026-07-18-nuxt-faksimil-reader-design.md`

**Audited base:** `89b0892f`

## Constraints

- Preserve the current Angular layout and fixed scan widths, including horizontal mobile overflow. Do not make scans fluid.
- Keep the existing e-text response, HTML fetch, stylesheet behavior, search highlighting, and visual baselines unchanged.
- Fetch exact legacy metadata at runtime; do not hard-code production work IDs, pages, widths, or image numbers.
- Use the page-local `useAsyncData`; add no one-use composable or store.
- Accept only exact `etext` and `faksimil` representations and never fall back between them.
- Do not fetch or probe JPEGs from Nitro.
- Do not modify FastAPI or generated API types in this slice. OCR overlay and typed faksimil search hits remain deferred.
- Do not restart the existing local Nuxt or FastAPI development servers.
- Do not stage unrelated `.superpowers/` content or `docs/superpowers/plans/2026-07-18-nuxt-author-supplemental-documents.md`.

---

### Task 1: Characterize and normalize the faksimil source contract

**Files:**
- Create: `nuxt/test/unit/reader-source.spec.ts`
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/server/utils/reader-source.ts`

- [ ] Add failing pure tests for `isReaderMediaType`, exact media selection, author/title identity, and rejection before I/O for unknown media.
- [ ] Add failing tests proving scan page name, page index, and image number remain distinct; reject missing, negative, unsafe, and duplicate page identities.
- [ ] Add failing tests proving `faksimil_sizes` indexes `0...4` map to logical sizes `1...5`, reject duplicates/out-of-range values, require positive widths, and sort sources numerically.
- [ ] Add failing tests for RFC3986-safe JPEG URL segments, four-digit image-number padding, preferred size 3/fallback selection, and the legacy `N`/`N+2` `1x`/`2x` pairing.
- [ ] Run `cd nuxt && npm run test:unit -- test/unit/reader-source.spec.ts` and confirm RED for missing faksimil contracts/helpers.
- [ ] Define `ReaderMediaType`, a shared Reader page base, unchanged `ReaderEtextPage`, `ReaderFacsimilePage`, logical size/source types, and their discriminated union in `shared/types/reader.ts`.
- [ ] Refactor `reader-source.ts` into exact e-text and faksimil metadata arms. Preserve the existing e-text sibling-page inheritance semantics; require image numbers on the exact faksimil arm and do not inherit image-less e-text pages.
- [ ] Export small pure source/URL/size helpers where direct unit coverage is useful. Keep legacy payload dictionaries private to the source adapter.
- [ ] Run the focused unit test to GREEN, then run `cd nuxt && npm run test:unit -- test/unit/reader-routes.spec.ts` to catch route-helper regressions.

### Task 2: Extend canonical and shorthand Nitro contracts

**Files:**
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/ssr/reader-shorthand.spec.ts`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Modify: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`
- Modify: `nuxt/server/api/reader/resolve/[author]/[title]/[mediatype].get.ts`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/[mediatype].vue`

- [ ] Extend the deterministic fixture with one exact faksimil representation using page names `1`, `3`, `5`, indexes `0`, `1`, `2`, image numbers `7`, `9`, `12`, multiple source sizes/widths, and independent malformed image/size/width cases. Record metadata, HTML, OCR, JPEG, and search-hit requests separately.
- [ ] Add failing canonical API/SSR assertions for the faksimil union arm: selected image number/sources, title/description, sibling pages, exactly one metadata request, and no `res_NNNNN.html`, OCR, or JPEG server fetch.
- [ ] Replace—not delete—the unsupported-faksimil shorthand tests with failing exact faksimil resolution and 307 redirect assertions, including raw duplicate/unknown query preservation.
- [ ] Add failing status tests for absent exact representation (404), unknown media before I/O (404), missing page before asset I/O (404), and malformed image number/sizes/widths (502).
- [ ] Update fixture unit expectations so faksimil remains rejected only by the e-text-only `/search-hits` endpoint, not by Reader metadata routes.
- [ ] Run `cd nuxt && npm run test:ssr -- test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts` and confirm the new cases are RED.
- [ ] Branch the canonical endpoint after common page resolution: preserve the e-text HTML branch and return the normalized faksimil image arm without fetching an asset.
- [ ] Widen the resolver and shorthand route validator to both supported media types. Validate the canonical path against the requested encoded media type rather than hard-coded `/etext`.
- [ ] Run the focused SSR and fixture unit tests to GREEN; confirm request ledgers prove no media cross-fallback or hidden asset fetch.

### Task 3: Render the scan and legacy controls without disturbing e-text

**Files:**
- Create: `nuxt/app/components/reader/ReaderFacsimileImage.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/assets/styles/reader.scss`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`

- [ ] Add failing SSR assertions for an actual `<img class="faksimil">`, fixed selected width, exact `src`/legacy density `srcset`, `type-faksimil`, accessible alt text, faksimil title/description, navigation, and absence of `.etext`, e-text CSS, and work e-text CSS.
- [ ] Add failing browser assertions for decoded image, fixed rendered width on desktop/mobile, adjacent size button availability, desktop-only rotation controls, and bounded image-error state that preserves navigation.
- [ ] Run focused SSR/browser cases and confirm RED before rendering changes.
- [ ] Implement `ReaderFacsimileImage.vue` with `page` and selected-size props, size-selection emits, an SSR-visible fixed-width `.img_area`, the scan image/source pair, local rotation in 90-degree steps, and page-identity error/rotation reset. Let the component teleport its own legacy size/rotation controls while the page remains the owner of URL changes.
- [ ] Widen the canonical route validator and narrow all media-specific template/computed access by the discriminant. Load e-text styles and render marked HTML only for `etext`; add the image component and `type-faksimil` only for `faksimil`.
- [ ] Gate the entire current hit fetch, marker state, hit UI, and hit-specific styling on a resolved e-text page. A faksimil URL with `q`, `hit`, `s_*`, duplicates, or unknown keys must preserve them without calling `/search-hits`.
- [ ] Derive the primary Reader request identity from route params rather than `route.fullPath`, so query-only size or hit changes do not refetch metadata. Implement `?storlek=N` through router replacement for valid adjacent advertised sizes; keep page navigation as push and preserve duplicate and unknown query values.
- [ ] Add only `.type-faksimil`, `.img_area`, `.faksimil`, control, rotation, and local error styles needed for parity. Do not change existing `.etext` selectors.
- [ ] Run the focused SSR/browser tests to GREEN.

### Task 4: Lock navigation, history, and failure behavior

**Files:**
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify only if a failing test exposes a defect: `nuxt/app/components/reader/ReaderFacsimileImage.vue`
- Modify only if a failing test exposes a defect: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`

- [ ] Add browser coverage proving previous/next navigation changes both canonical URL and scan URL without document reload, preserves duplicate and unknown query values, and Back/Forward restores the right image identity.
- [ ] Prove size changes replace rather than push history, do not refetch Reader metadata, change source/srcset/fixed width, stop at unavailable adjacent sizes, and reset local rotation/error state on page identity change.
- [ ] Prove `lastPageViews` stores `mediatype: "faksimil"`, updates by work+media without overwriting the e-text record, and remains nonfatal when storage is malformed or unavailable.
- [ ] Prove a faksimil search-shaped URL makes zero public/private e-text search-hit calls and still preserves its query through page navigation.
- [ ] Prove a failed JPEG shows one local alert while author/title context and previous/next navigation remain usable.
- [ ] Run `cd nuxt && npm run test:e2e -- test/e2e/reader.behavior.spec.ts` to GREEN on desktop and mobile projects.

### Task 5: Capture Angular authority and enforce strict visual parity

**Files:**
- Create: `nuxt/playwright.reader-faksimil-angular.config.ts`
- Create: `nuxt/test/visual/capture-reader-faksimil-angular.spec.ts`
- Create: `nuxt/test/e2e/reader-faksimil.visual.spec.ts`
- Create: `nuxt/test/visual/baselines/reader-faksimil-default-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-faksimil-default-mobile.png`
- Create: `nuxt/test/visual/baselines/reader-faksimil-large-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-faksimil-large-mobile.png`
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`

- [ ] Build a deterministic Angular authority capture for `/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil`, using the same normalized middle-page metadata and locally served synthetic/public-domain scan artwork as Nuxt. Keep the strict request allowlist, probe ledger, local font handling, image decode wait, and zero unexpected-request assertion.
- [ ] Capture default logical size 3 and direct `?storlek=4` at matching desktop/mobile projects. Assert exact scan URLs, 1x/2x pairing, fixed widths, visible control labels, mobile overflow, and no OCR/search request before accepting authority baselines.
- [ ] Add the corresponding Nuxt visual test using `threshold: 0.1`, `maxDiffPixels: 100`, `scale: "css"`, full-page screenshots, disabled animation, and no baseline masks or threshold relaxation.
- [ ] Run `cd nuxt && npx playwright test --config=playwright.reader-faksimil-angular.config.ts` to create/verify authority images.
- [ ] Run `cd nuxt && npx playwright test test/e2e/reader-faksimil.visual.spec.ts --project=desktop-chromium --project=mobile-chromium` and iterate bounded faksimil styles to strict GREEN.
- [ ] Run the unchanged existing e-text authority suite: `cd nuxt && npx playwright test test/e2e/reader-hit.visual.spec.ts --project=desktop-chromium --project=mobile-chromium`.

### Task 6: Independent review, full verification, and scoped commit

**Files:**
- Modify only the files above if review exposes an in-scope defect.

- [ ] Request an independent code review focused on Important/Critical correctness, SSR duplication, malformed legacy data, media leakage, query/history semantics, and visual-authority integrity. Fix findings with new regression tests first.
- [ ] Run `cd nuxt && npm run test:unit`.
- [ ] Run `cd nuxt && npm run test:ssr -- test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts`.
- [ ] Run `cd nuxt && npm run test:e2e -- test/e2e/reader.behavior.spec.ts`.
- [ ] Run both strict faksimil and unchanged e-text Reader visual suites on desktop/mobile.
- [ ] Run `cd nuxt && npm run typecheck`.
- [ ] Run `cd nuxt && npm run build`.
- [ ] Run `git diff --check`, inspect staged paths, and confirm unrelated plan/`.superpowers` content remains uncommitted.
- [ ] Commit the complete implementation and tests with a scoped message. Report the testable faksimil URL, exact verification results, authority comparison, and deferred OCR/search-overlay work.
