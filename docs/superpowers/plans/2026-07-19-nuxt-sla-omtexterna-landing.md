# Nuxt SLA Om texterna Landing Implementation Plan

Design: `docs/superpowers/specs/2026-07-19-nuxt-sla-omtexterna-landing-design.md`

Backend worktree: `/Users/johan/.codex/worktrees/8c5c/lb-backend`

Frontend worktree: `/Users/johan/.codex/worktrees/8c5c/littb`

The user has pre-approved implementation plans under the active migration goal.
Use test-driven development, preserve the Angular visuals exactly, keep the
page model in `<script setup>`, and do not introduce a composable.

## Scope guard

This plan implements only:

```text
/författare/LagerlöfS/omtexterna
```

Do not implement article filenames, footnote popovers, generic-author
`omtexterna`, `biblinfo`, Library, or Reader features. Preserve all 18 article
hrefs and three Reader hrefs as native links.

Do not touch ports 3000, 8000, 3018, or 4102. Use isolated test ports. Preserve
the unrelated modified supplemental-author plan and untracked `.superpowers/`
content; stage only exact task files.

### Task 1: Extend the Strict FastAPI Author-Document Contract

**Files**

- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Regenerate: `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`

**Contract**

- `AuthorDocumentKind` gains `omtexterna`.
- The only valid tuple is
  `("LagerlöfS", "LagerlofS", "omtexterna") -> "/red/sla/omtexterna.html"`.
- Any other author with this kind is 404 before OpenSearch.
- Existing three kinds keep their exact formula and semantics.

- [ ] Write RED model, transformer, route, and OpenAPI tests.

Assert that the descriptor accepts/serializes `omtexterna`, the transformer
returns the fixed path only for the exact requested and normalized author IDs,
and mismatched requested or normalized IDs are non-leaking 404s. At the route
level, spy on `query_author_document` and prove that an unsupported author-kind
pair does not call it. Preserve 422 for an unknown enum literal and current
404/503/500 semantics.

- [ ] Implement one exact registry and preflight guard.

Keep fixed SLA mappings separate from the generic source formula. Do not use a
route value as a filename. Repeat the tuple validation inside the pure
transformer even though the handler preflights it.

- [ ] Regenerate and verify OpenAPI.

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
python scripts/export_v2_openapi.py
python scripts/export_v2_openapi.py --check
python -m pytest -q \
  test_lbapi/v2/test_models.py \
  test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py \
  test_lbapi/v2/test_openapi.py
python -m compileall -q lbapi/v2
git diff --check
```

- [ ] Commit only the backend contract.

```bash
git add lbapi/v2/models.py lbapi/v2/authors.py \
  test_lbapi/v2/test_models.py test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): type SLA omtexterna landing"
```

### Task 2: Regenerate the Frontend Contract and Freeze the Exact Source

**Files**

- Regenerate: `nuxt/app/lib/api/generated/lbapi.ts`
- Modify: `nuxt/shared/types/author-document.ts`
- Modify: `nuxt/test/fixtures/author-document-data.mjs`
- Create: `nuxt/test/fixtures/author-document-content/LagerlofS-omtexterna.html`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Fixture authority**

```text
URL: https://red.litteraturbanken.se/red/sla/omtexterna.html
Path: /red/sla/omtexterna.html
Bytes: 7225
SHA-256: ca4812e8f5a88342f1699b3a41471da556ba27760bcd51bb635c0c0e20485928
```

- [ ] Write RED fixture tests for the new generated literal and exact bytes.

Assert the descriptor endpoint path, fixed source response, content type,
content length/hash, resettable descriptor/content ledgers, and zero generic
source fallback. Add negative probes for another author, normalized-author
paths, query variants, non-GET methods, and guessed article filenames.

- [ ] Regenerate from the checked backend snapshot and derive the shared kind.

Generate from the backend `openapi/v2.json`. Change the handwritten
`AuthorDocumentKind` union to derive from
`components["schemas"]["AuthorDocumentDescriptor"]["document_kind"]` so the
generated contract is canonical.

- [ ] Freeze the exact source with provenance and implement the fixture route.

Use the exact downloaded bytes; do not prettify or reserialize them. Extend the
existing author-document descriptor/content ledgers without changing existing
responses.

- [ ] Verify and commit.

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  npm run api:generate
npx vitest run test/unit/v2-server.spec.ts \
  test/unit/author-document.spec.ts
npx vue-tsc --noEmit
cd ..
git diff --check
git add nuxt/app/lib/api/generated/lbapi.ts \
  nuxt/shared/types/author-document.ts \
  nuxt/test/fixtures/author-document-data.mjs \
  nuxt/test/fixtures/author-document-content/LagerlofS-omtexterna.html \
  nuxt/test/fixtures/v2-server.mjs \
  nuxt/test/unit/v2-server.spec.ts
git commit -m "test(nuxt): freeze SLA omtexterna source"
```

### Task 3: Capture Deterministic Angular Desktop/Mobile Authority

**Files**

- Modify: `nuxt/test/visual/capture-author-documents-angular.spec.ts`
- Create: two baselines under `nuxt/test/visual/baselines/`

- [ ] Add the exact SLA case to the closed Angular firewall.

Use the frozen descriptor/body. Expect exactly one author request, one authors
bootstrap, ten work/about requests, one map request, one audio request, one
content request, and the established static/bootstrap request set. Block every
other local or production request. Add negative probes for query variants,
wrong sources/authors, guessed article content, repeated author bootstrap, and
non-GET source methods.

- [ ] Assert the exact ready visual shell before capture.

Require `focus page-authorInfo site-sla ready`, the exact title/description,
global LB logo/navigation visible, ordinary author background decoded, managed
heading visible, author H1/local links hidden, no portrait, fonts loaded, all 21
href/target pairs exact, and no unexpected console/page errors beyond the one
already recorded legacy selector warning.

- [ ] Capture desktop/mobile and record immutable hashes.

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
npx playwright test --config=playwright.author-documents-angular.config.ts
shasum -a 256 test/visual/baselines/author-document-*.png
```

All eight authority cases must pass, the six existing hashes must remain
byte-identical, and the two new SLA hashes must be recorded.

- [ ] Commit authority evidence.

```bash
cd ..
git add nuxt/test/visual/capture-author-documents-angular.spec.ts \
  nuxt/test/visual/baselines/author-document-omtexterna-desktop.png \
  nuxt/test/visual/baselines/author-document-omtexterna-mobile.png
git commit -m "test(nuxt): capture SLA omtexterna authority"
```

### Task 4: Extend the Bounded Nitro Author-Document Boundary

**Files**

- Modify: `nuxt/server/utils/author-document.ts`
- Modify: `nuxt/server/api/author-documents/[author]/[document].get.ts`
- Modify: `nuxt/test/unit/author-document.spec.ts`
- Modify: `nuxt/test/ssr/author-documents-api.spec.ts`

- [ ] Write RED tuple, source, transport, and sanitizer tests.

Cover exact descriptor acceptance and rejection for wrong requested author,
wrong normalized author, wrong kind, generic source formula, query-bearing
source, and extra descriptor keys. Direct Nitro requests for other authors must
return local 404 without descriptor/content requests.

Cover manual redirects, source 404, rejected content types, declared/streamed
262,144-byte limits, fetch rejection, malformed/multiple/missing body, comment
removal, dangerous subtree removal, unknown-element unwrapping, URL traversal
and repeated-encoding probes, and response-body cancellation for every rejected
upstream response.

For `omtexterna`, accept only the exact landing element/attribute set. Preserve
only complete canonical `clear: both` styles on title `h1`/`h2` and
`list-style-type: disc` on `ul.itemizedlist`. Strip the full attribute for any
mixed, duplicate, escaped, commented, `url()`, `var()`, custom-property, or
`!important` declaration. Preserve only safe `/författare/LagerlöfS/**` hrefs
and `_top`; remove other targets and unsafe hrefs. Prove all existing kinds
still strip all inline styles.

- [ ] Implement exact per-kind descriptor/source/parser policy.

Keep the existing generic parser behavior for the three existing documents.
Select the tighter SLA cap, exact `text/html` media type, element/attribute/url
policy, and canonical style parser only after the validated exact identity is
accepted. Never forward public query/cookie/auth data.

- [ ] Verify and commit.

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
npx vitest run test/unit/author-document.spec.ts
LITTB_NUXT_TEST_PORT=3038 npx playwright test \
  test/ssr/author-documents-api.spec.ts --project=ssr
npx vue-tsc --noEmit
cd ..
git diff --check
git add nuxt/server/utils/author-document.ts \
  'nuxt/server/api/author-documents/[author]/[document].get.ts' \
  nuxt/test/unit/author-document.spec.ts \
  nuxt/test/ssr/author-documents-api.spec.ts
git commit -m "feat(nuxt): bound SLA omtexterna source"
```

### Task 5: Render the Exact Page with Page-Local SSR Ownership

**Files**

- Modify: `nuxt/app/pages/författare/[author]/[document].vue`
- Modify: `nuxt/test/ssr/author-documents.spec.ts`
- Create: `nuxt/test/e2e/sla-omtexterna.behavior.spec.ts`

- [ ] Write RED SSR and browser behavior contracts.

SSR must include the managed body and exact metadata/classes, exactly one
descriptor plus one content request, and no legacy/profile/works/map/audio
fan-out. Assert the hidden shell DOM remains present, no portrait renders, all
21 links are exact, upstream head/title/doctype/comments do not leak, and
sanitized probes are absent.

Browser tests cover direct hydration reuse, query-only push/back/forward with no
refetch, same-page query preservation, stable redacted source/descriptor error
shells, stale-result identity protection when navigating from another author
document, and zero console/page/hydration problems. Other-author `omtexterna`,
nested article names, malformed segments, and excluded names must be global
404s with zero API/source requests.

- [ ] Extend the page's exact validation and generated kind handling.

Accept `omtexterna` only for `author === "LagerlöfS"`; keep existing kinds
generic. Add label `Om texterna`, keep the query-free async key and accepted
identity pattern, and fetch inside `<script setup>` through the same-origin
author-document API. Do not add a composable.

- [ ] Apply exact SLA head/body state and render through the existing DOM.

Use reactive head output so only this identity gains `site-sla`. Keep the
ordinary background, existing direct author H1/nav DOM, and
`.page_content > .content.unbox`. Do not add a portrait or CSS changes.

- [ ] Verify and commit.

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
LITTB_NUXT_TEST_PORT=3038 npx playwright test \
  test/ssr/author-documents-api.spec.ts \
  test/ssr/author-documents.spec.ts --project=ssr
LITTB_NUXT_TEST_PORT=3038 npx playwright test \
  test/e2e/sla-omtexterna.behavior.spec.ts --project=desktop-chromium
npx vue-tsc --noEmit
cd ..
git diff --check
git add 'nuxt/app/pages/författare/[author]/[document].vue' \
  nuxt/test/ssr/author-documents.spec.ts \
  nuxt/test/e2e/sla-omtexterna.behavior.spec.ts
git commit -m "feat(nuxt): render SLA omtexterna landing"
```

### Task 6: Prove Exact Visual Parity and Close the Slice

**Files**

- Create: `nuxt/test/e2e/sla-omtexterna.visual.spec.ts`
- Create: `.superpowers/sdd/sla-omtexterna-landing-closure-report.md`
- Modify production DOM only if a strict authority diff proves it necessary.

- [ ] Add strict desktop/mobile Nuxt comparisons.

Wait for exact body state, managed heading, fonts, and decoded ordinary
background. Assert hidden author H1/nav, no portrait, exact link ledger, no
browser API/content request, no production request, no excluded data request,
and no console/page errors. Compare to the two Angular images with
`threshold: 0` and `maxDiffPixels: 0`.

- [ ] Diagnose RED using DOM/computed-style evidence.

If parity fails, compare actual/diff images and computed styles. Modify only the
smallest framework-only DOM detail proven by authority. Do not tune global CSS,
rewrite content, or expand sanitizer policy to chase pixels.

- [ ] Run fresh closure matrices.

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
npx playwright test --config=playwright.author-documents-angular.config.ts
LITTB_NUXT_TEST_PORT=3038 npx playwright test \
  test/ssr/author-documents-api.spec.ts \
  test/ssr/author-documents.spec.ts --project=ssr
LITTB_NUXT_TEST_PORT=3038 npx playwright test \
  test/e2e/sla-omtexterna.behavior.spec.ts --project=desktop-chromium
LITTB_NUXT_TEST_PORT=3038 npx playwright test \
  test/e2e/sla-omtexterna.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
npx vitest run test/unit/author-document.spec.ts \
  test/unit/v2-server.spec.ts
npm run test:unit
LITTB_NUXT_TEST_PORT=3038 npx playwright test --project=ssr
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json \
  npm run api:check
npx vue-tsc --noEmit
npm run build
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
python -m pytest -q test_lbapi/v2
python scripts/export_v2_openapi.py --check
python -m compileall -q lbapi/v2
cd /Users/johan/.codex/worktrees/8c5c/littb
git diff --check
```

- [ ] Record and verify closure authority.

Record the source hash, two new baseline hashes, unchanged six prior author
baseline hashes, exact descriptor/content and empty excluded-data ledgers,
suite totals, warnings, and any deferred concern. Confirm there are no
`*-actual.png` or `*-diff.png` artifacts and no unrelated staged files.

- [ ] Commit only tracked parity evidence.

```bash
git add nuxt/test/e2e/sla-omtexterna.visual.spec.ts
git diff --cached --check
git commit -m "test(nuxt): verify SLA omtexterna parity"
```

Do not stage `.superpowers/` unless the parent explicitly requests it.

## Final review gate

Before declaring the slice complete, obtain an independent whole-slice review
with explicit Spec PASS/FAIL, Quality APPROVED/NOT APPROVED, and Ready YES/NO.
Every Important or Critical finding must be fixed with RED/GREEN evidence and
re-reviewed.
