# Nuxt SLA Article Family Implementation Plan

Design: `docs/superpowers/specs/2026-07-19-nuxt-sla-articles-design.md`

Backend: `/Users/johan/.codex/worktrees/8c5c/lb-backend`

Frontend: `/Users/johan/.codex/worktrees/8c5c/littb`

The plan is pre-approved under the active migration goal. Use TDD, preserve the
current visuals and native fragment behavior exactly, fetch in page-local
`<script setup>`, and do not introduce a composable or footnote component.

Preserve the unrelated modified supplemental-author plan and untracked
`.superpowers/` content. Do not stop the protected servers on 3000, 8000, 3018,
4102. Stage only exact task files and use isolated test ports.

### Task 1: Add the exact typed FastAPI article registry

**Files**

- Modify backend v2 models/authors, their focused tests, and `openapi/v2.json`.

- [ ] Write RED tests for a 23-member `SlaArticleId`, strict
  `SlaArticleDescriptor`, the exact route, provider preflight, normalized-author
  validation, 404/422/500 behavior, and unchanged existing document contracts.
- [ ] Implement one explicit filename-to-source mapping. Never form a source
  path by concatenating a route value.
- [ ] Regenerate OpenAPI; run focused and full v2 tests plus compile/diff checks.
- [ ] Commit as `feat(api): type SLA article registry` and independently review.

### Task 2: Generate the frontend type and freeze all 23 sources

**Files**

- Regenerate `nuxt/app/lib/api/generated/lbapi.ts`.
- Add shared SLA article types/registry.
- Add 23 exact files below a dedicated fixture content directory.
- Extend fixture server/data and unit tests.

- [ ] Write RED tests proving the generated 23-member union, exact descriptor
  routes, fixed source paths, byte counts/hashes/media types, cross-link closure,
  independent ledgers, and rejection of wildcard/variant/query/non-GET probes.
- [ ] Fetch and store exact bytes from the audited first-party URLs without
  formatting or serialization.
- [ ] Derive the TypeScript article union from generated OpenAPI; keep a runtime
  exact registry whose completeness is checked against fixture/schema data.
- [ ] Run generation check, focused unit tests, typecheck, and diff checks.
- [ ] Commit as `test(nuxt): freeze SLA article corpus` and independently review.

### Task 3: Capture deterministic Angular authority

**Files**

- Add an SLA article Angular authority spec and representative baselines.

- [ ] Freeze the closed request firewall and exact ready state for:
  `TextkritiskaRiktlinjer.html`, `Introduktion.html`,
  `ForeGostaBerling.html`, `SprakandringarGBS.html`, and
  `AboutTheSLagerlofArchive.html`, at desktop and mobile widths.
- [ ] Assert the exact shell, metadata, body inventory, internal/external links,
  visible author heading, hidden local links, absent portrait, fonts/background,
  and the one known legacy selector warning where footnotes are present.
- [ ] Prove native reference click changes the hash, scrolls to the exact note,
  renders no popover, and performs no content refetch.
- [ ] Record immutable hashes and prove all earlier author-document/SLA landing
  hashes remain byte-identical.
- [ ] Commit as `test(nuxt): capture SLA article authority` and independently
  review.

### Task 4: Build the bounded article Nitro boundary

**Files**

- Add a nested author-document API route and dedicated SLA article utility.
- Extend fixture controls, unit tests, and SSR API tests.

- [ ] Write RED descriptor/source validation, exact tuple, media-type, redirect,
  cancellation, declared/streamed size, parse/body, active subtree, attributes,
  styles, URLs, fragments, tables, and malformed relative-link tests.
- [ ] Implement descriptor validation against the generated registry and the
  fixed expected source path, reusing proven fetch/stream helpers where safe.
- [ ] Implement the article-specific sanitizer from the audited DOM/attribute/
  style/href inventory. Preserve paired footnote IDs/fragments and drop
  `href="italic"`.
- [ ] Compare every sanitized corpus href ledger to its frozen source ledger.
  Preserve the bounded canonical and legacy cross-author/profile/Reader/work,
  registered article, exact Library query, PDF, and external HTTP(S) families;
  prove unrecognized root-relative or query-bearing variants are removed.
- [ ] Prove other authors, unknown/case/encoded/traversal article values, query
  source paths, and extra descriptor fields fail closed before source fetching.
- [ ] Run focused unit/API SSR/typecheck/diff checks.
- [ ] Commit as `feat(nuxt): bound SLA article sources` and independently review.

### Task 5: Render the nested page with page-local SSR ownership

**Files**

- Create `nuxt/app/pages/författare/[author]/[document]/[article].vue`.
- Add SSR and browser behavior suites.

- [ ] Write RED direct-SSR, hydration, metadata/shell, article-navigation,
  fragment/query history, native-footnote, error, no-fan-out, stale-result, and
  browser-firewall tests.
- [ ] Validate only `LagerlöfS/omtexterna/<registry member>` before fetching.
  Fetch the same-origin article API inside `<script setup>` with a query-free
  identity and accepted-result guard. Do not add a composable.
- [ ] Reuse the exact SLA landing shell, layout-neutral wrapper, `.page_content
  > .content.unbox`, title/description, background, and state classes. Add no
  popup, portrait, or CSS changes.
- [ ] Run focused SSR/behavior, landing regressions, typecheck, and diff checks.
- [ ] Commit as `feat(nuxt): render SLA article family` and independently review.

### Task 6: Prove strict parity and close the family

**Files**

- Add representative Nuxt visual comparisons and a closure report under
  `.superpowers/sdd/`.

- [ ] Compare the five representative desktop/mobile pages against Angular at
  zero tolerance after exact fonts/background/body readiness.
- [ ] Assert no browser API/content refetch on hydration, fragments, or query
  history; no production-origin request; no popup; and exact request ledgers.
- [ ] Re-run all prior author-document/SLA landing visual hashes unchanged.
- [ ] Run full frontend unit, SSR, typecheck, build, schema generation/check,
  backend v2, compile, artifact, and diff checks.
- [ ] If and only if a strict diff proves a framework-only DOM mismatch, make
  the smallest DOM correction and repeat all proof.
- [ ] Commit tests as `test(nuxt): verify SLA article parity`; independently
  review the complete slice and record exact evidence in the progress ledger.
