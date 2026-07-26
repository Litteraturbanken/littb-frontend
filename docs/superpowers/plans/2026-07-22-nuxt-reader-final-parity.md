# Nuxt Reader Final Normal-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore normal Reader Läsfokus controls, faksimil `?ocr` inspection, and exact `keyword: 1800` Nya vägar eligibility without changing the established Angular visuals.

**Architecture:** Keep the canonical page's single page-local `useAsyncData` model fetch. Extend the typed Reader response with derived Nya vägar eligibility and nullable sanitized faksimil OCR data, keep focus/night/scale as URL-derived and page-local UI state, and render the legacy focus controls through a focused presentation component using existing Reader classes.

**Tech Stack:** Nuxt 4, Nitro/H3, Vue 3, TypeScript, linkedom, SCSS, Vitest, Playwright.

**Design:** `docs/superpowers/specs/2026-07-22-nuxt-reader-final-parity-design.md`

## Global Constraints

- Preserve Angular labels, layout, logo, classes, widths, colors, and control order. Do not redesign.
- Keep the Reader model fetch in the canonical page's `<script setup>` and add no store or one-use composable.
- Use `NuxtLink` and the existing raw router/history mechanism for internal Reader navigation; keep the Nya vägar authority URL an ordinary external link.
- Treat OCR as optional: invalid/unavailable OCR never fails or hides the scan.
- Preserve exact raw query bytes for focus and page navigation, including duplicates, bare/empty keys, escape case, and fragments.
- Browser-only APIs must remain SSR-safe.
- Do not edit `nuxt/app/lib/reader-routes.ts` or `nuxt/test/unit/reader-routes.spec.ts`; the encoded-path audit owns them.
- Do not touch Library production or tests.
- Do not edit shared fixture data or `nuxt/test/fixtures/v2-server.mjs` until follow-up implementation authorization.
- Do not stage or commit during the RED-only handoff.

---

### Task 1: Freeze focused RED contracts

**Files:**
- Create: `nuxt/test/unit/reader-final-parity.spec.ts`
- Create: `nuxt/test/ssr/reader-final-parity.spec.ts`
- Create: `nuxt/test/e2e/reader-final-parity.behavior.spec.ts`
- Create: `nuxt/test/e2e/reader-final-parity.visual.spec.ts`

**Interfaces:**
- Consumes: existing `normalizeReaderMetadata`, canonical Reader routes, OCR request ledger, and Playwright Reader fixture server.
- Produces: executable behavior/SSR/visual contracts for every implementation task below.

- [ ] **Step 1: Add the pure eligibility RED test**

Use an inline work-info payload so the eligibility contract fails because the
normalizer omits `hasNyaVagar`, not because a fixture route is absent:

```ts
const metadata = normalizeReaderMetadata({
  hits: 1,
  data: [{
    authors: [{ authorid: "SöderbergH", full_name: "Hjalmar Söderberg" }],
    endpagename: "-1",
    keyword: ["1800"],
    lbworkid: "lb-reader-nya-vagar",
    mediatype: "etext",
    pages: [{ pagename: "-2", pageindex: 2 }, { pagename: "-1", pageindex: 3 }],
    parts: [],
    searchable: true,
    shorttitle: "Nya vägar",
    startpagename: "-2",
    title: "Nya vägar",
    titlepath: "NyaVagarReader"
  }]
}, "http://source.invalid", "SöderbergH", "NyaVagarReader", "etext")
expect(metadata).toMatchObject({ hasNyaVagar: true })
```

Add table cases for absent keyword, `[]`, `["1800-tal"]`, `[1800]`, and a
string container, all expecting `false`.

- [ ] **Step 2: Add SSR/API RED tests**

Assert:

```ts
expect(await response.json()).toMatchObject({
  mediaType: "faksimil",
  ocrOverlay: {
    width: 625,
    height: 900,
    html: expect.stringContaining("OCR fixture")
  }
})
```

Then assert the direct page HTML for `?ocr` contains `.reader_main.ocr`, the
sanitized overlay text, and the scan; direct `?fokus` contains a focused Reader
root and `Läsfokus`; the dedicated eligible route contains the exact Nya vägar
href and logo alt; and the ineligible route contains neither.

- [ ] **Step 3: Add browser RED tests**

Cover focus activation/close replacement, exact query preservation, text-scale
change, night/light body state, bottom-bar/side-cover navigation, page/Back
restoration, OCR class/text/image visibility/asset ledger, and exact Nya vägar
eligibility.

- [ ] **Step 4: Add visual RED tests**

Add desktop/mobile captures for focused e-text day, focused e-text night/text
menu, faksimil OCR, and Nya vägar. Each test asserts the target feature exists
before `toHaveScreenshot`, so the initial failure is a missing feature rather
than a missing baseline.

- [ ] **Step 5: Verify RED**

Run with ports not used by other workers:

```bash
cd nuxt
npm run test:unit -- test/unit/reader-final-parity.spec.ts
LBAPI_FIXTURE_PORT=4217 LITTB_NUXT_TEST_PORT=3117 npx playwright test \
  test/ssr/reader-final-parity.spec.ts --project=ssr
LBAPI_FIXTURE_PORT=4217 LITTB_NUXT_TEST_PORT=3117 npx playwright test \
  test/e2e/reader-final-parity.behavior.spec.ts --project=desktop-chromium
LBAPI_FIXTURE_PORT=4217 LITTB_NUXT_TEST_PORT=3117 npx playwright test \
  test/e2e/reader-final-parity.visual.spec.ts --project=desktop-chromium
```

Expected failures are respectively missing `hasNyaVagar`, missing OCR/focus/Nya
SSR markup, inert `Läsfokus`, and absent visual states. Fix syntax, fixture
startup, and selector mistakes until every failure reaches the intended missing
feature.

---

### Task 2: Add deterministic fixture and ledger coverage

**Files:**
- Modify: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: current `readerWorkInfoResponse`, `readerPageHtmlByIndex`, Reader metadata routes, and OCR ledgers.
- Produces: `NyaVagarReader`, exact noneligible metadata, valid/missing/malformed OCR assets, and deterministic request evidence.

- [ ] **Step 1: Add dedicated Nya vägar metadata**

Add an independent export instead of changing the visual-authority Doktor Glas
record:

```js
export const readerNyaVagarWorkInfoResponse = {
  hits: 1,
  data: [{
    ...structuredClone(readerWorkInfoResponse.data[0]),
    keyword: ["1800"],
    lbworkid: "lb-reader-nya-vagar",
    shorttitle: "Nya vägar Reader",
    title: "Nya vägar Reader",
    titlepath: "NyaVagarReader"
  }]
}
```

Add `readerNonNyaVagarWorkInfoResponse` with `keyword: ["1800-tal"]`, distinct
work/title IDs, and the same page shape.

- [ ] **Step 2: Route dedicated metadata and e-text bodies**

In the fixture's `get_work_info` dispatch, return those records only for their
exact `titlepath`. Route their `res_00001..3.html?username=app` assets to the
existing deterministic page bodies and record them through the existing Reader
metadata/HTML ledgers.

- [ ] **Step 3: Replace the placeholder normal OCR body**

For Gösta Berlings saga page index `1`, return:

```html
<body><div data-size="625x900"><div class="parent" style="left: 20px; top: 30px"><span class="w" style="left: 4px; top: 5px">OCR fixture</span></div></div></body>
```

Add dedicated routes returning 404, missing `data-size`, oversized coordinates,
and markup containing `<script>`, `onclick`, unsafe classes, and unknown tags.
Every route records its exact path in `_reader_ocr_requests`.

- [ ] **Step 4: Lock fixture behavior**

Extend `v2-server.spec.ts` to assert exact metadata selection, exact OCR bodies,
ledger reset, and no cross-title response. Run:

```bash
cd nuxt && npm run test:unit -- test/unit/v2-server.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit after the authorized implementation checkpoint**

```bash
git add nuxt/test/fixtures/reader-data.mjs nuxt/test/fixtures/v2-server.mjs \
  nuxt/test/unit/v2-server.spec.ts
git commit -m "test(nuxt): add final Reader parity fixtures"
```

---

### Task 3: Normalize Nya vägar eligibility

**Files:**
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/server/utils/reader-source.ts`
- Test: `nuxt/test/unit/reader-final-parity.spec.ts`

**Interfaces:**
- Consumes: optional legacy `representation.keyword: unknown`.
- Produces: `ReaderWorkMetadataBase.hasNyaVagar: boolean` and `ReaderPageBase.hasNyaVagar: boolean`.

- [ ] **Step 1: Run the pure RED case**

```bash
cd nuxt && npm run test:unit -- test/unit/reader-final-parity.spec.ts
```

Expected: FAIL because `hasNyaVagar` is absent/undefined.

- [ ] **Step 2: Add the minimal fail-closed normalizer**

```ts
function hasNyaVagarKeyword(value: unknown): boolean {
  return Array.isArray(value)
    && value.length <= 1_000
    && value.every(keyword => (
      typeof keyword === "string"
      && keyword.length > 0
      && keyword.length <= 200
      && !READER_CONTROL_CHARACTERS.test(keyword)
    ))
    && value.includes("1800")
}
```

Add `hasNyaVagar` to the internal/common public interfaces and populate it from
`representation.keyword`. Pass it through the existing `commonPage` object in
the canonical Nitro handler.

- [ ] **Step 3: Verify GREEN and regression safety**

```bash
cd nuxt
npm run test:unit -- test/unit/reader-final-parity.spec.ts test/unit/reader-source.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nuxt/shared/types/reader.ts nuxt/server/utils/reader-source.ts \
  nuxt/server/api/reader/'[author]'/'[title]'/'[page]'/'[mediatype]'.get.ts \
  nuxt/test/unit/reader-final-parity.spec.ts
git commit -m "feat(nuxt): expose Reader Nya vägar eligibility"
```

---

### Task 4: Load and sanitize optional normal Reader OCR

**Files:**
- Create: `nuxt/server/utils/reader-ocr.ts`
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`
- Test: `nuxt/test/unit/reader-final-parity.spec.ts`
- Test: `nuxt/test/ssr/reader-final-parity.spec.ts`

**Interfaces:**
- Consumes: asset base, bounded work ID, safe page index, and public/internal `ocr` presence.
- Produces: `ReaderOcrOverlay = { html: string; width: number; height: number }` or `null` on the faksimil response.

- [ ] **Step 1: Add sanitizer RED cases**

Export `parseReaderOcrOverlay` and test valid coordinates plus removal of script,
unknown elements/classes, IDs, handlers, unsafe styles, invalid sizes, oversized
source, and numeric values outside `±10000`.

- [ ] **Step 2: Run sanitizer and SSR RED**

```bash
cd nuxt
npm run test:unit -- test/unit/reader-final-parity.spec.ts
LBAPI_FIXTURE_PORT=4217 LITTB_NUXT_TEST_PORT=3117 npx playwright test \
  test/ssr/reader-final-parity.spec.ts --project=ssr
```

Expected: FAIL for missing parser/export and missing `ocrOverlay`.

- [ ] **Step 3: Implement the bounded parser**

Move the already-audited editor allowlists into the new normal Reader utility
without changing them:

```ts
export interface ReaderOcrOverlay {
  html: string
  width: number
  height: number
}

export function parseReaderOcrOverlay(source: string): ReaderOcrOverlay | null {
  if (source.length === 0 || source.length > 512 * 1024) return null
  // parse body > div, validate data-size, sanitize root and descendants,
  // then return the root outerHTML and numeric dimensions.
}
```

Use `linkedom`, exact tags/classes, and the property/value rules recorded in the
design. Return `null` rather than partially accepting an invalid root size.

- [ ] **Step 4: Implement optional asset loading**

```ts
export async function fetchReaderOcrOverlay(
  base: string,
  workId: string,
  pageIndex: number
): Promise<ReaderOcrOverlay | null> {
  const filename = String(pageIndex).padStart(5, "0")
  try {
    const source = await $fetch<string>(
      `${base}/txt/${encodeURIComponent(workId)}/ocr_${filename}.html`,
      { responseType: "text", retry: 0 }
    )
    return parseReaderOcrOverlay(source)
  } catch {
    return null
  }
}
```

Add `ocrOverlay: ReaderOcrOverlay | null` to `ReaderFacsimilePage`. In the
canonical handler, call the loader only for faksimil when `getQuery(event).ocr`
is present, and always return `null` otherwise. Never fetch OCR for e-text.

- [ ] **Step 5: Verify GREEN**

Run the focused unit and SSR suites. Confirm request ledgers contain one exact
`ocr_00001.html` request for the middle faksimil page, zero OCR requests without
the query, and zero failures for missing/malformed overlay fixtures.

- [ ] **Step 6: Commit**

```bash
git add nuxt/server/utils/reader-ocr.ts nuxt/shared/types/reader.ts \
  nuxt/server/api/reader/'[author]'/'[title]'/'[page]'/'[mediatype]'.get.ts \
  nuxt/test/unit/reader-final-parity.spec.ts nuxt/test/ssr/reader-final-parity.spec.ts
git commit -m "feat(nuxt): add optional normal Reader OCR model"
```

---

### Task 5: Render OCR and Nya vägar from the single page model

**Files:**
- Modify: `nuxt/app/components/reader/ReaderFacsimileImage.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify only if evidence requires it: `nuxt/app/assets/styles/reader.scss`
- Test: `nuxt/test/ssr/reader-final-parity.spec.ts`
- Test: `nuxt/test/e2e/reader-final-parity.behavior.spec.ts`

**Interfaces:**
- Consumes: `ReaderFacsimilePage.ocrOverlay`, `ReaderPageBase.hasNyaVagar`, and exact `ocr` query presence.
- Produces: SSR-stable `.overlay`, `.reader_main.ocr`, and exact Nya vägar sidebar markup.

- [ ] **Step 1: Extend the page model request identity**

Add a strict computed boolean for query-key presence and include only that
boolean in `readerRequestIdentity`. Send `query: { ocr: "1" }` only when true:

```ts
const ocrRequested = computed(() => route.query.ocr !== undefined)
const readerRequestIdentity = computed(() => JSON.stringify([
  authorParam.value, titleParam.value, pageParam.value, mediaTypeParam.value,
  ocrRequested.value
]))
```

This keeps focus and every unrelated query out of the model identity.

- [ ] **Step 2: Render the scaled overlay in the existing faksimil component**

Add an image element ref and update its rendered width on load/resize. Render:

```vue
<div
  v-if="page.ocrOverlay"
  class="reader-ocr-layer absolute overflow-hidden h-full w-full"
>
  <div class="overlay overflow-hidden origin-top-left" :style="overlayStyle"
       v-html="page.ocrOverlay.html" />
</div>
```

Set `.reader_main.ocr` only when `ocrRequested && facsimileReader.ocrOverlay`.
Reuse the existing `.overlay` and `.reader_main.ocr` rules; add no CSS unless a
failing visual comparison proves a missing legacy declaration.

- [ ] **Step 3: Render the exact promotional link**

Import `~/assets/img/lb_logga_nyavagar_2.2021.svg` and append the existing
sidebar item only when `reader.hasNyaVagar`:

```vue
<li v-if="reader.hasNyaVagar" class="-ml-px">
  <a class="block w-3/6 -ml-3 reader-nya-vagar"
     href="https://litteraturbanken.se/diktensmuseum/nya-vagar-inledning/">
    <img class="object-contain" :src="nyaVagarLogo"
         alt="Logotyp för Nya vägar">
  </a>
</li>
```

Mirror this truthful link in the ClientOnly SSR fallback.

- [ ] **Step 4: Run focused SSR/browser tests**

Expected: OCR and Nya vägar cases PASS; Läsfokus cases remain RED.

- [ ] **Step 5: Commit**

```bash
git add nuxt/app/components/reader/ReaderFacsimileImage.vue \
  nuxt/app/pages/författare/'[author]'/titlar/'[title]'/sida/'[page]'/'[mediatype]'.vue \
  nuxt/test/ssr/reader-final-parity.spec.ts \
  nuxt/test/e2e/reader-final-parity.behavior.spec.ts
git commit -m "feat(nuxt): render Reader OCR and Nya vägar states"
```

---

### Task 6: Implement URL-backed Läsfokus controls

**Files:**
- Create: `nuxt/app/components/reader/ReaderFocusControls.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/assets/styles/reader.scss`
- Test: `nuxt/test/e2e/reader-final-parity.behavior.spec.ts`
- Test: `nuxt/test/ssr/reader-final-parity.spec.ts`

**Interfaces:**
- Consumes: focus boolean, current media, previous/next/start/part hrefs, available faksimil sizes, and page-owned emits.
- Produces: exact legacy focus DOM/classes plus `adjust-text`, `toggle-night`, `select-size`, and `close` events.

- [ ] **Step 1: Add a byte-preserving page-local focus query helper**

Do not touch the separately owned `reader-routes.ts`. In the page, split the raw
full path into pathname/query/fragment, decode query keys only for exact
comparison with `fokus`, remove all exact focus segments, and append bare
`fokus` when enabled. Preserve every other segment verbatim.

- [ ] **Step 2: Add page-owned state and guarded transforms**

```ts
const focusMode = computed(() => route.query.fokus !== undefined)
const focusBarVisible = ref(true)
const nightMode = ref(false)
const textScale = ref(1)

onMounted(() => { textScale.value = window.innerHeight / 900 })

const focusTransform = computed(() => focusMode.value && etextReader.value
  ? { transform: `scale(${textScale.value})`, transformOrigin: "left top" }
  : undefined)
```

Clamp scale adjustments to `0.5..2.5`. Reset night/scale when leaving the
normal Reader, not on same-component page navigation.

- [ ] **Step 3: Implement focus activation and close with replacement**

Use `navigateRawFullPath(focusFullPath(rawFullPath.value, true), true)` from the
sidebar trigger and the same helper with `false` from close. Focus-only changes
must leave the primary request ledger unchanged and must not add a history
entry.

- [ ] **Step 4: Build the presentation component**

Render teleported `leftCover`, `rightCover`, and `bottomBar`. Use buttons for
the settings/menu/close controls and `NuxtLink custom` anchors for actual page
destinations. Preserve visible `A a`, angle/list icons, `[Start]`, part labels,
`Mindre text`, `Större text`, `Nattläge`, `Ljust läge`, and the faksimil size
labels. Keep disabled boundaries unfocusable.

- [ ] **Step 5: Port only the legacy focus styles**

Copy the established `_focus_mode.scss` values into scoped `.page-reading`
rules in `reader.scss`: centered Reader, hidden corridors, fixed covers, fixed
380px bottom bar, text/parts popovers, 40px circular arrows, night colors, and
mobile behavior. Reuse variables/mixins already present. Do not alter closed
Reader selectors or baselines.

- [ ] **Step 6: Compose head/body classes**

Append `night` only for `focusMode && etextReader && nightMode`. Preserve
`focus page-reading ready` and conditional `modal-open`. Apply `focus` and
`focusTransform` to `.reader_main`; clicking the Reader root toggles the bar
only while focus is active.

- [ ] **Step 7: Verify GREEN**

Run the focused SSR and behavior suites on desktop, then mobile. Confirm exact
router URLs, one history replacement for open/close, push for page links,
Back/Forward, no requests on focus-only changes, bounded text scale, no night
control for faksimil, and no hydration/browser errors.

- [ ] **Step 8: Commit**

```bash
git add nuxt/app/components/reader/ReaderFocusControls.vue \
  nuxt/app/pages/författare/'[author]'/titlar/'[title]'/sida/'[page]'/'[mediatype]'.vue \
  nuxt/app/assets/styles/reader.scss \
  nuxt/test/e2e/reader-final-parity.behavior.spec.ts \
  nuxt/test/ssr/reader-final-parity.spec.ts
git commit -m "feat(nuxt): restore normal Reader Läsfokus"
```

---

### Task 7: Capture Angular authority and close visual parity

**Files:**
- Create: `nuxt/playwright.reader-final-parity-angular.config.ts`
- Create: `nuxt/test/visual/capture-reader-final-parity-angular.spec.ts`
- Create: `nuxt/test/visual/baselines/reader-focus-day-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-focus-day-mobile.png`
- Create: `nuxt/test/visual/baselines/reader-focus-night-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-focus-night-mobile.png`
- Create: `nuxt/test/visual/baselines/reader-ocr-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-ocr-mobile.png`
- Create: `nuxt/test/visual/baselines/reader-nya-vagar-desktop.png`
- Create: `nuxt/test/visual/baselines/reader-nya-vagar-mobile.png`
- Modify only from screenshot evidence: `nuxt/app/assets/styles/reader.scss`
- Test: `nuxt/test/e2e/reader-final-parity.visual.spec.ts`

**Interfaces:**
- Consumes: identical deterministic Angular/Nuxt fixture states and matching viewports.
- Produces: immutable authority PNGs and strict Nuxt comparisons.

- [ ] **Step 1: Add a unique-port Angular capture config**

Use default authority ports `4218` and `3118`, one worker, desktop 1440×1000
and iPhone 13 Chromium, local fixture/server commands, and no reuse of another
worker's server.

- [ ] **Step 2: Capture deterministic authority**

For every state, block nonlocal requests, assert exact metadata/HTML/OCR/JPEG
and logo requests, wait for fonts and decoded images, disable animations, and
capture full-page CSS-scale PNGs. Fail on console errors, hydration warnings,
page errors, or undeclared requests.

- [ ] **Step 3: Compare Nuxt without relaxing evidence**

```bash
cd nuxt
npx playwright test --config=playwright.reader-final-parity-angular.config.ts
LBAPI_FIXTURE_PORT=4217 LITTB_NUXT_TEST_PORT=3117 npx playwright test \
  test/e2e/reader-final-parity.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Use `threshold: 0.1`, `maxDiffPixels: 100`, `scale: "css"`, no masks, and no
baseline update from Nuxt output. Make only selector-local CSS corrections
supported by fresh diffs.

- [ ] **Step 4: Prove existing Reader visuals are unchanged**

Run all existing Reader visual specs on both projects. Any existing baseline
change is a regression; fix CSS scoping instead of replacing it.

- [ ] **Step 5: Commit**

```bash
git add nuxt/playwright.reader-final-parity-angular.config.ts \
  nuxt/test/visual/capture-reader-final-parity-angular.spec.ts \
  nuxt/test/visual/baselines/reader-*.png \
  nuxt/test/e2e/reader-final-parity.visual.spec.ts nuxt/app/assets/styles/reader.scss
git commit -m "test(nuxt): lock final normal Reader visual parity"
```

---

### Task 8: Verification and handoff

**Files:**
- Modify only in-scope files above if fresh evidence exposes a defect.

**Interfaces:**
- Consumes: completed feature and deterministic evidence.
- Produces: reviewable, regression-safe normal Reader parity handoff.

- [ ] **Step 1: Run focused and full verification**

```bash
cd nuxt
npm run test:unit
LBAPI_FIXTURE_PORT=4217 LITTB_NUXT_TEST_PORT=3117 npm run test:ssr
LBAPI_FIXTURE_PORT=4217 LITTB_NUXT_TEST_PORT=3117 npm run test:e2e
npm run typecheck
npm run build
cd ..
git diff --check
```

Expected: all commands PASS with no hydration warnings, page errors, external
fixture escapes, or changed existing screenshots.

- [ ] **Step 2: Review security and routing boundaries**

Confirm OCR never exposes scripts/handlers/unsafe styles, missing OCR never
hides a scan, keyword matching is exact, focus-only navigation performs no
model request, internal links use Nuxt routing, external Nya vägar stays exact,
and no change landed in the encoded-path-owned route helper files or Library.

- [ ] **Step 3: Inspect and commit only authorized paths**

```bash
git status --short
git diff --stat
git diff --check
git add <only the files named by this plan>
git commit -m "feat(nuxt): complete normal Reader parity"
```

- [ ] **Step 4: Report evidence**

Report the exact focus/OCR/Nya vägar routes tested, request ledgers, unit/SSR/
behavior/visual project counts, typecheck/build results, Angular authority
hashes, and any explicitly deferred faksimil-search/editor work.
