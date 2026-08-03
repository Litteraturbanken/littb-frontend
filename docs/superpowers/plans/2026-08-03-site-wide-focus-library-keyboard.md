# Site-wide Focus and Library Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore visible keyboard focus throughout the Nuxt application and make Library work-title disclosures visually correct, semantically linked, and fully operable by keyboard.

**Architecture:** Replace the legacy global focus suppression with one keyboard-only, forced-colors-aware focus contract in the shared stylesheet. Keep Library work titles as native buttons, add a deterministic `aria-controls` relationship to each existing action region, and cover the behavior with Playwright tests that exercise the browser's real tab order and native button activation.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript 5.9, SCSS, Playwright 1.61, Yarn 1, Invoke.

## Global Constraints

- Do not change typography, spacing, ordinary mouse/touch presentation, or existing hover behavior outside the Library title correction.
- Do not add a custom roving-tabindex system or custom Enter/Space handlers for native controls.
- Do not change API requests, route/query contracts, result grouping, or data fetching.
- Keep Vue Multiselect's existing arrow-key, Enter, and Escape behavior unchanged.
- The site-wide focus cue must use `:focus-visible`, include both light and dark edges, have a visible offset, and remain usable in forced-colors mode.
- Library work-title disclosures must be black (`#333`) while idle and use the existing red (`#7a1400`) on hover and keyboard focus.
- Every work-title disclosure must retain `aria-expanded` and gain `aria-controls` referencing a stable, unique action-container ID.
- Write each regression test first, run it, and observe the expected failure before changing production code.
- Add no dependencies.

---

## File Map

- `nuxt/app/assets/styles/styles.scss` owns the single application-wide keyboard focus contract.
- `nuxt/test/e2e/shell-accessibility.behavior.spec.ts` proves that a non-Library page exposes a visible keyboard focus outline.
- `nuxt/app/pages/bibliotek.vue` owns the Library work disclosure ID, ARIA relationship, and title interaction colors.
- `nuxt/test/e2e/library.behavior.spec.ts` proves the Library title color and full title-to-action keyboard path.

### Task 1: Site-wide keyboard focus contract

**Files:**
- Modify: `nuxt/test/e2e/shell-accessibility.behavior.spec.ts`
- Modify: `nuxt/app/assets/styles/styles.scss:101`

**Interfaces:**
- Consumes: native browser `:focus-visible` matching and the existing shared shell tab order.
- Produces: a global `:focus-visible` rule with a `2px` white outline, `2px` offset, `4px` dark outer edge, and forced-colors override.

- [ ] **Step 1: Read the required test guidance**

Read `/Users/johan/.codex/plugins/cache/openai-curated-remote/superpowers/6.2.0/skills/test-driven-development/writing-good-tests.md` completely before editing the test.

- [ ] **Step 2: Add the failing shell focus test**

Append this test to `nuxt/test/e2e/shell-accessibility.behavior.spec.ts`:

```ts
test("keyboard focus remains visibly identifiable outside the Library", async ({ page }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })

  await page.keyboard.press("Tab")
  const focused = page.locator(":focus")
  await expect(focused).toHaveCount(1)
  await expect(focused).toBeVisible()

  const style = await focused.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      outlineOffset: computed.outlineOffset
    }
  })

  expect(style.outlineStyle).toBe("solid")
  expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0)
  expect(Number.parseFloat(style.outlineOffset)).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 3: Run the new test and verify the legacy rule fails it**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/shell-accessibility.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "keyboard focus remains visibly identifiable"
```

Expected: FAIL because the focused element reports `outlineStyle: "none"` or an outline width of `0` under the legacy `:focus { outline: none; }` rule.

- [ ] **Step 4: Replace blanket focus suppression with the keyboard-only focus contract**

In `nuxt/app/assets/styles/styles.scss`, replace:

```scss
:focus {
    outline: none;
}
```

with:

```scss
:focus:not(:focus-visible) {
    outline: none;
}

:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px #333;
}

@media (forced-colors: active) {
    :focus-visible {
        outline: 2px solid Highlight;
        box-shadow: none;
    }
}
```

Do not add `!important`; component rules may add presentation, but they must leave this outline intact.

- [ ] **Step 5: Run the focused shell test and verify it passes**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/shell-accessibility.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "keyboard focus remains visibly identifiable"
```

Expected: PASS with a solid, non-zero outline and an offset of at least `2px`.

- [ ] **Step 6: Run the complete shared-shell accessibility test file**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/shell-accessibility.behavior.spec.ts \
  --project=desktop-chromium
```

Expected: all shared navigation semantics, touch-target, and focus tests PASS.

- [ ] **Step 7: Commit the independently working focus contract**

```bash
git add nuxt/app/assets/styles/styles.scss \
  nuxt/test/e2e/shell-accessibility.behavior.spec.ts
git commit -m "fix: restore visible keyboard focus"
```

### Task 2: Library work-title disclosure parity

**Files:**
- Modify: `nuxt/test/e2e/library.behavior.spec.ts:690`
- Modify: `nuxt/app/pages/bibliotek.vue:2010`
- Modify: `nuxt/app/pages/bibliotek.vue:3140-3170`
- Modify: `nuxt/app/pages/bibliotek.vue:3696-3708`

**Interfaces:**
- Consumes: Task 1's global `:focus-visible` outline and the existing `BrowseResult.key`, `expandedWorkKey`, and `toggleWorkActions(item: BrowseResult)` behavior.
- Produces: `workActionsId(item: BrowseResult): string`, an `aria-controls`/`id` pair, idle title color `#333`, and keyboard interaction color `#7a1400`.

- [ ] **Step 1: Add the failing Library keyboard-flow test**

Insert this test immediately before the existing `Works groups representations...` test in `nuxt/test/e2e/library.behavior.spec.ts`:

```ts
test("Works titles are black keyboard disclosures linked to their representation actions", async ({
  page
}) => {
  await page.goto("/bibliotek?visa=works&sort=popularitet", { waitUntil: "networkidle" })

  const work = page.locator("[data-library-work-row]").filter({ hasText: "Doktor Glas" })
  const toggle = work.locator("[data-library-work-toggle]")
  const actions = work.locator("[data-library-work-actions]")

  await expect(toggle).toHaveCSS("color", "rgb(51, 51, 51)")
  await expect(toggle).toHaveAttribute("aria-expanded", "false")

  await page.locator("[data-library-sort]").last().focus()
  await page.keyboard.press("Tab")
  await expect(toggle).toBeFocused()
  expect(await toggle.evaluate(element => getComputedStyle(element).outlineStyle)).toBe("solid")

  const controls = await toggle.getAttribute("aria-controls")
  expect(controls).toBeTruthy()
  if (!controls) throw new Error("work disclosure is missing aria-controls")
  await expect(actions).toHaveAttribute("id", controls)

  await page.keyboard.press("Enter")
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(actions).toBeVisible()

  await page.keyboard.press("Tab")
  await expect(work.getByRole("link", { name: "Läs som etext", exact: true })).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(toggle).toBeFocused()
})
```

- [ ] **Step 2: Run the Library test and verify the current presentation and ARIA fail it**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/library.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "Works titles are black keyboard disclosures"
```

Expected: FAIL first because the idle title color is `rgb(122, 20, 0)`; after that assertion is temporarily inspected or moved past, the current markup also lacks `aria-controls`.

- [ ] **Step 3: Add the deterministic action-container ID helper**

Add this function immediately before `toggleWorkActions` in `nuxt/app/pages/bibliotek.vue`:

```ts
function workActionsId(item: BrowseResult): string {
    return `library-work-actions-${encodeURIComponent(item.key)}`
}
```

`encodeURIComponent` keeps the entire key collision-safe while removing whitespace from the HTML ID. Do not derive the ID from the result index because result order can change after sorting.

- [ ] **Step 4: Link each disclosure button to its existing action region**

Add the `aria-controls` binding next to `aria-expanded` on the work-title button:

```vue
:aria-controls="workActionsId(item)"
:aria-expanded="
    !downloadMode &&
    expandedWorkKey === item.key
"
```

Add the matching ID binding to the existing action container:

```vue
<div
    v-show="!downloadMode && expandedWorkKey === item.key"
    :id="workActionsId(item)"
    data-library-work-actions
    class="collapse-content"
>
```

Keep the native `<button type="button">`, `@click.stop`, router query update, and `v-show` behavior unchanged.

- [ ] **Step 5: Correct the title's idle and interaction colors**

Replace the work-title color rules in `nuxt/app/pages/bibliotek.vue` with:

```css
.library-work-toggle {
    padding: 0;
    color: #333;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
}

.library-work-toggle:hover,
.library-work-toggle:focus-visible {
    color: #7a1400;
}
```

Use `:focus-visible`, not `:focus`, so mouse activation does not apply the keyboard-only interaction presentation.

- [ ] **Step 6: Run the focused Library test and verify it passes**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/library.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "Works titles are black keyboard disclosures"
```

Expected: PASS; the idle title is dark, keyboard focus has a solid ring, Enter expands it, and Tab/Shift+Tab traverse between the title and first representation action.

- [ ] **Step 7: Run the existing work disclosure regression alongside the new test**

Run from `nuxt/`:

```bash
yarn playwright test test/e2e/library.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "Works (titles are black|groups representations)"
```

Expected: both tests PASS, including Nuxt history restoration of the expanded disclosure.

- [ ] **Step 8: Lint and type-check the changed Vue and test code**

Run from `nuxt/`:

```bash
yarn eslint app/pages/bibliotek.vue \
  test/e2e/shell-accessibility.behavior.spec.ts \
  test/e2e/library.behavior.spec.ts \
  --max-warnings 0
yarn typecheck
```

Expected: both commands exit `0` with no warnings or TypeScript errors.

- [ ] **Step 9: Commit the independently working Library disclosure change**

```bash
git add nuxt/app/pages/bibliotek.vue \
  nuxt/test/e2e/library.behavior.spec.ts
git commit -m "fix: make library results keyboard navigable"
```

### Task 3: Regression, staging, and real-browser verification

**Files:**
- Verify only; modify production or test files only if a failing check exposes a concrete regression in the approved scope.

**Interfaces:**
- Consumes: Task 1's site-wide focus contract and Task 2's Library disclosure relationship.
- Produces: evidence that shell, Library, SSR, multiselect, slider, tooltip, pointer, and staging behavior satisfy the approved design.

- [ ] **Step 1: Run the affected desktop browser suites**

Run from `nuxt/`:

```bash
yarn playwright test \
  test/e2e/shell-accessibility.behavior.spec.ts \
  test/e2e/library.behavior.spec.ts \
  test/e2e/library-advanced.behavior.spec.ts \
  test/e2e/library-multiselect-parity.behavior.spec.ts \
  --project=desktop-chromium
```

Expected: all tests PASS, including advanced-search disclosure, sliders, Vue Multiselect interactions, tooltips, result navigation, and the new focus path.

- [ ] **Step 2: Run the focused Library quality gate**

Run from the repository root:

```bash
invoke quality.library
```

Expected: backend Library model/provider/API tests, OpenAPI codegen check, Nuxt contract check, typecheck, unit tests, and Library SSR tests all PASS.

- [ ] **Step 3: Confirm the worktree is committed and push the branch**

```bash
git status --short
git push origin codex/nuxt-v2-statistics
```

Expected: `git status --short` prints nothing and the push succeeds without rewriting branch history.

- [ ] **Step 4: Deploy the committed frontend ref to staging**

Run from the repository root:

```bash
./scripts/deploy-stage.sh HEAD
```

Expected: the staging Nomad deployment becomes healthy and serves the new frontend revision at `https://stage.litteraturbanken.se`.

- [ ] **Step 5: Verify the Library path in a real browser**

Use the `browser:control-in-app-browser` skill and open:

```text
https://stage.litteraturbanken.se/bibliotek?visa=works&sort=popularitet
```

Verify all of the following with keyboard input rather than DOM-only inspection:

1. Tab focus is visibly outlined through global navigation, Library search, advanced search, sliders, result tabs, sort links, work-title buttons, author links, and pagination.
2. An idle work title is dark rather than red.
3. Enter on `Doktor Glas` expands its actions without a page reload.
4. The next Tab focuses `Läs som etext`; Shift+Tab returns to `Doktor Glas`.
5. Vue Multiselect still opens, navigates, selects, and closes with Arrow keys, Enter, and Escape.
6. No focus ring is clipped by a result row, panel, or overflow container.

- [ ] **Step 6: Verify pointer focus remains keyboard-only on staging**

Reload the same staging URL to clear keyboard modality, click a Library work title with the pointer, and inspect the focused button. Expected: the representation actions open, the pointer does not produce the two-tone keyboard ring, and hover/ordinary page visuals remain unchanged.

- [ ] **Step 7: Verify one non-Library page on staging**

Open:

```text
https://stage.litteraturbanken.se/om/ide
```

Press Tab once and continue through at least three links. Expected: every focused link has the same visible two-tone ring, no link moves in layout, and pointer clicks do not retain the keyboard ring.

- [ ] **Step 8: Record final evidence before declaring completion**

Invoke `superpowers:verification-before-completion`, record the exact passing command outputs and staging checks, and only then report the change as fixed. If verification requires an in-scope correction, add a failing regression first, implement the minimum correction, repeat all affected checks, commit it, push it, and redeploy before reporting completion.
