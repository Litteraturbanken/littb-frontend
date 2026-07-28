# Nuxt Lighthouse 100 Implementation Plan

> **For implementation:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach repeatable Lighthouse Performance 100 on the optimized Nitro Doctor Glas reader while clearing its actionable accessibility, console, asset, and payload findings without changing the visual design.

**Architecture:** Give Nitro the same safe legacy-asset boundary as Vite, reduce the global client graph to a small shared shell, and make reader, library/search, home, presentation, and Dramawebben styles and code route-owned. Preserve dynamic literary-content selectors explicitly and gate every wave with production-server behavior, parity tests, and Lighthouse budgets.

**Tech Stack:** Nuxt 4, Nitro/H3, Vue 3, TypeScript, Sass, Vitest, Playwright, Lighthouse 13.4.1, ESLint.

## Global Constraints

- Do not change the established visual design.
- Do not self-host the repository's desktop OTF files.
- Audit `yarn build` plus Nitro output, never `yarn dev`.
- Keep SSR as the source of initial reader content.
- Do not use static CSS purging for selectors needed by fetched literary HTML.
- Preserve all existing reader routes, history behavior, horizontal scroll behavior, OCR behavior, and keyboard shortcuts.
- Keep unrelated dirty-worktree changes intact.

---

### Task 1: Repeatable Lighthouse production gate

**Files:**
- Create: `nuxt/scripts/lighthouse-budget.mjs`
- Create: `nuxt/scripts/run-lighthouse-reader.mjs`
- Create: `nuxt/test/unit/lighthouse-budget.spec.ts`
- Modify: `nuxt/package.json`
- Modify: `nuxt/yarn.lock`

**Interfaces:**
- Consumes: Lighthouse JSON for the exact Doctor Glas reader URL.
- Produces: `evaluateLighthouseResult(result, budget)` returning `{ failures: string[], summary: object }`; `yarn lighthouse:reader` writes HTML/JSON artifacts and exits nonzero on a failed budget.

- [ ] **Step 1: Write the failing budget tests**

Cover category score normalization, missing audit data, console errors, forbidden asset URLs, and the difference between one passing run and three consecutive passing runs. Use literal JSON fixtures small enough to understand inline.

- [ ] **Step 2: Run the test to verify RED**

Run: `yarn vitest run test/unit/lighthouse-budget.spec.ts`

Expected: FAIL because `scripts/lighthouse-budget.mjs` does not exist.

- [ ] **Step 3: Implement the budget evaluator and runner**

Pin Lighthouse 13.4.1 in `devDependencies`. The runner must build once, start Nitro on a dedicated port, wait for HTTP 200, run the desktop preset three times, and always terminate its child server. Default final budgets are Performance 100, Accessibility 100, Best Practices 100, SEO 100, zero console errors, and zero forbidden reader assets; intermediate waves may pass explicit lower budgets while recording progress.

- [ ] **Step 4: Verify GREEN and capture the baseline failure**

Run: `yarn vitest run test/unit/lighthouse-budget.spec.ts`

Expected: PASS.

Run: `yarn lighthouse:reader --runs 1 --performance 100`

Expected: FAIL with the current measured Performance score and named failing audits, while still writing report artifacts.

- [ ] **Step 5: Commit**

```bash
git add nuxt/scripts/lighthouse-budget.mjs nuxt/scripts/run-lighthouse-reader.mjs nuxt/test/unit/lighthouse-budget.spec.ts nuxt/package.json nuxt/yarn.lock
git commit -m "test(nuxt): add production Lighthouse budget gate"
```

### Task 2: Production legacy-asset proxy parity

**Files:**
- Modify: `nuxt/nuxt.config.ts`
- Create: `nuxt/playwright.reader-assets-production.config.ts`
- Create: `nuxt/test/e2e/reader-assets-production.behavior.spec.ts`
- Modify: `nuxt/test/unit/playwright-config.spec.ts`

**Interfaces:**
- Consumes: `LITTB_CONTENT_PROXY_TARGET`, `READER_SOURCE_PROXY_TARGET`, and `LITTERATURKARTAN_PROXY_TARGET` at build time.
- Produces: built-server same-origin GET/HEAD access for `/red/**`, `/txt/**`, `/bilder/**`, `/export/faksimil/**`, and `/litteraturkartan/**` with upstream status, body, content type, and cache headers preserved.

- [ ] **Step 1: Write the failing production-server spec**

Start the existing fixture server, build Nuxt with all legacy targets pointing to that fixture, start `.output/server/index.mjs`, and assert:

```ts
expect((await request.get("/red/css/etext.css")).headers()["content-type"]).toContain("text/css")
expect((await request.get("/txt/css/lb-reader-doktor-glas-etext.css")).status()).toBe(200)
expect((await request.get("/red/../private-v2/openapi.json")).status()).toBeGreaterThanOrEqual(400)
```

Also load the reader and assert there are no stylesheet MIME or 404 console errors.

- [ ] **Step 2: Run the spec to verify RED**

Run: `yarn playwright test --config=playwright.reader-assets-production.config.ts`

Expected: FAIL because production currently exposes only the Vite proxies.

- [ ] **Step 3: Add Nitro route rules for the public prefixes**

Add exact wildcard proxy rules that retain the matched suffix, for example:

```ts
"/red/**": { proxy: `${contentProxyTarget}/red/**` },
"/txt/**": { proxy: `${readerSourceProxyTarget}/txt/**` }
```

Add the remaining prefixes with their existing target constants. Do not proxy `/api` through these rules and do not broaden a prefix to arbitrary paths.

- [ ] **Step 4: Verify GREEN**

Run: `yarn playwright test --config=playwright.reader-assets-production.config.ts`

Expected: PASS with CSS responses served as `text/css` and no reader console errors.

- [ ] **Step 5: Commit**

```bash
git add nuxt/nuxt.config.ts nuxt/playwright.reader-assets-production.config.ts nuxt/test/e2e/reader-assets-production.behavior.spec.ts nuxt/test/unit/playwright-config.spec.ts
git commit -m "fix(nuxt): proxy legacy reader assets in Nitro"
```

### Task 3: Shared navigation accessibility and touch targets

**Files:**
- Modify: `nuxt/app/layouts/default.vue`
- Modify: `nuxt/app/assets/styles/styles.scss`
- Modify: `nuxt/app/assets/styles/reader.scss`
- Create: `nuxt/test/e2e/shell-accessibility.behavior.spec.ts`
- Modify: `nuxt/test/e2e/reader-final-parity.behavior.spec.ts`

**Interfaces:**
- Consumes: existing navigation destinations and reader link markup.
- Produces: a named `<nav>` containing `.mainnav` as an ordinary list; all audited reader controls expose at least 24 by 24 CSS pixels of safe target area.

- [ ] **Step 1: Write failing semantic and geometry tests**

Assert one `nav[aria-label="Huvudnavigation"] > ul.mainnav`, no `ul.mainnav[role]`, and literal minimum bounding-box heights of 24 pixels for `.mainnav a`, `.pager_ctrls a`, and `.subnav a` that are visible in the desktop reader.

- [ ] **Step 2: Run tests to verify RED**

Run: `yarn playwright test --project=desktop-chromium test/e2e/shell-accessibility.behavior.spec.ts test/e2e/reader-final-parity.behavior.spec.ts`

Expected: FAIL on the current `<ul role="navigation">` and 22-pixel reader links.

- [ ] **Step 3: Implement semantic wrapper and target spacing**

Wrap the existing list in `<nav aria-label="Huvudnavigation">`, remove the list role, and add only the minimum line-height/padding needed to satisfy target geometry. Compensate adjacent spacing where necessary so corridor alignment and total block height remain visually unchanged.

- [ ] **Step 4: Verify GREEN and visual parity**

Run the focused behavior tests and the existing reader visual spec:

`yarn playwright test --project=desktop-chromium test/e2e/shell-accessibility.behavior.spec.ts test/e2e/reader-final-parity.behavior.spec.ts test/e2e/reader-faksimil.visual.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add nuxt/app/layouts/default.vue nuxt/app/assets/styles/styles.scss nuxt/app/assets/styles/reader.scss nuxt/test/e2e/shell-accessibility.behavior.spec.ts nuxt/test/e2e/reader-final-parity.behavior.spec.ts
git commit -m "fix(nuxt): restore shell navigation semantics"
```

### Task 4: Route-owned stylesheet and asset graph

**Files:**
- Modify: `nuxt/nuxt.config.ts`
- Modify: `nuxt/app/assets/styles/styles.scss`
- Modify: `nuxt/app/assets/styles/nuxt.scss`
- Modify: `nuxt/app/assets/styles/reader.scss`
- Create: `nuxt/app/assets/styles/core.scss`
- Create: `nuxt/app/assets/styles/home.scss`
- Create: `nuxt/app/assets/styles/library-search.scss`
- Create: `nuxt/app/assets/styles/presentations.scss`
- Create: `nuxt/app/assets/styles/dramawebben.scss`
- Modify: `nuxt/app/pages/index.vue`
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/app/pages/sök.vue`
- Modify: `nuxt/app/pages/presentationer/[...segments].vue`
- Modify: `nuxt/app/pages/dramawebben/index.vue`
- Modify: `nuxt/app/pages/dramawebben/[document].vue`
- Modify: `nuxt/app/pages/dramawebben/pjäser.vue`
- Modify: `nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Create: `nuxt/test/e2e/reader-assets.behavior.spec.ts`

**Interfaces:**
- Consumes: existing selectors and Sass mixins without changing their declarations.
- Produces: a global core bundle plus route chunks; the reader request graph contains reader/core assets but no Dramawebben background files, library/search component CSS, or Vue Multiselect CSS.

- [ ] **Step 1: Write the failing reader asset-graph test**

Load the production reader, collect resource timing URLs, and assert that none includes `dramawebben`, `bibliotek`, `sök`, `vue-multiselect`, or feature-only background assets. Assert the known reader stylesheet and required authority typography remain active by checking representative computed styles, not source text.

- [ ] **Step 2: Run the test to verify RED**

Run: `yarn playwright test --config=playwright.reader-assets-production.config.ts test/e2e/reader-assets.behavior.spec.ts`

Expected: FAIL with the current Dramawebben images and global feature CSS in the reader graph.

- [ ] **Step 3: Move styles without rewriting them**

Move contiguous feature blocks from `styles.scss` into the five route-owned files. Remove `reader.scss` and Vue Multiselect CSS from `nuxt.config.ts` global CSS and import them only from owning pages/components. Keep reset, base typography, corridor geometry, logo, main navigation, shared containers, and utilities in `core.scss`.

Replace the package Font Awesome stylesheet with a local compatibility entry that retains the existing `.fa` class contract and WOFF2 source but drops EOT, WOFF, TTF, and SVG fallback URLs.

- [ ] **Step 4: Verify the reader graph and every affected visual surface**

Run the reader asset spec plus home, library, search, Dramawebben, presentation, reader, and editor visual specs. Any screenshot difference must be traced to a missing selector and fixed by moving the original rule, not redesigning it.

- [ ] **Step 5: Record Lighthouse improvement**

Run: `yarn lighthouse:reader --runs 1 --performance 90`

Expected: PASS the intermediate budget, with no route-unrelated images and materially less unused CSS than the 398 KiB baseline.

- [ ] **Step 6: Commit**

```bash
git add nuxt/nuxt.config.ts nuxt/app/assets/styles nuxt/app/pages nuxt/test/e2e/reader-assets.behavior.spec.ts
git commit -m "perf(nuxt): split route stylesheet assets"
```

### Task 5: Reader JavaScript boundary

**Files:**
- Modify: `nuxt/app/layouts/default.vue`
- Modify: `nuxt/app/components/global/QuickSearch.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/components/reader/ReaderDictionaryDialog.vue`
- Modify: `nuxt/app/components/reader/ReaderContentsDialog.vue`
- Modify: `nuxt/app/components/reader/ReaderSourceInfoDialog.vue`
- Modify: `nuxt/app/lib/search-hit-highlight.ts`
- Modify: `nuxt/app/lib/reader-dictionary.ts`
- Create: `nuxt/test/e2e/reader-client-graph.behavior.spec.ts`

**Interfaces:**
- Consumes: SSR reader payload and existing user interactions.
- Produces: a reader initial client graph without `linkedom`, Vue Multiselect, library view-model code, Dramawebben parsers, or unused Headless UI component families.

- [ ] **Step 1: Write the failing client-graph test**

Use production resource timing plus emitted sourcemaps/manifest data to assert forbidden modules are absent from chunks requested by the initial reader page. Separately exercise Quick Search and reader controls so an optimization cannot pass by deleting behavior.

- [ ] **Step 2: Run the test to verify RED**

Run: `yarn playwright test --config=playwright.reader-assets-production.config.ts test/e2e/reader-client-graph.behavior.spec.ts`

Expected: FAIL with the current shared client chunk contents.

- [ ] **Step 3: Move feature imports behind their owners**

Replace client-side `linkedom` parsing with the browser DOM APIs already available on the hydrated reader, while retaining server-safe parsing at the SSR boundary. Convert the three reader dialogs and Quick Search to lazy component imports so Headless UI is requested only when those controls are activated. Do not lazy-load controls necessary for first reader interaction.

- [ ] **Step 4: Verify GREEN and interaction parity**

Run the client-graph spec, `reader-production.behavior.spec.ts`, `reader.behavior.spec.ts`, and quick-search behavior tests.

- [ ] **Step 5: Record Lighthouse improvement and commit**

Run: `yarn lighthouse:reader --runs 1 --performance 95`

```bash
git add nuxt/app nuxt/test/e2e/reader-client-graph.behavior.spec.ts
git commit -m "perf(nuxt): isolate the reader client graph"
```

### Task 6: Critical delivery, compression, and final score

**Files:**
- Modify: `nuxt/nuxt.config.ts`
- Modify: `nuxt/scripts/run-lighthouse-reader.mjs`
- Modify: focused stylesheet entries only if the measured critical path still requires it
- Modify: `nuxt/test/unit/lighthouse-budget.spec.ts`

**Interfaces:**
- Consumes: the now-correct route bundles.
- Produces: compressed public assets, compressed HTML in the audited serving topology, bounded critical CSS, and three consecutive Performance 100 results.

- [ ] **Step 1: Add failing delivery assertions**

Assert `content-encoding` for compressible production responses, immutable caching for hashed `/_nuxt/` assets, no uncompressed document diagnostic, and final budgets of 100/100/100/100 with zero console errors.

- [ ] **Step 2: Run the delivery assertions to verify RED**

Run the production asset spec and one Lighthouse run. Confirm the failure names compression or remaining metric thresholds rather than unrelated fixture behavior.

- [ ] **Step 3: Enable Nitro public-asset compression and minimize the remaining critical path**

Set Nitro compression/precompression options supported by the pinned Nuxt/Nitro version. If route splitting alone does not reach the metric target, inline only the measured shell/reader critical rules and load the remaining route stylesheet non-blockingly while preserving CLS at or below 0.01.

- [ ] **Step 4: Run the final Lighthouse gate**

Run: `yarn lighthouse:reader --runs 3 --performance 100 --accessibility 100 --best-practices 100 --seo 100`

Expected: three consecutive passing reports, zero first-party console errors, and no forbidden reader assets.

- [ ] **Step 5: Commit**

```bash
git add nuxt/nuxt.config.ts nuxt/scripts/run-lighthouse-reader.mjs nuxt/test/unit/lighthouse-budget.spec.ts nuxt/app/assets/styles
git commit -m "perf(nuxt): reach Lighthouse 100 reader delivery"
```

### Task 7: Full regression and parity verification

**Files:**
- Modify only files required to repair regressions found by verification.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a verified production-ready performance wave with reports preserved under `nuxt/output/lighthouse/`.

- [ ] **Step 1: Run static and architectural checks**

```bash
yarn lint
yarn typecheck
yarn policy:check
yarn build
```

- [ ] **Step 2: Run unit and SSR suites**

```bash
yarn test:unit
yarn test:ssr
```

- [ ] **Step 3: Run focused E2E and visual suites**

Run the production asset, reader client-graph, shell accessibility, reader behavior, reader final parity, reader visual, home visual, library visual, search visual, Dramawebben visual, presentation visual, and editor-reader visual specs.

- [ ] **Step 4: Run the final three-report Lighthouse gate again from a clean build**

Run: `yarn lighthouse:reader --clean --runs 3`

Expected: Performance 100, Accessibility 100, Best Practices 100, SEO 100 in all three reports.

- [ ] **Step 5: Inspect the dirty worktree and commit only goal-owned changes**

```bash
git diff --check
git status --short
```

Preserve unrelated user changes. Commit any verification repairs by their owning task rather than one unrelated cleanup commit.
