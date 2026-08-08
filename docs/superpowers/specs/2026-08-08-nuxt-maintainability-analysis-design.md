# Nuxt Maintainability Analysis Design

## Purpose

Prevent behaviorally correct but review-unacceptable AI-authored code from entering the Nuxt application. The gate must catch high-confidence generic smells automatically, encode recurring Litteraturbanken-specific review rules, expose dead and architecturally misplaced code, and avoid making the existing migration debt an excuse to weaken checks.

The generated OpenAPI client remains the only generated-code exemption. All other TypeScript, JavaScript, and Vue source is treated as authored production code regardless of whether a human or an AI produced it.

## Scope

The first installation covers the `nuxt/` project and uses four complementary, locally reproducible analyzers:

- `eslint-plugin-sonarjs` for control-flow and maintainability findings such as duplicated branches, identical expressions, and excessive cognitive complexity.
- Knip for unused files, dependencies, exports, and exported types.
- dependency-cruiser for cycles and forbidden module-layer relationships.
- ast-grep for small, tested Litteraturbanken-specific structural rules that are clearer as declarative syntax patterns than as JavaScript AST programs.

CodeQL and Semgrep cross-file analysis are not part of this installation. They remain candidates for a later security/data-flow phase because their hosting or licensing choices are independent of the local maintainability gate.

## Alternatives Considered

### Recommended: complementary analyzers behind one gate

Use each tool only for the problem it models best and normalize its findings through one checked-in baseline. This provides broad coverage while keeping configuration and output reviewable.

### SonarJS only

This has the lowest operational cost, but it cannot find Nuxt-specific dead surface area, enforce dependency direction, or encode project-specific structural review rules. It would not address duplicate domain ownership adequately.

### CodeQL or Semgrep as the primary engine

These provide stronger data-flow capabilities, but introduce more complex query authoring and deployment. They are valuable for security work but disproportionate for duplicated branches, orphaned exports, and local architectural drift.

## Gate Architecture

`yarn quality:maintainability` is the single local entry point. It invokes a small Node orchestrator that runs the configured analyzers, converts their diagnostics into stable fingerprints, compares them with `quality/maintainability-baseline.json`, and exits nonzero when it finds a diagnostic not present in the baseline.

Fingerprints exclude line numbers so unrelated edits do not turn known debt into false new failures. They retain the tool, rule, file, and semantic identity available from the analyzer, such as an export name or dependency edge. The command prints new, existing, and resolved findings separately.

`yarn quality:maintainability:update-baseline` explicitly regenerates the baseline. Normal checks never modify it. Baseline changes are ordinary reviewed source changes; inline suppression comments and weakened severities remain forbidden by the existing architecture policy.

The baseline is a migration mechanism, not an acceptance list:

- New high-confidence findings fail immediately.
- Existing findings remain visible.
- Resolved fingerprints are reported and must be removed by an explicit baseline update.
- SonarJS rules that can be made clean without broad refactoring run directly as ESLint errors rather than being baselined.

## Automatic Offender Discovery

No configuration contains a hand-maintained list of suspicious source files or functions. Every maintainability run scans the complete authored Nuxt source tree and builds a suspect inventory from analyzer diagnostics and advisory complexity thresholds.

The orchestrator attributes each finding to the smallest enclosing named code unit: a function, method, Vue component, server handler, or module when no smaller named unit exists. Stable unit identity is based on path, syntax kind, and exported or local name rather than line number. Resolving a diagnostic location to its containing unit is attribution only; SonarJS and the other analyzers remain responsible for deciding whether the code is problematic.

An advisory SonarJS discovery pass uses stricter complexity and size thresholds than the blocking lint configuration. Its output does not create ESLint warnings. Instead, it feeds the baseline-backed inventory together with Knip, dependency-cruiser, and ast-grep diagnostics. Units are ranked by severity, number of independent rules, number of analyzers agreeing, and excess over the configured complexity or size threshold.

Each run prints a ranked review queue and writes a machine-readable report beneath the ignored `.quality/` directory. New code units enter the queue automatically when they cross a threshold or receive a finding; resolved units disappear after the baseline is explicitly refreshed. A developer may supply a path filter for investigation, but path filters are never stored in the canonical configuration and never determine which source is scanned in CI.

The system therefore requires human judgment only for promoting a recurring review observation into a general rule or adjusting a reviewed threshold. It never requires the user to nominate each offending file or function.

## Analyzer Responsibilities

### SonarJS

SonarJS is integrated into the canonical Nuxt ESLint configuration. The initial blocking set favors deterministic review findings: all duplicated branches, duplicated branches, identical expressions/functions, redundant boolean literals, collection size comparisons, and a reviewed cognitive-complexity ceiling. Subjective or high-volume SonarJS rules are not enabled in this phase; the repository retains `--max-warnings 0` rather than accumulating advisory warnings.

The architecture policy is extended so the reviewed SonarJS import, plugin registration, and error-only rules are required and cannot be disabled or downgraded.

### Knip

Knip analyzes Nuxt entry points and conventions through an explicit checked-in configuration. Generated API files, build output, visual artifacts, and fixtures are excluded. Unused source files, production dependencies, exports, and exported types are fingerprinted. Nuxt convention entry points and legitimate framework auto-imports are configured rather than suppressed case by case.

### dependency-cruiser

dependency-cruiser checks Vue and TypeScript module relationships. The initial rules reject cycles, production imports from tests or fixtures, client application code importing server implementation code, and lower-level library modules importing pages or components. Framework entry-point discovery is left to Knip; dependency-cruiser does not enforce orphan rules that conflict with Nuxt file conventions.

### ast-grep

ast-grep owns only repository-specific syntax rules with positive and negative fixtures. The first rule prevents a switch over an object's discriminator from containing multiple branches that all reconstruct the same `{ mode: object.mode, response: object.response }` identity result. It catches the concrete `bibliotek.vue` failure without pretending to solve arbitrary semantic equivalence.

New structural rules require a real review finding, a minimal matching fixture, and a nearby non-matching fixture. The gate must not become a collection of speculative style preferences.

## Existing Library Finding

The redundant switch in `app/pages/bibliotek.vue` is corrected to return `toLibrarySearchView(data)` directly. The two `LibraryPageData` definitions are consolidated behind one canonical exported type when typechecking confirms that the component-specific state wrapper is not semantically distinct. This repair is covered by the structural regression fixture and existing Library contract tests.

## Integration

`invoke quality.frontend` runs `yarn quality:maintainability` after ordinary lint and before typechecking. The focused `invoke quality.library` task runs the maintainability gate because the first regression is in Library code. The full release gate inherits it through `quality.frontend`.

No hosted service, account, network access, or editor extension is required. All versions are pinned in `nuxt/package.json` and `yarn.lock`.

## Testing

Implementation follows test-first development:

1. Architecture-policy fixtures first demonstrate that missing, downgraded, or malformed SonarJS configuration is incorrectly accepted, then pass after the verifier is extended.
2. Maintainability-orchestrator unit tests demonstrate stable unit attribution, fingerprinting, new-finding failure, known-finding acceptance, resolved-finding reporting, automatic review-queue ranking, and explicit baseline updates.
3. ast-grep rule fixtures demonstrate the bad Library switch matches and a genuinely transforming switch does not.
4. Package/task contract tests demonstrate that the gate is included in the authoritative frontend and Library quality tasks.
5. The Library identity adapter is changed only after a focused regression assertion fails for its current redundant form.

Final verification runs the focused tests, `yarn policy:check`, `yarn lint`, `yarn quality:maintainability`, `yarn typecheck`, the full unit suite, the Library SSR suite, and `invoke quality.frontend`. Analyzer output is reviewed for false positives before the baseline is accepted.

## Success Criteria

- The shown duplicated Library switch cannot be reintroduced without a failing automated check.
- New SonarJS, Knip, dependency-cruiser, and ast-grep findings fail one deterministic command.
- Offending functions, components, handlers, and modules are discovered across the complete authored Nuxt tree without a maintained filename list.
- Every run emits a ranked human-review queue and a machine-readable unit inventory.
- Current debt is visible and ratcheted without inline suppressions or downgraded severities.
- Nuxt framework conventions do not create known false-positive failures.
- The authoritative Invoke quality tasks execute the maintainability gate.
- A contributor can run the complete gate without hosted services or credentials.
