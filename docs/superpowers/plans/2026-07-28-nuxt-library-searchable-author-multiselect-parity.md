# Nuxt Library Searchable Author Multiselect Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the searchable `Om ett författarskap` Library multiselect retain its production input-and-chip layout in closed and open states without changing route ownership or other multiselects.

**Architecture:** Extend `SearchMultiSelect`'s existing persistent-input-row contract to searchable controls. The Library page opts the author selector into that contract, while narrowly scoped CSS gives the real Vue search input the left field only when the menu is active.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, vue-multiselect 3.5.0, SCSS, Playwright.

## Global Constraints

- Production `https://litteraturbanken.se/bibliotek` is the visual and interaction authority.
- Preserve the existing 350 px input, 8 px chip gap, route-owned `about_authors` values, SSR, Back/Forward, and reload behavior.
- Do not add a page-specific author multiselect component or move Library model code into a composable.
- Do not alter Search-page multiselect behavior.

---

### Task 1: Searchable persistent row and selected-chip behavior

**Files:**
- Modify: `nuxt/test/e2e/library-multiselect-parity.behavior.spec.ts`
- Modify: `nuxt/app/components/search/SearchMultiSelect.vue`
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/app/assets/styles/nuxt.scss`

**Interfaces:**
- Consumes: `SearchMultiSelect` props `searchable: boolean` and `persistentInputRow: boolean`.
- Produces: the same `update:modelValue: [string[]]` and `query: [string]` events; no public type changes.

- [ ] **Step 1: Write the failing four-author regression**

Add a Playwright test that navigates to the reported route and uses literal
geometry and interaction expectations:

```ts
test("selected searchable Library authors keep the input left and visible chips right", async ({ page }) => {
  await page.goto(
    "/bibliotek?avancerat=1&about_authors="
      + "KrusenstjernaA,HornA,AgrellA,Grafstr%C3%B6mAA",
    { waitUntil: "networkidle" }
  )
  await waitForHydration(page)

  const root = page.locator("[data-library-about-authors]")
  const field = root.locator(".search-multiselect__input-row")
  const chips = root.locator(".select2-selection__choice")
  await expect(chips).toHaveCount(4)
  await expect(chips).toHaveText([
    "×Agnes von Krusenstjerna",
    "×Agneta Horn",
    "×Alfhild Agrell",
    "×Anders Abraham Grafström"
  ])
  const [fieldBox, firstChipBox] = await Promise.all([
    field.boundingBox(), chips.first().boundingBox()
  ])
  expect(firstChipBox!.x - (fieldBox!.x + fieldBox!.width)).toBeCloseTo(8, 1)
  await field.click()
  await expect(root.locator(".multiselect")).toHaveAttribute("aria-expanded", "true")
  await expect(chips).toHaveCount(4)
  const search = root.locator(".multiselect--active input.multiselect__input")
  await search.fill("Boye")
  await expect(root.getByRole("option", { name: "Karin Boye", exact: true })).toBeVisible()
  expect(new URL(page.url()).searchParams.get("about_authors"))
    .toBe("KrusenstjernaA,HornA,AgrellA,GrafströmAA")
})
```

- [ ] **Step 2: Run the regression and verify RED**

Run:

```bash
cd nuxt
yarn playwright test test/e2e/library-multiselect-parity.behavior.spec.ts \
  --project=desktop-chromium --grep='selected searchable Library authors'
```

Expected: FAIL because `.search-multiselect__input-row` is absent and the real
search input overlays the chips from x=400 instead of leaving an 8 px gap.

- [ ] **Step 3: Implement the minimal reusable behavior**

In `SearchMultiSelect.vue`, allow the persistent row whenever selected values
exist and it owns the closed left slot:

```vue
<input
  v-if="values.length && persistentInputRow && (!searchable || !isOpen)"
  class="multiselect__input search-multiselect__input-row"
  type="search"
  :placeholder="placeholder"
  readonly
  tabindex="-1"
  aria-hidden="true"
  @mousedown.prevent.stop
  @click.prevent.stop="toggleOptions"
>
```

In `bibliotek.vue`, add `persistent-input-row` to the author
`SearchMultiSelect`.

In `nuxt.scss`, scope the native search-input layout to
`[data-library-about-authors]`: hide it while the selected closed persistent
row owns the left slot, and while active make it static, first in flex order,
350 px wide, and separated from the chips by 8 px. Do not target the custom
`.search-multiselect__input-row` with the native-input rule.

- [ ] **Step 4: Run the focused behavior tests and verify GREEN**

Run:

```bash
cd nuxt
yarn playwright test test/e2e/library-multiselect-parity.behavior.spec.ts \
  --project=desktop-chromium
```

Expected: all Library multiselect parity tests PASS, including single-toggle
open/close and route restoration.

- [ ] **Step 5: Commit the focused implementation**

```bash
git add nuxt/app/components/search/SearchMultiSelect.vue \
  nuxt/app/pages/bibliotek.vue nuxt/app/assets/styles/nuxt.scss \
  nuxt/test/e2e/library-multiselect-parity.behavior.spec.ts
git commit -m "fix: match searchable Library author selector"
```

### Task 2: Production visual regression and full verification

**Files:**
- Modify: `nuxt/test/e2e/library.visual.spec.ts`
- Create: `nuxt/test/visual/baselines/library-about-authors-selected-desktop.png`

**Interfaces:**
- Consumes: the selected author layout delivered by Task 1.
- Produces: a production-derived screenshot gate protected by the baseline hash manifest.

- [ ] **Step 1: Capture the production authority state**

At a 1280×900 CSS viewport, select Agnes von Krusenstjerna, Agneta Horn,
Alfhild Agrell, and Anders Abraham Grafström in production. Close the dropdown
and capture `.about_container` into the named baseline. Record its SHA-256 in
`libraryStateBaselineManifest`.

- [ ] **Step 2: Add the screenshot assertion**

Add a visual test that opens the identical four-author route, waits for visual
assets, and compares `[data-library-about-authors]` against the production
baseline with `scale: "css"`, `threshold: 0.01`, and at most 10 differing
pixels. Keep the existing component geometry assertions.

- [ ] **Step 3: Run focused visual and interaction verification**

```bash
cd nuxt
yarn playwright test test/e2e/library.visual.spec.ts \
  test/e2e/library-multiselect-parity.behavior.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: all selected-author behavior and production screenshot checks PASS.

- [ ] **Step 4: Run Library regression, SSR, and static gates**

```bash
cd nuxt
yarn playwright test test/e2e/library-advanced.behavior.spec.ts \
  test/e2e/library.behavior.spec.ts --project=desktop-chromium \
  --project=mobile-chromium
yarn playwright test test/ssr/library.spec.ts --project=ssr
yarn lint
yarn typecheck
git diff --check
```

Expected: every command exits 0 with no test failures, lint warnings, type
errors, or whitespace errors.

- [ ] **Step 5: Commit the visual contract**

```bash
git add nuxt/test/e2e/library.visual.spec.ts \
  nuxt/test/visual/baselines/library-about-authors-selected-desktop.png
git commit -m "test: lock Library author selector parity"
```
