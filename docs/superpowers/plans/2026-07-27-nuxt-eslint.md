# Nuxt ESLint Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin and integrate the official Nuxt ESLint flat configuration, lint every handwritten file in `nuxt/`, apply ordinary autofixes once, and leave a verified inventory of unresolved findings.

**Architecture:** The package-local Nuxt module generates a project-aware flat configuration, while a committed `eslint.config.mjs` adds global exclusions for generated and transient content. Package scripts make linting reproducible from `nuxt/`; configuration and source autofixes are committed separately so the mechanical rewrite remains reviewable.

**Tech Stack:** Nuxt 4.4.8, Vue 3.5.39, TypeScript 5.9.3, ESLint 10.8.0, `@nuxt/eslint` 1.16.0, Yarn 1.22.17, Vitest 4.1.10, Playwright 1.61.1.

## Global Constraints

- Lint only the package rooted at `nuxt/`; do not change or invoke the root AngularJS ESLint configuration.
- Cover handwritten `.vue`, `.ts`, `.tsx`, `.js`, `.mjs`, and `.cjs` files in the Nuxt package, including tests and tool configuration.
- Exclude `app/lib/api/generated/**`, `.nuxt/**`, `.output/**`, `node_modules/**`, `coverage/**`, `playwright-report/**`, and `test-results*/**`.
- Pin `eslint` exactly to `10.8.0` and `@nuxt/eslint` exactly to `1.16.0`.
- Use Nuxt's recommended JavaScript, TypeScript, Vue, and Nuxt rules without enabling stylistic formatting.
- Treat warnings as failures; do not add convenience overrides, per-file exceptions, or suppression comments.
- Run only ordinary `eslint --fix`; do not apply editor suggestions or manually clean up the remaining inventory.
- Preserve unrelated dirty and untracked files and leave all development servers running.

---

### Task 1: Integrate the package-local Nuxt ESLint checker

**Files:**
- Modify: `nuxt/package.json`
- Modify: `nuxt/yarn.lock`
- Modify: `nuxt/nuxt.config.ts`
- Create: `nuxt/eslint.config.mjs`
- Create: `nuxt/README.md`

**Interfaces:**
- Consumes: Nuxt's generated `.nuxt/eslint.config.mjs` and the existing `nuxt prepare` postinstall lifecycle.
- Produces: `yarn lint`, `yarn lint:fix`, and a flat configuration whose working directory and ignores confine ESLint to handwritten Nuxt files.

- [ ] **Step 1: Prove the checker is not already available**

Run from the repository root:

```bash
test ! -e nuxt/eslint.config.mjs
test -z "$(node -e 'const p=require("./nuxt/package.json"); process.stdout.write(p.scripts?.lint || "")')"
test -z "$(node -e 'const p=require("./nuxt/package.json"); process.stdout.write(p.devDependencies?.eslint || "")')"
```

Expected: all three checks exit zero. Also run `cd nuxt && yarn eslint --version`; it must fail because no package-local ESLint executable exists.

- [ ] **Step 2: Add exact dependencies and scripts**

Modify `nuxt/package.json` so its scripts include:

```json
"lint": "eslint . --max-warnings 0",
"lint:fix": "eslint . --fix --max-warnings 0"
```

Add these exact development dependencies, preserving alphabetical order:

```json
"@nuxt/eslint": "1.16.0",
"eslint": "10.8.0"
```

Do not modify the root `package.json`.

- [ ] **Step 3: Register the Nuxt module without a dev-server checker**

Add this configuration immediately after `ssr: true` in `nuxt/nuxt.config.ts`:

```ts
modules: ["@nuxt/eslint"],
eslint: {
  config: {
    autoInit: false
  }
},
```

Do not set `checker`; linting remains an explicit command and does not alter dev-server behavior.

- [ ] **Step 4: Commit the flat configuration boundary**

Create `nuxt/eslint.config.mjs` with exactly:

```js
import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  ignores: [
    ".nuxt/**",
    ".output/**",
    "node_modules/**",
    "app/lib/api/generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results*/**"
  ]
})
```

This config adds only global ignores. Do not enable `stylistic`, override a rule, or add file-specific exceptions.

- [ ] **Step 5: Document the developer workflow**

Create `nuxt/README.md` with:

```markdown
# Litteraturbanken Nuxt application

Install dependencies with `yarn install`. The postinstall hook prepares Nuxt's
generated types and ESLint configuration.

## Code quality

- `yarn lint` checks all handwritten Nuxt application, server, shared, test, and
  configuration code. Generated API types and build/test artifacts are excluded.
- `yarn lint:fix` applies ESLint's ordinary automatic fixes.
- `yarn typecheck` runs Nuxt and Vue type analysis.
- `yarn test:unit` runs the Vitest suite.

Lint warnings fail the command. Do not add suppression comments or run broad
editor suggestions without a separate review.
```

- [ ] **Step 6: Install and prepare the pinned toolchain**

Run:

```bash
cd nuxt
yarn install
yarn eslint --version
test -f .nuxt/eslint.config.mjs
```

Expected: Yarn updates only `nuxt/yarn.lock`, ESLint prints `v10.8.0`, and Nuxt's generated ESLint config exists.

- [ ] **Step 7: Verify dependency and configuration resolution**

Run from `nuxt/`:

```bash
yarn list --pattern '^(eslint|@nuxt/eslint)$' --depth=0
yarn eslint --print-config app/app.vue > /tmp/littb-eslint-vue-config.json
yarn eslint --print-config server/utils/reader-source.ts > /tmp/littb-eslint-ts-config.json
```

Expected: the dependency list shows the exact pins, both JSON files are nonempty, the Vue config has a Vue parser, and both resolved configs contain active rules.

- [ ] **Step 8: Prove file discovery is scoped**

Run from `nuxt/`, allowing the expected nonzero lint status:

```bash
set +e
yarn eslint . --format json > /tmp/littb-eslint-discovery.json
lint_status=$?
set -e
node -e '
const results = JSON.parse(require("node:fs").readFileSync("/tmp/littb-eslint-discovery.json", "utf8"))
const bad = results.map(result => result.filePath).filter(file =>
  !file.startsWith(process.cwd() + "/") ||
  file.includes("/app/lib/api/generated/") ||
  file.includes("/.nuxt/") ||
  file.includes("/.output/") ||
  file.includes("/node_modules/") ||
  file.includes("/coverage/") ||
  file.includes("/playwright-report/") ||
  /\/test-results[^/]*\//.test(file)
)
if (bad.length) { console.error(bad.join("\n")); process.exit(1) }
console.log(`scoped_files=${results.length}`)
'
test "$lint_status" -eq 0 -o "$lint_status" -eq 1
```

Expected: the script prints a positive scoped file count and no forbidden path.

- [ ] **Step 9: Verify and commit the reproducible integration**

Run from the repository root:

```bash
git diff --check -- nuxt/package.json nuxt/yarn.lock nuxt/nuxt.config.ts nuxt/eslint.config.mjs nuxt/README.md
git add nuxt/package.json nuxt/yarn.lock nuxt/nuxt.config.ts nuxt/eslint.config.mjs nuxt/README.md
git diff --cached --check
git diff --cached --stat
git commit -m "chore(nuxt): integrate ESLint checker"
```

Expected: the commit contains exactly the five integration files and does not include generated `.nuxt` content.

---

### Task 2: Apply and audit ordinary ESLint autofixes

**Files:**
- Modify: only ESLint-selected handwritten files under `nuxt/`

**Interfaces:**
- Consumes: the package-local `yarn lint` and `yarn lint:fix` commands from Task 1.
- Produces: an audited autofix commit, an idempotent lint-fix workflow, and an exact remaining rule inventory.

- [ ] **Step 1: Capture the baseline without changing source files**

Run from `nuxt/`:

```bash
set +e
yarn eslint . --format json > /tmp/littb-eslint-baseline.json
baseline_status=$?
set -e
node -e '
const rows = JSON.parse(require("node:fs").readFileSync("/tmp/littb-eslint-baseline.json", "utf8"))
const messages = rows.flatMap(row => row.messages)
const counts = new Map()
for (const message of messages) {
  const key = message.ruleId || "parse-error"
  counts.set(key, (counts.get(key) || 0) + 1)
}
console.log(`files=${rows.length}`)
console.log(`errors=${rows.reduce((n, row) => n + row.errorCount, 0)}`)
console.log(`warnings=${rows.reduce((n, row) => n + row.warningCount, 0)}`)
for (const [rule, count] of [...counts].sort()) console.log(`${rule}=${count}`)
'
test "$baseline_status" -eq 0 -o "$baseline_status" -eq 1
```

Expected: the totals equal the sum of the rule counts. Preserve this output for the final handoff.

- [ ] **Step 2: Snapshot the existing dirty scope**

Run from the repository root:

```bash
git status --short > /tmp/littb-eslint-pre-fix-status.txt
git diff --name-only > /tmp/littb-eslint-pre-fix-tracked.txt
git status --short -- nuxt
```

Expected: record all pre-existing files. Stop if any handwritten Nuxt source file is already dirty; generated or ignored test artifacts do not block the autofix pass.

- [ ] **Step 3: Apply only ESLint's ordinary fixes**

Run from `nuxt/`:

```bash
set +e
yarn lint:fix > /tmp/littb-eslint-fix-output.txt 2>&1
fix_status=$?
set -e
tail -n 40 /tmp/littb-eslint-fix-output.txt
test "$fix_status" -eq 0 -o "$fix_status" -eq 1
```

Do not run a formatter, use editor quick-fixes, add disable directives, or manually resolve the remaining diagnostics.

- [ ] **Step 4: Prove the autofix scope**

Run from the repository root:

```bash
git diff --name-only -- nuxt
git diff --stat -- nuxt
git diff --check -- nuxt
comm -13 <(sort /tmp/littb-eslint-pre-fix-tracked.txt) <(git diff --name-only | sort) |
  awk 'NF && $0 !~ /^nuxt\// { print "OUT_OF_SCOPE " $0; bad=1 } END { exit bad }'
```

Expected: every newly modified tracked file begins with `nuxt/`, and no ignored or generated path appears.

- [ ] **Step 5: Audit suppressions and every semantic edit**

Run:

```bash
git diff --check -- nuxt
git diff -- nuxt | rg '^\+.*(eslint-disable|eslint-enable|@ts-ignore|@ts-expect-error)'
git diff -- nuxt
```

Expected: the suppression search exits one with no output. Review every import removal, declaration rewrite, control-flow change, and Vue template edit; trailing layout-only changes may be reviewed by category.

- [ ] **Step 6: Prove `lint:fix` is idempotent**

Run from the repository root:

```bash
before=$(git diff --binary -- nuxt | shasum -a 256 | cut -d' ' -f1)
(cd nuxt && yarn lint:fix > /tmp/littb-eslint-second-fix.txt 2>&1) || true
after=$(git diff --binary -- nuxt | shasum -a 256 | cut -d' ' -f1)
test "$before" = "$after"
```

Expected: hashes match. If they differ, inspect the new diff and repeat only after establishing why the documented command was not stable.

- [ ] **Step 7: Capture the final inventory**

Run from `nuxt/`:

```bash
set +e
yarn eslint . --format json > /tmp/littb-eslint-final.json
final_status=$?
set -e
node -e '
const rows = JSON.parse(require("node:fs").readFileSync("/tmp/littb-eslint-final.json", "utf8"))
const messages = rows.flatMap(row => row.messages)
const counts = new Map()
for (const message of messages) {
  const key = message.ruleId || "parse-error"
  counts.set(key, (counts.get(key) || 0) + 1)
}
console.log(`files=${rows.length}`)
console.log(`errors=${rows.reduce((n, row) => n + row.errorCount, 0)}`)
console.log(`warnings=${rows.reduce((n, row) => n + row.warningCount, 0)}`)
for (const [rule, count] of [...counts].sort()) console.log(`${rule}=${count}`)
'
test "$final_status" -eq 0 -o "$final_status" -eq 1
```

Expected: record exact remaining counts without adding overrides or suppressions.

- [ ] **Step 8: Run the complete static and automated verification**

Run from `nuxt/`:

```bash
yarn typecheck
yarn test:unit
yarn build
yarn test:ssr
yarn test:e2e
```

Expected: all five commands exit zero. Leave the existing Nuxt and backend development servers running.

- [ ] **Step 9: Review and commit the autofixes**

Run from the repository root:

```bash
git diff --check -- nuxt
git add -u -- nuxt
git diff --cached --name-only |
  awk '$0 !~ /^nuxt\// { print "OUT_OF_SCOPE " $0; bad=1 } END { exit bad }'
git diff --cached --check
git diff --cached --stat
git commit -m "style(nuxt): apply ESLint autofixes"
```

Expected: only approved handwritten Nuxt files are committed. The final handoff reports baseline and remaining totals by rule, the net reduction, exact verification results, and both implementation commit hashes.
