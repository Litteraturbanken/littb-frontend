# Nuxt Zero-Lint Quality Gate Design

## Purpose and scope

This tranche reduces the Nuxt application's complete ESLint inventory to zero
without changing visible markup, interaction, routes, request ownership, or
content. It then makes zero warnings and zero errors a blocking project quality
gate before the next generated Reader/Editor contract tranche begins.

The measured starting inventory is 117 diagnostics across 48 files:

- 89 errors: 40 `@typescript-eslint/no-explicit-any`, 29
  `no-control-regex`, seven TypeScript unused bindings, four `prefer-const`,
  three `@typescript-eslint/ban-ts-comment`, three `no-useless-escape`, and one
  each of `@typescript-eslint/no-dynamic-delete`, JavaScript `no-unused-vars`,
  and `vue/no-multiple-template-root`;
- 28 warnings: 26 `vue/no-v-html` and two
  `vue/require-default-prop`.

Generated code, build output, dependencies, coverage, Playwright reports, and
test-result directories retain their existing exclusions. No new ESLint rule
override, file exclusion, inline disable, `@ts-ignore`, broad `any`, or unsafe
cast is permitted. The generated client remains checked by its deterministic
OpenAPI/code-generation gate rather than hand-edited to satisfy lint.

## Sequencing

The work is divided by semantic risk, not by whatever ESLint happens to report
first:

1. mechanical binding, declaration, escape, and optional-prop corrections;
2. typed malformed-fixture builders for the two unit suites that currently use
   `any` to construct invalid inputs;
3. shared, named Unicode/control-character predicates with boundary tests;
4. the Dramawebben catalog route-state and template-root corrections;
5. a typed trusted-HTML boundary for content already sanitized by a reviewed
   producer;
6. the same exact-DOM renderer for explicitly trusted managed editorial HTML;
7. blocking task wiring, documentation, and the complete parity gate.

Each group has its own failing test or lint assertion, focused verification,
review, and commit. Behavior-sensitive groups never share a commit with broad
mechanical cleanup.

## Mechanical diagnostics

Unused imports, parameters, fixture bindings, `prefer-const`, and useless
escapes are resolved at their source. A binding is deleted only when tests and
source inspection prove it is dead; otherwise it is used or renamed to express
its role. The currently unused Editor `parseOverlay` implementation is removed
only after confirming that OCR overlay handling is owned by
`fetchReaderOcrOverlay` and that no dynamic import or test reaches it.

The three fixture-module `@ts-ignore` comments are replaced by narrow module
declarations describing the actual exported fixture values. Replacing them
with `@ts-expect-error` would preserve a suppression and is not acceptable.

`SearchMultiSelect` gives both optional props explicit defaults with
`withDefaults`. The defaults preserve the current distinction between an empty
option group and the absence of a group, and preserve the current accessible
name behavior.

## Malformed test fixtures without `any`

All 40 explicit `any` findings are confined to
`test/unit/reader-source-info.spec.ts` and
`test/unit/text-search.spec.ts`. Those cases intentionally submit malformed
JSON, but malformed data does not require `any`.

Each suite receives focused helpers that begin with `unknown`, prove an object
or array boundary, clone the valid fixture, and mutate it through
`Record<string, unknown>` or `unknown[]`. Helpers expose only the operations the
negative cases require: replace a property, omit a property, append an unknown
item, or replace a nested object. They do not claim that malformed values
conform to generated response types. Positive fixtures continue to use exact
generated aliases and `satisfies`.

The tests must retain the same invalid payloads and assertions. Type cleanup is
not allowed to remove a negative case or weaken it to a generic failure.

## Shared text-safety predicates

The 29 control-character regular expressions encode several different rules.
They must not be replaced with one catch-all predicate. A shared utility uses
code-unit/code-point iteration and exports named semantic predicates for:

- all C0 and C1 controls;
- HTML text controls while allowing TAB, LF, and CR where the current parser
  allows them;
- lone UTF-16 surrogate code units;
- route/path values that additionally reject their current reserved
  characters;
- URL values that additionally reject their current whitespace or separator
  set.

Callers compose the named predicates with their existing length, trimming,
scheme, and reserved-character rules. Tests cover U+0000, U+0008, U+0009,
U+000A, U+000B, U+000C, U+000D, U+000E, U+001F, U+007F, U+009F, U+D800, and
U+DFFF, plus slash, backslash, percent, hash, and whitespace where relevant.
Every migrated validator receives characterization cases showing that its
accepted and rejected boundary set is unchanged.

## Dramawebben catalog structure

`dramawebben/pjäser.vue` stops deleting dynamic query keys. It constructs the
next query from an allowlisted copy or object rest operation, preserving key
order and the current browser-history bytes.

The second template root is the source-information dialog. It moves inside the
existing `DramawebbenShell` component tree at a location where its Headless UI
portal still renders the dialog at the same document location. No wrapper
element is added to the rendered page. Closed and open dialog DOM,
focus-restoration behavior, route history, and desktop/mobile screenshots must
remain unchanged.

## Trusted HTML boundary

### Types and issuance

A shared nominal `TrustedHtml` string type represents HTML that a reviewed
producer has already made safe for its declared context. It remains a string at
runtime and therefore serializes through Nuxt SSR without changing payloads.
Ordinary strings cannot be passed to the renderer.

The brand may be issued only by named functions colocated with an owning
boundary:

- allowlist sanitizers for author documents, Dramawebben documents, SLA
  articles, dictionary articles, Reader OCR/source information, and Editor
  Reader HTML;
- generated backend projections whose contract explicitly states that the HTML
  field has been sanitized by the backend;
- reviewed managed-content loaders for the home, About/help, and Presentation
  sources.

There is no exported general-purpose `asTrustedHtml(string)` escape hatch.
Transformations that introduce known markup, such as Reader hit `<mark>` tags
or joining already trusted role rows with `<br>`, use narrow tested helpers and
return `TrustedHtml`. Concatenating arbitrary strings does not retain the
brand.

### Rendering

One render component is the sole Vue sink. It accepts `TrustedHtml`, an
explicit native element tag, and inherited attributes/listeners. Its render
function creates that native element with `innerHTML`; it adds no wrapper and
preserves the caller's class, style, accessibility attributes, and click
handler. SSR and hydration produce the same element type and child markup as
the current `v-html` sites.

The 21 sinks already fed by sanitizer/backend-owned projections migrate first.
The five managed editorial sinks in the home, About/help, and Presentation
pages migrate only after characterization proves the exact input and output
markup. In accordance with the approved parity decision, this tranche does not
rewrite or newly sanitize those trusted editorial documents. Their trust is
made explicit at the loader boundary, restricted to the existing configured
same-origin/managed sources, bounded by the current size/error rules, and
covered by navigation and visual tests.

The gate asserts that application templates contain no `v-html` and that only
the reviewed renderer writes `innerHTML`. This is an architectural choke point,
not a rule-avoidance wrapper: issuance is limited, named, and tested.

## Quality commands

The root Invoke tasks gain a blocking `quality.frontend` task only after the
inventory is genuinely zero. It runs, under Node 22.22:

- `yarn lint` with `--max-warnings 0` already encoded in `package.json`;
- Nuxt type checking;
- the complete unit suite;
- the production build;
- the complete SSR project.

`quality.contract` continues to own OpenAPI snapshot and generated-client
drift. A documented release/parity command additionally runs the complete
desktop/mobile E2E suite. Focused E2E tests for HTML rendering, managed
navigation, Dramawebben dialog behavior, and immutable visual baselines run in
the task-specific verification before the full release gate.

`docs/quality.md` records zero as the new baseline and explains the trusted-HTML
issuance rule, text-safety utilities, generated-code exclusion, and the next
Reader/Editor contract tranche. Task tests inspect deterministic command
composition so a future edit cannot silently remove lint, typecheck, unit,
build, or SSR coverage.

## Verification and invariants

Completion requires all of the following current-state evidence:

- ESLint reports zero errors and zero warnings across the same project scope;
- searches find no production/test explicit `any`, no TypeScript suppression,
  no Vue `v-html`, and no unreviewed `innerHTML` sink outside the renderer;
- typecheck, all unit tests, production build, and all SSR tests pass;
- the complete desktop/mobile E2E suite passes with only its declared skips;
- committed visual baselines are byte-identical before and after;
- route URLs, browser-history behavior, rendered element hierarchy, focus
  behavior, managed links, OCR selection, and Reader highlighting remain
  unchanged;
- generated OpenAPI and TypeScript artifacts have no drift;
- unrelated dirty and untracked files in both repositories remain untouched.

## Next contract tranche

Once `quality.frontend` is blocking, the next separately specified tranche adds
strict generated v2 Reader/Editor manifest operations. It replaces the legacy
`get_work_info` and `count_pages` JSON parsers that currently feed the canonical
Reader, both Reader shorthand routes, and the Editor Reader. Page HTML, OCR,
facsimile images, and trusted editorial/static documents remain separate
validated asset boundaries.
