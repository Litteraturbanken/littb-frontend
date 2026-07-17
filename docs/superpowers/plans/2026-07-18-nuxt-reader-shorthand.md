# Nuxt Reader Shorthand Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve legacy Reader shorthand URLs to the exact canonical Nuxt Reader start page on SSR and client navigation without changing visuals or duplicating Reader logic.

**Architecture:** Extract the existing strict Reader metadata boundary into a Nitro server utility, expose a typed no-store resolver endpoint, and add a tiny page whose one-use `useRequestFetch` call redirects to the canonical Reader route. Preserve the raw query suffix byte-for-byte and keep successful rendering owned by the existing canonical Reader page.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Nitro/H3 server handlers, TypeScript, Playwright, Vitest fixture server.

## Global Constraints

- Preserve the existing Angular route outcome and all current Nuxt Reader visuals.
- Successful shorthand requests must canonicalize to `/författare/{author}/titlar/{title}/sida/{startPage}/etext`.
- Support only `etext` until the canonical Nuxt faksimil Reader exists.
- Keep one-use fetch/model logic inside the page `<script setup>`; do not add a composable.
- Preserve the raw query suffix exposed by `route.fullPath` without reconstructing it, including bare/empty keys, ordering, repetition, plus/space spellings, and retained percent escapes.
- Use strict response and identity validation; return `404` for absent identities and `502` for unavailable or malformed source data.
- Do not add Angular/Vue compatibility code or a temporary static payload.
- Do not implement the source-information modal or any other deferred Reader feature in this slice.
- Do not stage `.superpowers/`.

---

## File map

- Create `nuxt/server/utils/reader-source.ts`: one strict metadata/source boundary shared by Nitro Reader handlers.
- Modify `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`: consume the shared boundary without changing its response contract.
- Create `nuxt/server/api/reader/resolve/[author]/[title]/[mediatype].get.ts`: return a typed canonical start-page resolution and no HTML.
- Modify `nuxt/shared/types/reader.ts`: define `ReaderRouteResolution` alongside `ReaderPage`.
- Create `nuxt/app/pages/författare/[author]/titlar/[title]/[mediatype].vue`: page-local resolver fetch and canonical SSR/client redirect.
- Modify `nuxt/app/pages/bibliotek.vue`: render the existing EPUB title href through `NuxtLink` with unchanged anchor DOM/visuals so it is a real SPA caller.
- Modify `nuxt/test/fixtures/v2-server.mjs`: deterministic malformed/unavailable Reader metadata cases and exact request ledger support.
- Create `nuxt/test/ssr/reader-shorthand.spec.ts`: resolver and direct-SSR redirect contract.
- Modify `nuxt/test/e2e/reader.behavior.spec.ts`: client navigation and no-error regression.

### Task 1: Shared Reader source boundary and typed resolver

**Files:**
- Create: `nuxt/server/utils/reader-source.ts`
- Create: `nuxt/server/api/reader/resolve/[author]/[title]/[mediatype].get.ts`
- Modify: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`
- Modify: `nuxt/shared/types/reader.ts`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Create: `nuxt/test/ssr/reader-shorthand.spec.ts`

**Interfaces:**
- Consumes: `readerSourceBase`, legacy `GET /api/get_work_info`, and the current exact `ReaderPage` contract.
- Produces: `loadReaderMetadata(event, author, titlePath, mediaType): Promise<ReaderWorkMetadata>`, `fetchReaderPageHtml(base, workId, pageIndex): Promise<string>`, and `ReaderRouteResolution`.

- [ ] **Step 1: Add failing resolver contract tests and deterministic fixture cases**

Extend the fixture's `/api/get_work_info` branch with these exact deterministic
title identities, always ledgering `${url.pathname}${url.search}` before the
response:

| `titlepath` | Fixture response | Expected resolver status |
| --- | --- | --- |
| `DoktorGlas` | current exact etext | `200` |
| `SiblingPagesReader` | exact etext without `pages`, plus same-`lbworkid` faksimil with valid pages | `200` |
| `MissingReader` | normal Doktor Glas identity | `404` title mismatch |
| `NoRequestedMediaReader` | exact title with only faksimil | `404` |
| `WrongAuthorReader` | exact title/etext with first author `OtherAuthor` | `404` |
| `MissingStartReader` | exact title/etext with no `startpagename` | `404` |
| `MalformedStartReader` | exact title/etext with numeric `startpagename` | `502` |
| `OutOfListStartReader` | exact title/etext with start `99`, absent from valid pages | `404` |
| `MalformedPagesReader` | exact title/etext with non-array pages and no valid sibling | `502` |
| `MediaMismatchReader` | exact title whose representation says faksimil | `404` |
| `MalformedReader` | `{ hits: 1, data: "malformed" }` | `502` |
| `UnavailableReader` | upstream `503` | `502` |

Add mutable `readerMetadataDelays` plus exact `GET`/`PUT`/`DELETE`
`/_reader_metadata_delays` controls, keyed by `titlepath`, for Task 2's race
tests.

Create `reader-shorthand.spec.ts` with exact cases:

```ts
import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const resolvePath = "/api/reader/resolve/S%C3%B6derbergH/DoktorGlas/etext"

async function resetReader(request: APIRequestContext) {
  await request.delete(`${fixture}/_reader_requests`)
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

test.beforeEach(async ({ request }) => resetReader(request))

test("resolves exact Reader metadata without fetching page HTML", async ({ request }) => {
  const response = await request.get(resolvePath)
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "SöderbergH",
    titlePath: "DoktorGlas",
    mediaType: "etext",
    startPageName: "-2",
    canonicalPath: "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  })
  expect(await readerRequests(request)).toEqual([
    "/api/get_work_info?authorid=S%C3%B6derbergH" +
    "&exclude=content_vector&titlepath=DoktorGlas"
  ])
})
```

Add one table-driven assertion for every named identity/status above. Assert
unsupported `faksimil` returns `404` with an empty upstream ledger. For a
query-bearing resolver URL, assert the upstream ledger is still exactly the
three-parameter string above: public `om-boken`, repeated keys, and unknown
keys must not be forwarded. Assert `SiblingPagesReader` returns its etext
canonical path using the inherited start page and still never fetches
`/txt/**/res_*.html`.

- [ ] **Step 2: Run the focused tests to verify RED**

Run:

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3131 yarn playwright test \
  --project=ssr test/ssr/reader-shorthand.spec.ts
```

Expected: FAIL because the resolver route and shared types do not exist. Record the exact failing count and first relevant assertion.

- [ ] **Step 3: Define the shared type and strict source utility**

Add to `shared/types/reader.ts`:

```ts
export interface ReaderRouteResolution {
  authorId: string
  canonicalPath: string
  mediaType: "etext"
  startPageName: string
  titlePath: string
}
```

Create `server/utils/reader-source.ts` with a focused internal model:

```ts
export interface ReaderSourcePage {
  pageIndex: number
  pageName: string
}

export interface ReaderWorkMetadata {
  author: { id: string, name: string }
  base: string
  displayTitle: string
  fullTitle: string
  imprintYear: string | null
  mediaType: "etext"
  pages: ReaderSourcePage[]
  startPageName: string | null
  titlePath: string
  workId: string
}

export async function loadReaderMetadata(
  event: H3Event,
  author: string,
  titlePath: string,
  mediaType: string
): Promise<ReaderWorkMetadata>
```

Move the current `isRecord`, required-string, page parsing, author/title/work
validation, imprint derivation, and metadata fetch into this utility. Select
only an exact `titlepath`/`etext` representation; intentionally do not retain
Angular's requested-media fallback. If that etext has no pages, inherit a
strictly valid page array only from a sibling with the same `lbworkid`. Keep a
missing `startpagename` nullable so an otherwise valid canonical page remains
valid; reject a present non-string value as malformed `502`. Require the first
returned author ID to equal the requested author or return `404`. Enforce
`mediaType === "etext"` before upstream IO.
Export the existing HTML fetch as:

```ts
export async function fetchReaderPageHtml(
  base: string,
  workId: string,
  pageIndex: number
): Promise<string>
```

- [ ] **Step 4: Implement the resolver and refactor the canonical handler**

The resolver must require all route params, call `loadReaderMetadata`, require
`startPageName`, prove it exists in `metadata.pages`, and return:

```ts
const canonicalPath = [
  "/författare",
  encodeURIComponent(metadata.author.id),
  "titlar",
  encodeURIComponent(metadata.titlePath),
  "sida",
  encodeURIComponent(metadata.startPageName),
  metadata.mediaType
].join("/")

return {
  authorId: metadata.author.id,
  canonicalPath,
  mediaType: metadata.mediaType,
  startPageName: metadata.startPageName,
  titlePath: metadata.titlePath
} satisfies ReaderRouteResolution
```

Set `cache-control: no-store`. Refactor the canonical handler to call the same
metadata utility and exported HTML fetch, then build the existing `ReaderPage`
unchanged. Do not alter canonical page status, fields, stylesheets, or HTML.

- [ ] **Step 5: Run resolver and canonical Reader regression tests GREEN**

Run:

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3131 yarn playwright test \
  --project=ssr test/ssr/reader-shorthand.spec.ts test/ssr/reader.spec.ts
yarn typecheck
```

Expected: all new shorthand tests and all existing Reader SSR tests pass;
typecheck exits `0`. Add canonical regression cases proving wrong returned
author is `404`, missing start metadata does not break an explicitly requested
valid page, and present malformed start metadata is the chosen strict `502`.

- [ ] **Step 6: Commit Task 1**

```bash
git add -- \
  nuxt/server/utils/reader-source.ts \
  nuxt/server/api/reader/resolve/'[author]'/'[title]'/'[mediatype]'.get.ts \
  nuxt/server/api/reader/'[author]'/'[title]'/'[page]'/'[mediatype]'.get.ts \
  nuxt/shared/types/reader.ts \
  nuxt/test/fixtures/v2-server.mjs \
  nuxt/test/ssr/reader-shorthand.spec.ts
git commit -m "feat(nuxt): resolve reader start pages"
```

### Task 2: Page-local SSR/client canonical redirect

**Files:**
- Create: `nuxt/app/pages/författare/[author]/titlar/[title]/[mediatype].vue`
- Modify: `nuxt/app/pages/bibliotek.vue`
- Modify: `nuxt/test/ssr/reader-shorthand.spec.ts`
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`

**Interfaces:**
- Consumes: Task 1 `ReaderRouteResolution` and `GET /api/reader/resolve/{author}/{title}/{mediatype}`.
- Produces: the public shorthand Nuxt route with exact canonical redirect semantics.

- [ ] **Step 1: Add failing direct-SSR and client-navigation tests**

In `reader-shorthand.spec.ts`, add:

```ts
test("SSR preserves the raw shorthand query in a canonical redirect", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas/etext" +
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F",
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext" +
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  )
})
```

Add direct-page SSR status tests using every exact fixture identity from Task
1. In `reader.behavior.spec.ts`, configure a 300 ms `DoktorGlas` metadata delay,
start on `/bibliotek?visa=epub&sort=popularitet`, and click the unique
`[data-library-epub-title]` Doktor Glas link after proving it is rendered by a
`NuxtLink` client navigation (no document request for the shorthand page).
Assert the shorthand URL and only `.searching .preloader` own the page during
the delay, then assert the canonical Reader and `?om-boken`. Going Back must
return directly to the EPUB Library state rather than the shorthand URL.

Add a separate `navigateClient(page, rawPath)` test helper that obtains the
mounted Vue app from `#__nuxt`, calls its installed `$router.push(rawPath)`,
and exercises the exact literal query from the SSR test. Assert the canonical
client URL retains the same `route.fullPath` suffix. Add a delayed navigation
away case: start a shorthand client navigation, navigate to `/bibliotek`
before release, wait past the delay, and assert the late resolver never leaves
Library. Keep the console/page-error ledger empty in all cases.

- [ ] **Step 2: Run the focused tests to verify RED**

Run:

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3132 yarn playwright test \
  --project=ssr test/ssr/reader-shorthand.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3133 yarn playwright test \
  --project=desktop-chromium test/e2e/reader.behavior.spec.ts \
  -g "shorthand"
```

Expected: FAIL because Nuxt has no shorthand page route.

- [ ] **Step 3: Implement the page-local resolver fetch and strict validation**

Create the page with `key: route => route.fullPath`, validation for non-empty
scalar author/title, and exact `mediatype === "etext"`. In `<script setup>`,
import only the shared type, capture `requestedFullPath`, derive scalar params,
and call `useRequestFetch` directly. Validate all five response fields against
the requested identity and an independently built expected canonical path.
Convert fetch `404` to page `404` and upstream or malformed failures to `502`.

Preserve the raw suffix:

```ts
const queryIndex = route.fullPath.indexOf("?")
const rawQuerySuffix = queryIndex >= 0 ? route.fullPath.slice(queryIndex) : ""
const target = `${resolution.canonicalPath}${rawQuerySuffix}`

await navigateTo(target, { redirectCode: 307, replace: true })
```

Wrap that logic in one local async function. On the server, `await` it. On the
client, call it without awaiting from otherwise synchronous setup, so the new
page commits immediately and renders the existing legacy-style
`.searching > .preloader` instead of remaining behind page suspense. Capture
an active identity token, invalidate it in `onBeforeRouteLeave`, and check both
the token and `route.fullPath === requestedFullPath` before redirecting or
showing an error. Do not create a composable.

Change only the EPUB title element in `bibliotek.vue` from `<a :href>` to
`<NuxtLink :to>` while retaining the same data attribute, text, surrounding
markup, and rendered anchor DOM. Do not change styles or other Library links.

- [ ] **Step 4: Run focused SSR/client tests GREEN**

Run:

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3132 yarn playwright test \
  --project=ssr test/ssr/reader-shorthand.spec.ts test/ssr/reader.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3133 yarn playwright test \
  --project=desktop-chromium test/e2e/reader.behavior.spec.ts
yarn typecheck
```

Expected: shorthand and canonical Reader SSR pass, full Reader behavior passes,
and typecheck exits `0`.

- [ ] **Step 5: Run adjacent route regressions and production checks**

Run sequentially:

```bash
cd nuxt
yarn test:unit
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3136 yarn playwright test \
  --project=desktop-chromium --project=mobile-chromium \
  test/e2e/reader-hit.visual.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3134 yarn playwright test \
  --project=desktop-chromium \
  test/e2e/library.behavior.spec.ts \
  test/e2e/author-works.behavior.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3135 yarn playwright test \
  --project=ssr \
  test/ssr/library.spec.ts \
  test/ssr/author-works.spec.ts
yarn typecheck
yarn build
LBAPI_OPENAPI_SCHEMA=../../lb-backend/openapi/v2.json yarn api:check
cd ..
git diff --check
```

Expected: every suite and command exits `0`; no visual baseline changes.

- [ ] **Step 6: Commit Task 2**

```bash
git add -- \
  nuxt/app/pages/författare/'[author]'/titlar/'[title]'/'[mediatype]'.vue \
  nuxt/app/pages/bibliotek.vue \
  nuxt/test/ssr/reader-shorthand.spec.ts \
  nuxt/test/e2e/reader.behavior.spec.ts
git commit -m "feat(nuxt): canonicalize reader shorthand routes"
```

### Task 3: Independent review and live handoff

**Files:**
- Modify: `.superpowers/sdd/progress.md` (untracked report only)
- Create: `.superpowers/sdd/reader-shorthand-final-report.md` (untracked report only)

**Interfaces:**
- Consumes: Tasks 1-2 commits and all verification output.
- Produces: a reviewed slice and a live development route ready for user testing.

- [ ] **Step 1: Request independent spec and quality review**

The reviewer must verify exact legacy redirect authority, strict upstream and
response identity, raw query preservation, correct `404`/`502`, no duplicate
Reader implementation, no one-use composable, no hidden compatibility layer,
and no visual drift. Address every Critical/Important finding with a focused
RED/GREEN regression and a separate commit; re-review until clean.

- [ ] **Step 2: Run fresh final verification**

Re-run the Task 2 focused Reader SSR/behavior, full unit, typecheck, build,
exact OpenAPI check, and frontend `git diff --check`. Record exact commands,
counts, exit codes, and warnings in `reader-shorthand-final-report.md`.

- [ ] **Step 3: Verify the live route in the in-app browser**

With the existing Nuxt dev server and configured live source, navigate to:

```text
http://127.0.0.1:3000/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken
```

Verify the final URL is the canonical `/sida/-2/etext?om-boken`, the Doktor
Glas Reader content is visible, the Reader stylesheets are loaded, and no new
router/hydration/page error is emitted. Keep the dev servers running.

- [ ] **Step 4: Record progress without staging reports**

Mark the Reader shorthand slice complete in `.superpowers/sdd/progress.md`.
Confirm `git status --short` shows only `?? .superpowers/` after committed
production/test work.
