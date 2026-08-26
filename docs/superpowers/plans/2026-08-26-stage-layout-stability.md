# Stage Layout Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove production/Stage layout shifts caused by Requiem fallback metrics and missing facsimile image geometry without changing settled visuals.

**Architecture:** Preserve the existing authority font source and final CSS. Add metric-compatible local fallback aliases to the existing font stacks, then reserve facsimile image height from authoritative OCR dimensions when available. Verify both changes in a fixture-backed production build and retain the settled visual suite unchanged.

**Tech Stack:** Nuxt 4, Vue 3, SCSS, Tailwind CSS, Playwright, TypeScript

**Spec:** `docs/superpowers/plans/2026-08-26-stage-layout-stability-design.md`

## Global Constraints

- Development-only Vite stylesheet reinjection is out of scope.
- Settled application styling and visual baselines must not change.
- Do not extract, rewrite, or replace the licensed authority font payload.
- Do not deploy, merge, or push.

---

### Task 1: Production Requiem fallback metrics

**Files:**
- Modify: `nuxt/app/assets/styles/nuxt.scss`
- Modify: `nuxt/app/assets/styles/styles.scss`
- Create: `nuxt/test/e2e/layout-shift-production.behavior.spec.ts`
- Create: `nuxt/playwright.layout-shift-production.config.ts`

**Interfaces:**
- Consumes: the authority Requiem faces declared by `FD3D54C3A22C4D32B.css`
- Produces: local fallback families used by the existing Display, Text, and Small Caps font stacks

- [ ] **Step 1: Write the failing production browser test**

Capture layout-shift entries in a cold production browser context for `/bibliotek`, `/epub`, `/presentationer`, `/om/ide`, and `/författare/StrindbergA`. Assert that headings do not change line count between the first animation frame and `document.fonts.ready`, and that cumulative layout shift stays below `0.01` for each tested viewport.

- [ ] **Step 2: Run the focused production test and verify RED**

Run: `cd nuxt && yarn playwright test --config playwright.layout-shift-production.config.ts`

Expected: FAIL because the existing Georgia fallback causes first-frame heading wrapping on at least Library, Presentations, and About.

- [ ] **Step 3: Implement the minimal fallback faces and stacks**

Add local `@font-face` fallbacks using `src: local("Times New Roman")` and calibrated `size-adjust` values for Requiem Display, Text, and Small Caps. Add those aliases immediately after the corresponding authority faces in existing stacks. Do not change font sizes, line heights, margins, widths, or final authority font selection.

- [ ] **Step 4: Run the focused production test and verify GREEN**

Run: `cd nuxt && yarn playwright test --config playwright.layout-shift-production.config.ts`

Expected: PASS with no heading line-count change and CLS below the declared threshold.

### Task 2: Facsimile intrinsic geometry

**Files:**
- Modify: `nuxt/app/components/reader/ReaderFacsimileImage.vue`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`

**Interfaces:**
- Consumes: `ReaderOcrOverlay.width`, `ReaderOcrOverlay.height`, and the selected facsimile source width
- Produces: a proportional integer image height used by the container and `<img>` intrinsic dimensions

- [ ] **Step 1: Write the failing browser test**

Open the fixture-backed facsimile reader before its image completes. Assert that the image and `.img_area` reserve the height derived from `selectedWidth * overlayHeight / overlayWidth`, and that loading the image does not move the reader content.

- [ ] **Step 2: Run the focused reader test and verify RED**

Run: `cd nuxt && yarn playwright test test/e2e/reader.behavior.spec.ts --project=mobile-chromium --grep "reserves facsimile geometry"`

Expected: FAIL because the current image and container expose width only.

- [ ] **Step 3: Implement proportional intrinsic height**

Derive the height only when valid OCR dimensions exist. Apply it to the image `height` attribute and the image-area height while preserving the existing overlay scale and selected width. Leave pages without authoritative height data unchanged.

- [ ] **Step 4: Run the focused reader test and verify GREEN**

Run the same focused command. Expected: PASS.

### Task 3: Regression verification

**Files:**
- Modify only if a genuine regression is found in the files already in scope

**Interfaces:**
- Consumes: Tasks 1 and 2
- Produces: verified production layout stability with unchanged settled visuals

- [ ] **Step 1: Run production layout stability coverage**

Run: `cd nuxt && yarn playwright test --config playwright.layout-shift-production.config.ts`

- [ ] **Step 2: Run reader and route behavior coverage with configured workers**

Run the focused reader, author, Library/EPUB, presentation, About, and search behavior suites using the repository's supported parallel runner.

- [ ] **Step 3: Run settled visual regression coverage**

Run the complete visual lane without snapshot updates and confirm that no baseline files changed.

- [ ] **Step 4: Run static and production checks**

Run lint, typecheck, and a production build. Confirm the git diff contains no visual baseline changes and no dev-only stylesheet migration.
