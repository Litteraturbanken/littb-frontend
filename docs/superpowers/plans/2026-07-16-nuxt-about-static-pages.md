# Nuxt Static About Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Independently SSR-render four low-complexity About routes from their existing live `/red` content source, share the exact About shell with statistics, and restore the legacy `/statistik` alias and shell-preserving 404.

**Architecture:** One allowlisted Nuxt page owns the four content paths and fetches the selected first-party HTML directly in `<script setup>`. Nitro uses a private content origin, browser navigation uses same-origin `/red`, and full XHTML responses are reduced to their body content before `v-html`. A genuinely shared About shell component preserves existing markup; redirect and error handling stay separate from content routing.

**Tech Stack:** Nuxt 4.4.8, Vue 3.5.39, Nitro SSR, TypeScript 5.9.3, Tailwind CSS 3.4.18, Vitest 4.1.10, Playwright 1.61.1.

## Global Constraints

- This is an architectural migration only; do not redesign or editorially change the pages.
- The deployed AngularJS application is the visual, behavioral, URL, and content authority.
- `/red` remains the runtime content owner and publication path; never bundle production copies of these pages into Nuxt.
- Test-only response fixtures are allowed solely for deterministic automated checks.
- Page-specific content selection, fetch, XHTML extraction, and failure handling stay in `nuxt/app/pages/om/[page].vue`; do not create a one-use composable, store, repository, service, or CMS abstraction.
- Extract shared markup only where both the statistics page and the new About page consume it.
- Do not add `@headlessui/vue`: this slice contains no interactive primitive that needs it.
- Preserve the current Organisation quirk: no About navigation item is active.
- Leave `/om/hjalp`, `/om/kontakt`, translated/hidden About pages, home, presentations, history, ID lookup, catalog utilities, search, library, reader, editor, FastAPI, generated API code, and deployment out of scope.
- Do not modify AngularJS application source. Authority-test additions under `nuxt/test/` are permitted.
- Preserve unrelated `.superpowers/` working files and any user changes.

---

## File Structure

### Created

- `nuxt/app/components/about/AboutPageShell.vue` — exact shared About heading/navigation and slot.
- `nuxt/app/pages/om/[page].vue` — allowlist, SSR/browser fetch, XHTML-body extraction, metadata, and render.
- `nuxt/app/error.vue` — shell-preserving Swedish 404 and generic non-404 error.
- `nuxt/test/fixtures/about-content/ide.html` — test-only captured Intro response.
- `nuxt/test/fixtures/about-content/organisation.html` — test-only captured Organisation response.
- `nuxt/test/fixtures/about-content/rattigheter.html` — test-only captured Rights response.
- `nuxt/test/fixtures/about-content/tack.html` — test-only captured Thanks response.
- `nuxt/test/fixtures/about-content/cc_by.png` — test-only rendered asset.
- `nuxt/test/fixtures/about-content/cc_publicdomain.png` — test-only rendered asset.
- `nuxt/test/unit/about-content-fixtures.spec.ts` — fixture integrity and safety assertions.
- `nuxt/test/ssr/about-pages.spec.ts` — direct SSR, exact upstream path, failure, and allowlist assertions.
- `nuxt/test/ssr/routing-errors.spec.ts` — redirect and 404 HTTP contracts.
- `nuxt/test/e2e/about-pages.behavior.spec.ts` — navigation, content, proxy, and hydration behavior.
- `nuxt/test/e2e/about-pages.visual.spec.ts` — Nuxt desktop/mobile parity comparisons.
- `nuxt/test/helpers/visual.ts` — shared browser-asset readiness helper used by authority and Nuxt visual tests.
- `nuxt/test/visual/capture-about-angular.spec.ts` — matching Angular authority captures.
- `nuxt/test/visual/baselines/about-*-desktop.png` — four desktop authority baselines.
- `nuxt/test/visual/baselines/about-*-mobile.png` — four mobile authority baselines.

### Modified

- `nuxt/app/pages/om/statistik.vue` — consume the shared About shell without moving page-owned API logic.
- `nuxt/nuxt.config.ts` — content runtime bases, `/red` development proxy, SSR rule, and `/statistik` redirect.
- `nuxt/playwright.config.ts` — point private/public content retrieval at the deterministic fixture during tests.
- `nuxt/playwright.angular.config.ts` — discover both statistics and About authority capture specs.
- `nuxt/test/e2e/statistics.visual.spec.ts` — consume the shared visual readiness helper without changing assertions.
- `nuxt/test/fixtures/v2-server.mjs` — serve and record deterministic `/red` HTML/assets and simulate content failure.
- `nuxt/test/visual/capture-angular.spec.ts` — consume the shared visual readiness helper without changing authority behavior.
- `nuxt/test/unit/foundation.spec.ts` — require real shared-shell ownership and retain the no-Angular boundary.

---

### Task 1: Capture deterministic content authority fixtures

**Files:**
- Create: `nuxt/test/fixtures/about-content/ide.html`
- Create: `nuxt/test/fixtures/about-content/organisation.html`
- Create: `nuxt/test/fixtures/about-content/rattigheter.html`
- Create: `nuxt/test/fixtures/about-content/tack.html`
- Create: `nuxt/test/fixtures/about-content/cc_by.png`
- Create: `nuxt/test/fixtures/about-content/cc_publicdomain.png`
- Create: `nuxt/test/unit/about-content-fixtures.spec.ts`
- Modify: `nuxt/test/fixtures/v2-server.mjs`

**Interfaces:**
- Consumes: the six existing resources under `https://red.litteraturbanken.se/red/...`.
- Produces: fixture-server GET responses for the four exact HTML paths and two exact PNG paths; all content requests are appended to the existing `requests` log; `PUT /_failure {"resource":"content"}` makes HTML requests return 503.

- [ ] **Step 1: Add the failing fixture integrity test**

Create `nuxt/test/unit/about-content-fixtures.spec.ts`:

```ts
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const root = fileURLToPath(new URL("../fixtures/about-content", import.meta.url))

const htmlFixtures = {
  "ide.html": {
    sha256: "b64aa7dee0f33bed59986d145348161461b7e055d63466c57ef84036e71b5019",
    markers: ["Introduktion", "Om urvalet av texter", "Mål"]
  },
  "organisation.html": {
    sha256: "fe92a811175ff45ec9bb9cfa4ec5289eb8112d02a50ded4fdd509b72dd5e2467",
    markers: ["Organisation", "Teknisk utveckling", "Tidigare medarbetare"]
  },
  "rattigheter.html": {
    sha256: "aaa38e151914fce00c734902ab088cb4da51915d8f7de23a1b5958800c5be3bc",
    markers: ["Rättigheter och material", "Creative Commons", "Licenser på metadata"]
  },
  "tack.html": {
    sha256: "916a89214e8fb09c4ef5572608ca0550e2cbfffac35b6edf46004a52b700d317",
    markers: ["Litteraturbanken tackar", "Kungl. biblioteket", "Uppsala universitetsbibliotek"]
  }
} as const

describe("About content authority fixtures", () => {
  for (const [filename, expected] of Object.entries(htmlFixtures)) {
    test(`${filename} is the reviewed authority response`, async () => {
      const content = await readFile(resolve(root, filename), "utf8")
      expect(createHash("sha256").update(content).digest("hex")).toBe(expected.sha256)
      for (const marker of expected.markers) expect(content).toContain(marker)
      expect(content).not.toMatch(/<script\b/i)
      expect(content).not.toMatch(/\son[a-z]+\s*=/i)
      expect(content).not.toMatch(/\bng-[a-z-]+\s*=/i)
    })
  }

  test.each([
    ["cc_by.png", "2d8a628333a76cfe484a2b9c01bca786fccf08d0010d4bffca2b38b29dd4ed0b"],
    ["cc_publicdomain.png", "ecd5dc29a28b8f01a064ba2dfede96e154e6d4f02848f5be1d51a080af62abcf"]
  ])("%s is the reviewed rendered asset", async (filename, sha256) => {
    const content = await readFile(resolve(root, filename))
    expect(createHash("sha256").update(content).digest("hex")).toBe(sha256)
  })
})
```

- [ ] **Step 2: Run the test and verify the fixtures are missing**

Run:

```bash
yarn --cwd nuxt vitest run test/unit/about-content-fixtures.spec.ts
```

Expected: FAIL with `ENOENT` for `nuxt/test/fixtures/about-content/ide.html`.

- [ ] **Step 3: Capture the test-only responses mechanically**

Run:

```bash
mkdir -p nuxt/test/fixtures/about-content
curl -fsS https://red.litteraturbanken.se/red/om/ide/omlitteraturbanken.html \
  --output nuxt/test/fixtures/about-content/ide.html
curl -fsS https://red.litteraturbanken.se/red/om/ide/organisation.html \
  --output nuxt/test/fixtures/about-content/organisation.html
curl -fsS https://red.litteraturbanken.se/red/om/rattigheter/rattigheter.html \
  --output nuxt/test/fixtures/about-content/rattigheter.html
curl -fsS https://red.litteraturbanken.se/red/om/tack.html \
  --output nuxt/test/fixtures/about-content/tack.html
curl -fsS https://red.litteraturbanken.se/red/om/rattigheter/cc_by.png \
  --output nuxt/test/fixtures/about-content/cc_by.png
curl -fsS https://red.litteraturbanken.se/red/om/rattigheter/cc_publicdomain.png \
  --output nuxt/test/fixtures/about-content/cc_publicdomain.png
```

These files are test fixtures only. Do not copy them into `nuxt/app/` or `nuxt/public/`.

- [ ] **Step 4: Extend the fixture server**

At the top of `nuxt/test/fixtures/v2-server.mjs`, add:

```js
import { readFileSync } from "node:fs"

const aboutContent = new Map([
  ["/red/om/ide/omlitteraturbanken.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/ide.html", import.meta.url))]],
  ["/red/om/ide/organisation.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/organisation.html", import.meta.url))]],
  ["/red/om/rattigheter/rattigheter.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/rattigheter.html", import.meta.url))]],
  ["/red/om/tack.html", ["text/html; charset=utf-8", readFileSync(new URL("./about-content/tack.html", import.meta.url))]],
  ["/red/om/rattigheter/cc_by.png", ["image/png", readFileSync(new URL("./about-content/cc_by.png", import.meta.url))]],
  ["/red/om/rattigheter/cc_publicdomain.png", ["image/png", readFileSync(new URL("./about-content/cc_publicdomain.png", import.meta.url))]]
])
```

Add this response helper after `sendJson`:

```js
function sendBody(response, status, contentType, body) {
  response.writeHead(status, {
    "content-type": contentType,
    "access-control-allow-origin": "*"
  })
  response.end(body)
}
```

Before `resourceFor(...)` handling inside the server callback, add:

```js
  const content = aboutContent.get(url.pathname)
  if (request.method === "GET" && content) {
    requests.push(`${url.pathname}${url.search}`)
    if (failure === "content" && content[0].startsWith("text/html")) {
      return sendBody(response, 503, "text/plain; charset=utf-8", "content unavailable")
    }
    return sendBody(response, 200, content[0], content[1])
  }
```

- [ ] **Step 5: Verify fixture integrity and existing fixture behavior**

Run:

```bash
yarn --cwd nuxt vitest run test/unit/about-content-fixtures.spec.ts
yarn --cwd nuxt test:unit
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add nuxt/test/fixtures/about-content nuxt/test/fixtures/v2-server.mjs nuxt/test/unit/about-content-fixtures.spec.ts
git commit -m "test(nuxt): capture About content authority"
```

---

### Task 2: Extract the genuinely shared About shell

**Files:**
- Create: `nuxt/app/components/about/AboutPageShell.vue`
- Modify: `nuxt/app/pages/om/statistik.vue`
- Modify: `nuxt/test/unit/foundation.spec.ts`

**Interfaces:**
- Consumes: `activePage: "ide" | "hjalp" | "rattigheter" | "tack" | "statistik" | "kontakt" | null`.
- Produces: exact `h1` and `.links` navigation plus the default slot; `null` marks no link active.

- [ ] **Step 1: Add the failing shared-ownership test**

Append this test to `nuxt/test/unit/foundation.spec.ts`:

```ts
  test("statistics consumes the shared About shell", async () => {
    const shell = await readFile(
      resolve(nuxtRoot, "app/components/about/AboutPageShell.vue"),
      "utf8"
    )
    const statistics = await readFile(
      resolve(nuxtRoot, "app/pages/om/statistik.vue"),
      "utf8"
    )

    for (const href of [
      "/om/ide",
      "/om/organisation",
      "/om/hjalp",
      "/om/rattigheter",
      "/om/tack",
      "/om/statistik",
      "/om/kontakt"
    ]) expect(shell).toContain(`href="${href}"`)

    expect(statistics).toContain('import AboutPageShell from "../../components/about/AboutPageShell.vue"')
    expect(statistics).toContain('<AboutPageShell active-page="statistik">')
    expect(statistics).not.toContain('<ul class="links">')
  })
```

- [ ] **Step 2: Run it and verify it fails**

Run:

```bash
yarn --cwd nuxt vitest run test/unit/foundation.spec.ts
```

Expected: FAIL with `ENOENT` for `AboutPageShell.vue`.

- [ ] **Step 3: Create `AboutPageShell.vue`**

```vue
<script setup lang="ts">
type AboutPage =
  | "ide"
  | "hjalp"
  | "rattigheter"
  | "tack"
  | "statistik"
  | "kontakt"

defineProps<{ activePage: AboutPage | null }>()
</script>

<template>
  <h1>Om Litteraturbanken</h1>
  <ul class="links">
    <li><a :class="{ active: activePage === 'ide' }" href="/om/ide">Intro</a></li>{{ " " }}
    <li><a href="/om/organisation">Organisation</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'hjalp' }" href="/om/hjalp">Hjälp</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'rattigheter' }" href="/om/rattigheter">Rättigheter</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'tack' }" href="/om/tack">Tack</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'statistik' }" href="/om/statistik">Statistik</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'kontakt' }" href="/om/kontakt">Kontakt</a></li>
  </ul>
  <slot />
</template>
```

Organisation deliberately has no dynamic `active` class; this preserves the Angular authority typo.

- [ ] **Step 4: Wrap statistics without moving its model code**

Add this import at the top of `nuxt/app/pages/om/statistik.vue`:

```ts
import AboutPageShell from "../../components/about/AboutPageShell.vue"
```

In the template, replace the existing `h1` and `.links` list with the opening tag:

```vue
<AboutPageShell active-page="statistik">
```

Keep the existing `<div v-if="statsData" class="content stats unbox">...</div>` byte-for-byte inside the component, then add:

```vue
</AboutPageShell>
```

- [ ] **Step 5: Verify unit, SSR, behavior, and existing visual parity**

Run:

```bash
yarn --cwd nuxt vitest run test/unit/foundation.spec.ts
yarn --cwd nuxt test:ssr
yarn --cwd nuxt test:e2e --grep "statistics"
```

Expected: all PASS, including the existing statistics screenshot comparisons.

- [ ] **Step 6: Commit**

```bash
git add nuxt/app/components/about/AboutPageShell.vue nuxt/app/pages/om/statistik.vue nuxt/test/unit/foundation.spec.ts
git commit -m "refactor(nuxt): share About page shell"
```

---

### Task 3: SSR-render the four runtime-backed About routes

**Files:**
- Create: `nuxt/app/pages/om/[page].vue`
- Create: `nuxt/test/ssr/about-pages.spec.ts`
- Modify: `nuxt/nuxt.config.ts`
- Modify: `nuxt/playwright.config.ts`

**Interfaces:**
- Consumes: private runtime config `contentBase`, public runtime config `contentBase`, and the four fixed `/red` content paths.
- Produces: SSR pages for `ide`, `organisation`, `rattigheter`, and `tack`; upstream failure returns the About shell with an empty content area; any other `[page]` returns 404.

- [ ] **Step 1: Add failing SSR route tests**

Create `nuxt/test/ssr/about-pages.spec.ts`:

```ts
import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

const pages = [
  ["ide", "/red/om/ide/omlitteraturbanken.html", ["Introduktion", "Om urvalet av texter", "Mål"]],
  ["organisation", "/red/om/ide/organisation.html", ["Organisation", "Teknisk utveckling", "Tidigare medarbetare"]],
  ["rattigheter", "/red/om/rattigheter/rattigheter.html", ["Rättigheter och material", "Creative Commons", "Licenser på metadata"]],
  ["tack", "/red/om/tack.html", ["Litteraturbanken tackar", "Kungl. biblioteket", "Uppsala universitetsbibliotek"]]
] as const

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

for (const [slug, contentPath, markers] of pages) {
  test(`${slug} fetches its allowlisted content during SSR`, async ({ request }) => {
    await reset(request)
    const response = await request.get(`/om/${slug}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("<title>Om LB | Litteraturbanken</title>")
    expect(html).toContain("Om Litteraturbanken")
    for (const marker of markers) expect(html).toContain(marker)
    expect(html).not.toContain("XHTML 1.0 Transitional")
    expect(html).not.toMatch(/<title>(?:OM_LITTERATURBANKEN|ORGANISATION|RÄTTIGHETER)<\/title>/)
    const log = await (await request.get(`${fixture}/_requests`)).json()
    expect(log.requests).toEqual([contentPath])
  })
}

test("content failure preserves the About shell without leaking upstream text", async ({ request }) => {
  await reset(request)
  await request.put(`${fixture}/_failure`, { data: { resource: "content" } })
  const response = await request.get("/om/ide")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("Om Litteraturbanken")
  expect(html).not.toContain("Introduktion")
  expect(html).not.toContain("content unavailable")
})

test("unknown About page is a real 404 and cannot select a remote path", async ({ request }) => {
  await reset(request)
  const response = await request.get("/om/not-allowed")
  expect(response.status()).toBe(404)
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual([])
})
```

- [ ] **Step 2: Point Playwright at the deterministic content fixture**

In `nuxt/playwright.config.ts`, extend the Nuxt web-server command to:

```ts
      command:
        `NUXT_API_BASE=${fixtureOrigin}/v2 ` +
        `NUXT_PUBLIC_API_BASE=/api/v2 ` +
        `LBAPI_PROXY_TARGET=${fixtureOrigin} ` +
        `NUXT_CONTENT_BASE=${fixtureOrigin} ` +
        `LITTB_CONTENT_PROXY_TARGET=${fixtureOrigin} yarn dev`,
```

- [ ] **Step 3: Run the SSR test and verify the route is missing**

Run:

```bash
yarn --cwd nuxt playwright test --project=ssr test/ssr/about-pages.spec.ts
```

Expected: FAIL because `/om/ide` currently returns 404.

- [ ] **Step 4: Add content runtime configuration and proxy**

At the top of `nuxt/nuxt.config.ts`, add:

```ts
const contentProxyTarget = process.env.LITTB_CONTENT_PROXY_TARGET || "https://red.litteraturbanken.se"
```

Extend `routeRules`:

```ts
  routeRules: {
    "/om/statistik": { ssr: true },
    "/om/**": { ssr: true }
  },
```

Extend `runtimeConfig` without changing the existing API keys:

```ts
  runtimeConfig: {
    apiBase: "http://127.0.0.1:8000/v2",
    contentBase: "https://red.litteraturbanken.se",
    public: {
      apiBase: "/api/v2",
      contentBase: ""
    }
  },
```

Add a second Vite proxy entry beside the API proxy:

```ts
        "^/red(?:/|$)": {
          target: contentProxyTarget,
          changeOrigin: true
        }
```

- [ ] **Step 5: Implement the allowlisted page-owned fetch**

Create `nuxt/app/pages/om/[page].vue`:

```vue
<script setup lang="ts">
import AboutPageShell from "../../components/about/AboutPageShell.vue"

const pages = {
  ide: {
    activePage: "ide",
    contentPath: "/red/om/ide/omlitteraturbanken.html"
  },
  organisation: {
    activePage: null,
    contentPath: "/red/om/ide/organisation.html"
  },
  rattigheter: {
    activePage: "rattigheter",
    contentPath: "/red/om/rattigheter/rattigheter.html"
  },
  tack: {
    activePage: "tack",
    contentPath: "/red/om/tack.html"
  }
} as const

type PageKey = keyof typeof pages

definePageMeta({
  validate: route => {
    const page = Array.isArray(route.params.page) ? route.params.page[0] : route.params.page
    return typeof page === "string" && ["ide", "organisation", "rattigheter", "tack"].includes(page)
  }
})

useSeoMeta({
  title: "Om LB | Litteraturbanken",
  description: "Om Litteraturbanken."
})

useHead({
  htmlAttrs: {
    style: "background: url('/assets/img/backgrounds/about_bkg.jpg') no-repeat;"
  },
  bodyAttrs: { class: "focus page-about ready" }
})

const route = useRoute()
const pageKey = computed(() => {
  const value = Array.isArray(route.params.page) ? route.params.page[0] : route.params.page
  return value as PageKey
})
const selectedPage = computed(() => pages[pageKey.value])
const asyncKey = computed(() => `about-content:${pageKey.value}`)
const config = useRuntimeConfig()

function extractBody(html: string): string {
  const body = html.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)
  return body?.[1] ?? html
}

const { data: content } = await useAsyncData(asyncKey, async () => {
  const base = import.meta.server ? config.contentBase : config.public.contentBase
  const url = `${base.replace(/\/$/, "")}${selectedPage.value.contentPath}`
  try {
    const html = await $fetch<string>(url, { responseType: "text" })
    return extractBody(html)
  } catch (error) {
    if (import.meta.dev) console.error(`About content request failed for ${pageKey.value}`, error)
    return ""
  }
})
</script>

<template>
  <AboutPageShell :active-page="selectedPage.activePage">
    <div v-html="content || ''" />
  </AboutPageShell>
</template>
```

- [ ] **Step 6: Run focused and regression checks**

Run:

```bash
yarn --cwd nuxt playwright test --project=ssr test/ssr/about-pages.spec.ts
yarn --cwd nuxt test:unit
yarn --cwd nuxt typecheck
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add nuxt/app/pages/om/'[page].vue' nuxt/nuxt.config.ts nuxt/playwright.config.ts nuxt/test/ssr/about-pages.spec.ts
git commit -m "feat(nuxt): SSR-render runtime About content"
```

---

### Task 4: Restore the statistics alias and legacy 404 shell

**Files:**
- Create: `nuxt/app/error.vue`
- Create: `nuxt/test/ssr/routing-errors.spec.ts`
- Modify: `nuxt/nuxt.config.ts`

**Interfaces:**
- Consumes: Nuxt's `NuxtError` and existing `default` layout.
- Produces: HTTP 308 `/statistik` redirect preserving query; HTTP 404 with exact legacy Swedish content and shell.

- [ ] **Step 1: Add failing redirect and error tests**

Create `nuxt/test/ssr/routing-errors.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("legacy statistics alias redirects permanently and preserves query", async ({ request }) => {
  const response = await request.get("/statistik?source=legacy", { maxRedirects: 0 })
  expect(response.status()).toBe(308)
  expect(response.headers().location).toBe("/om/statistik?source=legacy")
})

test("missing route returns the legacy Swedish 404 inside the site shell", async ({ request }) => {
  const response = await request.get("/definitely-not-a-route")
  expect(response.status()).toBe(404)
  const html = await response.text()
  expect(html).toContain("<title>Sidan kan inte hittas | Litteraturbanken</title>")
  expect(html).toContain("Du har angett en adress som inte finns på Litteraturbanken.")
  expect(html).toContain("Använd webbläsarens bakåtknapp för att komma tillbaka")
  for (const selector of ["leftCorridor", "mainview", "rightCorridor"]) {
    expect(html).toContain(`id="${selector}"`)
  }
  expect(html).not.toContain("page-about")
  expect(html).not.toContain("about_bkg.jpg")
})
```

- [ ] **Step 2: Run the tests and verify current failures**

Run:

```bash
yarn --cwd nuxt playwright test --project=ssr test/ssr/routing-errors.spec.ts
```

Expected: FAIL because `/statistik` is not a 308 and the generic Nuxt error page lacks the legacy copy/shell.

- [ ] **Step 3: Add the exact route rule**

Extend `routeRules` in `nuxt/nuxt.config.ts`:

```ts
  routeRules: {
    "/om/statistik": { ssr: true },
    "/om/**": { ssr: true },
    "/statistik": {
      redirect: { to: "/om/statistik", statusCode: 308 }
    }
  },
```

- [ ] **Step 4: Create the shell-preserving error page**

Create `nuxt/app/error.vue`:

```vue
<script setup lang="ts">
import type { NuxtError } from "#app"

const props = defineProps<{ error: NuxtError }>()
const isNotFound = computed(() => props.error.statusCode === 404)

useSeoMeta({
  title: computed(() => isNotFound.value
    ? "Sidan kan inte hittas | Litteraturbanken"
    : "Ett fel inträffade | Litteraturbanken")
})

useHead({
  htmlAttrs: { style: "" },
  bodyAttrs: { class: "focus ready" }
})
</script>

<template>
  <NuxtLayout name="default">
    <template v-if="isNotFound">
      <p>Du har angett en adress som inte finns på Litteraturbanken.</p>
      <p>
        Använd webbläsarens bakåtknapp för att komma tillbaka till
        sidan du var på innan, eller klicka på någon av
        länkarna till vänster.
      </p>
    </template>
    <p v-else>Ett fel inträffade. Vänligen försök igen senare.</p>
  </NuxtLayout>
</template>
```

- [ ] **Step 5: Verify focused behavior and all SSR tests**

Run:

```bash
yarn --cwd nuxt playwright test --project=ssr test/ssr/routing-errors.spec.ts
yarn --cwd nuxt test:ssr
yarn --cwd nuxt typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add nuxt/app/error.vue nuxt/nuxt.config.ts nuxt/test/ssr/routing-errors.spec.ts
git commit -m "feat(nuxt): restore legacy redirect and 404"
```

---

### Task 5: Lock browser behavior and desktop/mobile visual parity

**Files:**
- Create: `nuxt/test/e2e/about-pages.behavior.spec.ts`
- Create: `nuxt/test/e2e/about-pages.visual.spec.ts`
- Create: `nuxt/test/helpers/visual.ts`
- Create: `nuxt/test/visual/capture-about-angular.spec.ts`
- Create: `nuxt/test/visual/baselines/about-ide-desktop.png`
- Create: `nuxt/test/visual/baselines/about-ide-mobile.png`
- Create: `nuxt/test/visual/baselines/about-organisation-desktop.png`
- Create: `nuxt/test/visual/baselines/about-organisation-mobile.png`
- Create: `nuxt/test/visual/baselines/about-rattigheter-desktop.png`
- Create: `nuxt/test/visual/baselines/about-rattigheter-mobile.png`
- Create: `nuxt/test/visual/baselines/about-tack-desktop.png`
- Create: `nuxt/test/visual/baselines/about-tack-mobile.png`
- Modify: `nuxt/playwright.angular.config.ts`
- Modify: `nuxt/test/e2e/statistics.visual.spec.ts`
- Modify: `nuxt/test/visual/capture-angular.spec.ts`

**Interfaces:**
- Consumes: Task 1 fixtures and fixture server; deployed Angular authority for screenshot capture.
- Produces: exact link/active/content/proxy assertions and eight reviewed visual baselines used by Nuxt comparisons.

- [ ] **Step 1: Add failing browser behavior tests**

Create `nuxt/test/e2e/about-pages.behavior.spec.ts` with parameterized checks for:

```ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const expectedLinks = [
  ["Intro", "/om/ide"],
  ["Organisation", "/om/organisation"],
  ["Hjälp", "/om/hjalp"],
  ["Rättigheter", "/om/rattigheter"],
  ["Tack", "/om/tack"],
  ["Statistik", "/om/statistik"],
  ["Kontakt", "/om/kontakt"]
] as const

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

async function openWithoutBrowserErrors(page: Page, path: string) {
  const problems: string[] = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  const response = await page.goto(path, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  return problems
}

test.beforeEach(async ({ request }) => reset(request))

test("Intro renders live content, exact navigation, and no hydration errors", async ({ page }) => {
  const problems = await openWithoutBrowserErrors(page, "/om/ide")
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)
  for (const [name, href] of expectedLinks) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href)
  }
  await expect(page.getByRole("link", { name: "Intro", exact: true })).toHaveClass(/\bactive\b/)
  await expect(page.getByRole("heading", { name: "Introduktion" })).toBeVisible()
  expect(problems).toEqual([])
})

test("Organisation intentionally has no active About tab", async ({ page }) => {
  await openWithoutBrowserErrors(page, "/om/organisation")
  await expect(page.locator("ul.links a.active")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible()
})

test("Rights retains existing /red images and license links", async ({ page }) => {
  await openWithoutBrowserErrors(page, "/om/rattigheter")
  await expect(page.locator('img[src="/red/om/rattigheter/cc_by.png"]')).toBeVisible()
  await expect(page.locator('img[src="/red/om/rattigheter/cc_publicdomain.png"]')).toBeVisible()
  await expect(page.getByRole("link", { name: "https://creativecommons.org/licenses/by/4.0/" })).toHaveAttribute(
    "href",
    "https://creativecommons.org/licenses/by/4.0/"
  )
})

test("Thanks renders the beginning and end of the managed response", async ({ page }) => {
  await openWithoutBrowserErrors(page, "/om/tack")
  await expect(page.getByRole("heading", { name: "Litteraturbanken tackar" })).toBeVisible()
  await expect(page.locator("#mainview")).toContainText("Uppsala universitetsbibliotek")
})

test("navigation fetches each selected fragment once and never refetches during hydration", async ({ page, request }) => {
  await openWithoutBrowserErrors(page, "/om/ide")
  let log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual(["/red/om/ide/omlitteraturbanken.html"])

  await page.getByRole("link", { name: "Organisation", exact: true }).click()
  await expect(page).toHaveURL("/om/organisation")
  await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible()
  log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual([
    "/red/om/ide/omlitteraturbanken.html",
    "/red/om/ide/organisation.html"
  ])
})

test("the browser /red proxy reaches the configured content origin", async ({ page, request }) => {
  await openWithoutBrowserErrors(page, "/om/ide")
  await request.delete(`${fixture}/_requests`)
  const body = await page.evaluate(async () => {
    const response = await fetch("/red/om/ide/organisation.html")
    return { status: response.status, text: await response.text() }
  })
  expect(body.status).toBe(200)
  expect(body.text).toContain("Organisation")
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual(["/red/om/ide/organisation.html"])
})

test("legacy statistics alias preserves browser query and fragment", async ({ page }) => {
  await page.goto("/statistik?source=legacy#ranking")
  await expect(page).toHaveURL("/om/statistik?source=legacy#ranking")
})

test("missing route uses generic body state without stale About background", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-route")
  expect(response?.status()).toBe(404)
  await expect(page.locator("body")).toHaveClass(/\bfocus\b/)
  await expect(page.locator("body")).toHaveClass(/\bready\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bpage-about\b/)
  expect(await page.locator("html").getAttribute("style")).not.toContain("about_bkg.jpg")
})
```

- [ ] **Step 2: Run behavior tests and fix only concrete parity defects**

Run:

```bash
yarn --cwd nuxt playwright test --project=desktop-chromium test/e2e/about-pages.behavior.spec.ts
```

Expected: PASS. If the captured authority contains malformed markup that changes accessible-name selection, narrow locators to the exact authority DOM rather than editing the content.

- [ ] **Step 3: Add Angular authority capture coverage**

Change `testMatch` in `nuxt/playwright.angular.config.ts` to:

```ts
  testMatch: /capture-.*angular\.spec\.ts/,
```

First create the shared visual helper `nuxt/test/helpers/visual.ts`:

```ts
import type { Page } from "@playwright/test"

export async function waitForVisualAssets(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images]
        .filter(image => !image.complete)
        .map(image => new Promise(resolve => {
          image.addEventListener("load", resolve, { once: true })
          image.addEventListener("error", resolve, { once: true })
        }))
    )
    const background = getComputedStyle(document.documentElement).backgroundImage
    const match = background.match(/url\(["']?(.+?)["']?\)/)
    if (match) {
      const image = new Image()
      image.src = match[1]
      await image.decode()
    }
  })
}
```

Delete the local `waitForVisualAssets` functions from `nuxt/test/visual/capture-angular.spec.ts` and `nuxt/test/e2e/statistics.visual.spec.ts`, and add these imports respectively:

```ts
import { waitForVisualAssets } from "../helpers/visual"
```

```ts
import { waitForVisualAssets } from "../helpers/visual"
```

Then create `nuxt/test/visual/capture-about-angular.spec.ts`:

```ts
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixtures = [
  ["/red/om/ide/omlitteraturbanken.html", "ide.html", "text/html; charset=utf-8"],
  ["/red/om/ide/organisation.html", "organisation.html", "text/html; charset=utf-8"],
  ["/red/om/rattigheter/rattigheter.html", "rattigheter.html", "text/html; charset=utf-8"],
  ["/red/om/tack.html", "tack.html", "text/html; charset=utf-8"],
  ["/red/om/rattigheter/cc_by.png", "cc_by.png", "image/png"],
  ["/red/om/rattigheter/cc_publicdomain.png", "cc_publicdomain.png", "image/png"]
] as const

const pages = [
  ["ide", "Introduktion"],
  ["organisation", "Organisation"],
  ["rattigheter", "Rättigheter och material"],
  ["tack", "Litteraturbanken tackar"]
] as const

test.beforeEach(async ({ page }) => {
  const responses = new Map(
    await Promise.all(fixtures.map(async ([pathname, filename, contentType]) => [
      pathname,
      {
        contentType,
        body: await readFile(resolve(import.meta.dirname, "../fixtures/about-content", filename))
      }
    ] as const))
  )

  await page.route("**/*", route => {
    const response = responses.get(new URL(route.request().url()).pathname)
    return response
      ? route.fulfill({ status: 200, contentType: response.contentType, body: response.body })
      : route.continue()
  })
})

for (const [slug, heading] of pages) {
  test(`captures the current Angular ${slug} authority`, async ({ page }, testInfo) => {
    await page.goto(`/om/${slug}`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toHaveClass(/\bready\b/)
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
    await waitForVisualAssets(page)

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `about-${slug}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}
```

- [ ] **Step 4: Capture the eight authority baselines**

Run:

```bash
yarn --cwd nuxt test:visual:capture
```

Expected: the four routes each produce a desktop and mobile PNG under `nuxt/test/visual/baselines/`. Inspect all eight images before accepting them; they must show loaded content, fonts, background, and Rights images.

- [ ] **Step 5: Add Nuxt visual comparisons**

Create `nuxt/test/e2e/about-pages.visual.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const pages = [
  ["ide", "Introduktion"],
  ["organisation", "Organisation"],
  ["rattigheter", "Rättigheter och material"],
  ["tack", "Litteraturbanken tackar"]
] as const

for (const [slug, heading] of pages) {
  test(`matches the approved Angular ${slug} page`, async ({ page }, testInfo) => {
    await page.goto(`/om/${slug}`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
    await waitForVisualAssets(page)

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`about-${slug}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })
  })
}
```

- [ ] **Step 6: Run all browser and visual checks**

Run:

```bash
yarn --cwd nuxt test:e2e
```

Expected: statistics behavior/visual tests and all new About behavior/visual tests PASS in desktop and mobile projects.

- [ ] **Step 7: Run the complete Nuxt and Angular regression gate**

Run:

```bash
yarn --cwd nuxt api:check
yarn --cwd nuxt test:unit
yarn --cwd nuxt test:ssr
yarn --cwd nuxt test:e2e
yarn --cwd nuxt typecheck
yarn --cwd nuxt build
yarn test:unit
yarn build
git diff --check
```

Expected: all commands PASS; generated API code is unchanged; Angular source and build behavior remain unchanged.

- [ ] **Step 8: Commit**

```bash
git add \
  nuxt/playwright.angular.config.ts \
  nuxt/test/e2e/about-pages.behavior.spec.ts \
  nuxt/test/e2e/about-pages.visual.spec.ts \
  nuxt/test/e2e/statistics.visual.spec.ts \
  nuxt/test/helpers/visual.ts \
  nuxt/test/visual/capture-angular.spec.ts \
  nuxt/test/visual/capture-about-angular.spec.ts \
  nuxt/test/visual/baselines/about-*-desktop.png \
  nuxt/test/visual/baselines/about-*-mobile.png
git commit -m "test(nuxt): lock About page parity"
```

---

## Final Review Gate

After Task 5:

1. Compare all implementation commits with `docs/superpowers/specs/2026-07-16-nuxt-about-static-pages-design.md`.
2. Verify `git diff 2fcb111..HEAD -- app/` is empty so Angular source was not modified after the approved design clarification.
3. Verify the production page source contains no captured About HTML or images; only test fixtures may contain them.
4. Verify Nuxt runtime source contains no Angular import, iframe, compatibility handoff, generic remote URL construction, or one-use content abstraction.
5. Verify the dev server loads all four live routes from `https://red.litteraturbanken.se` with default configuration.
6. Request a fresh final-branch review before claiming completion.
