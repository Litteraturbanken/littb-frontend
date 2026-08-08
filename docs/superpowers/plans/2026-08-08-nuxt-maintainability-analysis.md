# Nuxt Maintainability Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, baseline-ratcheted Nuxt maintainability gate and automatically generate ranked evidence packets for independent AI code review.

**Architecture:** ESLint with SonarJS blocks high-confidence defects. Knip, dependency-cruiser, an advisory SonarJS pass, and tested ast-grep rules feed a Node orchestrator that attributes diagnostics to named code units, compares stable fingerprints with a checked-in baseline, and emits JSON and Markdown review packets. AI review consumes the packet but remains advisory.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript compiler API, `@vue/compiler-sfc`, ESLint 10, `eslint-plugin-sonarjs` 4.2.0, Knip 6.32.0, dependency-cruiser 18.1.1, `@ast-grep/cli` 0.45.1, Vitest, Invoke.

## Global Constraints

- Scan all authored code under `nuxt/app`, `nuxt/server`, and `nuxt/shared`; exclude generated OpenAPI output, build artifacts, browser artifacts, and test fixtures.
- Do not maintain a canonical filename list of suspicious units.
- Do not add inline analyzer suppressions or downgrade blocking rules to warnings.
- Ordinary `yarn lint` remains warning-free.
- Normal checks never rewrite `quality/maintainability-baseline.json`.
- AI findings remain advisory until converted into a deterministic test or rule.
- Pin every tool version exactly.

---

### Task 1: Install and enforce the analyzer toolchain

**Files:**
- Modify: `nuxt/package.json`
- Modify: `nuxt/yarn.lock`
- Modify: `nuxt/eslint.config.mjs`
- Modify: `nuxt/scripts/verify-architecture-policy.mjs`
- Modify: `nuxt/test/unit/architecture-policy.spec.ts`

**Interfaces:**
- Produces: pinned analyzer binaries and the canonical blocking SonarJS configuration.

- [ ] **Step 1: Write failing dependency and policy tests**

Add a real-manifest assertion for exact versions `eslint-plugin-sonarjs@4.2.0`, `knip@6.32.0`, `dependency-cruiser@18.1.1`, `@ast-grep/cli@0.45.1`, and `@vue/compiler-sfc@3.5.39`. Change the canonical ESLint fixture to require the SonarJS import, `plugins: { sonarjs }`, and the six rules below. Add mutations removing the plugin/rule or lowering a severity; each must be rejected.

- [ ] **Step 2: Verify RED**

Run: `cd nuxt && yarn vitest run test/unit/architecture-policy.spec.ts -t "maintainability analyzer|SonarJS"`

Expected: FAIL because dependencies and policy support are absent.

- [ ] **Step 3: Install dependencies and configure blocking rules**

Run:

```bash
cd nuxt
yarn add --dev --exact eslint-plugin-sonarjs@4.2.0 knip@6.32.0 dependency-cruiser@18.1.1 @ast-grep/cli@0.45.1 @vue/compiler-sfc@3.5.39
```

Configure these as errors in `eslint.config.mjs`:

```js
"sonarjs/no-all-duplicated-branches": "error",
"sonarjs/no-collection-size-mischeck": "error",
"sonarjs/no-duplicated-branches": "error",
"sonarjs/no-identical-expressions": "error",
"sonarjs/no-identical-functions": "error",
"sonarjs/no-redundant-boolean": "error"
```

Extend `validEslintConfigSource` to require exactly the reviewed SonarJS import, plugin registration, ignore set, and error-only rules. Preserve semantic AST validation rather than raw text comparison.

- [ ] **Step 4: Verify GREEN and inspect real findings**

Run:

```bash
cd nuxt
yarn vitest run test/unit/architecture-policy.spec.ts
yarn policy:check
yarn lint
yarn install --frozen-lockfile
```

Expected: all commands pass. Fix indisputable existing findings; remove a noisy rule globally only with its policy test, never by file suppression.

- [ ] **Step 5: Commit**

```bash
git add nuxt/package.json nuxt/yarn.lock nuxt/eslint.config.mjs nuxt/scripts/verify-architecture-policy.mjs nuxt/test/unit/architecture-policy.spec.ts
git commit -m "build: add Nuxt maintainability analyzers"
```

---

### Task 2: Attribute diagnostics to discovered code units

**Files:**
- Create: `nuxt/scripts/maintainability/unit-attribution.mjs`
- Create: `nuxt/test/unit/maintainability-unit-attribution.spec.ts`

**Interfaces:**
- Produces: `listSourceUnits({ source, relativePath })` and `attributeFindingToUnit({ source, relativePath, line, column })`.

- [ ] **Step 1: Write failing attribution tests**

Cover a function declaration, arrow assigned to a variable, class method, nested function, Vue `<script setup>` with line offset, Vue component fallback, and module fallback. Assert stable IDs such as `app/Example.vue::function::fetchPage` and current line spans.

- [ ] **Step 2: Verify RED**

Run: `cd nuxt && yarn vitest run test/unit/maintainability-unit-attribution.spec.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement attribution**

Use `parse` from `@vue/compiler-sfc` for script blocks and `ts.createSourceFile` for TS/JS ASTs. Walk declarations, methods, accessors, constructors, and named variable/property function initializers. Choose the smallest containing unit. Use component and module fallbacks and sort by start line, end line, kind, then name.

- [ ] **Step 4: Verify GREEN**

Run: `cd nuxt && yarn vitest run test/unit/maintainability-unit-attribution.spec.ts`

Expected: all tests pass without warnings.

- [ ] **Step 5: Commit**

```bash
git add nuxt/scripts/maintainability/unit-attribution.mjs nuxt/test/unit/maintainability-unit-attribution.spec.ts
git commit -m "feat: attribute quality findings to code units"
```

---

### Task 3: Implement fingerprints, baseline comparison, and ranking

**Files:**
- Create: `nuxt/scripts/maintainability/findings.mjs`
- Create: `nuxt/test/unit/maintainability-findings.spec.ts`

**Interfaces:**
- Consumes: attributed units from Task 2.
- Produces: `fingerprintFinding`, `compareWithBaseline`, `rankReviewUnits`, and `serializeBaseline`.

- [ ] **Step 1: Write failing finding tests**

Assert that moving a unit between lines preserves its fingerprint; changing tool, rule, path, unit ID, or semantic identity changes it. Assert new/known/resolved partitioning and deterministic ranking. Ranking must prefer multiple analyzers agreeing on a unit and then sort ties alphabetically.

- [ ] **Step 2: Verify RED**

Run: `cd nuxt && yarn vitest run test/unit/maintainability-findings.spec.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the pure model**

Hash `[tool, rule, path, unit.id, identity].join("\u0000")` with SHA-256. Use severity weights `{ blocking: 8, advisory: 3, info: 1 }` and rank with:

```js
const score = severityWeightSum
  + uniqueRules.size * 2
  + Math.max(0, uniqueTools.size - 1) * 5
  + Math.min(20, totalMeasuredExcess)
  + (changedLineOverlap ? 3 : 0)
```

Return new, known, and resolved collections separately. Serialize schema version `1`, sorted records, and a final newline.

- [ ] **Step 4: Verify GREEN**

Run: `cd nuxt && yarn vitest run test/unit/maintainability-findings.spec.ts`

Expected: all model tests pass.

- [ ] **Step 5: Commit**

```bash
git add nuxt/scripts/maintainability/findings.mjs nuxt/test/unit/maintainability-findings.spec.ts
git commit -m "feat: add maintainability finding ratchet"
```

---

### Task 4: Configure and normalize analyzer output

**Files:**
- Create: `nuxt/eslint.maintainability.config.mjs`
- Create: `nuxt/knip.jsonc`
- Create: `nuxt/dependency-cruiser.config.cjs`
- Create: `nuxt/sgconfig.yml`
- Create: `nuxt/quality/ast-grep/no-identity-discriminator-switch.yml`
- Create: `nuxt/quality/ast-grep/__tests__/no-identity-discriminator-switch-test.yml`
- Create: `nuxt/scripts/maintainability/adapters.mjs`
- Create: `nuxt/test/unit/maintainability-adapters.spec.ts`
- Modify: `nuxt/scripts/verify-architecture-policy.mjs`
- Modify: `nuxt/test/unit/architecture-policy.spec.ts`

**Interfaces:**
- Produces: `parseEslintFindings`, `parseKnipFindings`, `parseDependencyCruiserFindings`, and `parseAstGrepFindings`, returning one common finding shape.

- [ ] **Step 1: Write failing adapter, rule, and suppression tests**

Provide minimal real JSON for every tool and assert normalized tool, rule, path, location, identity, measured value, and threshold. Add ast-grep fixtures where two discriminator cases reconstruct `{ mode: view.mode, response: view.response }`, plus a non-match with genuinely different transformations. Add policy cases rejecting `ast-grep-ignore` directives in JS, TS, and Vue source.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd nuxt
yarn vitest run test/unit/maintainability-adapters.spec.ts test/unit/architecture-policy.spec.ts -t "maintainability|ast-grep"
```

Expected: missing adapter/rule failures and accepted suppression directives.

- [ ] **Step 3: Add reviewed analyzer configs**

The advisory ESLint config scans authored source and configures:

```js
"sonarjs/cognitive-complexity": ["warn", 12],
"sonarjs/cyclomatic-complexity": ["warn", { threshold: 12 }],
"sonarjs/max-lines-per-function": ["warn", { maximum: 80 }]
```

Configure Knip for Nuxt conventions while excluding generated/build/fixture paths. Configure dependency-cruiser errors for cycles, production-to-test imports, app-to-server imports, and library-to-page/component imports. Configure ast-grep to load the tested rule. Extend policy to reject real ast-grep suppression comments while allowing documentation strings containing the same words.

- [ ] **Step 4: Implement fail-closed adapters**

Validate required fields and throw `Invalid <tool> diagnostic at index N` for malformed input. Normalize paths relative to `nuxt/`. Sonar identities include rule and threshold; Knip identities include issue type and symbol; dependency identities include rule/from/to; ast-grep identities include rule and matched syntax kind. No identity contains a line number.

- [ ] **Step 5: Verify GREEN with native rule tests**

Run:

```bash
cd nuxt
yarn vitest run test/unit/maintainability-adapters.spec.ts test/unit/architecture-policy.spec.ts
yarn ast-grep test
yarn depcruise --config dependency-cruiser.config.cjs --output-type err app server shared || true
yarn knip --config knip.jsonc --reporter json || true
```

Expected: unit and rule tests pass. Inventory tools may report current debt, but no generated or fixture path appears.

- [ ] **Step 6: Commit**

```bash
git add nuxt/eslint.maintainability.config.mjs nuxt/knip.jsonc nuxt/dependency-cruiser.config.cjs nuxt/sgconfig.yml nuxt/quality/ast-grep nuxt/scripts/maintainability/adapters.mjs nuxt/test/unit/maintainability-adapters.spec.ts nuxt/scripts/verify-architecture-policy.mjs nuxt/test/unit/architecture-policy.spec.ts
git commit -m "feat: configure Nuxt maintainability analyzers"
```

---

### Task 5: Generate deterministic AI review packets

**Files:**
- Create: `nuxt/scripts/maintainability/report.mjs`
- Create: `nuxt/test/unit/maintainability-report.spec.ts`
- Create: `nuxt/quality/maintainability-review-contract.md`

**Interfaces:**
- Consumes: ranked units and ratchet comparison from Task 3.
- Produces: `renderReviewJson(report)` and `renderReviewMarkdown(report)`.

- [ ] **Step 1: Write failing packet tests**

Assert schema version `1`, relative paths, unit spans, findings, dependency edges, selection reasons, changed-line overlap, and scores. Assert Markdown contains the same units and evidence but no copied source. Feed inputs in two insertion orders and require byte-identical output.

- [ ] **Step 2: Verify RED**

Run: `cd nuxt && yarn vitest run test/unit/maintainability-report.spec.ts`

Expected: FAIL because renderers are missing.

- [ ] **Step 3: Implement renderers and review contract**

Sort units by descending score then stable ID. End JSON and Markdown with a newline. Markdown includes summary counts and evidence tables. The review contract requires an independent AI to answer:

```text
1. Can this unit or an abstraction inside it be deleted?
2. Does it duplicate a domain concept, type, adapter, or branch?
3. Is indirection enforcing policy or merely moving code?
4. Does it follow the simplest established local pattern?
5. What exact smaller implementation preserves behavior?
```

Require path/line evidence, prohibit author-agent self-approval, and keep AI findings advisory until confirmed.

- [ ] **Step 4: Verify GREEN**

Run: `cd nuxt && yarn vitest run test/unit/maintainability-report.spec.ts`

Expected: packet tests pass with byte-stable output.

- [ ] **Step 5: Commit**

```bash
git add nuxt/scripts/maintainability/report.mjs nuxt/test/unit/maintainability-report.spec.ts nuxt/quality/maintainability-review-contract.md
git commit -m "feat: generate AI maintainability review packets"
```

---

### Task 6: Orchestrate analyzers and establish the baseline

**Files:**
- Create: `nuxt/scripts/run-maintainability.mjs`
- Create: `nuxt/test/unit/maintainability-cli.spec.ts`
- Create: `nuxt/quality/maintainability-baseline.json`
- Modify: `nuxt/package.json`
- Modify: `nuxt/.gitignore`

**Interfaces:**
- Produces: `yarn quality:maintainability`, `yarn quality:maintainability:update-baseline`, `.quality/maintainability-review.json`, and `.quality/maintainability-review.md`.

- [ ] **Step 1: Write failing CLI tests with executable fixture tools**

Use temporary commands selected through `MAINTAINABILITY_TOOL_FIXTURES`. Test: empty clean baseline exits `0`; new finding exits `1` while writing both packets; known finding exits `0`; `--update-baseline` writes sorted fingerprints; resolved entries are reported; malformed output exits `2`; an ordinary run never changes the baseline; and `--path app/pages` filters the review packet only after a complete scan and baseline comparison.

- [ ] **Step 2: Verify RED**

Run: `cd nuxt && yarn vitest run test/unit/maintainability-cli.spec.ts`

Expected: FAIL because the CLI is missing.

- [ ] **Step 3: Implement fail-closed orchestration**

Use `spawnSync`, capturing stdout/stderr separately. Accept analyzer nonzero status only when valid diagnostics were emitted; missing binaries, signals, invalid JSON, or invalid schemas exit `2`. Attribute every finding through Task 2. Parse `git diff --unified=0 --no-ext-diff HEAD -- app server shared` when Git exists; otherwise omit the changed-line bonus.

Write reports atomically under `.quality/`. Write the checked-in baseline only with `--update-baseline`. Print new/known/resolved counts and the top ten ranked units. Support repeatable `--path <prefix>` arguments only as a post-scan report filter; reject `--path` in CI when `CI` is truthy so canonical enforcement always reports the full tree. Exit `1` for new fingerprints and `0` otherwise.

- [ ] **Step 4: Add scripts and ignored output**

Add package scripts:

```json
"quality:maintainability": "node scripts/run-maintainability.mjs",
"quality:maintainability:update-baseline": "node scripts/run-maintainability.mjs --update-baseline"
```

Add `.quality/` to `nuxt/.gitignore`.

- [ ] **Step 5: Verify GREEN and generate the baseline**

Run:

```bash
cd nuxt
yarn vitest run test/unit/maintainability-cli.spec.ts
yarn quality:maintainability:update-baseline
yarn quality:maintainability
```

Expected: tests pass, the baseline is sorted, the ordinary run exits zero, and both packets contain no generated or fixture paths.

- [ ] **Step 6: Commit**

```bash
git add nuxt/scripts/run-maintainability.mjs nuxt/test/unit/maintainability-cli.spec.ts nuxt/quality/maintainability-baseline.json nuxt/package.json nuxt/.gitignore
git commit -m "feat: add maintainability quality ratchet"
```

---

### Task 7: Remove the Library identity adapter and duplicate state union

**Files:**
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/app/lib/library/page-results.ts`
- Create: `nuxt/test/unit/library-maintainability.spec.ts`
- Modify: `nuxt/quality/maintainability-baseline.json`

**Interfaces:**
- Consumes: canonical successful `LibraryPageData` from `view-model.ts`.
- Produces: distributively derived `LibraryPageState` and a direct `toLibrarySearchView(data)` return.

- [ ] **Step 1: Write the failing regression test**

Run the real ast-grep rule against `bibliotek.vue` and assert zero identity-switch findings. Add a compile-only assignment proving successful `LibraryPageData` is assignable to `LibraryPageState`.

- [ ] **Step 2: Verify RED**

Run: `cd nuxt && yarn vitest run test/unit/library-maintainability.spec.ts`

Expected: FAIL on the seven repeated identity returns.

- [ ] **Step 3: Derive state and delete the adapter**

Replace the repeated state union in `page-results.ts` with:

```ts
type StatefulPage<Page> = Page extends { mode: infer Mode, response: infer Response }
  ? { mode: Mode, response: StatefulResponse<Response> }
  : never

export type LibraryPageState = StatefulPage<LibrarySuccessPageData>
```

Derive response aliases from `Extract<LibraryPageState, ...>`, rename local component annotations accordingly, and replace the complete switch with `return toLibrarySearchView(data)`.

- [ ] **Step 4: Verify GREEN and remove resolved debt**

Run:

```bash
cd nuxt
yarn vitest run test/unit/library-maintainability.spec.ts test/unit/library-page-results.spec.ts test/unit/library-contract.spec.ts
yarn typecheck
yarn quality:maintainability:update-baseline
yarn quality:maintainability
```

Expected: focused tests and gates pass; the identity-switch fingerprint is absent from the refreshed baseline.

- [ ] **Step 5: Commit**

```bash
git add nuxt/app/pages/bibliotek.vue nuxt/app/lib/library/page-results.ts nuxt/test/unit/library-maintainability.spec.ts nuxt/quality/maintainability-baseline.json
git commit -m "refactor: remove redundant Library page adapter"
```

---

### Task 8: Integrate the gate into authoritative Invoke tasks

**Files:**
- Modify: `test/test_tasks.py`
- Modify: `tasks.py`

**Interfaces:**
- Produces: maintainability execution in `quality.frontend` and `quality.library`.

- [ ] **Step 1: Change expected calls first**

Insert `call(context, ["yarn", "quality:maintainability"], ...)` after lint and before typecheck in the frontend task expectation. Add it after focused typecheck and before unit/browser tests in the Library expectation. Update fail-fast and dry-run assertions.

- [ ] **Step 2: Verify RED**

Run:

```bash
python -m unittest \
  test.test_tasks.InvokeTaskTests.test_frontend_quality_runs_every_blocking_gate_in_order_under_node_22 \
  test.test_tasks.InvokeTaskTests.test_library_quality_runs_focused_backend_and_nuxt_gates
```

Expected: FAIL because `tasks.py` omits the command.

- [ ] **Step 3: Add the command to both task sequences**

Use the existing Node environment and `_run` fail-fast behavior. Do not create a second Invoke implementation of the analyzer logic.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
python -m unittest test.test_tasks
invoke --dry quality.frontend
invoke --dry quality.library
```

Expected: tests pass and dry runs show the reviewed order.

- [ ] **Step 5: Commit**

```bash
git add tasks.py test/test_tasks.py
git commit -m "build: gate frontend quality on maintainability"
```

---

### Task 9: Broad verification and independent packet review

**Files:**
- Modify only when a verification failure proves a scoped defect.

**Interfaces:**
- Verifies every approved success criterion.

- [ ] **Step 1: Run focused verification**

```bash
cd nuxt
yarn ast-grep test
yarn vitest run \
  test/unit/maintainability-unit-attribution.spec.ts \
  test/unit/maintainability-findings.spec.ts \
  test/unit/maintainability-adapters.spec.ts \
  test/unit/maintainability-report.spec.ts \
  test/unit/maintainability-cli.spec.ts \
  test/unit/library-maintainability.spec.ts \
  test/unit/architecture-policy.spec.ts
yarn policy:check
yarn lint
yarn quality:maintainability
yarn typecheck
```

Expected: every command exits zero and ordinary lint emits no warnings.

- [ ] **Step 2: Prove the ratchet rejects new code without touching the real baseline**

Use the CLI test harness to introduce the identity-switch fixture into a temporary repository. Assert exit `1`, a `newFindings` fingerprint, and both packets identifying the enclosing unit. Restore no files because the proof runs outside the worktree.

- [ ] **Step 3: Run broad project gates**

```bash
cd nuxt
yarn test:unit
yarn build
yarn playwright test test/ssr/library.spec.ts --project=ssr
cd ..
python -m unittest test.test_tasks
invoke quality.frontend
```

Expected: unit, build, Library SSR, task, and authoritative frontend gates exit zero.

- [ ] **Step 4: Perform independent AI packet inspection**

Review the top five units in `.quality/maintainability-review.md` against current source and callers using `quality/maintainability-review-contract.md`. Confirm every path, symbol, span, metric, and selection reason is reproducible. Treat false positives as adapter/config defects requiring a RED/GREEN test; never suppress a unit by filename.

- [ ] **Step 5: Audit final state**

```bash
git diff --check
git status --short
git log --oneline -12
```

Expected: no uncommitted scoped changes and no `.quality/` report is tracked.
