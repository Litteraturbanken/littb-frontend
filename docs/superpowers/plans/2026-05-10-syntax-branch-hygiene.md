# Syntax Branch Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `Syntax` branch clean, reviewable, and verified before further AngularJS-to-Vue runway work.

**Architecture:** This plan does not change application behavior. It removes branch baggage, fixes test-command documentation drift, reconciles `master`, and verifies the existing Vite/Playwright baseline. The application remains AngularJS on Vite.

**Tech Stack:** Git, Vite, AngularJS 1.7, Playwright, Yarn v1, npm scripts, Markdown.

---

## File Structure

- Modify: `.gitignore`
  - Add generated Playwright output and local browser-helper log directories.
- Modify: `package.json`
  - Add a `test:e2e` alias so docs and scripts agree.
- Modify: `TESTING.md`
  - Correct suite size and baseline language to match the current branch.
  - Document the known SO modal failure and the Vite server requirement.
- Delete: `playwright-report/index.html`
- Delete: `playwright-report/data/3b5e4db42784c384b6b6033841c7f58dac9147e9.md`
- Delete: `test-results/.last-run.json`
- Delete: `test-results/playwright_e2e-Reader-should-show-SO-modal-chromium/error-context.md`
- Delete: `app/public/assets/views/sla/kollationering-gbs1.xml`
- Delete: `app/public/assets/views/sla/kollationering-gbs2.xml`
- Delete: `app/public/assets/views/sla/kollationering-ol.xml`
- Inspect only: `playwright.config.js`
  - Confirm Playwright starts `yarn dev` and therefore Vite.

## Task 1: Ignore Generated Local Output

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Write the expected ignore entries**

Add these lines to `.gitignore` after the existing transient-output entries:

```gitignore
playwright-report/
test-results/
.playwright-cli/
.playwright-mcp/
```

- [ ] **Step 2: Verify ignored paths**

Run:

```bash
git check-ignore -v playwright-report test-results .playwright-cli .playwright-mcp
```

Expected: four lines showing `.gitignore` as the ignore source.

- [ ] **Step 3: Commit the ignore change**

Run:

```bash
git add .gitignore
git commit -m "Ignore generated Playwright output"
```

Expected: a commit that touches only `.gitignore`.

## Task 2: Remove Generated Test Artifacts

**Files:**
- Delete: `playwright-report/index.html`
- Delete: `playwright-report/data/3b5e4db42784c384b6b6033841c7f58dac9147e9.md`
- Delete: `test-results/.last-run.json`
- Delete: `test-results/playwright_e2e-Reader-should-show-SO-modal-chromium/error-context.md`

- [ ] **Step 1: Remove tracked generated artifacts**

Run:

```bash
git rm -r playwright-report test-results
```

Expected: Git stages deletions for the tracked generated files under those directories.

- [ ] **Step 2: Confirm no tracked generated artifacts remain**

Run:

```bash
git ls-files playwright-report test-results
```

Expected: no output.

- [ ] **Step 3: Confirm local helper logs are ignored, not staged**

Run:

```bash
git status --short --untracked-files=all
```

Expected: no `.playwright-cli/` or `.playwright-mcp/` entries. If entries still appear, return to Task 1 and fix `.gitignore`.

- [ ] **Step 4: Commit generated artifact removal**

Run:

```bash
git commit -m "Remove generated Playwright artifacts"
```

Expected: a commit that deletes only `playwright-report/` and `test-results/` tracked files.

## Task 3: Remove Unused SLA Collation XML Assets

**Files:**
- Delete: `app/public/assets/views/sla/kollationering-gbs1.xml`
- Delete: `app/public/assets/views/sla/kollationering-gbs2.xml`
- Delete: `app/public/assets/views/sla/kollationering-ol.xml`

- [ ] **Step 1: Verify no references exist**

Run:

```bash
rg -n "kollationering-gbs1|kollationering-gbs2|kollationering-ol" .
```

Expected: no output. If references appear, stop and inspect them before deletion.

- [ ] **Step 2: Remove unused XML assets**

Run:

```bash
git rm app/public/assets/views/sla/kollationering-gbs1.xml \
       app/public/assets/views/sla/kollationering-gbs2.xml \
       app/public/assets/views/sla/kollationering-ol.xml
```

Expected: Git stages the three XML deletions.

- [ ] **Step 3: Verify the filenames are gone from tracked files**

Run:

```bash
git ls-files | rg "kollationering-gbs1|kollationering-gbs2|kollationering-ol"
```

Expected: no output.

- [ ] **Step 4: Commit unused asset removal**

Run:

```bash
git commit -m "Remove unused SLA collation assets"
```

Expected: a commit that deletes only the three unused SLA collation XML files.

## Task 4: Align Test Scripts And Documentation

**Files:**
- Modify: `package.json`
- Modify: `TESTING.md`

- [ ] **Step 1: Add the missing script alias**

Modify the `scripts` section in `package.json` so it contains both `test` and `test:e2e`:

```json
"scripts": {
    "test": "node_modules/.bin/playwright test",
    "test:e2e": "node_modules/.bin/playwright test",
    "test:ui": "node_modules/.bin/playwright test --ui",
    "test:debug": "node_modules/.bin/playwright test --debug",
    "dev": "vite --host 0.0.0.0 --port 9000",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 9000 --strictPort",
    "dev:webpack": "NODE_OPTIONS='--openssl-legacy-provider' webpack-dev-server --config webpack.dev.js --host 0.0.0.0",
    "build:webpack": "NODE_OPTIONS='--openssl-legacy-provider' NODE_ENV=production webpack --config webpack.prod.js",
    "serve-dist:webpack": "NODE_ENV=production webpack-dev-server  --config webpack.prod.js --env prod --compress  --host 0.0.0.0"
}
```

- [ ] **Step 2: Update the test count in `TESTING.md`**

Set the current test-count bullet to the verified merged baseline:

```markdown
- **Total Tests**: 28 tests across 10 describe blocks
```

- [ ] **Step 3: Document the Vite server requirement**

In `TESTING.md`, replace:

```markdown
- **Server**: Tests run against dev server on `localhost:9000`
```

with:

```markdown
- **Server**: Tests run against the Vite dev server on `localhost:9000`. If an old webpack dev server is already listening on port 9000, stop it before running Playwright.
```

- [ ] **Step 4: Add the known baseline note**

After the "Run all E2E tests" command block in `TESTING.md`, add:

```markdown
Current `Syntax` baseline: 27 of 28 tests pass. The known failing test is `Reader > should show SO modal`, which depends on the SO modal flow and should be fixed or quarantined separately.
```

- [ ] **Step 5: Verify script availability**

Run:

```bash
npm run
```

Expected: output lists both `test` and `test:e2e`.

- [ ] **Step 6: Commit script and documentation alignment**

Run:

```bash
git add package.json TESTING.md
git commit -m "Align E2E test scripts and docs"
```

Expected: a commit touching only `package.json` and `TESTING.md`.

## Task 5: Reconcile Current `master`

**Files:**
- Modify as needed after merge/rebase conflict resolution.

- [ ] **Step 1: Inspect branch divergence**

Run:

```bash
git log --oneline --left-right --cherry-pick master...HEAD
```

Expected before reconciliation: output shows `master` commits on the left and `Syntax` commits on the right.

- [ ] **Step 2: Merge `master` into `Syntax`**

Run:

```bash
git merge master
```

Expected: either a clean merge commit or explicit conflicts to resolve. Prefer merge over rebase for this plan so the existing branch history remains stable.

- [ ] **Step 3: If conflicts occur, resolve them conservatively**

For conflicts in app code, keep the `Syntax` modernization structure and manually integrate newer `master` behavior. Known newer `master` topics are stats popular-work ranking and startpage/cache-killer/library-link generation. Do not resolve conflicts by wholesale accepting one side without reading the affected file.

- [ ] **Step 4: Complete the merge**

If conflicts occurred, run:

```bash
git status --short
for path in $(git diff --name-only --diff-filter=U); do git add "$path"; done
git commit
```

Expected: merge commit completes and `git status --short` shows no conflict markers or unresolved paths.

- [ ] **Step 5: Verify branch divergence after merge**

Run:

```bash
git log --oneline --left-right --cherry-pick master...HEAD
```

Expected: no left-side `master` commits remain. Right-side `Syntax` commits are expected.

## Task 6: Verify Clean Branch Baseline

**Files:**
- Inspect: `playwright.config.js`

- [ ] **Step 1: Confirm Playwright uses Vite**

Run:

```bash
sed -n '1,120p' playwright.config.js
```

Expected: `webServer.command` is `yarn dev`, and `package.json` maps `dev` to `vite --host 0.0.0.0 --port 9000`.

- [ ] **Step 2: Ensure port 9000 is free**

Run:

```bash
lsof -nP -iTCP:9000 -sTCP:LISTEN
```

Expected: no output. If a process is listening, stop the stale dev server before running Playwright.

- [ ] **Step 3: Install dependencies without lockfile churn**

Run:

```bash
yarn install --frozen-lockfile
```

Expected: exits 0 and does not modify `yarn.lock`.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: exits 0. Sass and Browserslist warnings are acceptable.

- [ ] **Step 5: Run the E2E baseline**

Run:

```bash
npm test -- --reporter=list
```

Expected before fixing the SO modal issue: `27 passed` and one failure for `Reader > should show SO modal`.

- [ ] **Step 6: Confirm working tree only contains intentional local noise**

Run:

```bash
git status --short --untracked-files=all
```

Expected: no tracked changes. No `.playwright-cli/`, `.playwright-mcp/`, `playwright-report/`, or `test-results/` entries should appear.

- [ ] **Step 7: Record baseline in final handoff**

In the implementation summary, report:

```text
Build: npm run build passed.
E2E: npm test -- --reporter=list produced 27 passed, 1 known SO modal failure.
Branch hygiene: generated artifacts ignored/removed, unused SLA collation XML removed, master reconciled.
```

Do not commit a generated Playwright report or test-result file.
