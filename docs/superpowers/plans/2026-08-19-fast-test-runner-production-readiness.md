# Fast Test Runner and Production-Readiness Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make Nuxt unit and Playwright gates reliable and materially faster on an 18-core laptop without sharing mutable fixture state, then produce an evidence-backed path from validated staging to production readiness.

**Architecture:** A pure policy module owns adaptive worker and shard counts. Vitest uses at most twelve workers; Playwright uses four isolated one-worker shards with private fixture/Nuxt ports; live staging uses four read-only workers. A final audit classifies production gaps without deploying or changing infrastructure.

**Tech Stack:** Node.js 22, Vitest 4, Playwright 1.61, Nuxt 4, TypeScript, ECMAScript modules, Yarn 1, Nomad documentation.

**Spec:** docs/superpowers/specs/2026-08-19-fast-test-runner-production-readiness-design.md

## Completion record — 2026-08-19

The implementation is complete through Task 6 and the production-readiness
audit is recorded in
`docs/superpowers/2026-08-19-production-readiness-audit.md`.

Two evidence-driven amendments supersede the original estimates below:

- Full runs showed that four simultaneous cold Nuxt compilers are unstable on
  this laptop. The measured default is therefore three isolated browser/SSR
  shards; callers may still override it explicitly.
- Multi-shard browser runs allow one retry for cold Vite startup failures and
  expose those retries in the reporter. The serial lane retains zero retries.
  The final three-shard full browser run passed 1,003 tests with 9 intentional
  skips and two recovered cold-start attempts in 505.75 seconds.

The final public `yarn test:ssr` command passed all 611 tests with the
three-shard default plus the serial stateful Reader lane in 60.15 seconds.
No application behavior, deployment, infrastructure, DNS, or credentials were
changed by this plan.

## Global Constraints

- Do not change application behavior or authored production source.
- Do not push, merge, deploy, roll back, access credentials, or perform external writes.
- Never run multiple Playwright workers against one mutable fixture server.
- Unit workers are min(12, availableParallelism()).
- Browser shards are min(4, availableParallelism()); each shard has one worker.
- Preserve ports 4100/3000 as single-run defaults and allocate unique shard ports.
- Give every shard unique Nuxt build and Playwright output directories.
- Remove only the current run's cache directory after success, failure, or interruption.
- Keep Vitest's generic five-second timeout; only cold ESLint startup gets 15 seconds.
- Preserve yarn test:unit, yarn test:ssr, and yarn test:e2e as public commands.
- Browser completion requires zero failures and zero retries; intentional skips may remain.
- Report performance as evidence, not as a brittle timing assertion.
- Separate repository evidence, staging observations, and operator confirmation in the audit.

---

### Task 1: Stabilize parallel unit execution

**Files:**
- Create: nuxt/scripts/test-runner-policy.mjs
- Create: nuxt/test/unit/test-runner-policy.spec.ts
- Modify: nuxt/vitest.config.ts
- Modify: nuxt/test/unit/eslint-quality.spec.ts:16-26

**Interfaces:**
- Produces boundedParallelism(cap, available?), configuredShardCount(raw, available?), and shardPorts(index, fixtureBase?, nuxtBase?).
- Tasks 3 and 4 consume this policy.

- [ ] **Step 1: Write the failing policy tests**

Create test-runner-policy.spec.ts with exact assertions for:
- boundedParallelism(12, 18) === 12;
- boundedParallelism(12, 8) === 8;
- zero/noninteger availability throws positive-integer error;
- configuredShardCount(undefined, 18) === 4 and with availability 2 equals 2;
- explicit 6 on 18 cores equals 6; explicit 20 is bounded to 18;
- zero, negative, decimal, empty, and nonnumeric overrides throw;
- shardPorts(0) returns 4100/3000 and shardPorts(3) returns 4103/3003.

- [ ] **Step 2: Verify RED**

    cd nuxt
    yarn vitest run test/unit/test-runner-policy.spec.ts --reporter=verbose

Expected: FAIL because scripts/test-runner-policy.mjs is absent.

- [ ] **Step 3: Implement the pure policy**

The module imports availableParallelism from node:os. A private positiveInteger(value, label) rejects noninteger or values below one. boundedParallelism returns Math.min(valid cap, valid availability). configuredShardCount parses the optional override, defaults to four, validates it, and bounds it to availability. shardPorts validates a zero-based nonnegative index and returns base ports plus index.

- [ ] **Step 4: Integrate policy and timeout**

Import boundedParallelism in vitest.config.ts; add maxWorkers: boundedParallelism(12) beside projects. Add 15_000 only as the third argument of the first ESLint test(). Do not change remaining cases or global timeout.

- [ ] **Step 5: Verify GREEN and full reproduction**

    cd nuxt
    yarn vitest run test/unit/test-runner-policy.spec.ts test/unit/eslint-quality.spec.ts --reporter=verbose
    /usr/bin/time -p yarn test:unit
    yarn eslint vitest.config.ts scripts/test-runner-policy.mjs test/unit/test-runner-policy.spec.ts test/unit/eslint-quality.spec.ts
    yarn typecheck

Expected: 96 files and 2,829 tests pass; no timeout.

- [ ] **Step 6: Commit**

    git add nuxt/vitest.config.ts nuxt/scripts/test-runner-policy.mjs nuxt/test/unit/test-runner-policy.spec.ts nuxt/test/unit/eslint-quality.spec.ts
    git commit -m "test: stabilize parallel unit execution"

### Task 2: Make browser origins environment-owned

**Files:**
- Create: nuxt/test/helpers/test-origins.ts
- Create: nuxt/test/unit/test-origin-policy.spec.ts
- Modify: hard-coded operational origins in nuxt/test/e2e/*.spec.ts and nuxt/test/ssr/*.spec.ts

The current set is 21 E2E files (About, Author Documents behavior/visual, Author Profiles visual, Author Works visual, Drama visual, History visual, Home behavior/visual, ID visual, Presentations behavior/visual, Quick Search visual, three Reader visuals, SLA Articles behavior, SLA Omtexterna behavior/visual, Statistics visual, Text Search visual), 13 SSR files (Author Documents API/page, Author Works export, Drama documents API, History, Home, legacy author routes, Litteraturkartan proxy, Presentations, Quick Search, SLA Articles API/page, Statistics), and reader-shorthand.spec.ts for port 3000.

**Interfaces:**
- fixtureOrigin derives from LBAPI_FIXTURE_PORT or 4100.
- nuxtTestOrigin derives from LITTB_NUXT_TEST_PORT or 3000.

- [ ] **Step 1: Write a failing source-boundary test**

Recursively read test/e2e and test/ssr, filter *.spec.ts, and collect relative paths whose source matches the regex http://127.0.0.1:(3000|4100). Assert violations equals [].

- [ ] **Step 2: Verify RED**

    cd nuxt
    yarn vitest run test/unit/test-origin-policy.spec.ts --reporter=verbose

Expected: FAIL listing the 35 current files.

- [ ] **Step 3: Add the shared helper**

Create test-origins.ts exporting fixtureOrigin and nuxtTestOrigin from the two environment variables with current ports as defaults.

- [ ] **Step 4: Replace operational literals only**

Import from ../helpers/test-origins in the listed files. Preserve local variable names and assertions. Do not edit inert URL samples in unit tests.

- [ ] **Step 5: Verify GREEN and concurrent isolation**

    cd nuxt
    yarn vitest run test/unit/test-origin-policy.spec.ts --reporter=verbose
    rg -n 'http://127\.0\.0\.1:(3000|4100)' test/e2e test/ssr
    LBAPI_FIXTURE_PORT=4210 LITTB_NUXT_TEST_PORT=3110 NUXT_IGNORE_LOCK=1 yarn playwright test test/ssr/home-page.spec.ts --project=ssr --workers=1 &
    first=$!
    LBAPI_FIXTURE_PORT=4211 LITTB_NUXT_TEST_PORT=3111 NUXT_IGNORE_LOCK=1 yarn playwright test test/ssr/statistics.spec.ts --project=ssr --workers=1 &
    second=$!
    wait "$first"
    wait "$second"

Expected: boundary test and both concurrent runs pass; rg is empty.

- [ ] **Step 6: Run scoped gates and commit**

    cd nuxt
    yarn eslint test/helpers/test-origins.ts test/unit/test-origin-policy.spec.ts test/e2e test/ssr
    yarn typecheck
    git diff --check -- test
    git add test/helpers/test-origins.ts test/unit/test-origin-policy.spec.ts test/e2e test/ssr
    git commit -m "test: parameterize browser fixture origins"

### Task 3: Add isolated Playwright shard supervision

**Files:**
- Create: nuxt/scripts/run-playwright-shards.mjs
- Create: nuxt/test/unit/playwright-shard-runner.spec.ts
- Modify: nuxt/package.json
- Modify: nuxt/nuxt.config.ts
- Modify: nuxt/playwright.config.ts

**Interfaces:**
- Produces createShardPlan({ projects, passthrough, shardCount, fixtureBase, nuxtBase }).
- Produces superviseShardPlans(plans, spawnShard): Promise<number>.
- Every plan uses one worker, one i/n shard, fixture bases spaced by two for the
  fixture's redirect companion port, Nuxt ports spaced by one, and unique
  build/output directories.

- [ ] **Step 1: Write failing plan/supervision tests**

Require a two-shard plan with --project=ssr, --workers=1, and --shard=1/2 or 2/2; ports 4200/3100 then 4202/3101; NUXT_IGNORE_LOCK=1; and distinct NUXT_BUILD_DIR/PLAYWRIGHT_OUTPUT_DIR values below one run root. Fake children expose completion: Promise<number> and terminate(). Assert all-zero returns zero, first nonzero is preserved, unresolved siblings terminate exactly once, POSIX cleanup targets the shard process group, and injected cleanup removes the run root on success and failure.

- [ ] **Step 2: Verify RED**

    cd nuxt
    yarn vitest run test/unit/playwright-shard-runner.spec.ts --reporter=verbose

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement plan construction and supervision**

Use shardPorts(). Spawn all plans immediately. Resolve only after all exit zero. After the first failure, terminate unresolved siblings once and preserve the first nonzero code.

- [ ] **Step 4: Implement the CLI**

Parse repeated --project=<name> options and forward remaining arguments. Require at least one project. Create a unique run root under node_modules/.cache/littb-playwright, use configuredShardCount(process.env.LITTB_PLAYWRIGHT_SHARDS), the resolved local Playwright CLI, inherited stdio, and SIGINT/SIGTERM cleanup. Remove only that run root after children settle.

- [ ] **Step 5: Make configs honor isolation directories**

Set Nuxt buildDir to process.env.NUXT_BUILD_DIR || ".nuxt" and Playwright
outputDir to process.env.PLAYWRIGHT_OUTPUT_DIR || "test-results". Extend tests
to pin both defaults and overrides.

- [ ] **Step 6: Preserve package command names**

Set test:ssr to node scripts/run-playwright-shards.mjs --project=ssr.
Set test:e2e to node scripts/run-playwright-shards.mjs --project=desktop-chromium --project=mobile-chromium.

- [ ] **Step 7: Verify GREEN with real shards**

    cd nuxt
    yarn vitest run test/unit/test-runner-policy.spec.ts test/unit/playwright-shard-runner.spec.ts --reporter=verbose
    LITTB_PLAYWRIGHT_SHARDS=2 yarn test:ssr -- test/ssr/robots.spec.ts test/ssr/home-page.spec.ts
    yarn eslint scripts/run-playwright-shards.mjs test/unit/playwright-shard-runner.spec.ts
    yarn typecheck
    lsof -nP -iTCP:3000-3003 -iTCP:4100-4103 -sTCP:LISTEN || true

Expected: units and real shards pass; no owned listener remains.

- [ ] **Step 8: Commit**

    git add nuxt/scripts/run-playwright-shards.mjs nuxt/test/unit/playwright-shard-runner.spec.ts nuxt/package.json nuxt/nuxt.config.ts nuxt/playwright.config.ts
    git commit -m "test: run Playwright in isolated shards"

### Task 4: Parallelize immutable live-stage smoke

**Files:**
- Modify: playwright.nuxt-live.config.js
- Create: nuxt/test/unit/nuxt-live-runner.spec.ts

**Interfaces:**
- Live config uses fullyParallel true, min(4, availableParallelism()) workers, global preflight, and zero retries.

- [ ] **Step 1: Write failing config tests**

Load the CommonJS config and assert fullyParallel is true; workers is greater than one and no more than four; retries is zero; globalSetup names nuxt_live_preflight.cjs. Read the live spec and reject fixture-control endpoints or mutation methods other than its existing read-only search/API POST assertions.

- [ ] **Step 2: Verify RED**

    cd nuxt
    yarn vitest run test/unit/nuxt-live-runner.spec.ts --reporter=verbose

Expected: FAIL on current serial one-worker config.

- [ ] **Step 3: Implement adaptive parallelism**

Require availableParallelism from node:os; set fullyParallel true and workers Math.min(4, availableParallelism()). Preserve preflight, timeouts, retries, reporter, trace, and project.

- [ ] **Step 4: Verify and commit**

    cd nuxt
    yarn vitest run test/unit/nuxt-live-runner.spec.ts --reporter=verbose
    yarn eslint test/unit/nuxt-live-runner.spec.ts
    node --check ../playwright.nuxt-live.config.js
    git diff --check -- ../playwright.nuxt-live.config.js test/unit/nuxt-live-runner.spec.ts
    git add ../playwright.nuxt-live.config.js test/unit/nuxt-live-runner.spec.ts
    git commit -m "test: parallelize live stage smoke"

Do not run live staging unless network and environment access are intentionally available.

### Task 5: Run the accelerated verification matrix

**Files:** No intended changes.

- [ ] **Step 1: Confirm clean boundaries**

Run git status --short and inspect ports 3000-3003/4100-4103 with lsof. Expect no changes/listeners.

- [ ] **Step 2: Run unit/static/build gates**

    cd nuxt
    /usr/bin/time -p yarn test:unit
    yarn lint
    yarn typecheck
    yarn policy:check
    yarn quality:maintainability
    yarn build

- [ ] **Step 3: Run full isolated SSR**

Run cd nuxt && /usr/bin/time -p yarn test:ssr. Expect all tests green and zero retries.

- [ ] **Step 4: Run full isolated desktop/mobile E2E**

Run cd nuxt && /usr/bin/time -p yarn test:e2e. Expect zero failures/retries and only established skips. Record elapsed time against the 18.4-minute serial baseline.

- [ ] **Step 5: Confirm cleanup/integrity**

Check ports again, run git diff --check e83af20e..HEAD, and require a clean worktree.

### Task 6: Audit production readiness

**Files:**
- Create: docs/superpowers/2026-08-19-production-readiness-audit.md

- [ ] **Step 1: Inventory evidence**

Inspect .github/workflows/e2e.yml, nuxt/Dockerfile, nuxt/nuxt.config.ts, nuxt/README.md, scripts/deploy-stage.sh, jobs/lb-frontend-stage.nomad, both live Playwright preflight/spec files, docs/quality.md, staging/observability designs, and the stage handoff.

- [ ] **Step 2: Write a readiness table**

Classify Ready/Conditional/Blocked: application parity; tests/review; immutable image; production job/routing; production config/secrets; backend/content/data; security/robots/origins; observability/alerts; capacity/health; CI enforcement; production smoke; rollback; DNS/TLS/cutover; post-cutover monitoring. For every non-ready row, name the missing artifact or owner confirmation. State that the repository currently evidences staging, not a production job/cutover path.

- [ ] **Step 3: Write the ordered cutover path**

Sequence: decide hostname/topology/capacity/owners; create/review production jobspec/deploy path; modernize CI to Node 22 and enforce every gate; build/attest one SHA-pinned image; deploy without traffic; run production-origin smoke/accessibility/visual/security/Lighthouse/dependency checks; rehearse exact rollback; cut traffic with thresholds; monitor before completion.

- [ ] **Step 4: Add Task 5 evidence**

Record exact counts, workers/shards, elapsed time, skips/retries, and process cleanup.

- [ ] **Step 5: Self-review and commit**

    rg -n 'TBD|TODO|PLACEHOLDER|FIXME' docs/superpowers/2026-08-19-production-readiness-audit.md
    git diff --check -- docs/superpowers/2026-08-19-production-readiness-audit.md
    git add docs/superpowers/2026-08-19-production-readiness-audit.md
    git commit -m "docs: audit Nuxt production readiness"

### Task 7: Review and finish

**Files:** No intended changes unless review finds a scoped defect.

- [ ] **Step 1: Review every task commit**

Use spec compliance then quality review on each exact parent/head range. Fix all Critical/Important findings; record Minor findings.

- [ ] **Step 2: Run broad final review**

Review e83af20e..HEAD, emphasizing failure cleanup, port isolation, command compatibility, verification evidence, and audit conclusions.

- [ ] **Step 3: Run immutable checks**

    git status --short
    git diff --check e83af20e..HEAD
    git log --oneline --decorate e83af20e..HEAD

- [ ] **Step 4: Use finishing-a-development-branch**

Do not push or merge automatically. Offer integration choices only after the final tree is green and reviewed.
