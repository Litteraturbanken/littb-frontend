# Production Focus Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make staging use the current production focus visuals for the colleague demo while preserving keyboard focus and assistive-technology semantics.

**Architecture:** Restore the CSS cascade that existed immediately before the shared site-wide ring was introduced in `0115f935`, rather than adding another global override or feature flag. Browser tests will continue to drive real Tab navigation but will distinguish production-hidden Reader and Dramawebben focus styling from the default-layout focus styling that production already had.

**Tech Stack:** Nuxt 4.4.8, Vue 3.5.39, Sass, Vitest 4.1.10, Playwright 1.61.1, Yarn 1.22.22, Node.js 22.

## Global Constraints

- Current production is the visual authority.
- Preserve tab order, keyboard activation, native focus ownership, `tabindex`, roles, accessible names, ARIA state, and route announcements.
- Do not introduce a runtime flag, user preference, or replacement focus-ring design.
- Do not change templates, component behavior, routes, data, or APIs.
- Keep dedicated accessibility coverage for navigation semantics, touch-target size, native roles, and the route announcer.
- Use test-driven development: record the focused browser and foundation failures before editing production CSS.
- Deploy only an immutable committed frontend SHA to `lb-frontend-stage`.

---

## File Map

- `nuxt/test/e2e/shell-accessibility.behavior.spec.ts`: owns real keyboard reachability and computed focus-style expectations for default, Reader, Dramawebben, and Library layouts.
- `nuxt/test/unit/foundation.spec.ts`: owns the exact mechanical relationship between legacy production CSS, Nuxt default CSS, and the Reader partition.
- `nuxt/app/assets/styles/styles.scss`: owns the default-layout focus cascade; restore the pre-`0115f935` inline `:focus-visible` block and selectors.
- `nuxt/app/assets/styles/reader-base.scss`: owns the Reader CSS partition; restore production's blanket visual focus suppression without changing focusability.
- `nuxt/app/pages/dramawebben/pjäser.vue`: owns the Dramawebben filter button exception; restore production's no-ring style.
- `nuxt/app/assets/styles/_focus.scss`: delete after its two imports are removed because no bundle will consume it.

---

### Task 1: Restore production focus visuals with test-first authority

**Files:**
- Modify: `nuxt/test/e2e/shell-accessibility.behavior.spec.ts:22-128`
- Modify: `nuxt/test/unit/foundation.spec.ts:20-180`
- Modify: `nuxt/app/assets/styles/styles.scss:1-120,607-615,2520-2545`
- Modify: `nuxt/app/assets/styles/reader-base.scss:1-115,607-615`
- Modify: `nuxt/app/pages/dramawebben/pjäser.vue:970-985`
- Delete: `nuxt/app/assets/styles/_focus.scss`

**Interfaces:**
- Consumes: browser-native `document.activeElement`, `:focus-visible`, and `getComputedStyle`; the legacy stylesheet at `app/styles/styles.scss` as the production CSS source.
- Produces: production-equivalent computed focus visuals while retaining the existing DOM focus sequence and accessible control semantics.

- [ ] **Step 1: Add the failing Reader and Dramawebben browser expectations**

Keep `expectKeyboardFocusRing` for default-layout targets that production already renders with the prior inline treatment. Add a production-hidden helper that still reaches the target exclusively with Tab presses:

```ts
async function expectKeyboardFocusWithoutSharedRing(
  page: import("@playwright/test").Page,
  target: Locator
) {
  await expect(target).toHaveCount(1)

  for (let tab = 0; tab < 80; tab += 1) {
    await page.keyboard.press("Tab")
    if (await target.evaluate(element => element === document.activeElement)) {
      await expect(target).toBeFocused()
      expect(await target.evaluate(element => {
        const computed = getComputedStyle(element)
        return {
          focusVisible: element.matches(":focus-visible"),
          outlineStyle: computed.outlineStyle,
          boxShadow: computed.boxShadow
        }
      })).toEqual({
        focusVisible: true,
        outlineStyle: "none",
        boxShadow: "none"
      })
      return
    }
  }

  throw new Error("keyboard navigation did not reach the expected control")
}
```

Change only these two owners to call it:

```ts
test("keyboard focus matches production in the Reader layout", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await expectKeyboardFocusWithoutSharedRing(
    page,
    page.locator('nav[aria-label="Huvudnavigation"] a').first()
  )
})

test("keyboard focus matches production on Dramawebben filter controls", async ({ page }) => {
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })
  await expectKeyboardFocusWithoutSharedRing(page, page.locator(".controls .filter_btn"))
})
```

Do not weaken the default-layout input, active Library tab, Dramawebben text-input, or general keyboard reachability tests.

- [ ] **Step 2: Update the foundation expectation before production CSS**

Replace the focus-related mechanical transformations with explicit default and Reader production blocks:

```ts
const defaultFocusStyle = `
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
`

const readerFocusStyle = `
:focus {
    outline: none;
}
`
```

In `mechanicallyOwnedStyles`, remove the `@use "focus"` insertion and `input:focus:not(:focus-visible)` rewrite. Replace the legacy Reader block with `defaultFocusStyle`:

```ts
[
  "\n:focus {\n    outline: none;\n}\n",
  defaultFocusStyle
]
```

In the existing active-button transformation, retain the reviewed active-state changes but restore the production selector:

```scss
&:focus {
    outline: none;
}
```

After building the Reader partition, replace `defaultFocusStyle` exactly once with `readerFocusStyle`:

```ts
const partition = owned.slice(0, pageStart)
  + owned.slice(license, history)
  + owned.slice(sharedImports + 1)
return replaceExactlyOnce(partition, defaultFocusStyle, readerFocusStyle)
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run from `nuxt/` with isolated ports:

```bash
LBAPI_FIXTURE_PORT=4213 LITTB_NUXT_TEST_PORT=3113 \
  yarn playwright test test/e2e/shell-accessibility.behavior.spec.ts \
  --project=desktop-chromium \
  --grep 'Reader layout|Dramawebben filter controls' \
  --workers=1 --reporter=line
yarn vitest run test/unit/foundation.spec.ts
```

Expected before production edits:

- the two browser cases fail because the shared ring still computes `outline-style: solid` and a 4px dark shadow; and
- the foundation ownership case fails because the CSS still imports `_focus.scss` and uses the post-`0115f935` selectors.

If either assertion passes before the CSS edit, stop and correct the authority rather than proceeding.

- [ ] **Step 4: Restore the default-layout production cascade**

In `nuxt/app/assets/styles/styles.scss`, remove:

```scss
@use "focus";
```

Restore the inline production block after the base `img` rule:

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

Restore these production selectors without changing their declarations:

```scss
input:focus, button.btn:focus {
    outline-color : $primarycolor;
    outline-width : 1px;
}
```

```scss
&:focus {
    outline: none;
}
```

- [ ] **Step 5: Restore Reader and Dramawebben production focus styling**

In `nuxt/app/assets/styles/reader-base.scss`, remove `@use "focus";`, restore the Reader-level rule after the base `img` rule, and restore its input/button selector:

```scss
:focus {
    outline: none;
}
```

```scss
input:focus, button.btn:focus {
    outline-color : $primarycolor;
    outline-width : 1px;
}
```

In `nuxt/app/pages/dramawebben/pjäser.vue`, restore the production filter rule:

```scss
.controls .filter_btn:focus {
  outline: 0 !important;
  box-shadow: none !important;
}
```

Delete `nuxt/app/assets/styles/_focus.scss` after confirming `rg -n '@use "focus"' nuxt/app` returns no matches.

- [ ] **Step 6: Run focused GREEN verification**

```bash
LBAPI_FIXTURE_PORT=4213 LITTB_NUXT_TEST_PORT=3113 \
  yarn playwright test test/e2e/shell-accessibility.behavior.spec.ts \
  --project=desktop-chromium --workers=1 --reporter=line
yarn vitest run test/unit/foundation.spec.ts
```

Expected: every shell-accessibility browser case and all eight foundation cases pass. Reader and Dramawebben controls must still be reached through Tab and remain `document.activeElement`; only their computed shared ring disappears.

- [ ] **Step 7: Run the broader static and build gates**

```bash
yarn eslint \
  test/e2e/shell-accessibility.behavior.spec.ts \
  test/unit/foundation.spec.ts \
  app/pages/dramawebben/pjäser.vue --max-warnings 0
yarn typecheck
yarn policy:check
yarn quality:maintainability
yarn build
git diff --check
```

Expected: every command exits 0; maintainability reports zero new findings; the build completes without warnings attributable to the packet.

- [ ] **Step 8: Review and commit the implementation packet**

```bash
git diff -- \
  nuxt/test/e2e/shell-accessibility.behavior.spec.ts \
  nuxt/test/unit/foundation.spec.ts \
  nuxt/app/assets/styles/styles.scss \
  nuxt/app/assets/styles/reader-base.scss \
  'nuxt/app/pages/dramawebben/pjäser.vue' \
  nuxt/app/assets/styles/_focus.scss
git diff --check
git add \
  nuxt/test/e2e/shell-accessibility.behavior.spec.ts \
  nuxt/test/unit/foundation.spec.ts \
  nuxt/app/assets/styles/styles.scss \
  nuxt/app/assets/styles/reader-base.scss \
  'nuxt/app/pages/dramawebben/pjäser.vue' \
  nuxt/app/assets/styles/_focus.scss
git commit -m "Restore production focus visuals"
```

Expected: the commit contains only the six paths above, with `_focus.scss` recorded as deleted.

---

### Task 2: Deploy and verify immutable staging parity

**Files:**
- No source changes.
- Use unchanged: `scripts/deploy-stage.sh`
- Use unchanged: `jobs/lb-frontend-stage.nomad`

**Interfaces:**
- Consumes: committed frontend SHA and the existing `docker-builder-multiarch`/Nomad staging workflow.
- Produces: one healthy `lb-frontend-stage` allocation running the exact committed image and live browser evidence against production.

- [ ] **Step 1: Verify repository and branch state**

Run from the repository root:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

Expected: clean status, branch `codex/nuxt-v2-statistics`, and a full immutable SHA.

- [ ] **Step 2: Push the immutable branch**

```bash
git push origin codex/nuxt-v2-statistics
git ls-remote --heads origin codex/nuxt-v2-statistics
```

Expected: the remote branch SHA equals `git rev-parse HEAD`.

- [ ] **Step 3: Deploy the committed frontend image**

```bash
export NOMAD_ADDR=http://nomad.infra.lb.se
scripts/deploy-stage.sh "$(git rev-parse HEAD)"
```

Expected: the multi-architecture image build completes, the Nomad deployment reaches `successful`, and `lb-frontend-stage` has one healthy allocation.

- [ ] **Step 4: Verify the running image is exact**

```bash
export NOMAD_ADDR=http://nomad.infra.lb.se
nomad job status lb-frontend-stage
nomad job inspect -json lb-frontend-stage \
  | jq -r '.TaskGroups[].Tasks[].Config.image'
```

Expected: one healthy allocation and image `registry.service.consul:5000/lb-frontend:<full-HEAD-SHA>`.

- [ ] **Step 5: Compare live production and staging focus behavior**

Use the Playwright CLI wrapper to open production and staging Library pages. On each site, use keyboard Tab navigation to focus “Visa utökad sökning” and inspect `document.activeElement` plus computed styles:

```bash
export CODEX_HOME=/Users/johan/.codex
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" open https://litteraturbanken.se/bibliotek
"$PWCLI" snapshot
"$PWCLI" press Tab
"$PWCLI" eval "() => { const e = document.activeElement; const s = getComputedStyle(e); return { text: e?.textContent?.trim(), focusVisible: e?.matches(':focus-visible'), outlineStyle: s.outlineStyle, boxShadow: s.boxShadow } }"
"$PWCLI" goto https://stage.litteraturbanken.se/bibliotek
"$PWCLI" snapshot
"$PWCLI" press Tab
"$PWCLI" eval "() => { const e = document.activeElement; const s = getComputedStyle(e); return { text: e?.textContent?.trim(), focusVisible: e?.matches(':focus-visible'), outlineStyle: s.outlineStyle, boxShadow: s.boxShadow } }"
"$PWCLI" close
```

Expected on both sites: the same Library control is focused, `focusVisible` is true, and `outlineStyle` is `none`; staging no longer has the 2px white shared outline. Confirm the page has no console errors and Library results remain rendered.

- [ ] **Step 6: Record deployment evidence without further edits**

Capture the committed SHA, Nomad deployment ID/status, image reference, and live production/staging computed-style results in the task handoff. Do not create a deployment-only source commit.

