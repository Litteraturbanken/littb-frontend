# Nuxt V2 Semantic Review Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and bootstrap a content-addressed semantic review ledger that gives every authored Nuxt V2 production unit a bounded independent review and makes later changes invalidate approval.

**Architecture:** Extend the existing TypeScript/Vue unit attribution into a complete production-source inventory, group owned units into deterministic packets, enrich them with dependency/test/risk context, and fingerprint their semantic neighborhood. A separate fail-closed ledger validates structured read-only reviewer evidence; the authoritative quality task blocks on missing, stale, oversized, or unresolved packets after the initial retrospective review is complete.

**Tech Stack:** Node.js 22, TypeScript compiler API, `@vue/compiler-sfc`, dependency-cruiser JSON, Vitest, Invoke, Codex CLI read-only structured review, Nuxt 4, Vue 3.

## Global Constraints

- Scan authored production code under `nuxt/app`, `nuxt/server`, and `nuxt/shared`.
- Exclude generated OpenAPI clients, tests, fixtures, build output, browser artifacts, and vendored code.
- Every discovered production unit has exactly one owner packet.
- Target 200–400 nonblank production lines per packet; block unwaived packets above 450 lines.
- Normal checks never rewrite the checked-in ledger or review evidence.
- A changed implementation, ownership graph, public contract, or dependency neighborhood invalidates approval.
- The implementation agent cannot approve its own packet; bootstrap reviews run through a separate read-only model process.
- Never accept unresolved Important or Critical findings.
- Do not rewrite migration history, weaken existing gates, add per-file analyzer suppressions, or change product behavior or visuals without a focused failing test and authority.
- Generated reports use repository-relative paths, deterministic sorting, no timestamps, and final newlines.

---

### Task 1: Discover every authored production source and unit

**Files:**
- Create: `nuxt/scripts/semantic-review/source-inventory.mjs`
- Create: `nuxt/test/unit/semantic-review-source-inventory.spec.ts`
- Modify: `nuxt/scripts/maintainability/unit-attribution.mjs`
- Modify: `nuxt/test/unit/maintainability-unit-attribution.spec.ts`

**Interfaces:**
- Consumes: `listSourceUnits({ source, relativePath })` from the maintainability subsystem.
- Produces: `discoverAuthoredSources(root): SourceRecord[]`, `inventorySource(record): InventoriedSource`, and `canonicalUnitSource(source, unit): string`.
- `InventoriedSource` contains `path`, `kind`, `source`, `lineCount`, `units`, `imports`, and `exports`.

- [ ] **Step 1: Write source-discovery exclusion tests**

Create a temporary tree containing `app/pages/index.vue`, `server/api/books.get.ts`, `shared/types.ts`, `app/lib/api/generated/lbapi.ts`, `app/test/helper.ts`, and `app/fixtures/page.ts`. Assert only the first three paths are returned, sorted lexically and relative to the Nuxt root.

```ts
expect(discoverAuthoredSources(root).map(item => item.path)).toEqual([
  "app/pages/index.vue",
  "server/api/books.get.ts",
  "shared/types.ts"
])
```

- [ ] **Step 2: Write exhaustive unit and canonical-source tests**

Assert that a Vue component owns a component fallback in addition to its named script units, that exported functions are marked exported, and that moving an unchanged function down by blank lines leaves `canonicalUnitSource` unchanged.

```ts
expect(inventory.units.map(unit => unit.id)).toContain("app/pages/index.vue::component::index")
expect(inventory.units.find(unit => unit.name === "loadBooks")?.exported).toBe(true)
expect(canonicalUnitSource(moved, movedUnit)).toBe(canonicalUnitSource(original, originalUnit))
```

- [ ] **Step 3: Run focused tests to verify RED**

Run:

```bash
cd nuxt
yarn vitest run test/unit/semantic-review-source-inventory.spec.ts test/unit/maintainability-unit-attribution.spec.ts
```

Expected: FAIL because `source-inventory.mjs` and component fallback enumeration are absent.

- [ ] **Step 4: Implement fail-closed discovery and canonical extraction**

Use `readdirSync(..., { withFileTypes: true })` recursively, accept only `.vue`, `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`, and apply the same authored-path policy as `run-maintainability.mjs`. Parse Vue blocks with `@vue/compiler-sfc` and scripts with the TypeScript compiler API. Extend `listSourceUnits` with `{ includeFallback: true }`, preserving its existing default behavior for maintainability attribution.

Canonical unit source must print the selected AST node with `ts.createPrinter({ removeComments: false })`, normalize line endings, and omit leading location whitespace. Vue component fallback canonical source is the complete normalized SFC.

- [ ] **Step 5: Run focused tests to verify GREEN**

Run the Step 3 command. Expected: all tests pass without warnings.

- [ ] **Step 6: Commit**

```bash
git add nuxt/scripts/semantic-review/source-inventory.mjs nuxt/test/unit/semantic-review-source-inventory.spec.ts nuxt/scripts/maintainability/unit-attribution.mjs nuxt/test/unit/maintainability-unit-attribution.spec.ts
git commit -m "feat(nuxt): inventory semantic review units"
```

---

### Task 2: Assign each unit to one bounded semantic packet

**Files:**
- Create: `nuxt/scripts/semantic-review/packet-planner.mjs`
- Create: `nuxt/test/unit/semantic-review-packet-planner.spec.ts`

**Interfaces:**
- Consumes: `InventoriedSource[]` from Task 1.
- Produces: `planReviewPackets(sources, options?): ReviewPacketPlan[]` and `validatePacketCoverage(sources, packets): void`.
- `ReviewPacketPlan` contains `id`, `rootUnitIds`, `ownedUnitIds`, `paths`, `productionLines`, `oversized`, and `waiver`.

- [ ] **Step 1: Write ownership tests for pages, handlers, exports, and nested helpers**

Use fixtures with a Vue page containing top-level helpers, a `defineEventHandler` server route, an exported library operation with nested callbacks, and a module with no named units. Assert every unit ID appears once across `ownedUnitIds`, nested helpers remain with their nearest top-level owner, and component/template fallback belongs to the component packet.

```ts
const owners = packets.flatMap(packet => packet.ownedUnitIds)
expect(owners.toSorted()).toEqual(allUnitIds.toSorted())
expect(new Set(owners).size).toBe(owners.length)
expect(() => validatePacketCoverage(sources, packets)).not.toThrow()
```

- [ ] **Step 2: Write boundary and oversize tests**

Assert two unrelated exported operations become separate packets, coherent private helpers stay attached, packets split before exceeding 450 lines where named roots permit it, and an indivisible 451-line root is marked `oversized: true` rather than silently accepted.

- [ ] **Step 3: Run the planner test to verify RED**

Run: `cd nuxt && yarn vitest run test/unit/semantic-review-packet-planner.spec.ts`

Expected: FAIL because the planner does not exist.

- [ ] **Step 4: Implement deterministic ownership and validation**

Use these root priorities: Vue component fallback; server handler; exported top-level declaration; top-level declaration; module fallback. A named unit is nested when its qualified name begins with the root name plus `.` and its source range is contained by the root. Build stable packet IDs with `` `${path}::packet::${rootName}` ``; component packets use `` `${path}::packet::component` ``.

Count the union of nonblank owned source lines, not repeated contextual lines. Sort packet roots by path and source order, then greedily combine adjacent private roots only while the result remains at or below 400 lines. Never combine unrelated exported roots. Throw named errors for missing owners, duplicate owners, unknown units, and empty packets.

- [ ] **Step 5: Run the planner test to verify GREEN**

Run the Step 3 command. Expected: all planner tests pass.

- [ ] **Step 6: Commit**

```bash
git add nuxt/scripts/semantic-review/packet-planner.mjs nuxt/test/unit/semantic-review-packet-planner.spec.ts
git commit -m "feat(nuxt): plan bounded semantic review packets"
```

---

### Task 3: Attach dependencies, callers, tests, types, and risk

**Files:**
- Create: `nuxt/scripts/semantic-review/context.mjs`
- Create: `nuxt/test/unit/semantic-review-context.spec.ts`

**Interfaces:**
- Consumes: `InventoriedSource[]`, `ReviewPacketPlan[]`, and optional current maintainability report JSON.
- Produces: `enrichReviewPackets({ root, sources, packets, maintainability }): ReviewPacket[]`.
- `ReviewPacket` adds `imports`, `callers`, `typeBoundaries`, `tests`, `riskFlags`, `riskScore`, and `maintainabilityFindings`.

- [ ] **Step 1: Write deterministic dependency and test-context tests**

Create fixtures where a page imports an API client and helper, another component imports the page helper, and unit/SSR tests import or name the production module. Assert direct imports and callers are repository-relative, generated API symbols appear under `typeBoundaries` but generated files never become owned units, and test candidates are sorted without becoming production coverage.

```ts
expect(packet.imports).toEqual(["app/lib/api/client.ts", "app/lib/books.ts"])
expect(packet.callers).toEqual(["app/components/BookLink.vue"])
expect(packet.tests).toEqual(["test/ssr/books.spec.ts", "test/unit/books.spec.ts"])
```

- [ ] **Step 2: Write risk classification tests**

Exercise exact flags for `api-boundary`, `route`, `ssr-state`, `raw-html`, `sanitization`, `storage`, `concurrency`, `accessibility`, `untested`, `maintainability-finding`, and `oversized`. Assert the score is a pure sum of checked-in weights and ties sort by packet ID.

- [ ] **Step 3: Run the context test to verify RED**

Run: `cd nuxt && yarn vitest run test/unit/semantic-review-context.spec.ts`

Expected: FAIL because `context.mjs` is missing.

- [ ] **Step 4: Implement context without semantic guesses**

Resolve only static relative imports and configured Nuxt aliases (`~/`, `@/`, `~~/`, `@@/`) against discovered sources. Build callers by reversing those edges. Discover test candidates from static imports first, then exact basename and route-segment matches under `nuxt/test`; label heuristic matches separately. Detect flags from parsed syntax and path conventions, not raw substring comments. Merge maintainability findings by owned unit ID.

Use fixed weights:

```js
export const riskWeights = Object.freeze({
  "api-boundary": 8,
  route: 8,
  "raw-html": 8,
  sanitization: 8,
  concurrency: 6,
  "ssr-state": 6,
  storage: 5,
  accessibility: 4,
  untested: 4,
  "maintainability-finding": 4,
  oversized: 10
})
```

- [ ] **Step 5: Run the context test to verify GREEN**

Run the Step 3 command. Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add nuxt/scripts/semantic-review/context.mjs nuxt/test/unit/semantic-review-context.spec.ts
git commit -m "feat(nuxt): enrich semantic review context"
```

---

### Task 4: Fingerprint and render complete review packets

**Files:**
- Create: `nuxt/scripts/semantic-review/packets.mjs`
- Create: `nuxt/test/unit/semantic-review-packets.spec.ts`
- Create: `nuxt/quality/semantic-review-contract.md`

**Interfaces:**
- Consumes: enriched `ReviewPacket[]` from Task 3.
- Produces: `fingerprintPacket(packet, sources): string`, `renderPacketIndex(packets): string`, `renderPacketJson(packet): string`, and `renderPacketMarkdown(packet): string`.

- [ ] **Step 1: Write fingerprint invalidation tests**

Assert fingerprints remain equal after line movement and absolute-root changes, but differ after an owned token, ownership edge, exported signature, direct import, or direct caller changes. Assert changing only an attached test body does not change the production fingerprint, while changing the test path appears in the rendered context.

- [ ] **Step 2: Write canonical rendering tests**

Assert shuffled input renders byte-identically; JSON contains no absolute path, timestamp, or copied full source; Markdown contains packet roots, line spans, context, risk, and the review contract path; and every artifact ends with one newline.

- [ ] **Step 3: Run packet tests to verify RED**

Run: `cd nuxt && yarn vitest run test/unit/semantic-review-packets.spec.ts`

Expected: FAIL because packet fingerprints and renderers do not exist.

- [ ] **Step 4: Implement SHA-256 manifests and the review contract**

Hash canonical JSON containing sorted owned `{ id, canonicalSource }`, sorted ownership pairs, exported signatures, imports, callers, and type-boundary identities. Render source locations rather than source bodies. The contract requires reviewers to inspect current code, cite exact evidence, distinguish defects/questions/false positives, and answer necessity, duplication, indirection, type integrity, concurrency, accessibility, security, and test-quality questions.

- [ ] **Step 5: Run packet tests to verify GREEN**

Run the Step 3 command. Expected: all packet tests pass.

- [ ] **Step 6: Commit**

```bash
git add nuxt/scripts/semantic-review/packets.mjs nuxt/test/unit/semantic-review-packets.spec.ts nuxt/quality/semantic-review-contract.md
git commit -m "feat(nuxt): render content-addressed review packets"
```

---

### Task 5: Validate independent evidence and the checked-in ledger

**Files:**
- Create: `nuxt/scripts/semantic-review/ledger.mjs`
- Create: `nuxt/test/unit/semantic-review-ledger.spec.ts`
- Create: `nuxt/quality/semantic-review-evidence.schema.json`
- Create: `nuxt/quality/semantic-review-ledger.json`
- Create: `nuxt/quality/semantic-reviews/.gitkeep`

**Interfaces:**
- Produces: `parseEvidence(value, packet): ReviewEvidence`, `validateLedger({ ledger, packets, evidenceByPath }): LedgerReport`, `serializeLedger(records): string`, and `recordEvidence({ ledger, packet, evidencePath, evidence }): string`.
- `LedgerReport` contains `approved`, `unreviewed`, `stale`, `changesRequested`, `oversized`, and `errors`.

- [ ] **Step 1: Write fail-closed schema tests**

Test unknown fields, missing fields, invalid paths, duplicate finding IDs, out-of-packet locations, nonexistent evidence, wrong evidence hash, author/reviewer equality, malformed verification commands, and an `approved` response containing an unresolved Important or Critical finding. Every case must throw a specific validation error.

- [ ] **Step 2: Write stale and canonical ledger tests**

Assert a valid approval passes only for the current packet fingerprint, a changed fingerprint reports `stale`, an oversized unwaived packet cannot be approved, and record/input insertion order produces byte-identical canonical JSON.

- [ ] **Step 3: Run ledger tests to verify RED**

Run: `cd nuxt && yarn vitest run test/unit/semantic-review-ledger.spec.ts`

Expected: FAIL because the ledger module is missing.

- [ ] **Step 4: Implement strict evidence and ledger validation**

Use an explicit object-key allowlist at every level; JSON Schema documents the same contract but runtime validation remains authoritative. Evidence has this shape:

```json
{
  "version": 1,
  "packetId": "app/pages/index.vue::packet::component",
  "packetFingerprint": "0000000000000000000000000000000000000000000000000000000000000000",
  "author": "implementation-agent",
  "reviewer": "independent-codex-review",
  "method": "codex-read-only",
  "verdict": "approved",
  "findings": [],
  "verification": ["yarn vitest run test/unit/example.spec.ts"]
}
```

Approved evidence cannot contain unresolved Important/Critical findings. `recordEvidence` computes the evidence SHA-256 and replaces exactly one packet record. Initialize the ledger as schema version 1 with an empty records array; incomplete coverage remains explicit until Task 8.

- [ ] **Step 5: Run ledger tests to verify GREEN**

Run the Step 3 command. Expected: all ledger tests pass.

- [ ] **Step 6: Commit**

```bash
git add nuxt/scripts/semantic-review/ledger.mjs nuxt/test/unit/semantic-review-ledger.spec.ts nuxt/quality/semantic-review-evidence.schema.json nuxt/quality/semantic-review-ledger.json nuxt/quality/semantic-reviews/.gitkeep
git commit -m "feat(nuxt): validate semantic review approvals"
```

---

### Task 6: Add the inventory, queue, packet, record, and check CLI

**Files:**
- Create: `nuxt/scripts/run-semantic-review.mjs`
- Create: `nuxt/test/unit/semantic-review-cli.spec.ts`
- Modify: `nuxt/package.json`
- Modify: `nuxt/scripts/run-maintainability.mjs`

**Interfaces:**
- Produces package commands `quality:review:inventory`, `quality:review:queue`, `quality:review:packet`, `quality:review:record`, and `quality:review:check`.
- Consumes `.quality/maintainability-review.json` when present; otherwise runs the maintainability collector through an exported `buildMaintainabilityReport()` without duplicating analyzer orchestration.

- [ ] **Step 1: Write CLI argument and side-effect tests**

Use a temporary Nuxt root and fixture source tree. Assert unknown flags fail, `--id` and `--evidence` require values, path traversal fails, inventory writes only `.quality/semantic-review`, queue is read-only, packet renders exactly one packet, record changes only the ledger, and check never writes.

- [ ] **Step 2: Write exit-code tests**

Assert inventory exits 0 for valid source, queue exits 1 while work remains and 0 when complete, record exits 2 for malformed evidence, and check exits 1 for missing/stale/changes-requested/oversized records but 0 for fully current approvals.

- [ ] **Step 3: Run CLI tests to verify RED**

Run: `cd nuxt && yarn vitest run test/unit/semantic-review-cli.spec.ts`

Expected: FAIL because the CLI and package scripts are absent.

- [ ] **Step 4: Refactor maintainability orchestration behind an exported function**

Move the current main-body collection into `buildMaintainabilityReport({ root, paths })` while preserving all existing CLI output, baseline behavior, and tests. Import that function from the semantic-review CLI only for inventory generation.

- [ ] **Step 5: Implement atomic CLI output and package scripts**

Add exact scripts:

```json
"quality:review:inventory": "node scripts/run-semantic-review.mjs inventory",
"quality:review:queue": "node scripts/run-semantic-review.mjs queue",
"quality:review:packet": "node scripts/run-semantic-review.mjs packet",
"quality:review:record": "node scripts/run-semantic-review.mjs record",
"quality:review:check": "node scripts/run-semantic-review.mjs check"
```

Write reports through a temporary file plus rename. Keep the packet index under `.quality/semantic-review/index.json`; name individual JSON and Markdown artifacts with the lowercase SHA-256 of `packet.id` under `.quality/semantic-review/packets/`.

- [ ] **Step 6: Run CLI and existing maintainability tests to verify GREEN**

Run:

```bash
cd nuxt
yarn vitest run test/unit/semantic-review-cli.spec.ts test/unit/maintainability-cli.spec.ts test/unit/maintainability-report.spec.ts
```

Expected: all tests pass and existing maintainability behavior is unchanged.

- [ ] **Step 7: Commit**

```bash
git add nuxt/scripts/run-semantic-review.mjs nuxt/test/unit/semantic-review-cli.spec.ts nuxt/package.json nuxt/scripts/run-maintainability.mjs
git commit -m "feat(nuxt): add semantic review workflow"
```

---

### Task 7: Protect and integrate the authoritative quality gate

**Files:**
- Modify: `nuxt/scripts/verify-architecture-policy.mjs`
- Modify: `nuxt/test/unit/architecture-policy.spec.ts`
- Modify: `test/test_tasks.py`
- Modify: `tasks.py`

**Interfaces:**
- Makes `yarn quality:review:check` an immutable package/policy contract.
- Adds semantic review after maintainability and before typecheck in `invoke quality.frontend` and `invoke quality.library`.

- [ ] **Step 1: Write package-policy mutation tests**

Add isolated package fixtures that remove, rename, redirect, or append bypass flags to each semantic-review script. Add source mutations introducing an inline semantic-review suppression marker and ledger paths outside `quality/semantic-reviews`; assert policy rejection.

- [ ] **Step 2: Write Invoke ordering tests**

Change the expected frontend command sequence to:

```py
[
    ["yarn", "policy:check"],
    ["yarn", "lint"],
    ["yarn", "quality:maintainability"],
    ["yarn", "quality:review:check"],
    ["yarn", "typecheck"],
    ["yarn", "test:unit"],
    ["yarn", "build"],
    ["yarn", "test:ssr"],
]
```

Assert Library quality also runs the review check immediately after maintainability.

- [ ] **Step 3: Run focused policy/task tests to verify RED**

Run:

```bash
cd nuxt && yarn vitest run test/unit/architecture-policy.spec.ts
cd .. && python -m pytest -q test/test_tasks.py
```

Expected: failures because the policy and Invoke tasks do not require the new gate.

- [ ] **Step 4: Implement semantic-review policy validation and task integration**

Require the exact package script values from Task 6, canonical ledger/evidence roots, and absence of suppression markers in authored production source. Insert `quality:review:check` in both Invoke tasks without changing unrelated command order.

- [ ] **Step 5: Run focused policy/task tests to verify GREEN**

Run the Step 3 commands. Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add nuxt/scripts/verify-architecture-policy.mjs nuxt/test/unit/architecture-policy.spec.ts test/test_tasks.py tasks.py
git commit -m "build: gate Nuxt quality on semantic review"
```

---

### Task 8: Run the complete retrospective independent review

**Files:**
- Create: `nuxt/scripts/run-independent-semantic-review.mjs`
- Create: `nuxt/test/unit/independent-semantic-review.spec.ts`
- Modify: `nuxt/quality/semantic-review-ledger.json`
- Create: validated evidence files under `nuxt/quality/semantic-reviews/*.json`
- Modify: production and test files only when a confirmed finding requires a repair.

**Interfaces:**
- Consumes generated packet JSON and `nuxt/quality/semantic-review-evidence.schema.json`.
- Produces one validated evidence file per current packet and a fully current ledger.

- [ ] **Step 1: Write reviewer-runner isolation tests**

Use a fixture command through `SEMANTIC_REVIEW_COMMAND` and assert the runner invokes one packet at a time, supplies the contract and packet paths, sets the repository root, requests the checked-in output schema, uses read-only sandboxing, rejects prose/malformed JSON, never writes production source, and resumes after already approved current packets.

- [ ] **Step 2: Run the runner test to verify RED**

Run: `cd nuxt && yarn vitest run test/unit/independent-semantic-review.spec.ts`

Expected: FAIL because the runner is absent.

- [ ] **Step 3: Implement the sequential read-only reviewer runner**

Default to this command shape, using equivalent argument-array values rather than invoking a shell:

```bash
repo_root="$(git rev-parse --show-toplevel)"
evidence_file="$(mktemp -t semantic-review.XXXXXX.json)"
codex exec --ephemeral --sandbox read-only --cd "$repo_root" \
  --output-schema nuxt/quality/semantic-review-evidence.schema.json \
  --output-last-message "$evidence_file" -
```

The stdin prompt names exactly one packet artifact and the review contract. After the process exits, validate the JSON against the current packet before atomically copying it into `quality/semantic-reviews/` and recording it. Stop on findings rather than automatically editing source.

- [ ] **Step 4: Run the runner test to verify GREEN**

Run the Step 2 command. Expected: all tests pass.

- [ ] **Step 5: Generate the real inventory and audit its coverage**

Run:

```bash
cd nuxt
yarn quality:maintainability
yarn quality:review:inventory
yarn quality:review:queue
```

Inspect the index totals. Assert the owned-unit count equals the discovered-unit count, duplicate ownership is zero, excluded paths are zero, and every oversized packet is explicitly listed.

- [ ] **Step 6: Review packets sequentially in risk order**

Run:

```bash
cd nuxt
node scripts/run-independent-semantic-review.mjs --author implementation-agent --reviewer independent-codex-review
```

For an approved packet, validate and record the evidence. For a question or false positive, require concrete evidence and a nonblocking disposition. For an Important/Critical finding, leave the packet changes-requested and execute Step 7 before continuing.

- [ ] **Step 7: Repair every confirmed blocking finding with TDD and a small commit**

For each changes-requested packet, first add the smallest focused test that demonstrates the stated consequence and run it to RED. Implement only the cited repair, run the focused test to GREEN plus lint/typecheck for the touched scope, and commit with the exact generic message `fix(nuxt): resolve semantic review finding` for behavioral repairs or `refactor(nuxt): resolve semantic review finding` for equivalent simplifications. Regenerate the packet, re-run the independent reviewer for its new fingerprint, and record approval only after the finding is resolved.

- [ ] **Step 8: Convert recurring findings into deterministic protection**

When two confirmed findings share the same syntactic or architectural cause, add a positive and nearby negative fixture to ESLint, ast-grep, dependency-cruiser, or architecture policy before proceeding. Run the new fixture RED, implement the narrow rule, run GREEN, and commit separately as `build: prevent repeated semantic review defect`.

- [ ] **Step 9: Reach a fully current ledger**

Run:

```bash
cd nuxt
yarn quality:review:inventory
yarn quality:review:check
yarn quality:review:queue
```

Expected: check exits 0; queue prints zero unreviewed, stale, changes-requested, or unwaived oversized packets.

- [ ] **Step 10: Commit the runner and completed review evidence**

```bash
git add nuxt/scripts/run-independent-semantic-review.mjs nuxt/test/unit/independent-semantic-review.spec.ts nuxt/quality/semantic-review-ledger.json nuxt/quality/semantic-reviews
git commit -m "chore(nuxt): record retrospective semantic review"
```

---

### Task 9: Verify the complete system and request final independent review

**Files:**
- Modify: `docs/superpowers/plans/2026-08-08-nuxt-semantic-review-ledger.md` only to mark executed checkboxes.
- Create: `.superpowers/sdd/2026-08-08-nuxt-semantic-review-ledger/verification-report.md` (ignored local evidence).

**Interfaces:**
- Produces fresh verification evidence and a final independent review of the complete implementation diff.

- [ ] **Step 1: Run focused semantic-review and policy suites**

```bash
cd nuxt
yarn vitest run \
  test/unit/maintainability-unit-attribution.spec.ts \
  test/unit/semantic-review-source-inventory.spec.ts \
  test/unit/semantic-review-packet-planner.spec.ts \
  test/unit/semantic-review-context.spec.ts \
  test/unit/semantic-review-packets.spec.ts \
  test/unit/semantic-review-ledger.spec.ts \
  test/unit/semantic-review-cli.spec.ts \
  test/unit/independent-semantic-review.spec.ts \
  test/unit/architecture-policy.spec.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run every deterministic frontend gate**

```bash
cd nuxt
yarn policy:check
yarn lint
yarn quality:maintainability
yarn quality:review:check
yarn typecheck
yarn test:unit
yarn test:ssr
yarn build
```

Expected: every command exits 0 with no warnings promoted or ignored.

- [ ] **Step 3: Run Invoke integration and relevant browser coverage**

```bash
invoke quality.frontend
cd nuxt
yarn playwright test --project=desktop-chromium --project=mobile-chromium \
  test/e2e/library.behavior.spec.ts \
  test/e2e/reader.behavior.spec.ts \
  test/e2e/text-search.behavior.spec.ts \
  test/e2e/editor.behavior.spec.ts
```

Expected: authoritative quality passes. Any browser failure must be reproduced in isolation and against the pre-goal commit before it can be documented as unrelated.

- [ ] **Step 4: Prove invalidation with a clean temporary mutation**

Copy one reviewed fixture/source to a temporary test tree, change one owned token, and run the ledger validator against the old approval. Record the expected stale result in the verification report; do not modify tracked production source for this proof.

- [ ] **Step 5: Run an independent final diff review**

Run a read-only independent review against `4a766634..HEAD` with instructions to inspect correctness, coverage gaps, bypasses, false approval paths, and unnecessary complexity. Resolve every Important/Critical finding with RED/GREEN evidence and rerun the affected gates.

- [ ] **Step 6: Audit repository state and write the report**

Run:

```bash
git diff --check
git status --short
git log --oneline 4a766634..HEAD
```

The report records exact command totals, independent review verdict, packet/unit/line coverage, fixes and regression rules, any base-proven unrelated failures, and the final clean or intentionally preserved status.

- [ ] **Step 7: Commit plan completion if checkbox changes are retained**

```bash
git add docs/superpowers/plans/2026-08-08-nuxt-semantic-review-ledger.md
git commit -m "docs: complete Nuxt semantic review rollout"
```
