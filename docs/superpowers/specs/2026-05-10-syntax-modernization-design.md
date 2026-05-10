# Syntax Modernization Design

## Purpose

The `Syntax` branch should become the branch that turns the current AngularJS application into a Vue-ready AngularJS application. The goal is not to replace AngularJS with Vue in this branch. The goal is to make the codebase easier to navigate, easier to test, and easier to migrate one feature at a time later.

The approved direction is to optimize for both a reviewable landing branch and a Vue migration runway. The branch should first become clean and credible enough to review, then continue modernizing syntax and module boundaries without changing the runtime framework.

## Current Context

The branch already contains major modernization work:

- Vite has been introduced as the main development and build path.
- `app/main.js` now acts as an ES module boot file that loads legacy globals before importing AngularJS registration modules.
- Several page controllers have been extracted into AngularJS components under `app/scripts/components/`.
- The backend service has started moving out of `services.js` into `app/scripts/services/backend.js`.
- Playwright is the active E2E runner.

The current verified baseline is:

- `npm run build` passes after dependencies are installed with `yarn install --frozen-lockfile`.
- `npm test -- --reporter=list` passes 23 of 24 tests when Playwright starts the Vite dev server.
- The known failing test is `Reader > should show SO modal`.

There are also branch-quality issues that should be handled before further refactoring:

- The branch has committed generated Playwright artifacts under `playwright-report/` and `test-results/`.
- Local Playwright helper logs exist under `.playwright-cli/` and `.playwright-mcp/`.
- `TESTING.md` refers to `npm run test:e2e`, but `package.json` currently exposes `npm test`.
- `master` has newer commits not yet reconciled into `Syntax`.
- Three large SLA collation XML assets are no longer in use and should be removed from the branch.

## Architecture

The target architecture is:

> AngularJS as adapter, application logic as modules.

AngularJS remains the runtime for now. AngularJS registration files should increasingly become thin adapters that wire dependencies into components, directives, and factories. Business logic, data shaping, query construction, URL construction, parsing, sorting, filtering, and state transitions should move into importable ES modules.

For new or touched feature areas, use this shape where practical:

- `app/scripts/features/<feature>/model.js` for pure data shaping and derived values.
- `app/scripts/features/<feature>/state.js` for framework-neutral state containers or factories.
- `app/scripts/features/<feature>/angular.js` for AngularJS registration and dependency injection wiring.
- `app/scripts/features/<feature>/template.html` for the feature-owned template, using `$ctrl` bindings.

Existing component directories under `app/scripts/components/` can continue to exist. The feature directory pattern should be introduced incrementally where it reduces coupling or makes extracted logic reusable outside AngularJS.

## Milestones

### Milestone 0: Branch Hygiene

Make `Syntax` reviewable before adding more behavior changes.

Tasks:

- Remove committed generated test artifacts from `playwright-report/` and `test-results/`.
- Add ignore rules for generated Playwright reports, test results, `.playwright-cli/`, and `.playwright-mcp/`.
- Remove the unused SLA collation XML assets:
  `app/public/assets/views/sla/kollationering-gbs1.xml`,
  `app/public/assets/views/sla/kollationering-gbs2.xml`, and
  `app/public/assets/views/sla/kollationering-ol.xml`.
- Reconcile `Syntax` with the two newer `master` commits.
- Fix testing documentation so commands match `package.json`.
- Document the valid test baseline and the known SO modal failure.
- Confirm the app is served by Vite during Playwright runs, not a stale webpack dev server on port 9000.

Exit criteria:

- `git status` contains no generated or local Playwright noise.
- The removed SLA collation XML filenames have no remaining code or content references.
- `npm run build` passes.
- `npm test -- --reporter=list` reports the expected baseline of 23 passing tests and the SO modal failure, unless that failure is explicitly fixed or quarantined.

### Milestone 1: Module Boundary Conventions

Create clear rules for how modernization work should be shaped.

Tasks:

- Add a short architecture note for pure module plus AngularJS adapter boundaries.
- Pick one small existing feature or directive cluster as the reference example.
- Extract a first pure module with focused unit coverage.
- Keep AngularJS registration in a thin adapter file.

Exit criteria:

- Future work has a concrete local example to copy.
- Extracted logic is importable without `angular.module("littbApp")`.
- Tests cover the pure module without booting AngularJS.

### Milestone 2: Directive Island Reduction

Reduce the long-term cost of `app/scripts/directives.js`.

Tasks:

- Group directives by purpose: metadata/title directives, DOM measurement directives, image/reader directives, search/library directives, and legacy leftovers.
- Convert simple metadata or display directives into components or plain helper modules where the behavior is not inherently directive-specific.
- Extract reusable logic from complex DOM directives into pure functions.
- Leave genuinely DOM-focused directives in AngularJS, but make them smaller and easier to reason about.

Exit criteria:

- `directives.js` is organized by explicit clusters or split into smaller registration modules.
- New logic added during the work is covered by unit tests where practical.
- No new global jQuery selectors or `$rootScope` state are introduced.

### Milestone 3: Service Layer Split

Continue the separation started by `app/scripts/services/backend.js`.

Tasks:

- Extract query builders, URL builders, parsing helpers, and normalization logic from `services.js` into ES modules.
- Keep AngularJS factories as compatibility adapters around those modules.
- Clarify state-service contracts for search, library, reader, and UI state.
- Remove or narrow compatibility bridges only when consumers have been migrated.

Exit criteria:

- Core data logic can be imported and tested without AngularJS.
- Angular factories mostly wire `$http`, `$q`, `$timeout`, and other runtime dependencies into pure module factories.
- State transitions are explicit method calls rather than direct `$rootScope` mutation.

### Milestone 4: Feature Controller Slimming

Make the main feature controllers ready for future framework replacement.

Targets:

- `app/scripts/library_controller.js`
- `app/scripts/search_controller.js`
- `app/scripts/components/reader/reading_controller.js`

Tasks:

- Move business logic and state transitions into feature modules.
- Keep controllers focused on template bindings, lifecycle hooks, dependency wiring, and event handling.
- Preserve the current AngularJS templates and routing while reducing controller-local hidden state.

Exit criteria:

- Each target feature has framework-neutral model or state modules.
- Controllers are smaller and mostly adapter-shaped.
- Future Vue components could reuse the extracted non-template logic.

### Milestone 5: Vue Readiness Gate

Define when it is reasonable to introduce the first Vue island.

Vue should not be introduced until all of these are true:

- `Syntax` is clean, rebased or merged with current `master`, and reviewable.
- The build is green.
- The E2E baseline is stable, with the SO modal failure either fixed, quarantined, or clearly documented as external.
- At least one feature has pure model/state modules with tests.
- A future Vue component can consume those modules without `$scope`, `$rootScope`, `angular.module("littbApp")`, jQuery globals, or template-side hidden globals.

When those conditions are met, a separate design should choose the first Vue island. Good candidates should be leaf components with small state surfaces and low routing complexity.

## Migration Rules

- Keep AngularJS as the runtime until a separate Vue island design is approved.
- Do not do broad rewrites without an explicit seam and verification plan.
- Prefer pure exported functions and classes over controller-local helpers.
- Prefer dependency injection at adapter boundaries over module-level reads from globals.
- Do not add new jQuery usage.
- Do not add new `$rootScope` state.
- Use `$scope` only for AngularJS lifecycle mechanics that still require it.
- Keep generated reports, local browser logs, and transient test output out of git.
- Leave the app buildable and testable at the end of each milestone.

## Data Flow

Feature data should move through explicit layers:

1. Runtime adapter receives route params, events, and AngularJS dependencies.
2. Pure modules build queries, URLs, derived state, and normalized data.
3. State modules expose explicit reads and writes.
4. AngularJS controllers bind state and actions to `$ctrl`.
5. Templates read from `$ctrl` and call explicit controller methods.

This makes the dependency direction clear. AngularJS may depend on pure modules. Pure modules must not depend on AngularJS.

## Error Handling

Modernization should preserve existing user-visible behavior unless a change is explicitly planned.

For extracted modules:

- Validate inputs at module boundaries when invalid input would otherwise fail deep inside UI code.
- Return structured results or throw clear errors for programmer mistakes.
- Keep HTTP and AngularJS promise behavior inside adapter layers until the surrounding code is ready to change.
- Do not hide external service failures behind broad catch blocks that make tests pass without preserving behavior.

For the known SO modal failure:

- Treat it as a tracked baseline issue until deliberately fixed or quarantined.
- Do not use it as evidence that unrelated modernization failed.
- Do not let it mask new reader regressions.

## Testing Strategy

Use two levels of verification:

- Unit tests for pure modules created by extraction.
- Playwright E2E tests for feature behavior through the AngularJS adapter.

Commands:

```bash
yarn install --frozen-lockfile
npm run build
npm test -- --reporter=list
```

Expected baseline before fixing the SO modal test:

- Build passes.
- Playwright reports 23 passing tests and one failing SO modal test.

After any behavior-affecting milestone, run the full Playwright suite. For small pure-module extractions, run the relevant unit tests first, then run the E2E suite when the adapter behavior is touched.

## Non-Goals

- Do not introduce Vue in this branch.
- Do not replace AngularJS routing in this branch.
- Do not convert the whole app to TypeScript in one pass.
- Do not rewrite all directives or controllers at once.
- Do not remove compatibility bridges until all known consumers have moved.
- Do not treat generated artifact cleanup as a behavior change.

## Risks

- Large branch diffs can make review difficult. Milestone 0 exists to reduce that risk before more refactoring.
- Vite and webpack can both serve the app on port 9000 in local development. Test runs must verify that Playwright is exercising Vite.
- Some AngularJS lifecycle use of `$scope` is still necessary. The goal is to isolate it, not pretend it can disappear immediately.
- The unused SLA collation XML assets make the branch look larger than the syntax work alone until they are removed.
- Extracting logic without tests can create false confidence. Pure-module extraction should usually come with unit coverage.

## Success Criteria

This design is successful when:

- `Syntax` has a clear path from current modernization work to a reviewable branch.
- Future syntax modernization work has an explicit module-plus-adapter pattern.
- The remaining AngularJS islands have an ordered reduction plan.
- The first Vue island is intentionally deferred until measurable readiness gates are met.
- Each milestone has concrete verification commands and exit criteria.
