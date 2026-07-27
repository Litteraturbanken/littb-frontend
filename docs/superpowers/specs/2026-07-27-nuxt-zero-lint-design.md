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
5. typed policy-specific HTML capabilities for content already sanitized by a
   reviewed producer;
6. separate managed-asset capabilities for unsanitized Reader/editorial HTML
   and Presentation styles, rendered without changing their bytes;
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
next query by removing exactly the selected key from the ordered current query,
preserving key order and the current browser-history bytes.

The second template root is the source-information dialog. It must not move
inside `DramawebbenShell`: before Headless UI is mounted, that would nest its
fallback `<div>` beneath `.subpage .page_content` and change SSR/hydration DOM.
The page instead exposes one lint-visible root through Vue's real `Fragment`
symbol (or an equivalent render function returning the same two sibling
VNodes). It adds no wrapper and preserves both siblings, fragment markers, and
portal ownership. Tests serialize the SSR response, the pre-mounted hydration
tree, and the mounted portal tree before and after the change.

Query updates remove exactly the selected controlled key through object rest
or an ordered entry filter. Every other key, repeated value array, value, and
insertion position remains intact. An allowlist that silently drops unknown
query state is not permitted.

## Trusted HTML boundary

### Types and issuance

One unparameterized “trusted string” would hide materially different security
policies. Shared nominal capabilities therefore retain their authority in the
type:

- `SanitizedHtml<Policy>` is emitted by a named allowlist sanitizer or by a
  generated backend field whose public contract explicitly owns sanitization;
- `ManagedAssetHtml<Authority>` represents byte-preserved HTML from a named,
  configured legacy content authority after origin/path, redirect,
  content-type, and response-size validation;
- `ManagedStyleText<Authority>` and `ManagedStylesheetHref<Authority>` cover
  Presentation inline CSS and linked styles separately from HTML.

All remain strings at runtime and therefore serialize through Nuxt SSR without
changing payloads. Ordinary strings cannot be passed to the renderer or style
installer. Compile-time tests cover sanitizer/server DTO through
`useAsyncData`/`useRequestFetch` and into the renderer, plus negative cases
proving that an ordinary string or the wrong policy is rejected. Any
intermediate Nitro/shared/page interface must retain the branded field rather
than widen it back to `string`.

The 20 current allowlist-sanitized sinks receive `SanitizedHtml` from their
owning author-document, Dramawebben-document, SLA, dictionary, Reader OCR and
source-information, Editor Reader, or backend-projection boundary. The main
Reader e-text sink is not in this group: its HTML comes directly from
`readerSourceBase`, and its current transformations only remove soft hyphens
and change existing span classes. It receives a distinct
`ManagedAssetHtml<"reader-etext">` capability after the asset transport checks.

The five home, About/help, and Presentation sinks are also not described as
sanitized. Their current parsers are structural and intentionally preserve
legacy markup, including active attributes that an allowlist sanitizer might
remove. In accordance with the approved exact-parity decision, this tranche
accepts that documented legacy-content risk rather than silently changing DOM.
It adds explicit configured-authority/path checks, rejects cross-authority
redirects, enforces bounded bytes and expected HTML/XML/CSS content types, and
issues distinct managed-editorial capabilities only after those checks. The
currently loaded production fixtures must be characterized first and shown to
pass the new transport bounds byte-for-byte. Presentation `<style>`, linked
stylesheets, and `backgrounds.xml` style text are included in the authority
review even though they are not HTML sinks.

There is no exported general-purpose branding escape hatch. Narrow helpers
provide a policy-branded empty value, join already branded role rows with a
fixed `<br>`, and perform reviewed transformations without widening through
`?? ""` or `Array.join`. Reader highlighting preserves its managed-reader
policy while changing classes on existing spans; it does not claim to add
sanitized markup. Arbitrary string concatenation never retains a capability.

### Rendering

One render component is the sole sink into a live Vue-owned DOM element. It
accepts a renderable policy capability and the closed observed tag union
`"div" | "section" | "figcaption" | "td"`. It declares `inheritAttrs: false`,
has no slots, children, scoped styles, or component DOM-event emits, forwards
`$attrs` exactly once, rejects caller-supplied `innerHTML` and `textContent`,
and merges the reviewed `innerHTML` last. It adds no wrapper and preserves
class, style, ARIA attributes, and each click listener exactly once.

A renderer matrix covers all four tags, conditional absence, class/style/ARIA,
one click delivery, the table cell, SSR serialization, hydration without a
warning, and mounted DOM. Sink-specific tests compare normalized SSR and
hydrated DOM serialization against the pre-migration authority; screenshot
tolerances alone do not prove hierarchy equality.

Detached parser, sanitizer, and highlighter DOM is allowed to use `innerHTML`
only at an audited list of serialization sites. The gate asserts that templates
contain no `v-html`, that only the renderer writes `innerHTML` to live
Vue-owned DOM, and that no unlisted detached-DOM write or branding issuer is
introduced. This is an architectural choke point, not a rule-avoidance
wrapper.

## Quality commands

The root Invoke tasks gain a blocking `quality.frontend` task only after the
inventory is genuinely zero. It runs, under Node 22.22:

- `yarn lint` with `--max-warnings 0` already encoded in `package.json`;
- Nuxt type checking;
- the complete unit suite;
- the production build;
- the complete SSR project.

It also runs an architectural-policy verifier which fails on `v-html`, ESLint
disable comments, `@ts-ignore`, a new live-DOM `innerHTML` sink, an unlisted
detached-DOM sink, a general exported capability issuer, weakened required
ESLint rules, or expanded project ignores. Existing described
`@ts-expect-error` assertions in the named negative compile-contract files are
retained; they prove invalid generated shapes fail to compile and are not part
of the lint debt.

`quality.contract` continues to own OpenAPI snapshot and generated-client
drift. A blocking release/parity task additionally runs the complete
desktop/mobile E2E suite and proves that committed visual snapshot files have
identical hashes. Focused E2E tests for HTML rendering, managed navigation,
Dramawebben dialog behavior, and immutable visual baselines run in the
task-specific verification before that full release gate.

`docs/quality.md` records zero as the new baseline and explains the trusted-HTML
issuance rule, text-safety utilities, generated-code exclusion, and the next
Reader/Editor contract tranche. Task tests inspect deterministic command
composition so a future edit cannot silently remove lint, typecheck, unit,
build, or SSR coverage.

## Verification and invariants

Completion requires all of the following current-state evidence:

- ESLint reports zero errors and zero warnings across the same project scope;
- searches find no production/test explicit `any`, no `@ts-ignore`, no ESLint
  disable, no Vue `v-html`, and no unreviewed live or detached `innerHTML`
  sink; described `@ts-expect-error` assertions remain limited to the named
  negative generated-contract tests;
- typecheck, all unit tests, production build, and all SSR tests pass;
- the complete desktop/mobile E2E suite passes with only its declared skips;
- normalized SSR and hydrated DOM authority serializations match for every
  distinct renderer host and the Dramawebben fragment/dialog lifecycle;
- `git diff` and recorded hashes prove committed visual baselines are
  byte-identical before and after;
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
