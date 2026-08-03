# Complexity Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce accidental complexity in the Nuxt migration and FastAPI V2 boundary without changing observable behavior or weakening validation.

**Architecture:** Extract focused pure modules behind the current public pages and provider functions. Preserve page-local fetching, public API schemas, SSR behavior, security validation, and visual output while replacing brittle source-shape policy checks with semantic invariants.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, Playwright, Node TypeScript AST, FastAPI, Pydantic, Pytest, Ruff.

## Global Constraints

- Do not change routes, query semantics, API response schemas, browser history, or visual layout.
- Keep single-page model fetching inside `script setup`; do not introduce generic composables for one consumer.
- Preserve runtime validation and sanitization at every untrusted-data boundary.
- Use generated OpenAPI types as the frontend contract and do not hand-edit generated files.
- Add a focused failing test before each production extraction and run the relevant regression suite after it passes.

---

### Task 1: Semantic architecture-policy invariants

**Files:**
- Modify: `nuxt/scripts/verify-architecture-policy.mjs`
- Modify: `nuxt/test/unit/architecture-policy.spec.ts`

**Interfaces:**
- Consumes: the existing verifier CLI and synthetic source-tree test harness.
- Produces: semantic capability-module and ESLint-config audits with unchanged CLI exit behavior.

- [ ] Add tests proving harmless formatting, declaration ordering, and unrelated strict ESLint rules are accepted.
- [ ] Run the focused Vitest file and confirm the new tests fail because whole-file fingerprints reject them.
- [ ] Replace exact capability AST equality with explicit issuer/helper/export invariants.
- [ ] Replace exact ESLint file equality with AST checks for the required ignores and forbidden policy overrides.
- [ ] Run architecture-policy tests and `npm run policy:check`.
- [ ] Commit the task.

### Task 2: Reader source-information modules

**Files:**
- Create: `nuxt/server/utils/reader-source-info-validation.ts`
- Create: `nuxt/server/utils/reader-source-info-sanitizer.ts`
- Create: `nuxt/server/utils/reader-source-info-definitions.ts`
- Create: `nuxt/server/utils/reader-source-info-projection.ts`
- Modify: `nuxt/server/utils/reader-source-info.ts`
- Modify: focused reader source-information unit tests under `nuxt/test/unit/`

**Interfaces:**
- Consumes: generated `WorkSourceInfoResponse`, existing static JSON definitions, and existing facade exports.
- Produces: focused validators/sanitizers/projectors re-exported or orchestrated by the existing facade.

- [ ] Add direct contract tests for the proposed validation and sanitization module exports.
- [ ] Run them and confirm import/export failures before extraction.
- [ ] Move validation without changing limits, exact-key rules, URL checks, or error mapping.
- [ ] Move sanitization without changing the allowlists or output.
- [ ] Move static-definition validation/cache loading and presentation projection.
- [ ] Run source-information unit, SSR, typecheck, lint, and policy checks.
- [ ] Commit the task.

### Task 3: Library page pure orchestration

**Files:**
- Create: `nuxt/app/lib/library/navigation.ts`
- Create: `nuxt/app/lib/library/page-results.ts`
- Create: `nuxt/app/directives/library-tooltip.ts`
- Modify: `nuxt/app/pages/bibliotek.vue`
- Add or modify: focused Library unit and behavior tests.

**Interfaces:**
- Consumes: current Library route/query types and discriminated `LibraryPageData` values.
- Produces: `parseLibraryRouteState`, mode-specific sort parsing, and typed page-result application helpers.

- [ ] Add unit tests for every route mode, sort fallback, page bound, and discriminated result target.
- [ ] Confirm the tests fail before the new modules exist.
- [ ] Extract route parsing and replace nested ternaries with explicit branches/tables.
- [ ] Extract result application while leaving requests and refs in `script setup`.
- [ ] Move the tooltip directive without altering timing or DOM output.
- [ ] Run Library unit, SSR, and browser behavior suites plus lint/typecheck.
- [ ] Commit the task.

### Task 4: Backend Library provider modules

**Files:**
- Create focused modules under `/Users/johan/dev/lb-backend/lbapi/v2/library/` for shared provider access, predicates, browsing, downloads, and counts.
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/library_provider.py`
- Modify: focused tests under `/Users/johan/dev/lb-backend/test_lbapi/v2/`.

**Interfaces:**
- Consumes: current request/response models and legacy provider protocol.
- Produces: the same public `search_library*`, `count_library`, `compile_library_predicate`, and `load_library_options` signatures through a compatibility facade.

- [ ] Add focused module-contract tests using representative public requests and hostile legacy responses.
- [ ] Confirm the tests fail before the focused modules exist.
- [ ] Move shared provider and predicate code first, retaining facade re-exports.
- [ ] Move browse, download, and count implementations by mode without changing response models.
- [ ] Run provider/API tests, Ruff, and backend type checks after each move.
- [ ] Commit the task in the backend repository without staging unrelated existing files.

### Task 5: Author-work normalization phases

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/author_works.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_author_work_normalization.py`

**Interfaces:**
- Consumes: legacy provider rows and current `kind`/`provider_ordinal` arguments.
- Produces: small internal typed identity, representation, and action phases feeding unchanged `NormalizedAuthorWork` output.

- [ ] Add focused tests for phase contracts covering inconsistent identity, media grouping, download precedence, and title URL selection.
- [ ] Confirm the new phase API tests fail before extraction.
- [ ] Extract immutable intermediate records and pure phase functions.
- [ ] Keep one public malformed-response exception boundary in `normalize_author_work_group`.
- [ ] Run author-work and author endpoint tests plus Ruff/type checks.
- [ ] Commit the backend task without staging unrelated files.

### Task 6: Shared reader/editor work-search helpers

**Files:**
- Create: `nuxt/app/lib/reader/work-search.ts`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue`
- Add: focused unit tests for shared helpers.

**Interfaces:**
- Consumes: generated work-search responses and page-specific route context.
- Produces: shared hit validation, index selection, keyboard activation decisions, and navigation query builders.

- [ ] Add tests for the shared pure API and confirm it is initially missing.
- [ ] Extract identical validation/navigation functions without moving fetch ownership.
- [ ] Update both pages and delete duplicated implementations.
- [ ] Run reader/editor unit, SSR, and browser behavior suites plus lint/typecheck.
- [ ] Commit the task.

### Task 7: Text-search request ownership

**Files:**
- Create: `nuxt/app/lib/text-search-request-owner.ts`
- Modify: `nuxt/app/pages/sök.vue`
- Add: `nuxt/test/unit/text-search-request-owner.spec.ts`
- Modify: text-search behavior tests as needed for observable stale-response behavior.

**Interfaces:**
- Consumes: request identity strings and async loaders supplied by `sök.vue`.
- Produces: a page-local ownership object that aborts superseded work and accepts only the latest matching response.

- [ ] Add unit tests for supersession, abort, stale completion, retry after failure, and independent request channels.
- [ ] Confirm they fail before the helper exists.
- [ ] Implement the smallest typed ownership primitive.
- [ ] Replace repeated version/controller bookkeeping in count, options, title-options, and more-hits flows while leaving fetch calls in `sök.vue`.
- [ ] Run text-search unit, SSR, and browser behavior suites plus lint/typecheck.
- [ ] Commit the task.

### Task 8: Full verification and complexity review

**Files:**
- Modify documentation only if the final module map differs from this plan.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: fresh verification evidence and a before/after complexity report.

- [ ] Run Nuxt policy, lint, typecheck, unit, SSR, and relevant Playwright suites.
- [ ] Run backend Ruff, type checks, V2 tests, and OpenAPI/client consistency checks.
- [ ] Re-run the frontend and backend complexity scans and compare the original hotspots.
- [ ] Inspect both repository diffs for behavior or generated-file drift.
- [ ] Report any remaining failures explicitly; do not claim completion unless every required check is green.
