# Typed Author Works Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/författare/:author/titlar` and `/författare/:author/mer` to visually faithful, SSR-complete Nuxt pages backed by one strict display-ready Author Works API.

**Architecture:** FastAPI performs one selected-field author lookup and ten bounded legacy work searches, validates and groups the raw representations, and returns fixed authored/about section arrays. Each Nuxt page fetches that generated contract directly in `<script setup>` and renders one shared presentational listing component with deterministic Angular visual authority.

**Tech Stack:** FastAPI, Pydantic v2, OpenSearch DSL, Nuxt 4, Vue 3, openapi-fetch/openapi-typescript, Vitest, Pytest, Playwright, Tailwind plus copied legacy SCSS.

**Design:** `docs/superpowers/specs/2026-07-17-nuxt-author-works-design.md`

## Global constraints

- Architectural migration only: preserve Swedish copy, editorial content,
  routes, DOM/CSS hooks, link order, native anchors/downloads, and visuals.
- Backend owns provider queries, auxiliary audio/map lookups, validation,
  grouping, sorting, media expansion, and final URLs. Nuxt never consumes raw
  OpenSearch rows.
- Each page fetches inside `<script setup>`; do not add a one-use works
  composable/store. A shared pure view helper and presentational component are
  allowed because two pages use them.
- Generate frontend types only from the checked-in backend OpenAPI snapshot.
- Preserve the legacy 10,000 whole-work and 1,000 part ceilings and reject
  overflow rather than silently truncating.
- Do not modify production Angular sources or existing baselines. Authority
  capture must be deterministic, intercepted, fail-closed, and free of live API
  or Nuxt proxy fallback.
- `/semer` and other managed Author documents remain deferred.
- Follow red-green-refactor. Commit and independently review every task before
  starting the next task.

---

### Task 1: Define the strict models and backward-compatible provider boundary

**Repository:** `/Users/johan/.codex/worktrees/8c5c/lb-backend`

**Files:**
- Modify: `lbapi/v2/models.py`
- Modify: `lbapi/elasticapi.py`
- Create: `test_lbapi/v2/test_author_works.py`
- Modify: existing elasticapi helper tests at the discovered test location

**Interfaces:**
- Produces the strict models from the design.
- Extends `list_parts_in_others_works(authorid, about_author=False,
  show_all=False, *, includes=(), excludes=(), limit=1000,
  sort_field=None)` without changing old calls.

- [ ] Add RED model tests for every required field, nested `extra="forbid"`,
  exact serialization, the `kind`-discriminated read/download action union, and
  every rejected media/kind/filename cross-combination. Read actions permit
  only etext/faksimil/infopost with a null filename; downloads permit only
  EPUB/PDF with a required nonempty filename.
- [ ] Add RED helper tests proving the old three-positional call builds the same
  query, source behavior, 1,000 size, and ordering as before, while keyword-only
  overrides forward exact includes/excludes/limit/sort.
- [ ] Run the focused tests and observe the intended missing-model/signature
  failures while unrelated existing helper tests remain green.
- [ ] Implement the models and helper extension without importing v2 code into
  the legacy provider layer.
- [ ] Run focused model/helper tests, the full relevant legacy provider suite,
  and `git diff --check`.
- [ ] Commit `feat(api): define author works contract` and prepare an exact
  review package.

---

### Task 2: Query and normalize all Author works sections

**Repository:** backend

**Files:**
- Create: `lbapi/v2/author_works.py`
- Modify: `test_lbapi/v2/test_author_works.py`
- Reuse: selected author-shell helpers from `lbapi/v2/authors.py` without a
  public profile round trip

**Interfaces:**
- Consumes `elasticapi.search_work_by_authors`, the extended
  `list_parts_in_others_works`, one exact author lookup, one bounded map query,
  and one timeout-bounded WordPress audio lookup.
- Produces pure `transform_author_works(...)` and
  `query_author_works(author_id) -> AuthorWorksResponse`.

- [ ] Add RED provider tests for one exact author-shell lookup plus the six
  authored and four about searches, including precise indices, roles, about
  flags, show filter, selected fields, sort fields, and ceilings. Separately
  prove the exact map query and exact lowercased audio slug request, finite
  timeout, and response validation. Prove each optional lookup independently
  yields a null URL on OpenSearch/transport/malformed failure while core
  author/work results remain 200; core-provider failures retain typed 503/500.
- [ ] Add RED raw-shape fixtures for rich/sparse/no-work authors, whole works,
  distinctly authored parts, contributor parts, infopost, EPUB export,
  generated PDF, and real-PDF suppression.
- [ ] Add RED pure-transform tests for tuple grouping, title ID precedence,
  media/action order, exact dedupe, group-wide identity/title conflicts,
  allowed etext/faksimil page differences, rejected duplicate-same-media page
  conflicts,
  filenames, encoded destinations, title URLs/tooltips, containing work,
  distinct action/display/containing-author precedence, fixed sections/labels,
  exact `name_for_index` output, the conditional `Texter om ...`, Ljud, map, and
  Presentation-fallback links, stable ascending sorts, literal null-shorttitle
  tooltip behavior, and overflow/malformed failures.
- [ ] Run focused tests RED and preserve their failure output in the task report.
- [ ] Implement narrow provider field tuples and pure fail-closed normalization.
  Do not import `lbapi.web` or reproduce `list_parts_in_others_works` DSL.
- [ ] Run focused tests, all Author/profile tests, model tests, compile, and
  `git diff --check`.
- [ ] Commit `feat(api): normalize author works` and independently review it.

---

### Task 3: Publish the endpoint and checked OpenAPI contract

**Repository:** backend

**Files:**
- Modify: `lbapi/v2/author_works.py`
- Modify: `lbapi/v2/app.py`
- Modify: `test_lbapi/v2/test_api.py`
- Modify: `test_lbapi/v2/test_openapi.py`
- Modify generated snapshot: `openapi/v2.json`

**Interfaces:**
- Produces `GET /authors/{author_id}/works`, operation
  `v2_get_author_works`, typed 200/404/422/500/503 responses.

- [ ] Add RED route tests for rich/empty, missing/hidden, invalid ID, provider
  503, malformed non-leaking 500, GET-only behavior, one query invocation, and
  exact response serialization.
- [ ] Add RED OpenAPI tests for the operation ID, path/method, schema graph,
  required arrays/fields/enums, discriminated action union, impossible-action
  rejection, error references, and exact stable v2 path set.
- [ ] Register an `authors`-tagged router using established global error
  handling; do not broadly catch or expose provider exceptions.
- [ ] Export `openapi/v2.json`, run snapshot check, the full `test_lbapi/v2`
  suite, compile, and `git diff --check`.
- [ ] Commit `feat(api): publish author works` and independently review it.

---

### Task 4: Regenerate the client and create isolated Author Works fixtures

**Repositories:** backend snapshot above; frontend `/Users/johan/.codex/worktrees/8c5c/littb`

**Files:**
- Regenerate: `nuxt/app/lib/api/generated/lbapi.ts`
- Create: `nuxt/test/fixtures/author-works-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Produces generated Author Works schema/path types and deterministic
  `/private-v2`/`/v2` responses with separate request ledgers.

- [ ] Add RED type assertions (including compile-time rejection of impossible
  action combinations) and fixture tests for rich `/titlar` and `/mer`,
  sparse/empty, RFC3986 author ID, malformed, 404, failed, and keyed delays.
- [ ] Require isolated `GET|DELETE /_author_works_requests` and keyed
  failure/delay controls; reset must not affect profile, Reader, or Library
  ledgers.
- [ ] Regenerate from the canonical backend snapshot and run `api:check`.
- [ ] Implement page-independent fixture data with exact generated-type
  `@satisfies` checks and private/public request provenance.
- [ ] Run focused fixture tests, the full frontend unit suite, API check, and
  `git diff --check`.
- [ ] Commit `test(nuxt): model author works` and independently review it.

---

### Task 5: Render `/titlar` and `/mer` with SSR and native interactions

**Repository:** frontend

**Files:**
- Create: `nuxt/app/components/author/AuthorWorksContent.vue`
- Create: `nuxt/app/pages/författare/[author]/titlar/index.vue`
- Create: `nuxt/app/pages/författare/[author]/mer.vue`
- Create or modify: a shared pure `nuxt/app/lib/author-works.ts` only for logic
  used by both pages
- Modify: `nuxt/nuxt.config.ts` only for exact `/export/faksimil/**` dev proxy
- Create: `nuxt/test/unit/author-works.spec.ts`
- Create: `nuxt/test/ssr/author-works.spec.ts`
- Create: `nuxt/test/e2e/author-works.behavior.spec.ts`

**Interfaces:**
- Consumes the generated endpoint directly inside both page scripts.
- Produces exact Author header/navigation/listing/sidebar DOM and route-keyed
  client transitions.

- [ ] Add RED unit/SSR tests for author validation, paths/year formatting,
  exact private request, zero raw provider data, fixed section selection, rich
  and empty rows, sidebar difference, metadata/body/background, typed
  404/503, malformed response, and no hydration duplicate.
- [ ] Add RED browser tests for every read/download/title/author/containing-work
  destination, native modified-click/keyboard semantics, exact `download`
  filenames, null-shorttitle hover tooltip, conditional Ljud/map/Texter om/
  Presentation-fallback destinations, external target hardening, direct entry,
  Back/Forward, and delayed author-to-author transitions with no stale heading/
  portrait/section/head.
- [ ] Implement page-local generated-client fetches with explicit route-keyed
  response identity/status. Server errors set status; client transitions render
  bounded loading/error content without leaving old author data visible.
- [ ] Build the shared component from the Angular `listing.html` and portrait
  evidence. Use ordinary anchors; never emulate navigation in click handlers or
  nest interactive elements.
- [ ] Add only the exact development proxy exclusion/route needed for generated
  PDFs and prove other API/Reader proxy behavior is unchanged.
- [ ] Run unit, SSR, behavior, existing Author profile behavior, typecheck,
  build, API check, and `git diff --check`.
- [ ] Commit `feat(nuxt): render author works` and independently review it.

---

### Task 6: Capture Angular authority and match Author Works visuals

**Repository:** frontend

**Files:**
- Create: `nuxt/playwright.author-works-angular.config.ts`
- Create: `nuxt/test/visual/capture-author-works-angular.spec.ts`
- Create: `nuxt/test/e2e/author-works.visual.spec.ts`
- Create: six `nuxt/test/visual/baselines/author-works-*.png`
- Modify production Vue/SCSS only when a fresh authority screenshot proves the
  need

**Visual matrix:**
- rich `/författare/{author}/titlar`, desktop/mobile;
- rich `/författare/{author}/mer`, desktop/mobile;
- sparse `/författare/{author}/titlar`, desktop/mobile.

- [ ] Extend the established Author capture ledger and assert exact signatures
  and counts for the Author request, `/api/get_authors`, ten work calls, map
  query, external WordPress audio probe, portrait/background assets,
  `backgrounds.xml`, `etext.css`, authority font, and analytics bootstrap.
  Intercept the otherwise unused managed HTML request exactly once at
  `/red/forfattare/{authorid_norm}/semer/index.html` for `/mer` and zero times
  for `/titlar`, without adding that request to Nuxt. Reject unexpected/live/
  provider escape and negative-probe work, auxiliary API, external-audio,
  managed-document, and static-asset families before any baseline write.
- [ ] Capture all six Angular baselines fresh and record image hashes. Do not
  read or overwrite an existing baseline before provenance checks pass.
- [ ] Add Nuxt visual comparisons using the same data, viewports, font readiness,
  route readiness, scroll position, and strict existing tolerance.
- [ ] Run RED comparisons and classify each measured difference before changing
  production DOM/CSS.
- [ ] Make the minimum `.page-authorInfo`-scoped changes needed for parity;
  preserve the already-reviewed Author profile pages and unrelated routes.
- [ ] Run fresh Angular 6/6, Nuxt visual 6/6, Author Works behavior/SSR/unit,
  Author profile regression suites, full frontend unit, backend full v2,
  typecheck, build, API drift, and both repository diff checks.
- [ ] Commit authority and parity separately, prepare exact binary review
  packages, and obtain a clean independent review before marking the slice
  complete.

## Final evidence ledger

Record exact commands, counts, hashes, commit ranges, review findings/fixes,
and worktree status in `.superpowers/sdd/author-works-task-*-report.md`. Preserve
the user's untracked `.superpowers/` material and do not stage it.
