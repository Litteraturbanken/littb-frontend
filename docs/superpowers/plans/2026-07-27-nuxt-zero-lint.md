# Nuxt Zero-Lint Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all 117 Nuxt ESLint diagnostics without suppressions or parity changes, establish policy-typed HTML rendering and managed-asset boundaries, and make zero lint plus frontend verification blocking project quality gates.

**Architecture:** Resolve mechanical and malformed-test debt first, then replace control-character regexes with shared semantic predicates. Introduce policy-parameterized nominal HTML capabilities and one exact-DOM renderer; sanitized producers and explicitly validated managed assets issue distinct capabilities. Finish with an architectural-policy verifier, deterministic Invoke tasks, full browser/visual parity, and a documented zero baseline.

**Tech Stack:** Nuxt 4.4, Vue 3.5, TypeScript 5.9, ESLint/Nuxt ESLint, Vitest 4.1, Playwright 1.61, Node 22.22, Invoke/Python pytest.

## Global Constraints

- Work only in `/Users/johan/.codex/worktrees/8c5c/littb` on the existing `codex/nuxt-v2-statistics` branch.
- Preserve every unrelated dirty and untracked file. Stage only files listed by the current task.
- Preserve exact visuals, native DOM hierarchy, Swedish copy, routes, raw query ordering, browser history, focus behavior, SSR/hydration behavior, request ownership, and managed-content bytes.
- Do not add ESLint overrides/exclusions, `eslint-disable`, `@ts-ignore`, production/test explicit `any`, broad unsafe casts, or generated-file edits.
- Preserve the existing described `@ts-expect-error` assertions in `nuxt/test/nuxt/author-works-contract.ts` and `nuxt/test/nuxt/reader-source-info-contract.ts`; Task 5 may add described negative assertions only in `renderable-html-contract.ts`.
- The sole nominal-capability assertion is private to `shared/utils/renderable-html.ts`; every other capability is created through a named policy issuer.
- Generated OpenAPI/TypeScript artifacts remain unchanged in this tranche and must pass drift checks.
- Prefix every Node command with `/Users/johan/.nvm/versions/node/v22.22.0/bin`, the configured Node 22.22 runtime for this worktree.
- Run PATH-prefixed Yarn/TypeScript and source-search verification commands from `nuxt/`; run Git, Invoke, and Python commands from the repository root. Mixed verification blocks use `git -C ..` when they remain in `nuxt/`.
- Existing committed visual baselines are immutable. Never update snapshots to make a change pass.
- Design commit `06add2bb` is the immutable visual-file authority; every visual audit compares the implementation branch against that commit, so committing a changed baseline cannot hide it.

---

### Task 1: Remove Mechanical Lint Debt and Type JavaScript Fixture Modules

**Files:**
- Modify: `nuxt/app/components/global/QuickSearch.vue`
- Modify: `nuxt/app/components/search/SearchMultiSelect.vue`
- Modify: `nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts`
- Modify: `nuxt/server/utils/legacy-author-route.ts`
- Modify: `nuxt/test/e2e/presentations.behavior.spec.ts`
- Modify: `nuxt/test/e2e/quick-search.visual.spec.ts`
- Modify: `nuxt/test/fixtures/library-query-data.mjs`
- Create: `nuxt/test/fixtures/quick-search-visual-data.d.mts`
- Create: `nuxt/test/fixtures/statistics-data.d.mts`
- Modify: `nuxt/test/ssr/presentations.spec.ts`
- Modify: `nuxt/test/unit/foundation.spec.ts`
- Modify: `nuxt/test/visual/capture-angular.spec.ts`
- Modify: `nuxt/test/visual/capture-author-angular.spec.ts`
- Modify: `nuxt/test/visual/capture-author-biblinfo-angular.spec.ts`
- Modify: `nuxt/test/visual/capture-quick-search-angular.spec.ts`
- Modify: `nuxt/test/visual/capture-sla-articles-angular.spec.ts`

**Interfaces:**
- Consumes: current JavaScript fixture exports and existing Quick Search, multiselect, Editor, Presentation, and visual-capture behavior.
- Produces: exact `.mjs` declarations, explicit optional-prop defaults, and zero diagnostics for every rule except the separately owned explicit-`any`, control-regex, Dramawebben-root/query, and HTML groups.

- [ ] **Step 1: Capture the RED mechanical inventory**

Run:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  app/components/global/QuickSearch.vue \
  app/components/search/SearchMultiSelect.vue \
  'server/api/editor/[lbid]/[ix]/[mediatype].get.ts' \
  server/utils/legacy-author-route.ts \
  test/e2e/presentations.behavior.spec.ts test/e2e/quick-search.visual.spec.ts \
  test/fixtures/library-query-data.mjs test/ssr/presentations.spec.ts \
  test/unit/foundation.spec.ts test/visual/capture-*.spec.ts \
  --max-warnings 0
```

Expected: fail with exactly the non-`any`, non-control-regex, non-`v-html`, non-Dramawebben findings owned by this task, including two missing prop defaults and three `@ts-ignore` comments.

- [ ] **Step 2: Add exact `.mjs` declarations before deleting suppressions**

Define same-basename declarations so TypeScript resolves the adjacent modules without ambient relative-module hacks. `quick-search-visual-data.d.mts` imports `components` and exposes:

```ts
import type { components } from "../../app/lib/api/generated/lbapi"

export const quickSearchVisualQuery: string
export const quickSearchTypedResponse: components["schemas"]["QuickSearchResponse"]
export const angularQuickSearchResponse: Readonly<{
  data: readonly Record<string, unknown>[]
  suggest: readonly unknown[]
}>
```

`statistics-data.d.mts` exposes generated v2 fixtures and the legacy capture shapes actually read by the visual test:

```ts
import type { components } from "../../app/lib/api/generated/lbapi"

export const stats: components["schemas"]["StatsResponse"]
export const popularWorks: readonly components["schemas"]["PopularWork"][]
export const popularEpubs: readonly components["schemas"]["PopularEpub"][]
export const legacyWorks: readonly Record<string, unknown>[]
export const legacyEpubs: readonly Record<string, unknown>[]
```

Run `yarn typecheck` and expect it to pass before removing the comments.

- [ ] **Step 3: Apply only behavior-neutral source corrections**

- replace the unused Quick Search error binding with the existing boolean/error branch form without swallowing a distinct status;
- extend the existing `withDefaults` object with `optionGroups: () => []` and
  `accessibleName: undefined`, leaving the inline prop declaration and
  `props.accessibleName ?? props.placeholder` fallback unchanged;
- remove the unreachable Editor `parseOverlay` family, its `parseHTML` import, and constants/types used only by that family after `rg -n 'parseOverlay|sanitizeOverlayElement'` proves no caller;
- remove the unused `encodeRfc3986Segment` import and dead test/capture bindings;
- convert the four never-reassigned capture bindings to `const`;
- remove only the reported unnecessary escapes;
- replace the unused Library fixture destructuring binding with object-rest omission that returns the same fixture bytes;
- delete the three `@ts-ignore` comments only after the declarations typecheck.

- [ ] **Step 4: Verify the focused behavior and lint group**

Run:

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/search-multi-select.spec.ts test/unit/foundation.spec.ts \
  test/ssr/presentations.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  app/components/global/QuickSearch.vue app/components/search/SearchMultiSelect.vue \
  'server/api/editor/[lbid]/[ix]/[mediatype].get.ts' \
  server/utils/legacy-author-route.ts test/e2e/presentations.behavior.spec.ts \
  test/e2e/quick-search.visual.spec.ts test/fixtures/library-query-data.mjs \
  test/ssr/presentations.spec.ts test/unit/foundation.spec.ts \
  test/visual/capture-*.spec.ts --format json \
  --output-file /tmp/littb-eslint-task1.json
jq '[.[] | .messages[] | select(.ruleId != "no-control-regex")] | length' \
  /tmp/littb-eslint-task1.json
```

Expected: tests/typecheck pass; ESLint exits nonzero only because this task's
Editor/legacy-route files still contain Task 3 control regexes; `jq` prints
`0`, proving every diagnostic not owned by Task 3 is gone.

- [ ] **Step 5: Commit the mechanical tranche**

```bash
git add nuxt/app/components/global/QuickSearch.vue \
  nuxt/app/components/search/SearchMultiSelect.vue \
  'nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts' \
  nuxt/server/utils/legacy-author-route.ts \
  nuxt/test/e2e/presentations.behavior.spec.ts \
  nuxt/test/e2e/quick-search.visual.spec.ts \
  nuxt/test/fixtures/library-query-data.mjs \
  nuxt/test/fixtures/quick-search-visual-data.d.mts \
  nuxt/test/fixtures/statistics-data.d.mts \
  nuxt/test/ssr/presentations.spec.ts nuxt/test/unit/foundation.spec.ts \
  nuxt/test/visual/capture-angular.spec.ts \
  nuxt/test/visual/capture-author-angular.spec.ts \
  nuxt/test/visual/capture-author-biblinfo-angular.spec.ts \
  nuxt/test/visual/capture-quick-search-angular.spec.ts \
  nuxt/test/visual/capture-sla-articles-angular.spec.ts
git commit -m "chore: remove mechanical Nuxt lint debt"
```

---

### Task 2: Replace Malformed-Fixture `any` With Unknown-First Mutation Helpers

**Files:**
- Create: `nuxt/test/helpers/malformed-json.ts`
- Create: `nuxt/test/unit/malformed-json.spec.ts`
- Modify: `nuxt/test/unit/reader-source-info.spec.ts`
- Modify: `nuxt/test/unit/text-search.spec.ts`

**Interfaces:**
- Consumes: positive generated response fixtures and the exact 40 negative mutations.
- Produces: `cloneRecord`, `requiredRecord`, and `requiredArray` helpers that expose malformed JSON as `unknown` containers without claiming generated conformance.

- [ ] **Step 1: Write RED helper tests**

Add tests proving exact cloning, nested record/array access, and rejection of the wrong container:

```ts
expect(cloneRecord({ nested: { rows: [1] } })).toEqual({ nested: { rows: [1] } })
expect(requiredRecord({ child: {} }, "child")).toEqual({})
expect(requiredArray({ rows: [1] }, "rows")).toEqual([1])
expect(() => requiredRecord({ child: [] }, "child")).toThrow("child must be an object")
expect(() => requiredArray({ rows: {} }, "rows")).toThrow("rows must be an array")
```

Run `yarn vitest run test/unit/malformed-json.spec.ts`; expect module-not-found failure.

- [ ] **Step 2: Implement the narrow helpers**

Create:

```ts
export type JsonRecord = Record<string, unknown>

export function cloneRecord(value: unknown): JsonRecord {
  const clone: unknown = structuredClone(value)
  if (typeof clone !== "object" || clone === null || Array.isArray(clone)) {
    throw new TypeError("fixture must be an object")
  }
  return clone as JsonRecord
}

export function requiredRecord(parent: JsonRecord, key: string): JsonRecord {
  const value = parent[key]
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${key} must be an object`)
  }
  return value as JsonRecord
}

export function requiredArray(parent: JsonRecord, key: string): unknown[] {
  const value = parent[key]
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array`)
  return value
}
```

The single `as JsonRecord` follows a complete runtime guard and is not a transport assertion. Do not add a generic path language or generated-type cast.

- [ ] **Step 3: Rewrite all 40 negative mutations without weakening cases**

Type every mutator `(value: JsonRecord) => void`. Use `requiredRecord` and `requiredArray` at each nested boundary. For example:

```ts
["duplicate author", (value: JsonRecord) => {
  const authors = requiredArray(value, "authors")
  authors.push(authors[0])
}],
["unsafe download URL", (value: JsonRecord) => {
  const action = requiredRecord(
    { action: requiredArray(value, "download_actions")[0] },
    "action"
  )
  action.url = "//evil.test/book"
}]
```

Preserve every case name, payload mutation, expected error, and valid generated fixture assertion. Remove the now-unused `WorkSourceInfoResponse` alias.

- [ ] **Step 4: Prove helper semantics, suites, lint, and typecheck**

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/malformed-json.spec.ts test/unit/reader-source-info.spec.ts \
  test/unit/text-search.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  test/helpers/malformed-json.ts test/unit/malformed-json.spec.ts \
  test/unit/reader-source-info.spec.ts test/unit/text-search.spec.ts \
  --max-warnings 0
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
```

Expected: all pass and `rg -n '\bany\b' test/unit/reader-source-info.spec.ts test/unit/text-search.spec.ts` finds no type usage.

- [ ] **Step 5: Commit the typed negative fixtures**

```bash
git add nuxt/test/helpers/malformed-json.ts nuxt/test/unit/malformed-json.spec.ts \
  nuxt/test/unit/reader-source-info.spec.ts nuxt/test/unit/text-search.spec.ts
git commit -m "test: type malformed Nuxt fixtures"
```

---

### Task 3: Replace Control Regexes With Exact Shared Text-Safety Predicates

**Files:**
- Create: `nuxt/shared/utils/text-safety.ts`
- Create: `nuxt/test/unit/text-safety.spec.ts`
- Modify: the 22 files listed in the `no-control-regex` inventory in the design audit: `nuxt/app/lib/{author-profile,internal-navigation,library-navigation,production-shortcuts,quick-search-developer,reader-dictionary,reader-missing-page}.ts`, `nuxt/app/pages/dramawebben/pjäser.vue`, `nuxt/app/pages/författare/[author]/[document]/index.vue`, `nuxt/app/pages/historik.vue`, `nuxt/app/pages/presentationer/presentation-parser.ts`, `nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts`, `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`, and `nuxt/server/utils/{author-document,dramawebben-document,editor-reader-html,legacy-author-route,legacy-dramawebben-route,reader-ocr,reader-source-info,reader-source,sla-article}.ts`
- Modify: `nuxt/test/unit/author-profile.spec.ts`, `internal-navigation.spec.ts`, `library-navigation.spec.ts`, `production-shortcuts.spec.ts`, `quick-search-developer.spec.ts`, `reader-dictionary.spec.ts`, `reader-missing-page.spec.ts`, `presentation-parser.spec.ts`, `author-document.spec.ts`, `dramawebben-document.spec.ts`, `editor-reader-html.spec.ts`, `legacy-author-route.spec.ts`, `reader-source-info.spec.ts`, `reader-source.spec.ts`, `sla-article.spec.ts`, `foundation.spec.ts`, and `v2-server.spec.ts` only to add a missing member of the declared boundary matrix.

**Interfaces:**
- Consumes: exact existing regex acceptance sets.
- Produces: `hasC0OrDelete`, `hasC0OrC1Control`, `hasHtmlUnsafeCodeUnit`, `hasLoneSurrogate`, `hasEcmaWhitespace`, and `removeC0AndSpace` with no regular-expression control ranges.

- [ ] **Step 1: Write the RED Unicode boundary matrix**

Test U+0000, 0008, 0009, 000A, 000B, 000C, 000D, 000E, 001F, 0020, 007F, 0080, 009F, paired emoji, U+D800, and U+DFFF. Required semantics:

```ts
expect(hasC0OrDelete("\u0080")).toBe(false)
expect(hasC0OrC1Control("\u0080")).toBe(true)
expect(hasHtmlUnsafeCodeUnit("\t\n\r")).toBe(false)
expect(hasHtmlUnsafeCodeUnit("\u000b")).toBe(true)
expect(hasLoneSurrogate("😀")).toBe(false)
expect(hasLoneSurrogate("\ud800")).toBe(true)
expect(removeC0AndSpace("\u0000 \tjava\nscript")).toBe("javascript")
```

Run the new unit file and expect an import failure.

- [ ] **Step 2: Implement code-unit/code-point iteration**

Use numeric code-unit loops for control and lone-surrogate detection. A high surrogate followed by a low surrogate is valid; either half alone is unsafe. Use `character.trim() === ""` only in `hasEcmaWhitespace`, matching JavaScript `\s` semantics without a regex. `removeC0AndSpace` removes code units 0x00 through 0x20 inclusive.

- [ ] **Step 3: Migrate callers by their exact former rule**

- C0/C1-only sites call `hasC0OrC1Control`;
- Library navigation and history use `hasC0OrDelete`, preserving their intentional acceptance of U+0080–U+009F;
- source-info/SLA HTML use `hasHtmlUnsafeCodeUnit`, preserving TAB/LF/CR;
- route/path sites combine `hasC0OrC1Control`, `hasLoneSurrogate`, and their existing slash/backslash/percent/hash checks;
- URL sites combine control/surrogate checks with their existing backslash/whitespace rule;
- Presentation scheme probing calls `removeC0AndSpace`;
- download filenames perform length plus slash/backslash/control checks explicitly.

Do not replace reserved-character checks with a broader predicate and do not change normalization order.

- [ ] **Step 4: Run focused validator tests and the exact lint audit**

Run the exact validator suite:

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/text-safety.spec.ts test/unit/author-profile.spec.ts \
  test/unit/internal-navigation.spec.ts test/unit/library-navigation.spec.ts \
  test/unit/production-shortcuts.spec.ts test/unit/quick-search-developer.spec.ts \
  test/unit/reader-dictionary.spec.ts test/unit/reader-missing-page.spec.ts \
  test/unit/presentation-parser.spec.ts test/unit/author-document.spec.ts \
  test/unit/dramawebben-document.spec.ts test/unit/editor-reader-html.spec.ts \
  test/unit/legacy-author-route.spec.ts test/unit/reader-source-info.spec.ts \
  test/unit/reader-source.spec.ts test/unit/sla-article.spec.ts \
  test/unit/foundation.spec.ts test/unit/v2-server.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
```

Then run the exact lint audit:

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  app shared server --max-warnings 999 --format json --output-file /tmp/littb-eslint-task3.json
jq '[.[] | .messages[] | select(.ruleId == "no-control-regex")] | length' \
  /tmp/littb-eslint-task3.json
```

Expected: `0`; the explicitly listed unit files above and typecheck pass.

- [ ] **Step 5: Commit exact text-safety semantics**

```bash
git add nuxt/shared/utils/text-safety.ts nuxt/test/unit/text-safety.spec.ts \
  nuxt/app/lib/author-profile.ts nuxt/app/lib/internal-navigation.ts \
  nuxt/app/lib/library-navigation.ts nuxt/app/lib/production-shortcuts.ts \
  nuxt/app/lib/quick-search-developer.ts nuxt/app/lib/reader-dictionary.ts \
  nuxt/app/lib/reader-missing-page.ts nuxt/app/pages/dramawebben/pjäser.vue \
  'nuxt/app/pages/författare/[author]/[document]/index.vue' \
  nuxt/app/pages/historik.vue \
  nuxt/app/pages/presentationer/presentation-parser.ts \
  'nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts' \
  'nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts' \
  nuxt/server/utils/author-document.ts nuxt/server/utils/dramawebben-document.ts \
  nuxt/server/utils/editor-reader-html.ts nuxt/server/utils/legacy-author-route.ts \
  nuxt/server/utils/legacy-dramawebben-route.ts nuxt/server/utils/reader-ocr.ts \
  nuxt/server/utils/reader-source-info.ts nuxt/server/utils/reader-source.ts \
  nuxt/server/utils/sla-article.ts \
  nuxt/test/unit/author-profile.spec.ts nuxt/test/unit/internal-navigation.spec.ts \
  nuxt/test/unit/library-navigation.spec.ts \
  nuxt/test/unit/production-shortcuts.spec.ts \
  nuxt/test/unit/quick-search-developer.spec.ts \
  nuxt/test/unit/reader-dictionary.spec.ts \
  nuxt/test/unit/reader-missing-page.spec.ts \
  nuxt/test/unit/presentation-parser.spec.ts \
  nuxt/test/unit/author-document.spec.ts \
  nuxt/test/unit/dramawebben-document.spec.ts \
  nuxt/test/unit/editor-reader-html.spec.ts \
  nuxt/test/unit/legacy-author-route.spec.ts \
  nuxt/test/unit/reader-source-info.spec.ts nuxt/test/unit/reader-source.spec.ts \
  nuxt/test/unit/sla-article.spec.ts nuxt/test/unit/foundation.spec.ts \
  nuxt/test/unit/v2-server.spec.ts
git diff --cached --name-only
git commit -m "refactor: centralize Nuxt text safety"
```

---

### Task 4: Preserve Dramawebben Query and Three-Root DOM Through a Fragment

**Files:**
- Create: `nuxt/app/lib/dramawebben-query.ts`
- Create: `nuxt/test/unit/dramawebben-query.spec.ts`
- Modify: `nuxt/app/pages/dramawebben/pjäser.vue`
- Modify: `nuxt/test/ssr/dramawebben.spec.ts`
- Modify: `nuxt/test/e2e/dramawebben.behavior.spec.ts`
- Modify: `nuxt/test/e2e/dramawebben-catalog.visual.spec.ts`

**Interfaces:**
- Consumes: the current three top-level VNodes (`#dw`, `DramawebbenShell`, `ReaderSourceInfoDialog`) and Vue Router query objects.
- Produces: `queryWithoutKey(query, key): LocationQueryRaw` plus one lint-visible Vue `Fragment` root that emits the same three sibling VNodes.

- [ ] **Step 1: Add RED source/behavior assertions**

Add `queryWithoutKey` to `app/lib/dramawebben-query.ts` and write its unit contract proving:

```ts
queryWithoutKey({ first: "1", repeat: ["a", "b"], selected: "x", last: "2" }, "selected")
// => { first: "1", repeat: ["a", "b"], last: "2" }
```

Extend SSR/E2E assertions to prove `#dw` precedes the shell, the closed fallback dialog remains its sibling through hydration, the mounted dialog portal remains body-owned, and closing removes only its exact query keys while retaining unknown/repeated keys and order. Add a source assertion expecting a real `Fragment` root. Run targeted lint; expect `no-dynamic-delete` and `vue/no-multiple-template-root` failures before implementation.

- [ ] **Step 2: Implement exact query removal**

Use ordered `Object.entries` filtering and `Object.fromEntries`, remove only the requested key, and never allowlist or stringify other values. Replace dynamic `delete` in `setQuery`.

- [ ] **Step 3: Wrap the existing three VNodes in Vue `Fragment`**

Import `Fragment` from Vue and use one `<component :is="Fragment">` template root containing, in unchanged order, `#dw`, `DramawebbenShell`, and `ReaderSourceInfoDialog`. Do not move the dialog into the shell or add a native wrapper.

- [ ] **Step 4: Prove DOM, history, lint, and visuals**

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/dramawebben-query.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/ssr/dramawebben.spec.ts --project=ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/e2e/dramawebben.behavior.spec.ts \
  test/e2e/dramawebben-catalog.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  app/pages/dramawebben/pjäser.vue --max-warnings 0
git -C .. diff --exit-code 06add2bb..HEAD -- \
  'nuxt/test/visual/baselines/*dramawebben-catalog*'
```

Expected: behavior/SSR/visual cases pass, lint is clean, and baseline diff is empty.

- [ ] **Step 5: Commit the parity-preserving structural fix**

```bash
git add nuxt/app/lib/dramawebben-query.ts \
  nuxt/test/unit/dramawebben-query.spec.ts \
  nuxt/app/pages/dramawebben/pjäser.vue \
  nuxt/test/ssr/dramawebben.spec.ts \
  nuxt/test/e2e/dramawebben.behavior.spec.ts \
  nuxt/test/e2e/dramawebben-catalog.visual.spec.ts
git commit -m "refactor: preserve Dramawebben fragment state"
```

---

### Task 5: Add Policy-Typed HTML Capabilities and the Sole Live-DOM Renderer

**Files:**
- Create: `nuxt/shared/types/renderable-html.ts`
- Create: `nuxt/shared/utils/renderable-html.ts`
- Create: `nuxt/app/components/global/RenderableHtmlContent.vue`
- Create: `nuxt/test/unit/renderable-html.spec.ts`
- Create: `nuxt/test/nuxt/renderable-html-contract.ts`
- Modify: `nuxt/package.json`
- Modify: `nuxt/yarn.lock`
- Modify: `nuxt/vitest.config.ts`
- Modify: `nuxt/vitest.component.config.ts`

**Interfaces:**
- Produces: `SanitizedHtml<P>`, `ManagedAssetHtml<A>`, `ManagedStyleText<A>`, `ManagedStylesheetHref<A>`, `RenderableHtml`, `RenderableCapability`, `RenderableHtmlTag`, `RenderableHtmlProps`, closed policy/authority unions, named issuers, branded empty/join/Reader-transform helpers, and `RenderableHtmlContent` implementing `RenderableHtmlProps`.

- [ ] **Step 1: Write RED compile and renderer tests**

The compile contract assigns every named issuer to its exact policy, constructs valid `RenderableHtmlProps`, and uses described `@ts-expect-error` assertions to reject plain strings, the wrong capability kind, and an unsupported tag. The standalone contract imports only `.ts` types/issuers; Nuxt typecheck owns the `.vue` component.

The component test matrix mounts all four tags, verifies class/style/ARIA, dispatches one click and observes one handler call, proves `innerHTML`/`textContent` attrs cannot override `html`, checks conditional absence, and uses an explicitly declared `@vue/server-renderer` 3.5.39 dev dependency to assert exact native SSR strings. It hydrates the server markup with `createSSRApp`, records console warnings, and expects byte-equivalent inner markup with no hydration warning. Add the component test to `vitest.component.config.ts` and exclude it from the node-unit project in `vitest.config.ts`.

Run both the component test and standalone `tsc`; expect missing-module failures.

- [ ] **Step 2: Implement nominal capabilities with one private assertion**

Define unique-symbol policies:

```ts
export type SanitizedHtmlPolicy =
  | "author-profile" | "author-document" | "dramawebben-document"
  | "sla-article" | "dictionary-article" | "reader-ocr"
  | "reader-source-info" | "editor-etext"
export type ManagedHtmlAuthority =
  | "reader-etext" | "home-editorial" | "about-editorial" | "presentation-editorial"

export type RenderableCapability =
  | RenderableHtml
  | ManagedStyleText<"presentation-editorial">
  | ManagedStylesheetHref<"presentation-editorial">
```

The non-exported `capability<T extends RenderableCapability>(value: string): T`
contains the sole `return value as T` assertion. Export exactly these named
issuers: `issueAuthorProfileHtml`, `issueAuthorDocumentHtml`,
`issueDramawebbenDocumentHtml`, `issueSlaArticleHtml`,
`issueDictionaryArticleHtml`, `issueReaderOcrHtml`,
`issueReaderSourceInfoHtml`, `issueEditorEtextHtml`,
`issueManagedReaderHtml`, `issueManagedHomeHtml`, `issueManagedAboutHtml`,
`issueManagedPresentationHtml`, `issueManagedPresentationStyle`, and
`issueManagedPresentationStylesheetHref`. Export policy-preserving
`emptyRenderableHtml`, `joinReaderSourceRows`, and
`transformManagedReaderHtml(value, transform)`; do not export a generic
brander.

- [ ] **Step 3: Implement the exact native renderer**

Use `defineComponent` in the `.vue` script block with `inheritAttrs: false` and a render function. Filter `innerHTML` and `textContent` out of `$attrs`, spread the rest once, and assign `innerHTML: props.html` last. Declare no slots, DOM event emits, template, wrapper, or style block.

- [ ] **Step 4: Verify type, runtime, SSR, hydration, and scoped lint**

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/renderable-html.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn tsc --noEmit --strict \
  --module esnext --moduleResolution bundler --target es2022 \
  test/nuxt/renderable-html-contract.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  shared/types/renderable-html.ts shared/utils/renderable-html.ts \
  app/components/global/RenderableHtmlContent.vue test/unit/renderable-html.spec.ts \
  test/nuxt/renderable-html-contract.ts --max-warnings 0
```

- [ ] **Step 5: Commit the rendering foundation**

```bash
git add nuxt/shared/types/renderable-html.ts \
  nuxt/shared/utils/renderable-html.ts \
  nuxt/app/components/global/RenderableHtmlContent.vue \
  nuxt/test/unit/renderable-html.spec.ts \
  nuxt/test/nuxt/renderable-html-contract.ts nuxt/package.json nuxt/yarn.lock \
  nuxt/vitest.config.ts nuxt/vitest.component.config.ts
git commit -m "feat: add policy-typed HTML renderer"
```

---

### Task 6: Propagate Sanitized HTML Policies Through All 20 Sanitized Sinks

**Files:**
- Modify: `nuxt/app/lib/author-profile.ts`
- Modify: `nuxt/app/lib/reader-dictionary.ts`
- Modify: `nuxt/app/components/author/AuthorProfileContent.vue`
- Modify: `nuxt/app/components/author/AuthorWorksContent.vue`
- Modify: `nuxt/app/components/reader/ReaderDictionaryDialog.vue`
- Modify: `nuxt/app/components/reader/ReaderDictionaryLookup.vue`
- Modify: `nuxt/app/components/reader/ReaderFacsimileImage.vue`
- Modify: `nuxt/app/components/reader/ReaderSourceInfoDialog.vue`
- Modify: `nuxt/app/pages/dramawebben/[document].vue`
- Modify: `nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue`
- Modify: `nuxt/app/pages/författare/[author]/[document]/[article].vue`
- Modify: `nuxt/app/pages/författare/[author]/[document]/index.vue`
- Modify: `nuxt/server/utils/author-document.ts`
- Modify: `nuxt/server/utils/dramawebben-document.ts`
- Modify: `nuxt/server/utils/editor-reader-html.ts`
- Modify: `nuxt/server/utils/reader-ocr.ts`
- Modify: `nuxt/server/utils/reader-source-info.ts`
- Modify: `nuxt/server/utils/sla-article.ts`
- Modify: `nuxt/shared/types/author-document.ts`
- Modify: `nuxt/shared/types/dramawebben-document.ts`
- Modify: `nuxt/shared/types/editor-reader.ts`
- Modify: `nuxt/shared/types/reader-source-info.ts`
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/shared/types/sla-article.ts`
- Modify: `nuxt/test/unit/author-profile.spec.ts`, `reader-dictionary.spec.ts`, `reader-source-info.spec.ts`, `editor-reader-html.spec.ts`, `author-document.spec.ts`, `dramawebben-document.spec.ts`, `reader-source.spec.ts`, and `sla-article.spec.ts`; `nuxt/test/ssr/author-profiles.spec.ts`, `author-documents.spec.ts`, `dramawebben.spec.ts`, `editor-reader.spec.ts`, `reader.spec.ts`, and `sla-articles.spec.ts`; `nuxt/test/e2e/author-profiles.behavior.spec.ts`, `author-profiles.visual.spec.ts`, `author-documents.behavior.spec.ts`, `author-documents.visual.spec.ts`, `dramawebben.behavior.spec.ts`, `dramawebben.visual.spec.ts`, `editor-reader.behavior.spec.ts`, `editor-reader.mobile.behavior.spec.ts`, `editor-reader.visual.spec.ts`, `reader.behavior.spec.ts`, `reader-source-info.visual.spec.ts`, `sla-articles.behavior.spec.ts`, and `sla-articles.visual.spec.ts`.

**Interfaces:**
- Consumes: Task 5 issuers and renderer.
- Produces: policy-retaining DTO/view fields from each sanitizer through Nuxt serialization and all 20 sanitized render locations; no plain string reaches those sinks.

- [ ] **Step 1: Add RED type-propagation and exact-DOM assertions**

Extend the compile contract with `AuthorProfileView.introductionHtml`,
`sourceHtml`, and `portrait.captionHtml`; `ReaderOcrOverlay.html`;
`EditorReaderPage.html` and `overlayHtml`; author/Dramawebben/SLA document
`bodyHtml`; and Reader source-info `sourceDescriptionHtml`,
`workIntroductionHtml`, `licenseHtml`, errata `cellsHtml`, and Dramawebben
`rolesHtml`/`historyHtml`. Add normalized SSR/DOM assertions for one
representative of every distinct host: `div`, `figcaption`, `td`, overlay,
modal article, author-document body, and source-info joined rows. Assert an
ordinary string cannot be assigned to each listed field.

Run typecheck; expect failures until producers and DTOs retain capabilities.

- [ ] **Step 2: Brand at the sanitizer boundary, never at the component**

Change sanitizer return types to their exact policy and call the corresponding issuer only after successful allowlist serialization. Required signatures include:

```ts
export function sanitizeDictionaryArticle(markup: string): SanitizedHtml<"dictionary-article">
export function parseReaderOcrOverlay(source: string): ReaderOcrOverlay | null
export function sanitizeEditorEtextHtml(source: string): SanitizedHtml<"editor-etext"> | null
export function sanitizeReaderSourceInfoHtml(
  source: string,
  context?: "editorial" | "inline" | "license"
): SanitizedHtml<"reader-source-info">
export function sanitizeAuthorHtml(
  value: string | null | undefined
): SanitizedHtml<"author-profile">
export function parseAuthorDocumentBody(
  source: string,
  kind?: AuthorDocumentKind
): SanitizedHtml<"author-document">
export function parseDramawebbenDocumentBody(
  source: string
): SanitizedHtml<"dramawebben-document">
export function parseSlaArticleBody(source: string): SanitizedHtml<"sla-article">
```

Update shared DTO fields and page/view types so serialization never widens them to `string`. Use the branded empty helper for nullable/empty fallbacks.

- [ ] **Step 3: Replace all 20 sanitized `v-html` sinks**

Replace the native element plus directive with `RenderableHtmlContent`, preserving the exact `as` tag, `v-if`, class, style, ARIA, and click listener. Use `joinReaderSourceRows` for roles and the branded empty helper for errata cells. Components do not issue capabilities.

- [ ] **Step 4: Run sanitizer, SSR, behavior, and visual gates**

Run every unit, SSR, and E2E file explicitly listed in Task 6, then `yarn typecheck` and scoped ESLint with `--max-warnings 0` over every Task 6 implementation/test file.

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/author-profile.spec.ts test/unit/reader-dictionary.spec.ts \
  test/unit/reader-source-info.spec.ts test/unit/editor-reader-html.spec.ts \
  test/unit/author-document.spec.ts test/unit/dramawebben-document.spec.ts \
  test/unit/reader-source.spec.ts test/unit/sla-article.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/ssr/author-profiles.spec.ts test/ssr/author-documents.spec.ts \
  test/ssr/dramawebben.spec.ts test/ssr/editor-reader.spec.ts \
  test/ssr/reader.spec.ts test/ssr/sla-articles.spec.ts --project=ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/e2e/author-profiles.behavior.spec.ts test/e2e/author-profiles.visual.spec.ts \
  test/e2e/author-documents.behavior.spec.ts test/e2e/author-documents.visual.spec.ts \
  test/e2e/dramawebben.behavior.spec.ts test/e2e/dramawebben.visual.spec.ts \
  test/e2e/editor-reader.behavior.spec.ts \
  test/e2e/editor-reader.mobile.behavior.spec.ts test/e2e/editor-reader.visual.spec.ts \
  test/e2e/reader.behavior.spec.ts test/e2e/reader-source-info.visual.spec.ts \
  test/e2e/sla-articles.behavior.spec.ts test/e2e/sla-articles.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  app/lib/author-profile.ts app/lib/reader-dictionary.ts \
  app/components/author/AuthorProfileContent.vue \
  app/components/author/AuthorWorksContent.vue \
  app/components/reader/ReaderDictionaryDialog.vue \
  app/components/reader/ReaderDictionaryLookup.vue \
  app/components/reader/ReaderFacsimileImage.vue \
  app/components/reader/ReaderSourceInfoDialog.vue \
  'app/pages/dramawebben/[document].vue' \
  'app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue' \
  'app/pages/författare/[author]/[document]/[article].vue' \
  'app/pages/författare/[author]/[document]/index.vue' \
  server/utils/author-document.ts server/utils/dramawebben-document.ts \
  server/utils/editor-reader-html.ts server/utils/reader-ocr.ts \
  server/utils/reader-source-info.ts server/utils/sla-article.ts \
  shared/types/author-document.ts shared/types/dramawebben-document.ts \
  shared/types/editor-reader.ts shared/types/reader-source-info.ts \
  shared/types/reader.ts shared/types/sla-article.ts --max-warnings 0
git -C .. diff --exit-code 06add2bb..HEAD -- \
  'nuxt/test/visual/baselines/*author*' \
  'nuxt/test/visual/baselines/*dramawebben*' \
  'nuxt/test/visual/baselines/*editor-reader*' \
  'nuxt/test/visual/baselines/*reader-source-info*' \
  'nuxt/test/visual/baselines/*sla*'
```

Expected: all pass; `rg -n 'v-html='` reports only the six managed sinks owned by Tasks 7–8; relevant visual baseline hashes do not change.

- [ ] **Step 5: Commit sanitized capability propagation**

```bash
git add nuxt/app/lib/author-profile.ts nuxt/app/lib/reader-dictionary.ts \
  nuxt/app/components/author/AuthorProfileContent.vue \
  nuxt/app/components/author/AuthorWorksContent.vue \
  nuxt/app/components/reader/ReaderDictionaryDialog.vue \
  nuxt/app/components/reader/ReaderDictionaryLookup.vue \
  nuxt/app/components/reader/ReaderFacsimileImage.vue \
  nuxt/app/components/reader/ReaderSourceInfoDialog.vue \
  'nuxt/app/pages/dramawebben/[document].vue' \
  'nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue' \
  'nuxt/app/pages/författare/[author]/[document]/[article].vue' \
  'nuxt/app/pages/författare/[author]/[document]/index.vue' \
  nuxt/server/utils/author-document.ts nuxt/server/utils/dramawebben-document.ts \
  nuxt/server/utils/editor-reader-html.ts nuxt/server/utils/reader-ocr.ts \
  nuxt/server/utils/reader-source-info.ts nuxt/server/utils/sla-article.ts \
  nuxt/shared/types/author-document.ts nuxt/shared/types/dramawebben-document.ts \
  nuxt/shared/types/editor-reader.ts nuxt/shared/types/reader-source-info.ts \
  nuxt/shared/types/reader.ts nuxt/shared/types/sla-article.ts \
  nuxt/test/unit/author-profile.spec.ts nuxt/test/unit/reader-dictionary.spec.ts \
  nuxt/test/unit/reader-source-info.spec.ts nuxt/test/unit/editor-reader-html.spec.ts \
  nuxt/test/unit/author-document.spec.ts nuxt/test/unit/dramawebben-document.spec.ts \
  nuxt/test/unit/reader-source.spec.ts nuxt/test/unit/sla-article.spec.ts \
  nuxt/test/ssr/author-profiles.spec.ts nuxt/test/ssr/author-documents.spec.ts \
  nuxt/test/ssr/dramawebben.spec.ts nuxt/test/ssr/editor-reader.spec.ts \
  nuxt/test/ssr/reader.spec.ts nuxt/test/ssr/sla-articles.spec.ts \
  nuxt/test/e2e/author-profiles.behavior.spec.ts \
  nuxt/test/e2e/author-profiles.visual.spec.ts \
  nuxt/test/e2e/author-documents.behavior.spec.ts \
  nuxt/test/e2e/author-documents.visual.spec.ts \
  nuxt/test/e2e/dramawebben.behavior.spec.ts nuxt/test/e2e/dramawebben.visual.spec.ts \
  nuxt/test/e2e/editor-reader.behavior.spec.ts \
  nuxt/test/e2e/editor-reader.mobile.behavior.spec.ts \
  nuxt/test/e2e/editor-reader.visual.spec.ts nuxt/test/e2e/reader.behavior.spec.ts \
  nuxt/test/e2e/reader-source-info.visual.spec.ts \
  nuxt/test/e2e/sla-articles.behavior.spec.ts nuxt/test/e2e/sla-articles.visual.spec.ts
git diff --cached --name-only
git commit -m "refactor: type sanitized HTML rendering"
```

---

### Task 7: Validate and Type the Managed Reader E-Text Asset

**Files:**
- Create: `nuxt/shared/utils/managed-text.ts`
- Create: `nuxt/test/unit/managed-text.spec.ts`
- Modify: `nuxt/server/utils/reader-source.ts`
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/test/unit/reader-source.spec.ts`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`

**Interfaces:**
- Produces: `fetchManagedText(url, rules, fetcher): Promise<string>` with one request, final-authority validation, MIME validation, byte bound, and UTF-8 decoding; `ReaderEtextPage.html: ManagedAssetHtml<"reader-etext">`.

- [ ] **Step 1: Write RED managed-transport tests**

Cover a single successful request, exact byte decoding, accepted `text/html; charset=utf-8`, non-2xx, missing/wrong MIME, oversized `Content-Length`, oversized actual body, cross-authority final URL, path outside the allowed `/txt/` prefix, malformed UTF-8, and abort propagation. Assert the fetcher is called once in every non-retry case.

Run the new unit file and expect an import failure.

- [ ] **Step 2: Implement the one-request bounded reader**

Define:

```ts
export type ManagedTextRules = Readonly<{
  authorityOrigin: string
  allowedPathPrefixes: readonly string[]
  allowedContentTypes: readonly string[]
  maximumBytes: number
}>

export async function fetchManagedText(
  url: string,
  rules: ManagedTextRules,
  fetcher: typeof fetch = fetch
): Promise<string>
```

Follow redirects through the existing request, then validate `response.url`; do not preflight. Read the body once, enforce header and actual byte limits, decode with `TextDecoder("utf-8", { fatal: true })`, and propagate `AbortError`. Do not add retry behavior.

- [ ] **Step 3: Use the managed Reader authority at the existing asset boundary**

Build the same `/txt/{workId}/res_{index}.html?username=app` URL, validate the configured `readerSourceBase` origin and `/txt/` path, retain the existing maximum Reader HTML size, remove soft hyphens exactly as today, then call `issueManagedReaderHtml`. Update `ReaderEtextPage.html`, `markedReaderHtml`, and its class-highlighting transform to preserve `"reader-etext"` policy. Replace the final Reader `v-html` with `RenderableHtmlContent as="div"`.

- [ ] **Step 4: Verify Reader parity and request ownership**

Run managed-text and reader-source units, Reader SSR, full Reader behavior desktop/mobile, typecheck, and scoped lint. Assert exact HTML request URL/count, no extra preflight/proxy request, unchanged marked-span classes, horizontal-scroll behavior, no hydration warning, and unchanged Reader visual hashes.

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/managed-text.spec.ts test/unit/reader-source.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/ssr/reader.spec.ts --project=ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/e2e/reader.behavior.spec.ts \
  test/e2e/reader-dictionary-production.behavior.spec.ts \
  test/e2e/reader-final-parity.behavior.spec.ts \
  test/e2e/reader-production.behavior.spec.ts \
  test/e2e/reader-contents.visual.spec.ts \
  test/e2e/reader-faksimil.visual.spec.ts test/e2e/reader-hit.visual.spec.ts \
  test/e2e/reader-final-parity.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  shared/utils/managed-text.ts server/utils/reader-source.ts \
  shared/types/reader.ts \
  'app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue' \
  test/unit/managed-text.spec.ts test/unit/reader-source.spec.ts \
  test/ssr/reader.spec.ts test/e2e/reader.behavior.spec.ts --max-warnings 0
git -C .. diff --exit-code 06add2bb..HEAD -- \
  'nuxt/test/visual/baselines/*reader*'
```

- [ ] **Step 5: Commit the managed Reader boundary**

```bash
git add nuxt/shared/utils/managed-text.ts nuxt/test/unit/managed-text.spec.ts \
  nuxt/server/utils/reader-source.ts nuxt/shared/types/reader.ts \
  'nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue' \
  nuxt/test/unit/reader-source.spec.ts nuxt/test/ssr/reader.spec.ts \
  nuxt/test/e2e/reader.behavior.spec.ts
git commit -m "refactor: type managed Reader HTML"
```

---

### Task 8: Validate and Type Home, About, and Presentation Managed Assets

**Files:**
- Modify: `nuxt/shared/utils/managed-text.ts`
- Modify: `nuxt/shared/utils/renderable-html.ts`
- Modify: `nuxt/app/pages/index.vue`
- Modify: `nuxt/app/pages/om/[page].vue`
- Modify: `nuxt/app/pages/presentationer/[...segments].vue`
- Modify: `nuxt/app/pages/presentationer/presentation-parser.ts`
- Modify: `nuxt/test/unit/home-content-fixtures.spec.ts`, `home-page-parser.spec.ts`, `about-content-fixtures.spec.ts`, `presentation-content-fixtures.spec.ts`, `presentation-parser.spec.ts`; `nuxt/test/ssr/home-page.spec.ts`, `about-pages.spec.ts`, `presentations.spec.ts`; `nuxt/test/e2e/home-page.behavior.spec.ts`, `home-page.visual.spec.ts`, `about-pages.behavior.spec.ts`, `about-pages.visual.spec.ts`, `about-help.behavior.spec.ts`, `about-help.visual.spec.ts`, `presentations.behavior.spec.ts`, and `presentations.visual.spec.ts`.

**Interfaces:**
- Consumes: Task 7 transport and Task 5 managed capability issuers.
- Produces: `ManagedAssetHtml<"home-editorial" | "about-editorial" | "presentation-editorial">`, policy-typed Presentation style text, and authority/path-only stylesheet hrefs; zero remaining `v-html`.

- [ ] **Step 1: Characterize current production-fixture bytes and requests**

Add fixture tests recording source byte length, content type, extracted body HTML, structural parser output, linked stylesheet hrefs, inline style text, background rules, and one request per currently fetched HTML/XML asset. Add failure cases for wrong origin/path, redirect, MIME, actual/header oversize, and malformed UTF-8. These tests must pass against the checked-in current fixtures before transport changes.

- [ ] **Step 2: Fetch only currently fetched bodies through `fetchManagedText`**

Use named rules and explicit maxima for:

- home HTML under its current managed path;
- all declared About/help HTML paths;
- Presentation HTML and `backgrounds.xml`.

Preserve current empty/error states. Do not fetch linked stylesheet bodies. Validate linked stylesheet href authority/path only and issue `ManagedStylesheetHref`; issue inline/background style text from the already validated parent document through the corresponding named issuer.

- [ ] **Step 3: Retain policy through each parser and replace five sinks**

Change `HomeContent.bodyHtml`, About `content`, and `PresentationDocument.bodyHtml` to exact managed capabilities. Parser transformations return the same byte-normalized strings under the same authority. Replace the home `div`, two About `section`/`div` hosts, and two Presentation `div` hosts with `RenderableHtmlContent` using the same tags/listeners/classes/styles.

- [ ] **Step 4: Prove exact markup, navigation, requests, SSR, and visuals**

Run every unit, SSR, behavior, and visual file explicitly listed in Task 8; run typecheck and scoped lint. Compare normalized pre/post SSR and hydrated DOM serialization and assert the fixture request ledgers are unchanged. Run:

```bash
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn vitest run \
  test/unit/home-content-fixtures.spec.ts test/unit/home-page-parser.spec.ts \
  test/unit/about-content-fixtures.spec.ts \
  test/unit/presentation-content-fixtures.spec.ts test/unit/presentation-parser.spec.ts
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/ssr/home-page.spec.ts test/ssr/about-pages.spec.ts \
  test/ssr/presentations.spec.ts --project=ssr
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn playwright test \
  test/e2e/home-page.behavior.spec.ts test/e2e/home-page.visual.spec.ts \
  test/e2e/about-pages.behavior.spec.ts test/e2e/about-pages.visual.spec.ts \
  test/e2e/about-help.behavior.spec.ts test/e2e/about-help.visual.spec.ts \
  test/e2e/presentations.behavior.spec.ts test/e2e/presentations.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
rg -n 'v-html=' app --glob '*.vue'
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn eslint \
  shared/utils/managed-text.ts shared/utils/renderable-html.ts \
  app/pages/index.vue 'app/pages/om/[page].vue' \
  'app/pages/presentationer/[...segments].vue' \
  app/pages/presentationer/presentation-parser.ts \
  test/unit/home-content-fixtures.spec.ts test/unit/home-page-parser.spec.ts \
  test/unit/about-content-fixtures.spec.ts \
  test/unit/presentation-content-fixtures.spec.ts \
  test/unit/presentation-parser.spec.ts test/ssr/home-page.spec.ts \
  test/ssr/about-pages.spec.ts test/ssr/presentations.spec.ts \
  test/e2e/home-page.behavior.spec.ts test/e2e/home-page.visual.spec.ts \
  test/e2e/about-pages.behavior.spec.ts test/e2e/about-pages.visual.spec.ts \
  test/e2e/about-help.behavior.spec.ts test/e2e/about-help.visual.spec.ts \
  test/e2e/presentations.behavior.spec.ts test/e2e/presentations.visual.spec.ts \
  --max-warnings 0
git -C .. diff --exit-code 06add2bb..HEAD -- 'nuxt/test/visual/baselines/*'
```

Expected: no matches. `git diff --exit-code 06add2bb..HEAD -- 'nuxt/test/visual/baselines/*'` must remain empty for every affected baseline.

- [ ] **Step 5: Commit managed editorial capabilities**

```bash
git add nuxt/shared/utils/managed-text.ts nuxt/shared/utils/renderable-html.ts \
  nuxt/app/pages/index.vue 'nuxt/app/pages/om/[page].vue' \
  'nuxt/app/pages/presentationer/[...segments].vue' \
  nuxt/app/pages/presentationer/presentation-parser.ts \
  nuxt/test/unit/home-content-fixtures.spec.ts \
  nuxt/test/unit/home-page-parser.spec.ts \
  nuxt/test/unit/about-content-fixtures.spec.ts \
  nuxt/test/unit/presentation-content-fixtures.spec.ts \
  nuxt/test/unit/presentation-parser.spec.ts \
  nuxt/test/ssr/home-page.spec.ts nuxt/test/ssr/about-pages.spec.ts \
  nuxt/test/ssr/presentations.spec.ts \
  nuxt/test/e2e/home-page.behavior.spec.ts nuxt/test/e2e/home-page.visual.spec.ts \
  nuxt/test/e2e/about-pages.behavior.spec.ts nuxt/test/e2e/about-pages.visual.spec.ts \
  nuxt/test/e2e/about-help.behavior.spec.ts nuxt/test/e2e/about-help.visual.spec.ts \
  nuxt/test/e2e/presentations.behavior.spec.ts \
  nuxt/test/e2e/presentations.visual.spec.ts
git diff --cached --name-only
git commit -m "refactor: type managed editorial HTML"
```

---

### Task 9: Enforce Architecture Policy and Blocking Frontend/Release Gates

**Files:**
- Create: `nuxt/scripts/verify-architecture-policy.mjs`
- Create: `nuxt/test/unit/architecture-policy.spec.ts`
- Modify: `nuxt/package.json`
- Modify: `tasks.py`
- Modify: `test/test_tasks.py`
- Modify: `docs/quality.md`
- Modify: `nuxt/test/nuxt/renderable-html-contract.ts`

**Interfaces:**
- Consumes: zero lint and every prior task's policy boundary.
- Produces: `yarn policy:check`, `invoke quality.frontend`, and `invoke quality.release`; zero is the documented and enforced baseline.

- [ ] **Step 1: Write RED policy-verifier fixtures and Invoke task tests**

The verifier tests create temporary source trees and prove failure for:

- `v-html`;
- `eslint-disable` or `@ts-ignore`;
- `@ts-expect-error` outside `author-works-contract.ts`, `reader-source-info-contract.ts`, and `renderable-html-contract.ts`, or without a description;
- live-DOM `innerHTML` outside `RenderableHtmlContent.vue`;
- detached-DOM `innerHTML` outside the exact reviewed sanitizer/highlighter file allowlist;
- a generic exported branding function or capability assertion outside `shared/utils/renderable-html.ts`;
- an ESLint `rules` override or any ignore beyond the current seven generated/build/test-output paths.

Task tests require `quality.frontend` to run `policy:check`, lint, typecheck, all units, build, and SSR; require `quality.release` to run backend, contract, frontend, full E2E, and the visual-baseline diff/hash check. Run tests and expect missing commands/tasks.

- [ ] **Step 2: Implement the deterministic policy verifier**

Use only Node `fs`, `path`, and explicit recursive traversal; ignore exactly `.nuxt`, `.output`, `node_modules`, `app/lib/api/generated`, `coverage`, `playwright-report`, and `test-results*`. Keep explicit path allowlists for detached sanitizer/highlighter `innerHTML` and the three negative compile-contract files. Print every violation and exit nonzero; print the audited file count on success.

- [ ] **Step 3: Wire package and Invoke tasks**

Add:

```json
"policy:check": "node scripts/verify-architecture-policy.mjs"
```

Implement `quality.frontend` with deterministic `context.run` calls from `nuxt/` under Node 22.22. Implement `quality.release` as the explicit backend + contract + frontend + full desktop/mobile E2E gate, followed by a Git diff/hash assertion over committed visual baselines. Do not hide a failing command with `warn=True`.

- [ ] **Step 4: Update contract compilation and quality documentation**

Add `renderable-html-contract.ts` to the standalone strict contract command. Replace the 48-file/89-error/28-warning baseline in `docs/quality.md` with zero. Document capability policies, allowed detached DOM, managed asset versus sanitized HTML, the no-prefetch stylesheet rule, and the next generated Reader/Editor manifest tranche.

- [ ] **Step 5: Run the focused policy/task gates**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
python -m pytest -q test/test_tasks.py
cd nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn policy:check
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn lint
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn typecheck
```

Expected: all green, with ESLint reporting zero errors and zero warnings.

- [ ] **Step 6: Run the complete release evidence**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.backend
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.contract
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH invoke quality.frontend
cd nuxt
PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:$PATH yarn test:e2e
cd ..
git diff --check
git diff --exit-code 06add2bb..HEAD -- 'nuxt/test/visual/baselines/*'
git status --short
```

Expected: strict backend/contract drift passes; frontend policy/lint/type/unit/build/SSR passes; full E2E passes with only declared skips; baselines have no diff; status contains only the user's unrelated pre-existing files.

- [ ] **Step 7: Request independent review and commit the gate**

Request one policy/security review and one parity/test-ownership review. Fix findings and rerun affected gates plus the complete release evidence. Then:

```bash
git add nuxt/scripts/verify-architecture-policy.mjs \
  nuxt/test/unit/architecture-policy.spec.ts nuxt/package.json \
  nuxt/test/nuxt/renderable-html-contract.ts \
  tasks.py test/test_tasks.py docs/quality.md
git commit -m "chore: enforce zero-lint Nuxt quality"
```

## Requirement-to-Test Matrix

| Requirement | Primary evidence |
| --- | --- |
| Exact 117-diagnostic elimination | full `yarn lint` with `--max-warnings 0`, before/after JSON inventory |
| No suppressed or weakened lint policy | `policy:check`, policy unit fixtures, exact ESLint ignore/rule audit |
| Malformed JSON remains negative evidence | unchanged 40 cases plus `malformed-json.spec.ts` |
| Unicode/path/URL acceptance parity | text-safety code-unit matrix plus existing validator suites |
| Dramawebben route/DOM parity | exact repeated-query E2E, SSR/pre-hydration/portal serialization, immutable catalog visuals |
| Sanitized HTML cannot widen to string | generated/shared DTO compile contract and sanitizer unit tests |
| Managed HTML risk is explicit and bounded | managed transport failure matrix, authority/path/content-type/byte tests |
| No new asset request ownership | exact Reader/home/About/Presentation request ledgers; no stylesheet prefetch |
| Sole live-DOM renderer | renderer matrix plus policy scan for live/detached `innerHTML` |
| Exact visuals and interaction | focused then complete desktop/mobile Playwright; immutable baseline hashes |
| CI-quality enforcement | deterministic Invoke task tests; `quality.frontend` and `quality.release` |
| Contract artifacts unchanged | `quality.contract`, OpenAPI snapshot, generated TypeScript drift |

## Plan Self-Review

- Spec coverage: all diagnostic rule groups, policy-capability distinctions, managed Reader/editorial authority, exact three-root Dramawebben DOM, zero-lint gate, full release parity, and next-tranche documentation are assigned.
- Scope: this plan intentionally does not add Reader/Editor FastAPI manifest operations; it establishes the blocking frontend gate required before that separately specified contract tranche.
- Type consistency: policy and authority names are introduced once in Task 5 and retained verbatim through Tasks 6–9.
- Completeness scan: the plan contains no unfinished markers, generic error-handling instruction, or undefined later operation.
- Test ownership: lint owns syntax/rules; unit tests own helpers, policies, Unicode, and transports; compile contracts own type rejection; SSR/E2E own DOM, hydration, requests, routes, and visuals; Invoke tests own command composition.
