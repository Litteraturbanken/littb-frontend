# Nuxt Author Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/författare/:author` and `/författare/:author/dramawebben` to visually faithful, SSR-complete Nuxt pages backed by one strict FastAPI v2 author-profile operation.

**Architecture:** FastAPI performs one exact selected-field author lookup, resolves the two possible bylines, and returns only display-ready profile metadata and validated destinations. Both Nuxt pages fetch the generated operation directly in `<script setup>`, share pure sanitization/view-model helpers and one presentational component, and render the existing author DOM/CSS with deterministic Angular-authority screenshots.

**Tech Stack:** FastAPI, Pydantic v2, OpenSearch DSL, Nuxt 4, Vue 3 `<script setup>`, openapi-fetch, linkedom, Vitest, Playwright, Tailwind plus copied legacy SCSS.

## Global Constraints

- This is an architectural migration only: do not redesign, rewrite editorial copy, or modify Angular production sources or copied legacy SCSS.
- Preserve hybrid/SSR behavior, exact Swedish routes, metadata, body classes, backgrounds, DOM/CSS hooks, desktop/mobile appearance, and live `/red` portrait URLs.
- Fetch model data directly in each page `<script setup>`; do not add a one-use composable. Shared pure helpers and the component are justified only because both profile routes use them.
- Preserve raw managed HTML at the API boundary and sanitize it deterministically before SSR `v-html`; never serialize unsanitized profile HTML into the hydrated view model.
- Do not add an Angular/Vue compatibility gateway, global author-catalog request, works query, Ljud request, Litteraturkartan request, Reader request, managed-document request, deployment hardening, dead “LÄS MER”, portrait zoom, or editor keyboard shortcut.
- Keep future Nuxt destinations as ordinary links. Temporary local 404s for not-yet-ported child routes are accepted and must not broaden this slice.
- Use Headless UI only for existing equivalent dropdown/modal behavior; this slice has none and therefore adds no Headless UI component.
- Follow strict red-green-refactor: every production behavior is preceded by a focused failing test whose expected failure is observed.
- Generate the checked-in TypeScript client only from the canonical backend OpenAPI snapshot.

---

### Task 1: Publish the strict Author profile operation

**Files:**
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/lbapi/v2/authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_models.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_authors.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_api.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/test_lbapi/v2/test_openapi.py`
- Modify: `/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json`

**Interfaces:**
- Consumes: existing `authors.router`, exact `elasticapi.get_documents`, `AuthorSummary`, `ApiErrorResponse`, and global v2 error handlers.
- Produces: `GET /authors/{author_id}`, operation `v2_get_author`, and the strict schemas described below.

- [ ] **Step 1: Write failing model and author-ID validation tests**

Add tests that instantiate every required model, reject extras recursively, and
prove a profile author ID accepts `StrindbergA`, `SöderbergH`, and `LagerlöfS`
but rejects empty/over-100 values, leading/trailing whitespace, `%`, `/`, `\`,
controls, `.` and `..`.

The model contract is:

```python
ProfileAuthorId = Annotated[
    str,
    StringConstraints(min_length=1, max_length=100),
    AfterValidator(validate_profile_author_id),
]

class AuthorPortrait(V2Model):
    url: str
    caption_html: str | None

class ProfileLink(V2Model):
    label: str
    url: str

class DramawebbenProfile(V2Model):
    introduction_html: str | None
    introduction_by: AuthorSummary | None
    source_html: list[str]
    portrait: AuthorPortrait | None

class AuthorProfile(V2Model):
    author_id: str
    full_name: str
    surname: str | None
    birth_year: str | None
    death_year: str | None
    canonical_path: str
    introduction_html: str | None
    introduction_by: AuthorSummary | None
    source_html: list[str]
    pseudonyms: list[AuthorSummary]
    other_names: list[str]
    portrait: AuthorPortrait | None
    search_url: str | None
    related_links: list[ProfileLink]
    encyclopedia_links: list[ProfileLink]
    dramawebben: DramawebbenProfile | None
```

- [ ] **Step 2: Run model tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2/test_models.py -k 'author_profile or profile_author_id'
```

Expected: collection/import failure because the profile models do not exist.

- [ ] **Step 3: Add failing exact-provider and transformation tests**

Use complete rich and sparse raw author dictionaries. Assert exactly one
selected-field query:

```python
get_documents(
    "author",
    0,
    2,
    includes=AUTHOR_PROFILE_FIELDS,
    show_only=False,
    and_query=Q("term", **{"authorid.raw": author_id}),
)
```

`AUTHOR_PROFILE_FIELDS` must contain only identity, `show`, `birth.plain`,
`death.plain`, ordinary intro/byline/sources, pseudonym identity/name/surname,
other names, picture/caption, searchable, presentation, bibliography,
external-reference label/URL, the five rendered Wikidata link fields, normalized
ID, and the represented Dramawebben intro/byline/sources/picture/caption fields.

Prove these transformations through the pure interface
`transform_author_profile(raw: dict[str, Any], requested_author_id: str,
bylines: dict[str, AuthorSummary]) -> AuthorProfile`:

- rich ordinary and Dramawebben content;
- sparse optional fields represented by `null`/empty arrays;
- living, death-only, both-year, and `0000` source years;
- ordinary root, Dramawebben-only, and no-intro canonical paths;
- portrait URLs ending in `_large.jpeg` and `_dw_large.jpeg`;
- coherent byline lookup by ID, including missing byline as `null`;
- Presentation, Bibliografi, and safe same-origin external-reference ordering;
- SBL, SKBL, BLF, SOL, and allowlisted Wikipedia HTTPS links;
- search URL `/sok?forfattare={encoded-id}&avancerad` only when searchable;
- hidden/no exact author as 404;
- duplicate exact documents, non-mapping data, blank required values, unsafe
  normalized IDs/links, malformed nested structures, and unexpected IDs as one
  non-leaking malformed-response failure.

- [ ] **Step 4: Run provider tests RED**

```bash
pytest -q test_lbapi/v2/test_authors.py -k profile
```

Expected: fail because the profile query, transformer, and endpoint are absent.

- [ ] **Step 5: Implement the minimal provider, transformer, and endpoint**

Extend `authors.py` without changing the existing summary resolver. Add
`get_author(author_id: ProfileAuthorId) -> AuthorProfile` at
`GET /authors/{author_id}` with operation ID `v2_get_author`, response model
`AuthorProfile`, and explicit `ApiErrorResponse` schemas for 404, 422, 500, and
503.

Catch OpenSearch failures from both primary and byline queries and raise a typed
503 with code `author_profile_unavailable` and message
`Unable to load author profile`. Resolve distinct ordinary/Dramawebben byline
IDs in one `query_author_summaries` call with `show_only=False`; transform a
genuinely missing byline to `null`.

Validate provider strings without trimming them into different identifiers.
Validate final internal paths by repeated decoding, reject traversal/protocol
relative/backslash/control/malformed-percent values, percent-encode each
constructed segment, and derive encyclopedia URLs from fixed allowlisted HTTPS
origins rather than accepting arbitrary absolute provider URLs.

- [ ] **Step 6: Add failing endpoint and OpenAPI assertions**

Test endpoint 200 serialization, hidden/missing 404, path 422, primary/byline
OpenSearch 503, generic non-leaking 500, exact operation ID, GET-only method,
all response refs, recursive `additionalProperties: false`, required nullable
keys, and the exact stable path set including `/authors/{author_id}`.

- [ ] **Step 7: Run endpoint/OpenAPI tests RED, then register the final behavior**

```bash
pytest -q test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py
```

Expected before final endpoint wiring/schema export: focused assertions fail.
Complete the wiring in the already-included author router, then export/check:

```bash
python scripts/export_v2_openapi.py
python scripts/export_v2_openapi.py --check
pytest -q test_lbapi/v2
git diff --check
git diff --quiet -- lbapi/elasticapi.py lbapi/web.py
```

Expected final result: all v2 tests pass, snapshot is fresh, and legacy provider
and v1 web files are unchanged.

- [ ] **Step 8: Commit the backend contract**

```bash
git add lbapi/v2/models.py lbapi/v2/authors.py \
  test_lbapi/v2/test_models.py test_lbapi/v2/test_authors.py \
  test_lbapi/v2/test_api.py test_lbapi/v2/test_openapi.py openapi/v2.json
git diff --cached --check
git commit -m "feat(api): publish author profiles"
```

---

### Task 2: Generate the client and deterministic profile fixture

**Files:**
- Modify: `nuxt/app/lib/api/generated/lbapi.ts`
- Create: `nuxt/test/fixtures/author-profile-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: Task 1's canonical `openapi/v2.json` and `v2_get_author` response.
- Produces: generated `AuthorProfile` types and fixture handling for rich,
  sparse, Dramawebben-only, missing, and failed profiles.

- [ ] **Step 1: Add failing fixture-server tests**

Create complete typed fixture objects for:

- `StrindbergA`: all root fields, portrait, byline, two sources, pseudonyms,
  other names, related links, encyclopedia links, search, and Dramawebben;
- `LagerlöfS`: ordinary intro with no portrait/sources/aliases/link boxes;
- `DramaOnly`: no ordinary intro and one Dramawebben intro/portrait; and
- `NoIntro`: neither intro, canonical `/titlar` path.

Assert both `/v2/authors/{encoded-id}` and
`/private-v2/authors/{encoded-id}` return exactly the complete fixture, unknown
IDs return the standard 404 envelope, and the request ledger records the
original encoded path. Add isolated controls:

```text
GET|DELETE /_author_profile_requests
GET|PUT|DELETE /_author_profile_failure
```

Failure returns typed 503 without mutating unrelated fixture state.

- [ ] **Step 2: Run fixture tests RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn vitest run test/unit/v2-server.spec.ts
```

Expected: focused profile tests fail with 404/missing controls.

- [ ] **Step 3: Generate the client and implement fixture routing**

```bash
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:generate
```

Implement exact public/private dispatch, encoded-ID decoding with rejection of
malformed input, standard 404/503 envelopes, and fixture-specific request/failure
state. Do not add test-only behavior to production Nuxt code.

- [ ] **Step 4: Verify generated and fixture boundaries**

```bash
yarn vitest run test/unit/v2-server.spec.ts
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
yarn typecheck
```

- [ ] **Step 5: Commit the generated boundary**

```bash
git add nuxt/app/lib/api/generated/lbapi.ts \
  nuxt/test/fixtures/author-profile-data.mjs \
  nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/v2-server.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): generate author profile client"
```

---

### Task 3: Build the shared safe profile view model

**Files:**
- Create: `nuxt/app/lib/author-profile.ts`
- Create: `nuxt/test/unit/author-profile.spec.ts`

**Interfaces:**
- Consumes: generated `components["schemas"]["AuthorProfile"]`.
- Produces: `validateAuthorRouteParam`, `formatAuthorYears`,
  `sanitizeAuthorHtml`, `AuthorProfileView`, and
  `createAuthorProfileView(profile, variant)` for `"ordinary" | "dramawebben"`.

- [ ] **Step 1: Write failing route and lifespan tests**

Assert scalar route IDs accept historical ASCII/Unicode identifiers and reject
arrays, empty/overlong values, controls, whitespace edges, slash/backslash,
percent, traversal, malformed or non-stabilizing repeated encoding. Assert:

```text
birth only -> f. 1849
death only -> d. 1940
both -> 1849-1912
missing or 0000 -> empty
```

- [ ] **Step 2: Write failing sanitizer tests**

One complete malicious fixture must preserve benign paragraphs, headings,
emphasis, blockquote, lists, classes/IDs/language/title, fragments, HTTP(S),
mail, tel, and safe relative links while removing scripts, forms, frames,
object/embed, SVG/MathML, styles, event handlers, `srcdoc`, Angular/Vue
directives, unsafe/custom/data/file/protocol-relative/backslash/control/
traversal URLs, and disallowed attributes/elements. Assert `/forfattare/` links
become `/författare/` and `_blank` anchors receive
`rel="noopener noreferrer"`. Run the sanitizer twice and assert identical
output.

- [ ] **Step 3: Write failing view-model tests**

Assert ordinary view selection, Dramawebben intro/byline coherent fallback,
Dramawebben-only portrait selection, sanitized intro/sources/captions, exact
lifespan, and unchanged validated profile links. Raw HTML must not occur in the
returned view model.

- [ ] **Step 4: Run helper tests RED**

```bash
yarn vitest run test/unit/author-profile.spec.ts
```

Expected: fail because the helper module does not exist.

- [ ] **Step 5: Implement the minimal pure helper module**

Use `linkedom` with explicit element/attribute allowlists. Unwrap benign unknown
formatting elements only when their descendants remain safe; remove active or
executable element subtrees entirely. Normalize URLs against a fixed dummy
same-origin base and serialize only the sanitized fragment.

Define a view type containing only sanitized strings and display-ready fields:

```ts
export type AuthorProfileView = {
  authorId: string
  fullName: string
  lifespan: string
  introductionHtml: string
  introductionBy: string
  sourceHtml: string[]
  pseudonymNames: string[]
  otherNames: string[]
  portrait: { url: string, captionHtml: string } | null
  searchUrl: string
  relatedLinks: Array<{ label: string, url: string }>
  encyclopediaLinks: Array<{ label: string, url: string }>
  hasOrdinaryIntroduction: boolean
  hasDramawebben: boolean
}
```

- [ ] **Step 6: Verify and commit the shared boundary**

```bash
yarn vitest run test/unit/author-profile.spec.ts
yarn typecheck
git add nuxt/app/lib/author-profile.ts nuxt/test/unit/author-profile.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): sanitize author profiles"
```

---

### Task 4: Port the root and Dramawebben profile pages

**Files:**
- Create: `nuxt/app/components/author/AuthorProfileContent.vue`
- Create: `nuxt/app/pages/författare/[author]/index.vue`
- Create: `nuxt/app/pages/författare/[author]/dramawebben.vue`
- Create: `nuxt/test/ssr/author-profiles.spec.ts`
- Create: `nuxt/test/e2e/author-profiles.behavior.spec.ts`

**Interfaces:**
- Consumes: generated `GET /authors/{author_id}`, Task 2 fixtures, and Task 3
  view-model helpers.
- Produces: both canonical SSR pages with the exact legacy profile shell.

- [ ] **Step 1: Add failing SSR tests**

For the rich root route, assert status 200, one private profile request, exact
title/description, `focus page-authorInfo ready`, ordinary `html` background,
heading/lifespan, active Introduction tab, Verk/Drama/Search links, beginning/
middle/end sanitized intro, byline, singular/plural source copy, aliases,
portrait/caption, both link boxes, and absence of malicious probes/raw HTML.

For sparse root and Dramawebben states, assert exact omission/fallback behavior,
Dramawebben background/title/active tab/subtitle/portrait, and no ordinary link
boxes in the Dramawebben content column. Assert missing is a page-local Swedish
404 and failure is a page-local non-leaking 503. Assert root canonical redirects
preserve query state for Dramawebben-only and no-intro profiles.

- [ ] **Step 2: Add failing browser behavior tests**

Assert hydration has no console/page warnings, only the public request occurs on
client navigation, different-author navigation replaces all profile content,
ordinary↔Drama navigation cleans up metadata/background/active state, direct
Drama navigation without a block replace-redirects to root, all internal links
are encoded ordinary anchors, and external encyclopedia `_blank` anchors have
`noopener noreferrer`.

- [ ] **Step 3: Run page tests RED**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3001 yarn playwright test \
  --project=ssr test/ssr/author-profiles.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3001 yarn playwright test \
  --project=desktop-chromium test/e2e/author-profiles.behavior.spec.ts
```

Expected: route 404s because the pages do not exist.

- [ ] **Step 4: Implement page-local fetch and response-state handling**

Each page must create the generated API client inside `<script setup>` using the
private server base or public client base, validate the route parameter, and call
`useAsyncData` with a reactive key containing the author ID. The loader returns
both the generated response body and HTTP status so the page can set a real
404/503 status and render the local error message.

The root follows a non-root `canonical_path` with a temporary replace redirect
and preserves the current query. The Dramawebben page redirects to root if the
profile lacks a Dramawebben block. Do not place fetch/model behavior in the
shared component.

- [ ] **Step 5: Implement the shared legacy markup**

`AuthorProfileContent.vue` receives only an `AuthorProfileView` and variant. It
must preserve these authority hooks:

```text
h1.text-balance.max-w-5xl
ul.links
div.page_content
div.lg:flex (ordinary)
div.introtext.content.unbox.show_more (ordinary)
div.introtext.content.sm:inline-block.show_more (Dramawebben)
div.introauthor
div.source > ul > li > div.source_content
div.pseudonym
div.other_name
div.portrait_container
div.ext_links (ordinary only)
```

Use ordinary anchors, active classes, accessible navigation labels/current-page
state, and no new styling unless a later visual RED proves a migration-only gap.
Apply exact background assets through `htmlAttrs.style` and exact body classes
through `bodyAttrs.class`.

- [ ] **Step 6: Verify pages and commit**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3001 yarn playwright test \
  test/ssr/author-profiles.spec.ts test/e2e/author-profiles.behavior.spec.ts
yarn vitest run test/unit/author-profile.spec.ts test/unit/v2-server.spec.ts
yarn typecheck
git add nuxt/app/components/author/AuthorProfileContent.vue \
  'nuxt/app/pages/författare/[author]/index.vue' \
  'nuxt/app/pages/författare/[author]/dramawebben.vue' \
  nuxt/test/ssr/author-profiles.spec.ts \
  nuxt/test/e2e/author-profiles.behavior.spec.ts
git diff --cached --check
git commit -m "feat(nuxt): port author profiles"
```

---

### Task 5: Capture Angular authority and lock visual parity

**Files:**
- Create: `nuxt/playwright.author-angular.config.ts`
- Create: `nuxt/test/visual/capture-author-angular.spec.ts`
- Create: `nuxt/test/e2e/author-profiles.visual.spec.ts`
- Create: `nuxt/test/visual/baselines/author-rich-desktop.png`
- Create: `nuxt/test/visual/baselines/author-rich-mobile.png`
- Create: `nuxt/test/visual/baselines/author-sparse-desktop.png`
- Create: `nuxt/test/visual/baselines/author-sparse-mobile.png`
- Create: `nuxt/test/visual/baselines/author-dramawebben-desktop.png`
- Create: `nuxt/test/visual/baselines/author-dramawebben-mobile.png`
- Modify only if visual RED proves necessary: Author component/page files or narrowly scoped `nuxt/app/assets/styles/nuxt.scss`

**Interfaces:**
- Consumes: frozen Task 2 profile data, existing Angular app/template/styles,
  `waitForVisualAssets`, and Task 4 Nuxt routes.
- Produces: immutable Angular-authority baselines and matching Nuxt visual tests.

- [ ] **Step 1: Build deterministic Angular captures**

Follow existing Angular capture configurations. Intercept the complete legacy
author/profile and byline requests with frozen rich, sparse, and Dramawebben
fixtures; intercept displayed portrait/background assets; fail on every
unexpected optional work/audio/map/managed-document request rather than letting
mutable production data affect the image. Capture main content after fonts,
profile completion, image decoding, background decoding, and removal of the
spinner.

- [ ] **Step 2: Capture and review desktop/mobile authority**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn playwright test --config=playwright.author-angular.config.ts
```

Open all six captures and confirm they show the intended complete rich, sparse,
and Dramawebben states with no blank/error shell before accepting them as
baselines.

- [ ] **Step 3: Add Nuxt visual tests and run RED**

Reuse the same semantic profile data and exact viewports. Assert the fixture
request ledger and no console/page/hydration errors before screenshot matching.

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3001 yarn playwright test \
  test/e2e/author-profiles.visual.spec.ts
```

Expected on first run: at least one screenshot mismatch against Angular
authority; inspect the diff before changing production markup.

- [ ] **Step 4: Make only evidence-driven parity corrections**

Correct Nuxt DOM/class placement, background cleanup, or narrowly scoped glue
styles. Do not edit the captured baselines, Angular sources, or copied legacy
SCSS to make mismatches disappear. Re-run until all six screenshots match within
the existing visual-test threshold.

- [ ] **Step 5: Run the slice verification matrix**

```bash
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3001 yarn playwright test \
  test/ssr/author-profiles.spec.ts \
  test/e2e/author-profiles.behavior.spec.ts \
  test/e2e/author-profiles.visual.spec.ts
yarn vitest run test/unit/author-profile.spec.ts test/unit/v2-server.spec.ts
yarn typecheck
yarn build
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
git diff --check
```

- [ ] **Step 6: Commit the visual authority and parity fixes**

```bash
git add nuxt/playwright.author-angular.config.ts \
  nuxt/test/visual/capture-author-angular.spec.ts \
  nuxt/test/e2e/author-profiles.visual.spec.ts \
  nuxt/test/visual/baselines/author-*.png \
  nuxt/app/components/author/AuthorProfileContent.vue \
  'nuxt/app/pages/författare/[author]/index.vue' \
  'nuxt/app/pages/författare/[author]/dramawebben.vue' \
  nuxt/app/assets/styles/nuxt.scss
git diff --cached --check
git commit -m "test(nuxt): match author profile visuals"
```

If no production/style file changed during parity, stage only the new capture,
test, and baseline files.

---

### Task 6: Final cross-repository review and durable migration record

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Review only: both repository ranges produced by Tasks 1–5

**Interfaces:**
- Consumes: reviewed backend/frontend commits and their fresh verification logs.
- Produces: final spec-compliance and code-quality verdicts plus a durable ledger entry.

- [ ] **Step 1: Run fresh full-scope verification**

```bash
cd /Users/johan/.codex/worktrees/8c5c/lb-backend
pytest -q test_lbapi/v2
python scripts/export_v2_openapi.py --check
git diff --check

cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn typecheck
yarn vitest run
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3001 yarn playwright test \
  test/ssr/author-profiles.spec.ts \
  test/e2e/author-profiles.behavior.spec.ts \
  test/e2e/author-profiles.visual.spec.ts
yarn build
LBAPI_OPENAPI_SCHEMA=/Users/johan/.codex/worktrees/8c5c/lb-backend/openapi/v2.json yarn api:check
git diff --check
```

- [ ] **Step 2: Perform independent whole-slice review**

Review exact backend and frontend ranges for both verdicts:

```text
Spec compliance: PASS | FAIL
Code quality: APPROVED | CHANGES REQUIRED
Ready for the next migration slice: YES | NO
```

Fix every Critical or Important finding with a focused failing regression test,
re-run its covering tests, and re-review until both verdicts are clean.

- [ ] **Step 3: Record durable progress**

Append the final backend/frontend commit ranges, review verdict, and deferred
next Author subroutes to `.superpowers/sdd/progress.md`. Keep the migration goal
active: complete Author profiles do not mean the complete site has been ported.
