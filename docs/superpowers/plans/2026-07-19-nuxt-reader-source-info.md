# Nuxt Reader Source Information Implementation Plan

> **Execution rule:** implement task-by-task with RED/GREEN evidence, a focused
> commit, and independent review before the next production task. The design is
> auto-approved under the active migration goal.

**Goal:** Restore the complete legacy Reader “Om boken” dialog and its three
public aliases through a typed FastAPI v2 contract, generated Nuxt client,
page-local SSR fetch, Headless UI dialog, and strict Angular visual parity.

**Design:**
`docs/superpowers/specs/2026-07-19-nuxt-reader-source-info-design.md`

**Frontend base:** `038a7531`

**Backend base:** `6822948`

## Non-negotiable contracts

- Do not edit Angular production files or copied legacy styles.
- Do not introduce a one-page composable, store, or Angular/Nuxt compatibility
  layer.
- Keep the base Reader usable when source information fails.
- Closed Reader navigation must not fetch source information.
- Fetch provenance and license definitions from their existing runtime source;
  do not hard-code or copy them.
- Use the generated FastAPI client for every backend call.
- Sanitize every upstream HTML field before browser rendering.
- Preserve exact raw query bytes outside `om-boken`/`innehall` ownership.
- Opening and closing the modal uses history replacement.
- Reuse legacy modal markup/classes and Headless UI; make no visual redesign.

## Task 1: Freeze the backend source-information contract

**Backend files:**

- Add: `lbapi/v2/source_info.py`
- Modify: `lbapi/v2/models.py`
- Modify: `lbapi/v2/app.py`
- Add: `test_lbapi/v2/test_source_info_models.py`
- Add: `test_lbapi/v2/test_source_info_provider.py`
- Add: `test_lbapi/v2/test_source_info_api.py`
- Modify: `test_lbapi/v2/test_openapi.py`

### RED

Write strict model, provider, route, and OpenAPI tests for:

- optional and exact `etext`/`faksimil` media selection plus legacy fallback;
- one exact author/title provider call with explicit source includes;
- Doktor Glas normal metadata, multiple representations, read/download order,
  cover, URN, Libris, provenance, license, and parsed errata;
- Dramawebben introduction, facts, roles, and history;
- sparse valid metadata using required `null`/empty DTO fields;
- absent work/media, unsafe path segments, oversized values, duplicate identity,
  malformed top-level/provider rows, malformed HTML field types, malformed
  errata, and provider failure;
- exact error status/body mapping with no provider leakage;
- no `content_vector`, pages, parts, page text, or undeclared fields in provider
  includes or serialized responses;
- GET-only route ownership and stable `v2_get_work_source_info` operation ID;
- recursive `additionalProperties: false`, required fields, discriminated media,
  bounds, formats, and response schemas in OpenAPI.

Run the focused tests and retain RED evidence before implementation.

### GREEN

Implement strict DTOs and `source_info.py` with pure normalization helpers and a
small provider adapter. Parse the legacy errata table into typed rows without
silently truncating. Derive only safe public routes/filenames. Register the
router and make the full focused backend suite green.

Run:

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
uv run pytest \
  test_lbapi/v2/test_source_info_models.py \
  test_lbapi/v2/test_source_info_provider.py \
  test_lbapi/v2/test_source_info_api.py \
  test_lbapi/v2/test_openapi.py
uv run python scripts/export_v2_openapi.py --check
```

Commit only backend Task 1 files.

## Task 2: Regenerate and prove the Nuxt transport boundary

**Frontend files:**

- Modify: `nuxt/openapi/v2.json`
- Modify: `nuxt/app/lib/api/client.ts`
- Modify: `nuxt/test/unit/api-client-drift.spec.ts` if operation assertions are
  centralized there

### RED/GREEN

Export the backend schema through the repository's existing script, regenerate
the client with the existing Nuxt command, and add a focused compile-time/drift
assertion proving the operation path, optional media query, strict success DTO,
and typed error responses are present. Do not hand-edit generated artifacts.

Run:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn api:generate
LBAPI_OPENAPI_SCHEMA=../../lb-backend/openapi/v2.json yarn api:check
yarn typecheck
```

Commit only generated transport artifacts and any focused drift assertion.

## Task 3: Build the Nitro sanitizer/static-data boundary

**Frontend files:**

- Add: `nuxt/shared/types/reader-source-info.ts`
- Add: `nuxt/server/utils/reader-source-info.ts`
- Add: `nuxt/server/api/reader/source-info/[author]/[title].get.ts`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Add: `nuxt/test/fixtures/reader-source-info-data.mjs`
- Add: `nuxt/test/unit/reader-source-info.spec.ts`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

### RED

Extend the deterministic fixture server with:

- typed normal, drama, sparse, missing, delayed, failed, malformed, and
  oversized FastAPI source-info responses;
- exact private/public source-info request ledgers;
- provenance and license JSON resources matching observed production shape;
- static-resource failure/malformed/oversized controls; and
- author-resolution responses for introduction/source attributions.

Add unit tests proving:

- exact runtime validation of the generated response and every recursive field;
- path/query safety and status mapping;
- static JSON runtime fetch paths, caching/revalidation options, key lookup, and
  known provenance image rewriting;
- bounded one-call attribution resolution with existing author reuse;
- sanitizer preservation of allowed editorial paragraphs/tables/links and
  removal of scripts, handlers, unsafe protocols, forms, embeds, and unknown
  elements;
- safe external-link attributes;
- structured errata HTML sanitization; and
- a modal-local non-leaking 502 for supplementary boundary failures.

### GREEN

Implement the frontend DTO and Nitro boundary. Keep all source-specific model
logic server-side. Do not put fetch/model code in a component or composable.

Run:

```bash
cd nuxt
yarn vitest run test/unit/reader-source-info.spec.ts test/unit/v2-server.spec.ts
yarn typecheck
LBAPI_OPENAPI_SCHEMA=../../lb-backend/openapi/v2.json yarn api:check
```

Commit Task 3 files after review.

## Task 4: Add raw-query helpers and all legacy aliases

**Frontend files:**

- Modify: `nuxt/app/lib/reader-routes.ts`
- Modify: `nuxt/test/unit/reader-routes.spec.ts`
- Add: `nuxt/server/api/reader/resolve/[author]/[title].get.ts`
- Add: `nuxt/app/pages/författare/[author]/titlar/[title]/index.vue`
- Add: `nuxt/app/pages/författare/[author]/titlar/[title]/info/index.vue`
- Add: `nuxt/app/pages/författare/[author]/titlar/[title]/info/[mediatype].vue`
- Modify: `nuxt/test/ssr/reader-shorthand.spec.ts`

### RED

Add route-helper tests for:

- bare/empty/repeated/encoded exact `om-boken` keys and explicit invalid values;
- adding one bare key while removing every existing exact occurrence;
- removing only `om-boken`, or both Reader dialog keys when switching dialogs;
- preserving unrelated bare/empty/repeated keys, order, `+`/`%20`, percent case,
  malformed escapes, and fragments byte-for-byte; and
- excluding both transient keys from neutral/history identities.

Add SSR alias tests proving:

- all three routes history-replace to the canonical selected start page with
  exactly bare `?om-boken`;
- default selection, requested selection, and requested-media fallback;
- incoming query/fragment discard;
- encoded safe identity;
- 404/422/500/503 mapping to the existing public 404/502 boundary; and
- exactly one resolver request followed by the ordinary canonical Reader load.

### GREEN

Generalize the current raw-query helpers without regressing contents behavior.
Add the optional-media resolver and three thin alias pages. Do not duplicate
selection logic in Vue pages.

Run:

```bash
cd nuxt
yarn vitest run test/unit/reader-routes.spec.ts
yarn playwright test test/ssr/reader-shorthand.spec.ts --project=ssr
yarn typecheck
```

Commit Task 4 files after review.

## Task 5: Implement the page-local Headless UI dialog

**Frontend files:**

- Add: `nuxt/app/components/reader/ReaderSourceInfoDialog.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Modify: `nuxt/app/assets/styles/nuxt.scss`
- Modify: `nuxt/test/ssr/reader.spec.ts`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`

### RED

Add SSR tests for:

- direct canonical bare `?om-boken` returning the Reader plus one source-info
  fetch and serialized modal content;
- closed Reader making no source-info/static requests;
- source-info failure retaining HTTP 200 Reader and exact modal-local error;
- title/sidebar real-link fallbacks;
- normal, drama, sparse, errata, license, provenance, URN, Libris, cover, read,
  and download content; and
- hydration making no duplicate source-info request.

Add browser tests for:

- title, sidebar, `o`, F18, direct query, Back/Forward, and no-JavaScript links;
- close button, Escape, backdrop, external query removal, and mutual exclusion
  with contents;
- exact replace semantics and raw-query byte preservation;
- no base Reader/search-hit/history refetch or write on modal-only transitions;
- modal-local loading/retry/error behavior;
- Headless UI focus trap, focus restoration, Escape, backdrop, and scroll lock;
- “Mer om pjäsen” drama copy;
- read/download/author/Libris/URN/provenance/license links;
- errata first-eight and “Visa fler”/“Visa färre”; and
- no hydration, console, page, or failed-request errors.

### GREEN

Implement `ReaderSourceInfoDialog.vue` as presentation-only Headless UI. Add one
conditional/on-demand `useAsyncData` inside the canonical page's `<script
setup>`, query-derived open state, replace helpers, triggers, keyboard action,
and body/corridor modal state. Extend the existing primary/search/history
identities to exclude both transient dialog keys. Add only the minimal `.about`
activation bridge required by copied legacy rules.

Run:

```bash
cd nuxt
yarn playwright test test/ssr/reader.spec.ts --project=ssr
yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn typecheck
LBAPI_OPENAPI_SCHEMA=../../lb-backend/openapi/v2.json yarn api:check
```

Commit Task 5 files after review.

## Task 6: Capture Angular authority and close visual parity

**Frontend files:**

- Add: `nuxt/test/visual/capture-reader-source-info-angular.spec.ts`
- Add: `nuxt/test/e2e/reader-source-info.visual.spec.ts`
- Add only reviewed normal/drama desktop/mobile baseline images under the
  existing Reader visual baseline directory
- Modify existing closed Reader visual tests only if needed to prove unchanged
  baselines, never to accept a redesign

### Authority capture

Use deterministic normal Doktor Glas and Dramawebben fixtures in the isolated
Angular server. Firewall all unregistered network traffic and wait for fonts,
images, modal animation, and scroll position. Capture identical desktop and
mobile viewports for:

- closed normal Reader;
- normal source-info dialog;
- drama source-info dialog; and
- long errata/provenance scroll state.

### Nuxt comparison

Require the Nuxt dialog to match the Angular captures for modal width/position,
backdrop, blur, content shadow, typography, padding, columns/stacking, cover,
actions, provenance, drama facts, license, errata, close button, and scroll.
Keep the existing closed Reader baseline unchanged. Review every changed pixel;
do not update a baseline merely because the test failed.

Run:

```bash
cd nuxt
yarn playwright test test/e2e/reader-source-info.visual.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn playwright test test/e2e/reader-faksimil.visual.spec.ts test/e2e/reader-hit.visual.spec.ts test/e2e/reader-contents.visual.spec.ts --project=desktop-chromium
```

Commit only reviewed visual tests/baselines and the smallest parity correction.

## Task 7: Full verification and live handoff

Run:

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
uv run pytest test_lbapi/v2
uv run python scripts/export_v2_openapi.py --check

cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn vitest run
yarn playwright test test/ssr/reader.spec.ts test/ssr/reader-shorthand.spec.ts --project=ssr
yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn typecheck
LBAPI_OPENAPI_SCHEMA=../../lb-backend/openapi/v2.json yarn api:check
```

Restart only the permitted 8010 backend and 3020 Nuxt servers if required. Live
test:

- each alias;
- canonical normal and drama `?om-boken`;
- title/sidebar/keyboard open and every close path;
- Back/Forward and raw search query preservation;
- normal/faksimil/drama/sparse/error content; and
- console, hydration, network, focus, scrolling, and request counts.

Perform independent code review of both repositories. Commit any reviewed fix
separately. Preserve all unrelated user work and keep protected ports 3000,
8000, 3018, and 4102 untouched.

