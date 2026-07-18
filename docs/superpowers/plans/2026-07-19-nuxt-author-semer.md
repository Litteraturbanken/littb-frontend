# Nuxt Author “Mera om” (`/semer`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/författare/:author/semer` as the SSR-rendered, visually unchanged managed author document while keeping `/mer` as the separate works listing.

**Architecture:** Extend the existing FastAPI `AuthorDocumentKind` discriminant and generated client with the single `semer` literal. Reuse the current Nitro descriptor/source validator, sanitizer, and dynamic Nuxt author-document page with its one page-local fetch; freeze real managed HTML and compare the same content in Angular and Nuxt at desktop and mobile.

**Tech Stack:** FastAPI/Pydantic/OpenAPI, Nuxt 4/Vue 3/TypeScript, generated `openapi-typescript` client, LinkeDOM sanitizer, Vitest, Playwright.

## Global Constraints

- Preserve the current Angular appearance; this is an architectural migration, not a redesign.
- Use hybrid SSR and return real 404/502 statuses rather than 200 placeholders.
- Keep the single-page model inside `<script setup>`; do not add a composable.
- Fetch and sanitize the real managed `/red/.../semer/index.html` body; do not substitute placeholder HTML or media.
- Keep `/författare/:author/mer` as the works/about-author listing and never fetch `semer` there.
- Preserve the typed trust boundary from FastAPI through checked OpenAPI and generated TypeScript.
- Add no Headless UI component: the route contains native static content and links only.
- The route/provider descriptor cannot select an origin; only the exact expected same-site source path is accepted.
- Do not add `semer`-specific CSS unless strict Angular screenshots prove an inherited-style gap.
- Footnote popovers, caching, SLA/`omtexterna`, and unrelated author-shell refactors remain deferred.

---

### Task 1: Extend the FastAPI author-document contract

**Repository:** `/Users/johan/.codex/worktrees/8c5c/lb-backend`

**Files:**
- Modify: `lbapi/v2/models.py`
- Modify: `test_lbapi/v2/test_models.py`
- Modify: `test_lbapi/v2/test_authors.py`
- Modify: `test_lbapi/v2/test_api.py`
- Modify: `test_lbapi/v2/test_openapi.py`
- Regenerate: `openapi/v2.json`

**Interfaces:**
- Consumes: existing `transform_author_document(raw, requested_author_id, document_kind)` and `GET /v2/authors/{author_id}/documents/{document_kind}`.
- Produces: `AuthorDocumentKind = Literal["presentation", "bibliografi", "semer"]` and an unchanged strict `AuthorDocumentDescriptor` whose `document_kind` and exact `source_path` may describe `semer`.

- [ ] **Step 1: Add failing model/provider tests for the literal and exact path**

Add a model payload with `document_kind="semer"` and a provider transformation case equivalent to:

```python
def test_author_document_transforms_semer_with_exact_source_path(monkeypatch) -> None:
    monkeypatch.setattr(
        authors,
        "query_optional_author_audio_url",
        lambda normalized_id: None,
    )
    descriptor = authors.transform_author_document(
        {"hits": 1, "data": [document_descriptor_source(
            authorid="AlmqvistCJL",
            authorid_norm="AlmqvistCJL",
            full_name="Carl Jonas Love Almqvist",
            birth={"plain": "1793"},
            death={"plain": "1866"},
        )]},
        "AlmqvistCJL",
        "semer",
    )
    assert descriptor.document_kind == "semer"
    assert descriptor.source_path == (
        "/red/forfattare/AlmqvistCJL/semer/index.html"
    )
```

Extend the API parameter case to request `/v2/authors/AlmqvistCJL/documents/semer` and assert the strict serialized descriptor. Change the OpenAPI enum expectation to:

```python
assert parameters["document_kind"]["schema"]["enum"] == [
    "presentation",
    "bibliografi",
    "semer",
]
```

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q \
  test_lbapi/v2/test_models.py \
  test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py \
  test_lbapi/v2/test_openapi.py
```

Expected: the new `semer` payload/request fails validation and the OpenAPI enum lacks `semer`; existing cases remain green.

- [ ] **Step 3: Make the minimal production change**

Change only the literal in `lbapi/v2/models.py`:

```python
AuthorDocumentKind = Literal["presentation", "bibliografi", "semer"]
```

Do not branch in `transform_author_document`; its existing exact path construction must produce the `semer` path from the typed literal.

- [ ] **Step 4: Verify the backend and checked schema**

```bash
pytest -q test_lbapi/v2/test_models.py test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py
python scripts/export_v2_openapi.py
pytest -q test_lbapi/v2
python scripts/export_v2_openapi.py --check
python -m compileall -q lbapi
git diff --check
```

Expected: every command exits 0; the exported schema contains exactly the three literals and no unrelated drift.

- [ ] **Step 5: Commit the backend contract**

```bash
git add lbapi/v2/models.py test_lbapi/v2/test_models.py \
  test_lbapi/v2/test_authors.py test_lbapi/v2/test_api.py \
  test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): add semer author documents"
```

---

### Task 2: Extend the generated client, strict Nuxt source boundary, and deterministic fixture

**Repository:** `/Users/johan/.codex/worktrees/8c5c/littb`

**Files:**
- Regenerate: `nuxt/app/lib/api/generated/lbapi.ts`
- Modify: `nuxt/shared/types/author-document.ts`
- Modify: `nuxt/server/api/author-documents/[author]/[document].get.ts`
- Modify: `nuxt/server/utils/author-document.ts`
- Modify: `nuxt/test/fixtures/author-document-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Create: `nuxt/test/fixtures/author-document-content/AlmqvistCJL-semer.html`
- Add only selected local visual assets when referenced by the frozen body.
- Modify: `nuxt/test/unit/author-document.spec.ts`
- Modify: `nuxt/test/unit/v2-server.spec.ts`
- Modify: `nuxt/test/ssr/author-documents-api.spec.ts`

**Interfaces:**
- Consumes: Task 1 OpenAPI enum and descriptor; existing `loadAuthorDocumentPage(event, author, kind)` sanitizer boundary.
- Produces: `AuthorDocumentKind = "presentation" | "bibliografi" | "semer"`; exact fixture descriptor/body; `/api/author-documents/AlmqvistCJL/semer` returning a sanitized `AuthorSupplementalPage` after exactly two private source requests.

- [ ] **Step 1: Freeze and record one real authority document**

Read the exact authority URL without following it into application routing:

```text
https://litteraturbanken.se/red/forfattare/AlmqvistCJL/semer/index.html
```

Save its complete response body as the fixture using `apply_patch`, record the source URL and SHA-256 in `author-document-data.mjs`, and enumerate every selected image/media URL needed for deterministic rendering. The fixture body must retain its real headings, prose, dimensions, normalized legacy links, and PDF links; it must not contain invented content.

- [ ] **Step 2: Add failing strict-boundary and fixture tests**

Extend the descriptor fixture with:

```js
export const semerAuthorDocumentDescriptor = {
  author_id: "AlmqvistCJL",
  normalized_author_id: "AlmqvistCJL",
  full_name: "Carl Jonas Love Almqvist",
  birth_year: "1793",
  death_year: "1866",
  has_introduction: true,
  has_dramawebben: false,
  search_url: "/sok?forfattare=AlmqvistCJL&avancerad",
  audio_url: null,
  document_kind: "semer",
  source_path: "/red/forfattare/AlmqvistCJL/semer/index.html"
}
```

Add tests that accept this exact descriptor and reject `semer` descriptors with wrong author, wrong kind, absolute/protocol-relative source, traversal/encoded traversal, query, fragment, control characters, or an unexpected source path. Parse the frozen body and assert real safe headings/images/links remain while scripts/styles/forms/events and unsafe URLs are absent.

Add a fixture-server contract asserting the v2 descriptor endpoint and exact managed source return the frozen data, and that `_author_document_requests` records the expected descriptor then content request.

- [ ] **Step 3: Verify RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  npm run api:generate
npm run test:unit -- test/unit/author-document.spec.ts test/unit/v2-server.spec.ts
LITTB_NUXT_TEST_PORT=3021 npm run test:ssr -- \
  test/ssr/author-documents-api.spec.ts
```

Expected before the handwritten allow-list changes: generated types include `semer`, but the shared/Nitro runtime validators reject it and the new API case fails.

- [ ] **Step 4: Add `semer` to every handwritten strict allow-list**

Update the shared type:

```ts
export type AuthorDocumentKind = "presentation" | "bibliografi" | "semer"
```

Update the Nitro route parser and `isAuthorDocumentKind`/descriptor guard to accept exactly those same three literals. Preserve the existing exact source-path construction:

```ts
`/red/forfattare/${encodedNormalized}/${kind}/index.html`
```

Do not relax origin, redirect, query, traversal, identity, size, or sanitizer checks.

- [ ] **Step 5: Verify GREEN and commit the typed source slice**

```bash
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  npm run api:check
npm run test:unit -- test/unit/author-document.spec.ts test/unit/v2-server.spec.ts
LITTB_NUXT_TEST_PORT=3021 npm run test:ssr -- \
  test/ssr/author-documents-api.spec.ts
npm run typecheck
git diff --check
git add app/lib/api/generated/lbapi.ts shared/types/author-document.ts \
  server/api/author-documents server/utils/author-document.ts \
  test/fixtures/author-document-data.mjs test/fixtures/v2-server.mjs \
  test/fixtures/author-document-content test/unit/author-document.spec.ts \
  test/unit/v2-server.spec.ts test/ssr/author-documents-api.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): load semer author documents"
```

Expected: API drift, focused unit/SSR, typecheck, and diff checks all exit 0.

---

### Task 3: Render `semer` in the existing SSR page and close navigation behavior

**Files:**
- Modify: `nuxt/app/pages/författare/[author]/[document].vue`
- Modify: `nuxt/test/ssr/author-documents.spec.ts`
- Modify: `nuxt/test/e2e/author-documents.behavior.spec.ts`
- Modify: `nuxt/test/ssr/legacy-author-routes.spec.ts`

**Interfaces:**
- Consumes: Task 2 `AuthorDocumentKind` and same-origin API response.
- Produces: exact `/författare/AlmqvistCJL/semer` SSR page with `Mera om` SEO/shell/body, hydration reuse, and stale-safe transitions among all three managed kinds.

- [ ] **Step 1: Add failing SSR cases**

Assert direct `semer` SSR returns 200 and contains:

```text
Carl Jonas Love Almqvist, Mera om | Litteraturbanken
body.focus.page-authorInfo.ready
.page_content > .content.unbox
```

Assert the outer author heading/lifespan and conditional navigation order, real frozen body headings/prose/images/links, absence of scripts/styles/forms/events, and zero provider/content-origin leakage. Assert exactly one descriptor plus one exact managed-content request and zero browser duplicate after hydration. Add 404/502 cases using existing fixture failure controls.

- [ ] **Step 2: Add failing behavior cases**

Extend the current behavior suite to cover:

1. `presentation → semer → bibliografi → Back/Forward` with the title/body changing atomically and no stale content.
2. A delayed obsolete document response that cannot overwrite a newer managed route.
3. A safe normalized legacy `/forfattare/**` link and one real selected image/PDF link retaining native behavior.
4. `/mer` still renders `AuthorWorksContent` and records zero `semer` source requests.

Extend the legacy route SSR matrix so `/forfattare/AlmqvistCJL/semer?x=1` returns a 307 to the accented canonical suffix with the raw query preserved.

- [ ] **Step 3: Run RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LITTB_NUXT_TEST_PORT=3022 npm run test:ssr -- \
  test/ssr/author-documents.spec.ts test/ssr/legacy-author-routes.spec.ts
LITTB_NUXT_TEST_PORT=3022 npm run test:e2e -- \
  test/e2e/author-documents.behavior.spec.ts
```

Expected: route validation/page label reject or mislabel `semer`; new behavior cases fail for the same missing page support.

- [ ] **Step 4: Make the minimal page changes**

Change the page guard to accept the three literal kinds and use an exhaustive label mapping:

```ts
const labels: Record<AuthorDocumentKind, string> = {
  presentation: "Presentation",
  bibliografi: "Bibliografi",
  semer: "Mera om"
}
const pageLabel = computed(() => labels[documentKind.value])
```

Make `documentKind` return the validated route literal rather than defaulting every non-bibliography value to presentation. Keep the existing page-local `useAsyncData`, identity cache, synchronous stale clearing, error mapping, template, and CSS unchanged.

- [ ] **Step 5: Verify GREEN and commit**

```bash
LITTB_NUXT_TEST_PORT=3022 npm run test:ssr -- \
  test/ssr/author-documents.spec.ts test/ssr/legacy-author-routes.spec.ts
LITTB_NUXT_TEST_PORT=3022 npm run test:e2e -- \
  test/e2e/author-documents.behavior.spec.ts
npm run typecheck
git diff --check
git add 'app/pages/författare/[author]/[document].vue' \
  test/ssr/author-documents.spec.ts test/ssr/legacy-author-routes.spec.ts \
  test/e2e/author-documents.behavior.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): render semer author documents"
```

---

### Task 4: Capture Angular authority and enforce desktop/mobile parity

**Files:**
- Modify: `nuxt/test/visual/capture-author-documents-angular.spec.ts`
- Modify: `nuxt/test/e2e/author-documents.visual.spec.ts`
- Create: `nuxt/test/visual/baselines/author-document-semer-desktop.png`
- Create: `nuxt/test/visual/baselines/author-document-semer-mobile.png`
- Modify only if screenshot evidence requires it: existing bounded author-document styles.

**Interfaces:**
- Consumes: the same Task 2 frozen descriptor/body/assets for Angular and Nuxt.
- Produces: immutable desktop/mobile Angular `semer` baselines and strict Nuxt comparisons while all existing author-document baselines stay unchanged.

- [ ] **Step 1: Add the Angular `semer` capture case**

Route the exact Angular shell, author calls, managed source, and selected assets already required by the shared author-document authority. Reject duplicate/unlisted queries, unexpected origins/assets, redirects, and any managed path other than:

```text
/red/forfattare/AlmqvistCJL/semer/index.html
```

Assert the complete legacy request ledger and wait for fonts plus every selected image before capture. Add negative probes for wrong kind, wrong normalized author, extra query, and unlisted asset.

- [ ] **Step 2: Capture the two new baselines**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
npx playwright test --config=playwright.author-documents-angular.config.ts
```

Expected: all existing capture cases plus `semer` desktop/mobile pass; only the two new baseline files are created.

- [ ] **Step 3: Add strict Nuxt comparisons and run RED**

Add `semer` to the existing visual case table and assert exact fixture/API/content/asset ledgers, zero hydration/console/page errors, and zero production escapes. Use unchanged screenshot settings:

```ts
{
  fullPage: true,
  animations: "disabled",
  caret: "hide",
  scale: "css",
  threshold: 0.1,
  maxDiffPixels: 100
}
```

Run:

```bash
LITTB_NUXT_TEST_PORT=3023 npx playwright test \
  test/e2e/author-documents.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: any visible mismatch fails under the unchanged threshold; existing presentation/bibliography states remain green.

- [ ] **Step 4: Diagnose any mismatch against Angular before changing CSS**

Inspect screenshot dimensions and pixel diffs. Change only an existing author-document selector when the Angular DOM/style cascade proves a missing inherited rule. Do not add masks, rewrite authority baselines, hide corpus content, or alter global author/profile/works visuals.

- [ ] **Step 5: Verify parity and commit**

```bash
npx playwright test --config=playwright.author-documents-angular.config.ts
LITTB_NUXT_TEST_PORT=3023 npx playwright test \
  test/e2e/author-documents.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
git diff --check
git add test/visual/capture-author-documents-angular.spec.ts \
  test/e2e/author-documents.visual.spec.ts \
  test/visual/baselines/author-document-semer-*.png
git diff --cached --check
git commit -m "test(nuxt): verify semer visual parity"
```

Expected: Angular and Nuxt author-document matrices pass; all pre-existing baseline hashes remain unchanged.

---

### Task 5: Independent review and full closure

**Files:**
- Modify only in-scope files above if review exposes a defect; add the corresponding regression first.

**Interfaces:**
- Consumes: Tasks 1–4 commits and test reports.
- Produces: independently approved backend/frontend slices with complete regression evidence and a running deterministic preview URL.

- [ ] **Step 1: Request an independent whole-slice review**

Review both repository ranges against the design, focusing on enum/schema drift, source-path/origin validation, sanitizer preservation, real content provenance, SSR status/hydration duplication, route identity races, `/mer` separation, legacy redirects, and visual-authority firewalls. Fix every Critical/Important finding with a RED regression and re-review.

- [ ] **Step 2: Run backend closure**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2
python scripts/export_v2_openapi.py --check
python -m compileall -q lbapi
git diff --check
```

- [ ] **Step 3: Run frontend closure**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  npm run api:check
npm run test:unit
LITTB_NUXT_TEST_PORT=3024 npm run test:ssr -- \
  test/ssr/author-documents-api.spec.ts \
  test/ssr/author-documents.spec.ts \
  test/ssr/legacy-author-routes.spec.ts \
  test/ssr/author-works.spec.ts
LITTB_NUXT_TEST_PORT=3024 npm run test:e2e -- \
  test/e2e/author-documents.behavior.spec.ts \
  test/e2e/author-works.behavior.spec.ts
npx playwright test --config=playwright.author-documents-angular.config.ts
LITTB_NUXT_TEST_PORT=3024 npx playwright test \
  test/e2e/author-documents.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
npm run typecheck
npm run build
git diff --check
```

- [ ] **Step 4: Run deterministic and live smoke checks**

Keep an isolated fixture-backed Nuxt preview running and open the exact test URL:

```text
http://127.0.0.1:{fixture_port}/författare/AlmqvistCJL/semer
```

At desktop and mobile, confirm the real body, images/links, author shell, Back/Forward transitions, background, no stale content, no console/hydration errors, and only expected local fixture origins. Separately smoke the port-3000 live route without treating an upstream 502 as a deterministic test failure; record the dated upstream state.

- [ ] **Step 5: Confirm repository hygiene and record closure**

Inspect `git status --short`, `git diff --check`, both commit ranges, generated-client drift, and baseline hashes. Keep the pre-existing supplemental-author plan edit and `.superpowers` scratch uncommitted. Record exact test totals, review verdict, preview URL, and deferred footnote/SLA work in the durable progress ledger.
