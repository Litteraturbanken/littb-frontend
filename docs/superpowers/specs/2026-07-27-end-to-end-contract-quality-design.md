# End-to-End Contract and Code Quality Design

**Status:** Approved on 2026-07-27

## Context

The Nuxt migration already has a useful typed foundation:

- FastAPI v2 exposes 23 operations and 76 closed OpenAPI schemas.
- `openapi/v2.json` is committed and checked for drift.
- `openapi-typescript` generates `nuxt/app/lib/api/generated/lbapi.ts`.
- Nuxt uses strict TypeScript with `noUncheckedIndexedAccess` and approximately
  twenty production consumers already call the generated `openapi-fetch`
  client.
- Production Nuxt source contains no explicit `any`, but the full ESLint
  baseline is still 104 errors and 28 warnings. Production source accounts
  for 41 errors and 28 warnings; most remaining explicit `any` findings are in
  tests.

The largest untyped application boundary is the Library page. It calls more
than ten legacy endpoints through `$fetch<unknown>`, then reconstructs and
validates several legacy OpenSearch response variants inside one very large
Vue file. That makes backend changes visible only at runtime and duplicates
transport knowledge in the frontend.

The backend v2 package uses Ruff but has no static type checker. The v2 test
suite currently collects 1,392 cases. Several tests protect valuable domain,
security, caching, and error behavior, but the suite also contains tests of
implementation syntax (for example whether a FastAPI endpoint is declared
with `def` rather than `async def`) and long manual restatements of an OpenAPI
schema already protected by the committed snapshot.

This design establishes one quality program across the FastAPI v2 contract
and the Nuxt v2 application without changing appearance or user-visible
behavior.

## Goals

1. Every Nuxt-owned backend call, including Library, crosses an explicit
   FastAPI v2 request/response contract and the generated TypeScript client.
2. Backend request, success, and error payloads are strict Pydantic models;
   raw OpenSearch or legacy API structures never become public v2 contracts.
3. Generated OpenAPI types remain authoritative through frontend fetching,
   page state, transformations, and component props until an explicit local
   view-model boundary.
4. Nuxt has zero ESLint errors and zero warnings under
   `eslint . --max-warnings 0`, without broad suppressions or convenience rule
   downgrades.
5. FastAPI v2 production code passes strict mypy with the Pydantic plugin and
   contains no untyped function definitions or unparameterized containers.
6. Contract drift, code generation drift, type errors, lint errors, and
   behavior regressions fail deterministic quality commands.
7. Backend tests are concise evidence for specification behavior, not a proxy
   for line count or implementation syntax.
8. Existing Angular visual and behavior parity remains unchanged throughout.

## Non-goals

- Rewriting the legacy AngularJS application or cleaning its lint output.
- Typing every historical endpoint in the legacy FastAPI application.
- Exposing raw Elasticsearch/OpenSearch query or response structures as v2
  DTOs.
- Moving page-specific fetching into composables. If a model is used by one
  page or component, its request stays in that component's `<script setup>`.
- Replacing the established visuals, copy, routes, or interaction patterns.
- Making all 4,000-plus advisory `ruff check --select ALL` findings a blocking
  gate. The previously approved safe-only Ruff policy remains in force; mypy
  becomes the backend static type gate and correctness-oriented Ruff checks
  remain available separately from subjective style inventory.
- Modeling editorial HTML, XML, images, or third-party/static content in the
  bibliographic OpenAPI contract.

## Architectural boundary

```text
Legacy storage, OpenSearch, and existing provider functions
                         |
                         v
         typed v2 provider/adapters (private Python types)
                         |
                         v
 strict Pydantic request / success / error DTOs (public contract)
                         |
                         v
        deterministic committed OpenAPI v2 snapshot
                         |
                         v
        generated openapi-typescript paths and schemas
                         |
                         v
                 openapi-fetch client
                         |
                         v
        page-local typed view-model transformations
                         |
                         v
                  Vue components/templates
```

The public contract boundary is the serialized Pydantic DTO, not a provider
dictionary and not a TypeScript interface. Python adapters may accept
untrusted legacy values as `object` or a deliberately small `TypedDict`, but
they must validate and normalize those values before constructing a response
model.

Nuxt may define local view models for presentation concerns such as grouped
dates, route objects, tooltip state, or localized labels. A local view model
must be visibly derived from a generated schema type; it must not duplicate a
transport payload or redefine backend nullability.

External editorial HTML/XML/image sources remain outside OpenAPI. Each source
has one narrow runtime-validation/sanitization boundary returning a local
domain type. `unknown` is permitted only at such an untrusted boundary and
must not escape it.

## FastAPI v2 contract ownership

All v2 Pydantic DTOs use the existing strict base-model policy with
`extra="forbid"`. Required nullable fields remain required so omission and
`null` have distinct meanings in generated TypeScript. Bounded strings,
lists, integers, identifiers, and discriminated unions are expressed in the
model rather than in prose-only tests.

Every operation declares:

- an explicit request model for nontrivial query/body input;
- an explicit success `response_model`;
- the shared typed error envelope for every documented failure status;
- a stable `operationId`;
- no undeclared object dictionaries in its public schema.

Provider adapters receive and return typed values. A legacy library response,
for example, is parsed once in Python and becomes a stable bibliographic DTO.
The frontend does not know legacy field names such as `_index`, `_source`,
aggregation buckets, or raw export objects.

## Library v2 tranche

Library is the first major end-to-end migration because it is both the
largest remaining untyped backend boundary and a critical feature-parity
surface.

The v2 API adds three purpose-built operations:

1. `GET /library/options` returns chronology bounds and the validated
   about-author option list used by advanced search.
2. `POST /library/search` accepts a discriminated request whose `mode` is one
   of `all`, `authors`, `works`, `parts`, `latest`, `epub`, or `pdf`. Common
   filters are modeled once; mode-specific pagination, sorting,
   `hide_1800`, and source-only fields live on their appropriate union member.
   The response is a matching discriminated union containing stable result
   records and the counts needed for that result set.
3. `POST /library/counts` returns independently refreshable EPUB, PDF, work,
   and part counts. Keeping counts separate preserves the existing behavior
   where slow or failed counts do not gate primary results.

The backend retains the established legacy query semantics internally so
feature parity does not depend on recreating search behavior. It translates
typed v2 input into the existing search/provider call, validates the complete
legacy response, and maps it to strict DTOs. The old endpoints remain
available during local migration but Nuxt stops calling them once parity
tests pass.

`bibliotek.vue` calls the generated client directly in `<script setup>`. Pure
route parsing and view-model transformations may move to focused modules
under `nuxt/app/lib/library/` so they can be tested without mounting the page;
fetching does not move into a one-use composable. The page no longer declares
transport-shaped `LibraryResponse`, `EpubResponse`, `PdfResponse`,
`BrowseResponse`, or `LatestResponse` types and no longer contains
`$fetch<unknown>` for backend data.

## Generated client and drift control

The checked backend snapshot is the canonical code-generation input. Local
development may generate from the live server, but verification and CI use
`/Users/johan/dev/lb-backend/openapi/v2.json` so results do not depend on a
running process.

The deterministic chain is:

1. `scripts/export_v2_openapi.py --check` proves Pydantic/FastAPI output equals
   `openapi/v2.json`.
2. Nuxt `api:check` proves `openapi/v2.json` equals the committed generated
   TypeScript file.
3. Nuxt typecheck proves every consumer remains compatible with that generated
   file.

Generated files are never manually edited. Handwritten aliases may select a
generated schema or operation type, but may not reproduce its properties.
The quality audit rejects backend calls made with raw `$fetch` when the URL is
under the v2 API base.

## Static analysis

### Backend

The backend pins `mypy==2.3.0` and enables `pydantic.mypy`. The initial strict
scope is all production files under `lbapi/v2`; completion requires zero
findings in that entire scope, with no per-module baseline file. Required
settings include `strict`, `disallow_any_generics`, `disallow_untyped_defs`,
`no_implicit_reexport`, `warn_redundant_casts`, and `warn_unused_ignores`.
Pydantic plugin settings enable `init_typed`, `init_forbid_extra`, and
`warn_required_dynamic_aliases`.

Third-party packages without type information receive the narrowest possible
module-specific missing-import allowance. Values returned by those packages
are immediately converted to `object`, a private `TypedDict`, or a Pydantic
model. An allowance may not turn an entire v2 module into `Any`.

Ruff continues to scan `lbapi/v2` and its tests with the full rule inventory.
The blocking production command selects `E4`, `E7`, `E9`, `F`, and `S` for
import, syntax, correctness, and security failures; the current five findings
in that subset must be resolved. All other Ruff rules remain an advisory
inventory subject to the existing safe-only policy. Subjective documentation
and style cleanup is not smuggled into this program.

### Frontend

Nuxt keeps `strict: true` and `noUncheckedIndexedAccess`. ESLint reaches zero
errors and zero warnings across the existing handwritten Nuxt scope. Findings
are resolved in code or through explicit safe abstractions, not broad file
exclusions, inline suppressions, or rule downgrades.

Current `vue/no-v-html` uses are replaced by one typed HTML boundary rather
than scattered template directives. A branded `TrustedHtml` value can be
created only by the existing managed-content sanitizer/validator, and a
`v-trusted-html` directive accepts only that brand before assigning
`innerHTML`. This preserves the current DOM behavior required by visual parity
while making source ownership and sanitization reviewable and eliminating raw
`v-html` from templates. Test-only mutation helpers replace `any` used to
corrupt fixtures. Unsafe double assertions remain only where a browser or
parser library has an inaccurate public type and the assertion is
encapsulated in one checked adapter with a focused test.

## Backend test-value policy

The existing 1,392 collected cases are a starting inventory, not a retention
target. There is no minimum or maximum test count. Each retained or new test
must map to a named contract or domain requirement and answer: “What plausible
regression would this fail on?”

Tests are owned by these layers:

| Layer | Owns | Does not own |
| --- | --- | --- |
| Model/contract | Domain validation not expressible by primitive typing; required nullable semantics; discriminated behavior | Repeating every field name or testing Pydantic itself |
| Provider/adapter | Legacy normalization, ordering, deduplication, query translation, malformed upstream boundaries | FastAPI status envelopes or internal helper call order |
| API | HTTP method/path, serialized success shape, typed status/error behavior, redaction | Whether the handler uses `def` or `async def` |
| OpenAPI | Exact committed snapshot plus cross-cutting closure/error/operation-ID invariants | Manually restating every schema property beside the snapshot |
| Nuxt unit/SSR | Generated-type consumption, route-owned state, rendering/data ownership | Re-testing backend validation matrices |
| Playwright | Observable interaction, navigation, visual parity, cross-layer critical paths | Exhaustive DTO validation |

The audit removes or consolidates tests that:

- inspect sync/async implementation, source text, annotations, or private
  structure;
- duplicate the committed OpenAPI snapshot field by field;
- assert exact mock call choreography unless ordering or count is observable;
- parameterize many values that all exercise one identical validation
  partition;
- verify framework behavior rather than an application policy;
- repeat one invariant at every layer without distinct failure value.

Tests for error redaction, strict boundary rejection, search semantics,
ordering, cache/single-flight behavior, stale-result ownership, and exact
feature-parity outputs remain when those behaviors are externally observable.
Representative partition tests replace exhaustive syntax matrices. During
review, selected retained tests are mutation-checked manually by temporarily
breaking the behavior they claim to protect; a test that stays green is
rewritten or removed.

Every feature plan includes a short requirement-to-test matrix. Adding a new
backend endpoint does not automatically require separate model, provider, API,
OpenAPI-property, SSR, and E2E tests; it requires the smallest set of layers
that proves the relevant risks.

## Error handling and runtime validation

All v2 errors use the existing non-leaking `ApiErrorResponse`. Invalid client
input produces typed 422 responses. Missing resources produce typed 404s.
Known legacy/search unavailability produces a typed 503. Malformed or
unexpected provider data produces a generic non-leaking 500 and is logged on
the server.

Nuxt distinguishes transport failure, typed API failure, cancellation, empty
success, and nullable optional data. A generated response type is not treated
as runtime validation of an external non-v2 source. External data must pass a
small parser before entering component state.

## Quality commands

Root Invoke tasks expose deterministic developer entry points:

- `invoke codegen.check`: backend OpenAPI snapshot check followed by Nuxt
  generated-client check from the file snapshot.
- `invoke quality.backend`: strict mypy for `lbapi/v2`, blocking selected
  Ruff correctness/security checks, and the reviewed v2 pytest suite.
- `invoke quality.frontend`: Nuxt ESLint with zero warnings, typecheck, and unit
  tests.
- `invoke quality.contract`: backend snapshot, frontend codegen, generated
  contract type tests, and focused cross-boundary tests.
- `invoke quality`: all three quality groups, then SSR and the critical
  Playwright contract/parity project.

The existing complete SSR and Playwright suites remain the final release gate.
The shorter quality command is useful during iteration but cannot prove full
visual or feature parity by itself.

## Delivery tranches

This program is intentionally split into independently reviewable plans:

1. **Contract and test-quality foundation.** Add strict backend mypy, define
   quality commands, remove syntax/schema-duplication tests, and document the
   requirement-to-test matrix without changing API behavior.
2. **Typed Library v2 boundary.** Add Library DTOs/adapters/operations,
   regenerate OpenAPI and TypeScript, migrate `bibliotek.vue`, and prove exact
   Library visual/behavior parity.
3. **Remaining transport ownership.** Audit every Nuxt fetch, migrate any
   remaining Nuxt-owned backend call to the generated client, and put external
   content behind narrow runtime validators.
4. **Frontend static-analysis closure.** Eliminate the complete ESLint
   baseline, encapsulate justified unsafe assertions, and remove duplicate
   transport models.
5. **Final contract audit and documentation.** Prove every operation, generated
   type, consumer, error path, quality command, and parity gate against the
   current tree; update developer documentation and remove obsolete legacy
   proxy configuration only after no Nuxt consumer remains.

Each tranche ends with a clean review and independently usable software. No
temporary Angular/Vue compatibility layer is added, and no intermediate
hybrid deployment is required.

## Completion criteria

The program is complete only when all of the following are true:

- Every Nuxt-owned backend request uses a generated v2 operation.
- Library contains no legacy backend `$fetch<unknown>` calls and no duplicate
  transport response interfaces.
- Every v2 operation has explicit strict request/success/error schemas and the
  OpenAPI snapshot has no open object schema.
- Backend snapshot export and frontend code generation are deterministic and
  clean from the committed files.
- Strict mypy passes all `lbapi/v2` production code with zero findings.
- Nuxt ESLint passes the complete handwritten scope with zero errors and zero
  warnings; Nuxt typecheck passes.
- Broad `any`, unexplained double assertions, and handwritten duplicates of
  generated transport schemas are absent from production paths.
- The backend test suite has a documented requirement map and contains no
  tests of handler syntax or manual schema duplication.
- Backend v2 tests, Nuxt unit tests, SSR tests, the full desktop/mobile
  Playwright suite, build, and codegen checks all pass on the final tree.
- Approved visual snapshots and observable application behavior are unchanged
  except where an explicit parity bug is fixed and separately approved.

## References

- Pydantic mypy integration and strict plugin settings:
  <https://docs.pydantic.dev/latest/integrations/mypy/>
- mypy 2.3.0 release metadata:
  <https://pypi.org/project/mypy/>
