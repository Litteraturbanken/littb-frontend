# Nuxt Library Relevance Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a populated, searchable, SSR-capable default `/bibliotek` “Alla träffar” page backed by the existing live relevance endpoint.

**Architecture:** A deterministic fixture mirrors one legacy relevance operation for SSR and browser tests. The page keeps response typing, URL construction, cancellation, rendering, and the single-consumer model in `<script setup>`, using private/public runtime bases and existing global styles.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, `$fetch`, Playwright, Vitest, legacy SCSS/Tailwind classes.

## Global Constraints

- Preserve default Angular `/bibliotek` visuals; do not redesign.
- Do not port advanced filters, count fan-out, other result tabs, pagination, downloads, Reader, author pages, deployment hardening, or Angular/Vue compatibility.
- Keep the runtime legacy relevance request live and page-local; add no one-use composable.
- Use ordinary anchors for destinations outside this slice.
- Do not edit Angular source or copied `nuxt/app/assets/styles/styles.scss`.

---

### Task 1: Add a deterministic legacy relevance fixture

**Files:**
- Create: `nuxt/test/fixtures/library-relevance-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

**Interfaces:**
- Consumes: `GET /api/relevance/:types` and private test alias `/legacy-api/relevance/:types`.
- Produces: `libraryRelevanceResponse(query)`, request ledger, failure control, and query-keyed delays.

- [ ] **Step 1: Write failing fixture tests**

Assert public/private paths return `{ data, hits, suggest }`, preserve exact
pathname/query in an isolated ledger, switch results by `q`, delay by `q`, and
support reset/failure controls:

```ts
expect(await getRequests()).toEqual([{ path, query: Object.fromEntries(url.searchParams) }])
expect(await request.put(`${fixture}/_library_relevance_failure`)).toBeOK()
```

- [ ] **Step 2: Run the fixture test RED**

Run: `cd nuxt && yarn vitest run test/unit/v2-server.spec.ts`

Expected: focused requests return 404 because the fixture operation and controls
do not exist.

- [ ] **Step 3: Implement the minimal fixture**

Export one default mixed response and query variants from
`library-relevance-data.mjs`. Add independent state and controls:

```text
GET|DELETE /_library_relevance_requests
GET|PUT|DELETE /_library_relevance_failure
GET|PUT|DELETE /_library_relevance_delays
```

Handle both prefixes, wait for the configured `q` delay, record the original
path/query, and return 503 only when failure is enabled.

- [ ] **Step 4: Run the fixture test GREEN**

Run: `cd nuxt && yarn vitest run test/unit/v2-server.spec.ts`

Expected: all fixture-server tests pass.

---

### Task 2: Port the default Library relevance page

**Files:**
- Modify: `nuxt/nuxt.config.ts`
- Modify: `nuxt/playwright.config.ts`
- Create: `nuxt/app/pages/bibliotek.vue`
- Create: `nuxt/test/ssr/library.spec.ts`
- Create: `nuxt/test/e2e/library.behavior.spec.ts`

**Interfaces:**
- Consumes: private `runtimeConfig.libraryApiBase`, public `runtimeConfig.public.libraryApiBase`, and the Task 1 fixture.
- Produces: SSR/default `/bibliotek`, debounced query search, sort/reset behavior, and mixed relevance rows.

- [ ] **Step 1: Write the SSR tests RED**

Assert status 200, exact title/description/body/html background, heading and
default controls, populated mixed rows and links, private request query, plus
empty and 503 states.

- [ ] **Step 2: Write browser tests RED**

Assert initial hydration does not duplicate the SSR request; input waits 300 ms,
updates `filter`, calls public `/api`, and renders the replacement response;
delayed old responses cannot replace newer results; reset and sort update the
query; no console/page errors occur.

- [ ] **Step 3: Run route tests RED**

```bash
cd nuxt
yarn playwright test --project=ssr test/ssr/library.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/library.behavior.spec.ts
```

Expected: `/bibliotek` renders the existing 404 because the page does not exist.

- [ ] **Step 4: Add runtime bases and proxy**

Add:

```ts
const legacyApiProxyTarget = process.env.LBAPI_LEGACY_PROXY_TARGET || "https://red.litteraturbanken.se"
runtimeConfig: {
  libraryApiBase: "https://red.litteraturbanken.se/api",
  public: { libraryApiBase: "/api" }
}
```

and a Vite proxy matching non-v2 `/api` paths. Pass fixture-specific private and
proxy environment variables in `playwright.config.ts`.

- [ ] **Step 5: Implement the minimal page**

Inside `bibliotek.vue`, define strict local response/result guards, legacy sort
mapping, query sanitization, URL construction, row link helpers, one initial
`useAsyncData`, and browser replacement requests guarded by AbortController plus
request version. Reuse the authority heading/form/tab/sort/result class strings.

- [ ] **Step 6: Run route tests GREEN**

```bash
cd nuxt
yarn playwright test --project=ssr test/ssr/library.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/library.behavior.spec.ts
yarn typecheck
```

Expected: all focused route tests and typecheck pass.

- [ ] **Step 7: Compare a populated authority state if deterministic capture is feasible**

Capture or inspect the identical populated Angular/Nuxt `#mainview` state at the
1440×1000 desktop viewport. Correct only demonstrated Nuxt markup drift; do not
expand the feature scope or change authority CSS.

- [ ] **Step 8: Run closure gates and commit**

```bash
cd nuxt
yarn vitest run test/unit/v2-server.spec.ts
yarn playwright test --project=ssr test/ssr/library.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/library.behavior.spec.ts
yarn typecheck
yarn build
git diff --check
```

Stage only this slice and commit with `feat(nuxt): port library relevance search`.
