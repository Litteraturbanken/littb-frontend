# Nuxt Dramawebben Managed Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `/dramawebben`, `/dramawebben/om`, and `/dramawebben/kringtexter` to Nuxt SSR with exact Angular visual parity, sanitized live managed XHTML, and no plays-dataset request.

**Architecture:** One Vue shell renders the exact start/subpage DOM. The root is data-free; a validated dynamic managed-document page owns its page-local fetch to a narrow same-origin Nitro endpoint. The endpoint exact-maps two private source paths, applies a bounded XHTML parser/sanitizer, and returns a local typed contract.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Nitro/H3, linkedom, Vitest, Playwright, existing legacy SCSS/assets.

## Global Constraints

- Preserve the approved Angular visuals; do not redesign or replace legacy styling.
- Scope is exactly `/dramawebben`, `/dramawebben/om`, and `/dramawebben/kringtexter`.
- Do not implement `/pjäser`, `/författare`, filters, modals, legacy resolvers, Library, or Reader.
- `/dramawebben` is the exact legacy start shell, not a redirect, and performs no fetch.
- The two managed pages fetch only their exact configured XHTML sources through the Nitro sanitizer boundary.
- Do not add FastAPI/OpenAPI/generated-client work.
- Keep page-only fetch/state in `<script setup>`; do not create a one-use composable.
- Reuse byte-identical `styles.scss`, `dramawebben.jpg`, `dramawebben_fade.jpg`, and `dramawebben_vit.svg`.
- Authority and test routes must reject unlisted network requests by default.
- Do not stop or reuse the user's main development servers on ports 3000 and 8000.

---

### Task 1: Freeze the Angular Visual Authority and Real Managed Sources

**Files:**
- Create: `nuxt/test/fixtures/dramawebben-content/om.html`
- Create: `nuxt/test/fixtures/dramawebben-content/kringtexter.html`
- Create: `nuxt/test/fixtures/dramawebben-data.mjs`
- Create: `nuxt/playwright.dramawebben-angular.config.ts`
- Create: `nuxt/test/visual/capture-dramawebben-angular.spec.ts`
- Create: `nuxt/test/visual/baselines/dramawebben-start-desktop.png`
- Create: `nuxt/test/visual/baselines/dramawebben-start-mobile.png`
- Create: `nuxt/test/visual/baselines/dramawebben-om-desktop.png`
- Create: `nuxt/test/visual/baselines/dramawebben-om-mobile.png`
- Create: `nuxt/test/visual/baselines/dramawebben-kringtexter-desktop.png`
- Create: `nuxt/test/visual/baselines/dramawebben-kringtexter-mobile.png`

**Interfaces:**
- Consumes: live sources and SHA-256 provenance fixed in the design.
- Produces: `dramawebbenCases`, exact frozen XHTML bytes, six authority PNGs, and a closed Angular request ledger used by later visual tasks.

- [ ] **Step 1: Copy and verify the live managed XHTML fixtures**

Retrieve only the two approved sources read-only, verify them, and then add the
verified text fixtures with `apply_patch` (not `curl --output` or another shell
write):

```bash
curl --fail --location --max-time 20 \
  https://red.litteraturbanken.se/red/dramawebben/om.html
curl --fail --location --max-time 20 \
  https://red.litteraturbanken.se/red/dramawebben/kringtexter/kringtexter.html
shasum -a 256 nuxt/test/fixtures/dramawebben-content/{om,kringtexter}.html
```

Expected hashes, in order:

```text
fc43696a050fd4c0390e1e452949b8925fc883ff8ac3f8e155f921984d9237b1
f63c7aecdbfafdcc4df1a1cbd41b2ceeee6424a32138f551aac2ce7d5c797fd5
```

- [ ] **Step 2: Define the frozen case metadata**

Create `dramawebben-data.mjs` with exact public routes, source paths, fixture files, headings, and hashes:

```js
export const dramawebbenCases = [
  { kind: "start", route: "/dramawebben", sourcePath: null, fixture: null, heading: null },
  {
    kind: "om",
    route: "/dramawebben/om",
    sourcePath: "/red/dramawebben/om.html",
    fixture: "om.html",
    heading: "Om Dramawebben"
  },
  {
    kind: "kringtexter",
    route: "/dramawebben/kringtexter",
    sourcePath: "/red/dramawebben/kringtexter/kringtexter.html",
    fixture: "kringtexter.html",
    heading: "Mer läsning om svensk dramatik"
  }
]
```

- [ ] **Step 3: Create a dedicated Angular authority config**

Extend `playwright.angular.config.ts`, match only `capture-dramawebben-angular.spec.ts`, use `http://127.0.0.1:9000`, start root `yarn dev`, set `reuseExistingServer: false`, and retain the existing desktop/mobile authority projects.

- [ ] **Step 4: Write the closed Angular capture test**

Start from the already reviewed explicit `allowedShellStaticRequests` inventory in
`capture-author-documents-angular.spec.ts`, then commit the exact Dramawebben
inventory after adding/removing only observed route-specific entries. Every
listed shell signature must occur exactly once and the router must default-deny;
do not generate an allowlist from the traffic under test. Fulfill only:

```ts
const managed = new Map([
  ["/red/dramawebben/om.html", omBytes],
  ["/red/dramawebben/kringtexter/kringtexter.html", kringtexterBytes]
])

const expectedDramaQueryEntries = [
  ["author_aggregation", "true"],
  ["exclude", "text,parts,sourcedesc,pages,errata"],
  ["filter_and", '{"provenance.library":"Dramawebben","texttype":"drama"}'],
  ["include", "shorttitle,title,lbworkid,titlepath,authors,titleid,mediatype,dramawebben,keyword,startpagename,sortkey"],
  ["show_all", "true"],
  ["sort_field", "sortkey|asc"],
  ["to", "10000"]
] as const
```

Assert that `[...url.searchParams.entries()]` equals this alphabetically ordered
wire list exactly, including one JSON-valued `filter_and` parameter and no
duplicates. Return `{ data: [], author_aggregation: [] }` for the one exact
Angular `list_all/etext,faksimil,pdf,infopost` request. Admit exactly one author
bootstrap request,
`GET /api/get_authors?exclude=intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben`,
and return `{ data: [] }`. Fulfill only the established exact local Typography
CSS, backgrounds XML/CSS, and explicit static/logo/background inventory. Abort
every other request. Add negative probes for an unlisted same-origin
script/document, wrong source query/method, duplicate or reordered plays
parameters, HTTP/alternate-port Typography/GTM origins, an unlisted API, and the
production managed origin.

For each case assert exact body classes (`focus page-dramaweb ready`, plus
`drama-dramasubpage` on subpages), `startpage`/`subpage`, logo/tagline, link
text/hrefs/active state, expected heading/body, exactly one Angular plays
request, zero/one exact managed request, loaded fonts/background/logo, no
production/unexpected requests, and no new console/page errors.

- [ ] **Step 5: Run the Angular authority and inspect all six images**

Run:

```bash
cd nuxt
npx playwright test --config=playwright.dramawebben-angular.config.ts
```

Expected: `6 passed`; exact request ledgers close with no broad `route.continue()` fallback. Visually inspect the six PNGs before accepting them.

- [ ] **Step 6: Commit the frozen authority**

```bash
git add nuxt/playwright.dramawebben-angular.config.ts \
  nuxt/test/fixtures/dramawebben-content \
  nuxt/test/fixtures/dramawebben-data.mjs \
  nuxt/test/visual/capture-dramawebben-angular.spec.ts \
  nuxt/test/visual/baselines/dramawebben-*.png
git commit -m "test(nuxt): capture Dramawebben authority"
```

---

### Task 2: Add the Typed, Bounded Managed-XHTML Boundary

**Files:**
- Create: `nuxt/shared/types/dramawebben-document.ts`
- Create: `nuxt/server/utils/dramawebben-document.ts`
- Create: `nuxt/server/api/dramawebben/documents/[document].get.ts`
- Create: `nuxt/test/unit/dramawebben-document.spec.ts`
- Create: `nuxt/test/ssr/dramawebben-documents-api.spec.ts`
- Modify: `nuxt/nuxt.config.ts`
- Modify: `nuxt/test/fixtures/v2-server.mjs`

**Interfaces:**
- Consumes: exact source paths and frozen XHTML from Task 1.
- Produces: `DramawebbenManagedDocument`, `loadDramawebbenDocument(event, kind)`, and `GET /api/dramawebben/documents/:document` for Task 4.

- [ ] **Step 1: Write the shared response/error types**

```ts
export type DramawebbenDocumentKind = "om" | "kringtexter"
export type DramawebbenManagedDocument = {
  documentKind: DramawebbenDocumentKind
  bodyHtml: string
}
export type DramawebbenDocumentErrorCode =
  | "dramawebben_document_not_found"
  | "dramawebben_document_unavailable"
```

- [ ] **Step 2: Write failing unit tests for the complete trust boundary**

Test exact mapping, wrong names, exactly one body, body-only output, current frozen fixtures, comment/head/doctype removal, dangerous subtree removal, unknown-element unwrapping, attribute allowlisting, root-relative/fragment/HTTPS href preservation, protocol-relative/HTTP/javascript/data/traversal/control rejection, `_blank` rel hardening, invalid content type, manual redirects, declared and streamed bodies over 262,144 bytes, upstream 404, and payload non-leakage. Prove that public query parameters, cookies, and authorization headers are never forwarded to the managed origin.

Run:

```bash
cd nuxt
npx vitest run test/unit/dramawebben-document.spec.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the parser/sanitizer and bounded reader**

Use `linkedom.parseHTML`. Keep the source map immutable and private:

```ts
const sources = {
  om: "/red/dramawebben/om.html",
  kringtexter: "/red/dramawebben/kringtexter/kringtexter.html"
} as const
const maxBytes = 262_144
```

Implement recursive removal/unwrap with the exact element and attribute sets in the design. Construct the source URL only from `runtimeConfig.contentBase` and `sources[kind]`, fetch with `redirect: "manual"`, require `text/html`, enforce length while streaming, parse exactly one body, and map 404 separately from all other failures.

- [ ] **Step 4: Implement the narrow Nitro endpoint and proxy exclusion**

The handler must decode one router param, accept only the two enum values, set `cache-control: no-store`, and call `loadDramawebbenDocument`. Extend the legacy proxy negative lookahead:

```ts
"^/api/(?!v2(?:/|$)|reader(?:/|$)|author-documents(?:/|$)|dramawebben(?:/|$))"
```

- [ ] **Step 5: Add fixture-server source/log/failure support and API SSR tests**

Serve the two exact source paths from Task 1. Add controllable 404, 502, redirect, wrong-content-type, malicious, and over-limit cases without changing unrelated fixtures. Assert exact request logs and public code/status/body behavior for the Nitro endpoint.

Run:

```bash
cd nuxt
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/ssr/dramawebben-documents-api.spec.ts --project=ssr
```

Expected: all API SSR cases pass using Nuxt port 3027 and fixture port 4100.

- [ ] **Step 6: Run focused checks and commit**

```bash
cd nuxt
npx vitest run test/unit/dramawebben-document.spec.ts
npx vue-tsc --noEmit
cd ..
git diff --check
git add nuxt/shared/types/dramawebben-document.ts \
  nuxt/server/utils/dramawebben-document.ts \
  'nuxt/server/api/dramawebben/documents/[document].get.ts' \
  nuxt/test/unit/dramawebben-document.spec.ts \
  nuxt/test/ssr/dramawebben-documents-api.spec.ts \
  nuxt/test/fixtures/v2-server.mjs nuxt/nuxt.config.ts
git commit -m "feat(nuxt): bound Dramawebben documents"
```

---

### Task 3: Render the Exact Data-Free Dramawebben Start Shell

**Files:**
- Create: `nuxt/app/components/dramawebben/DramawebbenShell.vue`
- Create: `nuxt/app/pages/dramawebben/index.vue`
- Create: `nuxt/test/ssr/dramawebben.spec.ts`

**Interfaces:**
- Consumes: existing global `.page-dramaweb` styles/assets and Task 1 authority.
- Produces: `DramawebbenShell` with `page: "start" | "om" | "kringtexter"` and the `/dramawebben` SSR route used by Task 4.

- [ ] **Step 1: Write the failing root SSR contract**

Assert `200`, title `Litteraturbanken`, authority body/wrapper classes, exact logo/tagline and five links, start-only wording (`Sök i pjäserna`, `Om dramawebben`), empty `page_content`, no active link, no managed-document request, and no legacy API/list request. Include a direct query URL and prove the query is preserved without changing/fetching the shell.

Run:

```bash
cd nuxt
LITTB_NUXT_TEST_PORT=3027 npx playwright test test/ssr/dramawebben.spec.ts --project=ssr
```

Expected: FAIL with route 404.

- [ ] **Step 2: Implement the exact shared shell markup**

Use a typed prop and slot:

```ts
const props = defineProps<{ page: "start" | "om" | "kringtexter" }>()
const isStartPage = computed(() => props.page === "start")
```

Reproduce the legacy cover, wrappers, logo, tagline, links, spacing text nodes, and `page_content`. Use ordinary anchors with exact hrefs. Apply `active` only to `kringtexter`.

- [ ] **Step 3: Implement the root page with zero fetches**

Set `useSeoMeta({ title: "Litteraturbanken" })`, authority body classes through `useHead`, and render:

```vue
<DramawebbenShell page="start" />
```

Do not import `$fetch`, `useAsyncData`, runtime config, or any data type in this page.

- [ ] **Step 4: Run focused SSR/type checks and commit**

```bash
cd nuxt
LITTB_NUXT_TEST_PORT=3027 npx playwright test test/ssr/dramawebben.spec.ts --project=ssr
npx vue-tsc --noEmit
cd ..
git diff --check
git add nuxt/app/components/dramawebben/DramawebbenShell.vue \
  nuxt/app/pages/dramawebben/index.vue nuxt/test/ssr/dramawebben.spec.ts
git commit -m "feat(nuxt): render Dramawebben start shell"
```

---

### Task 4: Render Managed Documents with Page-Local SSR Fetching

**Files:**
- Create: `nuxt/app/pages/dramawebben/[document].vue`
- Create: `nuxt/test/e2e/dramawebben.behavior.spec.ts`
- Modify: `nuxt/test/ssr/dramawebben.spec.ts`

**Interfaces:**
- Consumes: Task 2 API/types and Task 3 shell.
- Produces: exact `/om` and `/kringtexter` SSR/client behavior with stale-response isolation and no query-only refetch.

- [ ] **Step 1: Extend SSR tests with failing managed-page contracts**

For both routes assert `200`, body content in initial HTML, exact one-source request, no plays/authors/API request, subpage/body classes, compact logo/no tagline, exact link wording/active state, upstream head/title/doctype absence, and sanitized probes absent. Add exact invalid-name global 404-before-fetch. Add source 404, source failure, redirect, wrong content type, malformed XHTML, and oversize cases with the stable Dramawebben shell and no source leak.

- [ ] **Step 2: Write failing browser behavior tests**

Cover direct hydration, exact links, query-only `pushState`/back/forward without API refetch, om-to-kringtexter navigation with one request each, delayed A-to-B stale response rejection, invalid route 404, and zero page errors/unhandled rejections.

Run:

```bash
cd nuxt
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/ssr/dramawebben.spec.ts --project=ssr
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/e2e/dramawebben.behavior.spec.ts --project=desktop-chromium
```

Expected: managed-page cases fail because the dynamic page does not exist.

- [ ] **Step 3: Implement exact validation and page-local fetch ownership**

Use `definePageMeta.validate` to accept only `om` and `kringtexter`; invalid and
excluded names intentionally use Nuxt's global 404 before the page is created.
Keep the fetch in the page and reuse the proven accepted-identity ownership
pattern from the author-document page:

```ts
type PageResult = {
  identity: string
  status: 200 | 404 | 502
  errorCode: DramawebbenDocumentErrorCode | null
  page: DramawebbenManagedDocument | null
}

const route = useRoute()
const fetcher = useRequestFetch()
const kind = computed<DramawebbenDocumentKind>(() => validatedDocumentParam(route))
const currentIdentity = computed(() => kind.value)
const asyncKey = computed(() => `dramawebben-document:${currentIdentity.value}`)
const { data } = await useAsyncData<PageResult>(asyncKey, async () => {
  const requestedKind = kind.value
  return await loadPageResult(fetcher, requestedKind, requestedKind)
}, {
  lazy: true,
  getCachedData: (key, nuxtApp) => {
    const cached = nuxtApp.payload.data[key] as PageResult | undefined
    return cached?.identity === currentIdentity.value ? cached : undefined
  }
})

const accepted = shallowRef<PageResult | null>(null)
watch(currentIdentity, () => { accepted.value = null }, { flush: "sync" })
watch([data, currentIdentity], ([candidate, identity]) => {
  if (candidate?.identity === identity) accepted.value = candidate
}, { immediate: true, flush: "sync" })

if (import.meta.server && accepted.value?.status !== 200) {
  setResponseStatus(accepted.value?.status ?? 502)
}

const page = computed(() => accepted.value?.status === 200
  ? accepted.value.page
  : null)
```

`validatedDocumentParam` must be total after route validation. `loadPageResult`
catches the same-origin API error, extracts only the two local error codes, maps
them to `404`/`502`, validates the complete successful object and matching
`documentKind`, and otherwise returns a redacted `502` result. Do not include
`route.query` in the async key.

- [ ] **Step 4: Render only validated sanitized HTML inside the shell**

Use the exact subpage shell and one content container:

```vue
<DramawebbenShell :page="kind">
  <div v-if="page" v-html="page.bodyHtml" />
  <p v-else-if="accepted" class="error">Innehållet kan inte visas just nu.</p>
</DramawebbenShell>
```

Do not parse or trust upstream HTML in the Vue page. Preserve title `Litteraturbanken` and authority body classes.

- [ ] **Step 5: Run focused SSR/behavior/type checks and commit**

```bash
cd nuxt
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/ssr/dramawebben-documents-api.spec.ts \
  test/ssr/dramawebben.spec.ts --project=ssr
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/e2e/dramawebben.behavior.spec.ts --project=desktop-chromium
npx vue-tsc --noEmit
cd ..
git diff --check
git add 'nuxt/app/pages/dramawebben/[document].vue' \
  nuxt/test/ssr/dramawebben.spec.ts \
  nuxt/test/e2e/dramawebben.behavior.spec.ts
git commit -m "feat(nuxt): render Dramawebben documents"
```

---

### Task 5: Prove Desktop/Mobile Visual Parity and Close the Slice

**Files:**
- Create: `nuxt/test/e2e/dramawebben.visual.spec.ts`
- Create: `.superpowers/sdd/dramawebben-managed-documents-closure-report.md`
- Modify only if the authority proves a framework-only DOM mismatch: `nuxt/app/components/dramawebben/DramawebbenShell.vue`

**Interfaces:**
- Consumes: six Task 1 baselines and completed routes from Tasks 3–4.
- Produces: final six-case parity evidence and a closure report; no feature API for later tasks.

- [ ] **Step 1: Write the six failing Nuxt visual comparisons**

For each case and desktop/mobile project, wait for the expected body class, logo, CSS background, font status, and managed heading when present. Assert:

```ts
await expect(page).toHaveScreenshot(`dramawebben-${kind}-${device}.png`, {
  fullPage: true,
  animations: "disabled",
  caret: "hide",
  scale: "css",
  threshold: 0,
  maxDiffPixels: 0
})
```

- [ ] **Step 2: Run visual RED and diagnose DOM-only differences**

```bash
cd nuxt
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/e2e/dramawebben.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected initially: screenshot mismatch. Compare actual/diff images and computed styles. Change shell markup only where Angular authority proves the difference; do not tune global CSS or source content.

- [ ] **Step 3: Run fresh focused GREEN matrices**

```bash
cd nuxt
npx playwright test --config=playwright.dramawebben-angular.config.ts
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/ssr/dramawebben-documents-api.spec.ts \
  test/ssr/dramawebben.spec.ts --project=ssr
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/e2e/dramawebben.behavior.spec.ts --project=desktop-chromium
LITTB_NUXT_TEST_PORT=3027 npx playwright test \
  test/e2e/dramawebben.visual.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
npx vitest run test/unit/dramawebben-document.spec.ts
npx vue-tsc --noEmit
```

Expected: Angular `6 passed`, Nuxt visual `6 passed`, and every focused SSR/behavior/unit/typecheck command passes. Ports are Angular 9000, Nuxt 3027, fixture server 4100. Ports 3000 and 8000 remain untouched.

- [ ] **Step 4: Run regression and hygiene closure**

```bash
cd nuxt
npm run test:unit
LITTB_NUXT_TEST_PORT=3027 npx playwright test --project=ssr
cd ..
git diff --check
git status --short
```

Expected: full frontend unit and SSR suites pass; no unexpected actual/diff PNGs; only intended task files are staged. Record six baseline SHA-256 values, exact request ledgers, suite totals, and any unchanged deprecation warnings in the closure report.

- [ ] **Step 5: Commit visual parity evidence**

```bash
git add nuxt/test/e2e/dramawebben.visual.spec.ts \
  nuxt/app/components/dramawebben/DramawebbenShell.vue
git diff --cached --check
git commit -m "test(nuxt): verify Dramawebben visual parity"
```

Do not stage `.superpowers/` unless the parent explicitly requests it.

## Final Review Gate

Before declaring the slice complete, confirm:

- root SSR request ledger is empty;
- each managed route has exactly one mapped source request;
- every Nuxt ledger has zero `list_all`, `get_authors`, plays, filter, or production requests;
- unknown and excluded dynamic routes fetch nothing;
- query-only changes produce no request;
- raw upstream head/comments/dangerous probes never appear in SSR HTML;
- all six visual hashes are recorded and no diff artifact remains; and
- no files from the supplemental-author plan or unrelated dirty work are staged.
