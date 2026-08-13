# Production Focus Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make staging use current production focus visuals for the colleague demo while preserving keyboard focus and assistive-technology semantics.

**Architecture:** Restore the legacy focus cascade that preceded the Nuxt ring in `2892d1b6` and its site-wide expansion in `0115f935`. Real browser tests retain Tab-based focus ownership but reject the two-tone shared/proxy ring on representative default, Library, Reader, and Dramawebben controls.

**Tech Stack:** Nuxt 4.4.8, Vue 3.5.39, Sass, Vitest 4.1.10, Playwright 1.61.1, Yarn 1.22.22, Node.js 22.

## Global Constraints

- Current production is the visual authority.
- Preserve tab order, keyboard activation, native focus ownership, `tabindex`, roles, accessible names, ARIA state, tooltips, and route announcements.
- Do not introduce a flag, preference, or replacement focus design.
- Keep the Reader slider's separate component-specific indicator unchanged.
- Use TDD and deploy only an immutable committed frontend SHA.

---

### Task 1: Restore the legacy focus cascade

**Files:**
- Modify: `nuxt/test/e2e/shell-accessibility.behavior.spec.ts`
- Modify: `nuxt/test/e2e/library-advanced.behavior.spec.ts`
- Modify: `nuxt/test/unit/foundation.spec.ts`
- Modify: `nuxt/app/assets/styles/styles.scss`
- Modify: `nuxt/app/assets/styles/reader-base.scss`
- Modify: `nuxt/app/pages/dramawebben/pjäser.vue`
- Modify: `nuxt/app/components/library/LibraryAdvancedFilters.vue`
- Delete: `nuxt/app/assets/styles/_focus.scss`

**Interfaces:**
- Consumes: browser-native `document.activeElement`, `:focus-visible`, `getComputedStyle`, and legacy `app/styles/styles.scss`.
- Produces: production-hidden shared focus visuals with unchanged DOM focus and accessibility semantics.

- [ ] **Step 1: Write failing browser authorities**

Replace the ring helper with a Tab-driven helper that proves the target is `document.activeElement`, still matches `:focus-visible`, and does not have the shared signature:

```ts
async function expectKeyboardFocusWithoutSharedRing(page: Page, target: Locator) {
  await expect(target).toHaveCount(1)
  for (let tab = 0; tab < 80; tab += 1) {
    await page.keyboard.press("Tab")
    if (!await target.evaluate(element => element === document.activeElement)) continue
    await expect(target).toBeFocused()
    expect(await target.evaluate(element => {
      const style = getComputedStyle(element)
      return {
        focusVisible: element.matches(":focus-visible"),
        sharedOutline: style.outlineStyle === "solid"
          && style.outlineWidth === "2px"
          && style.outlineOffset === "2px",
        sharedShadow: style.boxShadow.includes("0px 0px 0px 4px")
      }
    })).toEqual({ focusVisible: true, sharedOutline: false, sharedShadow: false })
    return
  }
  throw new Error("keyboard navigation did not reach the expected control")
}
```

Use it for the existing default input, Reader main-navigation link, Dramawebben filter/text inputs, and active Library tab cases. Keep their exact selectors and real Tab navigation.

Change the Library gender-select case to retain:

```ts
await expect(gender).toBeFocused()
```

and assert its visual proxy has neither a solid outline nor a 4px shadow:

```ts
expect(await visual.evaluate(element => {
  const style = getComputedStyle(element)
  return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow }
})).toEqual({ outlineStyle: "none", boxShadow: "none" })
```

- [ ] **Step 2: Make foundation ownership expect legacy focus CSS**

Remove every focus-ring-only mechanical transformation from `mechanicallyOwnedStyles`: the shared import, blanket-focus replacement, `:focus-visible` input and active-button exceptions, and filter-outline split. The default CSS must retain the legacy literal:

```scss
:focus {
    outline: none;
}
```

`exactReaderPartition` must use the same literal without an extra replacement.

- [ ] **Step 3: Verify RED**

```bash
cd nuxt
LBAPI_FIXTURE_PORT=4213 LITTB_NUXT_TEST_PORT=3113 \
  yarn playwright test \
  test/e2e/shell-accessibility.behavior.spec.ts \
  test/e2e/library-advanced.behavior.spec.ts \
  --project=desktop-chromium \
  --grep 'focus' --workers=1 --reporter=line
yarn vitest run test/unit/foundation.spec.ts
```

Expected: representative controls still receive the shared/proxy ring, and foundation still detects ring-specific source transformations.

- [ ] **Step 4: Implement the minimal production CSS**

In `styles.scss` and `reader-base.scss`, remove `@use "focus"`, restore `:focus { outline: none; }`, and restore the original `input:focus, button.btn:focus` selector. In `styles.scss`, also restore the legacy active-button `box-shadow: none`, active Library tab `box-shadow: none` plus `&:focus`, and unconditional `input.filter { outline: none; }` declarations.

In `pjäser.vue`, restore unconditional `outline: 0` on the catalog text input. Because the filter button is nested below the scoped page style, use:

```scss
:deep(.controls .filter_btn:focus) {
  outline: 0 !important;
  box-shadow: none !important;
}
```

In `LibraryAdvancedFilters.vue`, delete only the two-tone `select[data-library-gender]:focus-visible + .selection` block and its forced-colors companion. Keep the transparent select's structure and behavior intact. Delete `_focus.scss` after `rg -n '@use "focus"' nuxt/app` returns no matches.

- [ ] **Step 5: Verify GREEN and broader gates**

```bash
cd nuxt
LBAPI_FIXTURE_PORT=4213 LITTB_NUXT_TEST_PORT=3113 \
  yarn playwright test \
  test/e2e/shell-accessibility.behavior.spec.ts \
  test/e2e/library-advanced.behavior.spec.ts \
  --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run test/unit/foundation.spec.ts
yarn eslint \
  test/e2e/shell-accessibility.behavior.spec.ts \
  test/e2e/library-advanced.behavior.spec.ts \
  test/unit/foundation.spec.ts \
  app/components/library/LibraryAdvancedFilters.vue \
  app/pages/dramawebben/pjäser.vue --max-warnings 0
yarn typecheck
yarn policy:check
yarn quality:maintainability
yarn build
git diff --check
```

Expected: all commands exit 0; every focus owner remains keyboard-focused and the shared/proxy ring is absent.

- [ ] **Step 6: Review and commit the implementation**

Review the exact eight-file implementation scope, request independent review, then commit only after CLEAN:

```bash
git add \
  nuxt/test/e2e/shell-accessibility.behavior.spec.ts \
  nuxt/test/e2e/library-advanced.behavior.spec.ts \
  nuxt/test/unit/foundation.spec.ts \
  nuxt/app/assets/styles/styles.scss \
  nuxt/app/assets/styles/reader-base.scss \
  nuxt/app/pages/dramawebben/pjäser.vue \
  nuxt/app/components/library/LibraryAdvancedFilters.vue \
  nuxt/app/assets/styles/_focus.scss
git commit -m "Restore production focus visuals"
```

---

### Task 2: Deploy and verify staging

**Files:**
- No source changes.
- Use unchanged: `scripts/deploy-stage.sh`
- Use unchanged: `jobs/lb-frontend-stage.nomad`

**Interfaces:**
- Consumes: committed frontend SHA and existing multi-architecture/Nomad workflow.
- Produces: one healthy staging allocation running that exact SHA.

- [ ] **Step 1: Push and deploy the immutable SHA**

```bash
git status --short
git push origin codex/nuxt-v2-statistics
export NOMAD_ADDR=http://nomad.infra.lb.se
scripts/deploy-stage.sh "$(git rev-parse HEAD)"
```

Expected: clean tree, remote SHA equals local HEAD, image build completes, deployment succeeds 1/1 healthy.

- [ ] **Step 2: Verify live production/staging parity**

Use the Playwright CLI on production and staging Library pages. Tab to “Visa utökad sökning” and capture `document.activeElement`, `:focus-visible`, outline, and shadow. Expected: both sites keep the same control focused with no two-tone ring. Also confirm staging renders Library results and has no console errors.

- [ ] **Step 3: Record immutable evidence**

Record the commit SHA, Nomad deployment ID/status, exact image, and browser comparison in the handoff. Do not create a deployment-only commit.

