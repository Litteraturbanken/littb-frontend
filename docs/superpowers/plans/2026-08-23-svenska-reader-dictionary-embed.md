# Svenska Reader Dictionary Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restricted, chrome-free `svenska.se` page that renders current SO and SAOB Reader lookups and reports coarse state to an approved Litteraturbanken parent.

**Architecture:** The embedded page calls the existing generated search API for SO and SAOB, consumes backend presentation metadata to select renderable articles, and reuses `SOArticle.vue` and `SAOBArticle.vue`. A pure library owns selection and the versioned message protocol; route middleware owns `frame-ancestors`.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript 5.9, generated FastAPI client, Tailwind CSS, Node test runner, Playwright, Nomad.

**Spec:** `/Users/johan/.codex/worktrees/8c5c/littb/docs/superpowers/specs/2026-08-23-reader-svenska-dictionary-embed-design.md`

## Global Constraints

- Work in `/Users/johan/dev/svenska.se` or an isolated worktree created with `superpowers:using-git-worktrees`.
- Do not add a Nuxt `/api` endpoint; FastAPI owns that namespace.
- Do not infer matching, ranking, variants, compounds, or canonical targets from raw dictionary source fields.
- Reuse `SOArticle.vue`, `SAOBArticle.vue`, `parseQLinkTarget`, and generated presentation fields.
- The message protocol is `type: "svenska-reader-lookup"`, `version: 1` and never carries a word, URL, HTML, or raw error.
- Only `https://litteraturbanken.se` and `https://stage.litteraturbanken.se` may frame the production embed route.
- The full `make quality` gate is mandatory before staging.

---

### Task 1: Define lookup selection and message contracts

**Files:**
- Create: `frontend/lib/reader-lookup.ts`
- Create: `frontend/tests/reader-lookup.test.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: generated `ElasticsearchQueryResultSO`, `ElasticsearchQueryResultSAOB`, `matchesSelectionAlias`, `isRenderableResultArticle`, and `resultArticleGroup`.
- Produces: `resolveReaderLookup`, `ReaderLookupView`, `ReaderLookupMessage`, `readerLookupParentOrigin`, and `postReaderLookupMessage`.

- [ ] **Step 1: Write failing state-table and protocol tests**

Create tests that build minimal presented hits and assert:

```ts
assert.deepEqual(resolveReaderLookup(soResponse, saobResponse, {}), {
    available: ["so", "saob"],
    selected: "so",
    soArticles: [soHit],
    saobArticle: saobHit
})
assert.equal(resolveReaderLookup(noHit, saobResponse, {}).selected, "saob")
assert.equal(resolveReaderLookup(noHit, noHit, {}).selected, null)
assert.equal(resolveReaderLookup(ambiguousResponse, noHit, {}).selected, null)
assert.equal(
    readerLookupParentOrigin(
        "https://stage.litteraturbanken.se/reader",
        ["https://litteraturbanken.se", "https://stage.litteraturbanken.se"]
    ),
    "https://stage.litteraturbanken.se"
)
assert.equal(readerLookupParentOrigin("https://evil.invalid/", allowed), null)
```

Also assert that serialized messages contain exactly `type`, `version`, `requestId`, `event`, `dictionaries`, and `selectedDictionary`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `frontend/scripts/run-npm exec -- tsx --test tests/reader-lookup.test.ts`

Expected: module-not-found failure for `frontend/lib/reader-lookup.ts`.

- [ ] **Step 3: Implement the pure contract**

Use these public shapes:

```ts
export type ReaderDictionary = "so" | "saob"
export type ReaderLookupEvent = "ready" | "result" | "empty" | "error"
export type ReaderLookupTarget = { id?: string; homografNr?: string }
export type ReaderLookupView = {
    available: ReaderDictionary[]
    selected: ReaderDictionary | null
    soArticles: Hit_SOSource_[]
    saobArticle: Hit_SAOBSource_ | null
}
export type ReaderLookupMessage = {
    type: "svenska-reader-lookup"
    version: 1
    requestId: string
    event: ReaderLookupEvent
    dictionaries?: ReaderDictionary[]
    selectedDictionary?: ReaderDictionary
}
```

Select an explicit alias with `matchesSelectionAlias`; otherwise require
`presentation.has_exact_hit`, a non-null `preferred_hit_id`, and a renderable hit. Group
SO articles with `resultArticleGroup`; SAOB renders the selected hit. Choose SO when both
are available and SAOB when it is the only result.

- [ ] **Step 4: Add the test to the enumerated unit suite and run it**

Append `tests/reader-lookup.test.ts` to `test:unit` in `frontend/package.json`, then run:

```bash
frontend/scripts/run-npm exec -- tsx --test tests/reader-lookup.test.ts
frontend/scripts/run-npm run lint
frontend/scripts/run-npm run typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit the pure boundary**

```bash
git add frontend/lib/reader-lookup.ts frontend/tests/reader-lookup.test.ts frontend/package.json
git commit -m "feat(reader): define SO and SAOB embed selection"
```

### Task 2: Build the chrome-free embedded page

**Files:**
- Create: `frontend/components/ReaderLookupSurface.vue`
- Create: `frontend/pages/embed/reader.vue`
- Verify: `frontend/plugins/q-links.client.ts`
- Create: `frontend/tests/e2e/reader-lookup-embed.spec.ts`

**Interfaces:**
- Consumes: Task 1's `resolveReaderLookup` and message helpers; existing generated search client and article components.
- Produces: `/embed/reader?word=<word>&requestId=<uuid>`.

- [ ] **Step 1: Write failing browser tests for all four result states**

In `reader-lookup-embed.spec.ts`, intercept `**/api/search/so**` and
`**/api/search/saob**` with generated-shape fixtures. Cover:

```ts
test("defaults to SO and exposes SAOB when both have articles", async ({ page }) => {
    await installLookupResponses(page, { so: soHit("hund"), saob: saobHit("hund") })
    await page.goto("/embed/reader?word=hund&requestId=018f47c0-4d5b-7a62-8f41-a04b5df3fd8e")
    await expect(page.getByRole("tab", { name: "SO" })).toHaveAttribute("aria-selected", "true")
    await page.getByRole("tab", { name: "SAOB" }).click()
    await expect(page.getByTestId("saob-article")).toBeVisible()
})
```

Add tests for SO-only, SAOB-only automatic selection, neither result, one-provider
failure with the other provider succeeding, both providers failing, internal q-link
navigation, keyboard tab switching, and the full-site link.

- [ ] **Step 2: Run the focused E2E test and confirm failure**

Run: `frontend/scripts/run-npm run e2e:only -- "Reader lookup embed"`

Expected: 404 or missing heading for `/embed/reader`.

- [ ] **Step 3: Implement `ReaderLookupSurface.vue`**

The component must:

```ts
const props = defineProps<{ initialWord: string; requestId: string }>()
const status = ref<"loading" | "result" | "empty" | "error">("loading")
const activeDictionary = ref<ReaderDictionary | null>(null)
const controller = shallowRef<AbortController | null>(null)
```

For every word, abort the prior request, call `searchSearchTypesGet` for `so` and
`saob` concurrently with `from=0`, `size=10`, `includeDidYouMean=false`, and
`exactMatch=true`, pass fulfilled responses to `resolveReaderLookup`, and ignore stale
generations. Render native tab semantics only when both results exist. Render
`SOArticle` for each grouped SO article and one `SAOBArticle` for SAOB. Wrap them in
`data-testid="so-results"` and `data-testid="saob-results"` so the existing q-link
plugin retains dictionary context.

- [ ] **Step 4: Implement the route and parent notifications**

`frontend/pages/embed/reader.vue` validates one trimmed word of at most 100 characters
with no whitespace/control characters and a UUID request ID. It renders
`ReaderLookupSurface`, posts `ready` after mount, posts each terminal state once, and
sets a compact page title. Invalid input renders the unavailable state and posts
`error` without calling the API.

Initialize the existing shared route state with `q=word`, `exactMatch=true`, and no
selection identifiers. Watch its `q`, `id`, and `homografNr` fields so the existing
`q-links.client.ts` handler can update the embedded lookup without changing the current
`/embed/reader` path. Add an assertion to `frontend/tests/q-link.test.ts` that
`parseQLinkTarget({ rawHref: "?q=hund&id=42", currentUrl: embedUrl })` returns
`{ q: "hund", id: "42" }`.

- [ ] **Step 5: Run focused and adjacent checks**

```bash
frontend/scripts/run-npm run e2e:only -- "Reader lookup embed"
frontend/scripts/run-npm exec -- tsx --test tests/reader-lookup.test.ts tests/q-link.test.ts
frontend/scripts/run-npm run lint
frontend/scripts/run-npm run typecheck
frontend/scripts/run-npm run quality:maintainability
```

Expected: all pass with no new maintainability finding.

- [ ] **Step 6: Commit the embedded surface**

```bash
git add frontend/components/ReaderLookupSurface.vue frontend/pages/embed/reader.vue frontend/tests/e2e/reader-lookup-embed.spec.ts frontend/tests/q-link.test.ts
git commit -m "feat(reader): add embedded SO and SAOB lookup"
```

### Task 3: Restrict framing and configure approved parents

**Files:**
- Modify: `frontend/nuxt.config.ts`
- Create: `frontend/server/middleware/reader-embed-frame-policy.ts`
- Create: `frontend/tests/reader-embed-frame-policy.test.ts`
- Modify: `frontend/package.json`
- Modify: `jobs/svenska-se-stage.nomad.hcl`
- Modify: `jobs/svenska-se.nomad.hcl`
- Create: `pipeline/tests/test_reader_embed_jobs.py`

**Interfaces:**
- Consumes: comma-separated `NUXT_PUBLIC_READER_EMBED_PARENT_ORIGINS`.
- Produces: a route-specific CSP `frame-ancestors` header and the same allowlist for child `postMessage` validation.

- [ ] **Step 1: Write failing policy and jobspec tests**

Assert the policy returns:

```ts
assert.equal(
    readerEmbedFrameAncestors("https://litteraturbanken.se,https://stage.litteraturbanken.se"),
    "frame-ancestors https://litteraturbanken.se https://stage.litteraturbanken.se"
)
assert.throws(() => readerEmbedFrameAncestors("https://evil.invalid"))
```

In the Python jobspec test, assert both jobs set exactly:

```text
NUXT_PUBLIC_READER_EMBED_PARENT_ORIGINS = "https://litteraturbanken.se,https://stage.litteraturbanken.se"
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
frontend/scripts/run-npm exec -- tsx --test tests/reader-embed-frame-policy.test.ts
uv run pytest -q pipeline/tests/test_reader_embed_jobs.py
```

Expected: missing helper and missing jobspec variable failures.

- [ ] **Step 3: Implement runtime configuration and middleware**

Add public runtime config:

```ts
readerEmbedParentOrigins:
    process.env.NUXT_PUBLIC_READER_EMBED_PARENT_ORIGINS ||
    "https://litteraturbanken.se,https://stage.litteraturbanken.se"
```

The middleware must set CSP only when `getRequestURL(event).pathname === "/embed/reader"`.
Parse origins through `new URL`, require HTTPS outside development, require origin-only
values, deduplicate them, and reject values outside the two production allowlisted
origins. Do not set `X-Frame-Options` on this route and do not change headers elsewhere.

- [ ] **Step 4: Set the same explicit allowlist in both Nomad jobs**

Add the exact environment variable from Step 1 to each frontend task. Do not expose a
general wildcard or change Authelia policy.

- [ ] **Step 5: Verify headers and unrelated routes in a production build**

```bash
frontend/scripts/run-npm run build
frontend/scripts/run-npm run e2e:only -- "Reader lookup embed"
curl -fsSI 'http://127.0.0.1:3001/embed/reader?word=hund&requestId=018f47c0-4d5b-7a62-8f41-a04b5df3fd8e'
curl -fsSI 'http://127.0.0.1:3001/'
```

Expected: the embed response has the restrictive `frame-ancestors`; `/` does not inherit it.

- [ ] **Step 6: Commit framing policy**

```bash
git add frontend/nuxt.config.ts frontend/server/middleware/reader-embed-frame-policy.ts frontend/tests/reader-embed-frame-policy.test.ts frontend/package.json jobs/svenska-se-stage.nomad.hcl jobs/svenska-se.nomad.hcl pipeline/tests/test_reader_embed_jobs.py
git commit -m "security(reader): restrict dictionary embed parents"
```

### Task 4: Complete local gate and stage the isolated surface

**Files:**
- Verify only: all files changed in Tasks 1-3.

**Interfaces:**
- Produces: a reviewed public embed artifact required by the later `littb` plan.

- [ ] **Step 1: Run the complete quality gate**

Run: `make quality`

Expected: Ruff, formatting, mypy, pytest, frontend policy, maintainability, typecheck,
generated client checks, unit tests, audit, and browser tests all pass.

- [ ] **Step 2: Deploy to Svenska stage**

Run: `make reload-stage`

Expected: the staged commit completes the existing Nomad rollout and health checks.

- [ ] **Step 3: Review stage as a top-level authenticated page**

Open these through the authenticated Chrome session:

```text
https://stage.svenska.se/embed/reader?word=hund&requestId=018f47c0-4d5b-7a62-8f41-a04b5df3fd8e
https://stage.svenska.se/embed/reader?word=dekrepiditet&requestId=018f47c0-4d5b-7a62-8f41-a04b5df3fd8f
```

Expected: common-word tabs default to SO; the confirmed SAOB-only case defaults to SAOB;
keyboard, mobile scrolling, audio, q-links, source details, and console are clean.

- [ ] **Step 4: Promote and verify the isolated production route**

After explicit release approval, run the repository's existing production release
command and verify:

```bash
curl -fsSI 'https://svenska.se/embed/reader?word=hund&requestId=018f47c0-4d5b-7a62-8f41-a04b5df3fd8e'
curl -fsSI 'https://svenska.se/'
```

Expected: the embed route has the restrictive CSP, the root route does not, and normal
Svenska search is unchanged. Record the deployed commit SHA for the dependent plan.
