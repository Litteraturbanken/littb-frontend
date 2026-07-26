# Nuxt ESLint Integration Design

## Goal

Add current, project-aware linting to the Nuxt application without involving the
legacy AngularJS frontend. Lint every handwritten JavaScript, TypeScript, and Vue
file in `nuxt/`, apply only ordinary ESLint autofixes, and retain a reviewable
inventory of findings that require judgment.

## Scope

The checker covers the complete handwritten Nuxt package:

- Vue single-file components under `app/`;
- application, server, and shared TypeScript;
- unit, SSR, behavior, and visual tests;
- Playwright, Vitest, Nuxt, Tailwind, and other package-local configuration; and
- handwritten JavaScript and MJS fixtures used by those tests.

The checker excludes generated or transient content:

- `app/lib/api/generated/**`;
- `.nuxt/**` and `.output/**`;
- `node_modules/**`;
- coverage, Playwright reports, screenshots, and `test-results*/**`; and
- other package-local cache or build output.

The root AngularJS `.eslintrc`, `.eslintignore`, dependencies, and source tree are
not migrated or linted by this work.

## Tooling and configuration

Pin `eslint` at `10.8.0` and `@nuxt/eslint` at `1.16.0` in
`nuxt/package.json` and the Yarn lockfile. The Nuxt module is the official
project-aware integration and supports ESLint's flat configuration format.

Register `@nuxt/eslint` in `nuxt.config.ts` without enabling the development
server checker. The checker would add work to every local dev-server rebuild and
is unnecessary because linting has explicit package scripts.

Commit `nuxt/eslint.config.mjs`, importing the generated
`.nuxt/eslint.config.mjs` configuration and adding only global ignore patterns.
Nuxt's recommended JavaScript, TypeScript, Vue, and Nuxt rules remain
authoritative. Stylistic formatting is not enabled in this first integration,
and no convenience rule overrides, per-file exceptions, or suppression comments
are added.

## Commands

Add these package-local scripts:

- `yarn lint` runs `eslint . --max-warnings 0`;
- `yarn lint:fix` runs `eslint . --fix --max-warnings 0`.

Both commands execute from `nuxt/`, which creates an additional hard boundary
between the new application and the legacy frontend. Warnings fail the command
so the lint inventory cannot silently grow.

## Autofix workflow

First install the pinned dependencies and run `nuxt prepare` so the generated
Nuxt flat configuration exists. Verify ESLint's version, print the resolved file
set, and prove that no generated, transient, or legacy file is selected.

Capture the baseline in JSON and summarize totals by rule and severity. Snapshot
the existing Git status before modifying source files. Run the ordinary
`yarn lint:fix` command once; do not apply editor quick-fixes, suggestions,
suppression directives, or manual cleanup of remaining findings.

Inspect every changed path and every non-formatting transformation. Restore or
encode intentional public contracts if an autofix removes an import that the
project exposes indirectly. Re-run `yarn lint:fix` and require an unchanged diff
to prove the documented workflow is repeatable.

## Verification

After the fix audit, run:

1. `yarn lint` to capture the exact remaining inventory;
2. `yarn typecheck` for Nuxt and Vue type analysis;
3. `yarn test:unit` for the complete Vitest suite;
4. `yarn build` for the production Nuxt build; and
5. focused SSR or Playwright checks if a fix touched runtime Vue, routing, server,
   or test-harness behavior.

Lint findings may remain after the safe-fix pass. They are reported rather than
hidden or manually resolved in this phase. Existing unrelated dirty and untracked
files remain untouched.

## Commit boundaries

Use two implementation commits:

1. dependencies, flat configuration, Nuxt registration, scripts, and developer
   documentation;
2. audited ESLint autofixes within the approved Nuxt scope.

No push, merge, deployment, or change to the running development servers is part
of this work.
