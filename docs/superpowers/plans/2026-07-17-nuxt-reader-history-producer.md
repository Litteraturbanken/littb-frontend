# Nuxt Reader History Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every successfully hydrated Nuxt Reader page in the exact legacy `lastPageViews` format so the existing Nuxt `/historik` page can resume it.

**Architecture:** Add a guarded, page-local client writer to the existing Reader route. It derives one record from normalized Reader data and current route state, replaces records by `(lbworkid, mediatype)`, and writes a newest-first array capped at 50 without introducing requests or shared state.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, browser `localStorage`, Playwright.

**Design:** `docs/superpowers/specs/2026-07-17-nuxt-reader-history-producer-design.md`

## Global Constraints

- Preserve the exact eight-field legacy record shape: `pageix`, `pagename`, `timestamp`, `mediatype`, `lbworkid`, `author`, `label`, and `url`.
- Deduplicate by `(lbworkid, mediatype)`, newest first, with a strict cap of 50.
- Use the decoded public route author and exact `route.fullPath` resume URL.
- Treat malformed/non-array storage as empty history; all storage exceptions must be non-fatal.
- Write only on the client after a successful Reader load; make no additional request or SSR write.
- Keep one-page model code in the Reader page `<script setup>`; add no composable, store, backend change, dependency, markup, style, or visual baseline.

---

### Task 1: Persist successful Reader visits and prove consumer integration

**Files:**
- Modify: `nuxt/test/e2e/reader.behavior.spec.ts`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`

**Interfaces:**
- Consumes: the existing normalized `ReaderPage` fields `pageIndex`, `pageName`, `mediaType`, `workId`, and `title`; `authorParam`; and `route.fullPath`.
- Produces: `localStorage.lastPageViews`, a JSON array of newest-first legacy records consumed unchanged by `nuxt/app/pages/historik.vue`.

- [ ] **Step 1: Write focused failing browser tests**

Extend `nuxt/test/e2e/reader.behavior.spec.ts` with typed helpers that seed and
read `lastPageViews`, then add assertions equivalent to:

```ts
type StoredPageView = {
  pageix: number
  pagename?: string
  timestamp: string
  mediatype: string
  lbworkid: string
  author: string
  label: string
  url: string
}

async function storedPageViews(page: Page): Promise<StoredPageView[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lastPageViews") ?? "[]"))
}

test("successful Reader hydration writes the complete legacy history record", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const [record] = await storedPageViews(page)
  expect(record).toMatchObject({
    pageix: 2,
    pagename: "-2",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    author: "SöderbergH",
    label: "Doktor Glas",
    url: "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  })
  expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp)
})
```

Add separate tests that preseed matching e-text, same-work facsimile, and other
work records; verify only the matching e-text is replaced. Preseed more than 50
records and verify the result length is exactly 50 with the current entry first.
Navigate via `Nästa sida` and verify one matching record now contains the next
page name/index/URL. Extend the deterministic Reader fixture's page-fragment
route so both page indexes `2` and `3` return the existing small synthetic HTML;
this permits the ordinary `-2` to `-1` navigation without introducing new
content fixtures. Seed malformed JSON and a non-array JSON value and verify a
valid fresh record results. Override `Storage.prototype.getItem` and then
`Storage.prototype.setItem` with throwing functions via `page.addInitScript` and
verify the Reader still renders with no captured browser problem. Request an
unknown Reader page after seeding storage and verify the raw stored value is
unchanged. Finally visit the Reader and then `/historik`; verify the existing
`Hjalmar Söderberg – Doktor Glas` resume row links to `readerPath`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium
```

Expected: the new storage assertions fail because the Reader does not yet write
`lastPageViews`; the existing hydration test remains green.

- [ ] **Step 3: Add the minimal page-local writer**

In the Reader page `<script setup>`, add the exact local type and writer:

```ts
type LastPageView = {
  pageix: number
  pagename: string | undefined
  timestamp: string
  mediatype: "etext" | "faksimil"
  lbworkid: string
  author: string
  label: string
  url: string
}

function writeLastPageView(): void {
  const current: LastPageView = {
    pageix: reader.value.pageIndex,
    pagename: reader.value.pageName,
    timestamp: new Date().toISOString(),
    mediatype: reader.value.mediaType,
    lbworkid: reader.value.workId,
    author: authorParam,
    label: reader.value.title,
    url: route.fullPath
  }
  try {
    const raw = localStorage.getItem("lastPageViews")
    let parsed: unknown = []
    if (raw !== null) {
      try {
        parsed = JSON.parse(raw)
      } catch {
        // Malformed legacy data is treated as an empty history.
      }
    }
    const previous = Array.isArray(parsed) ? parsed : []
    const next = [
      current,
      ...previous.filter(value => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) return true
        const record = value as Record<string, unknown>
        return record.lbworkid !== current.lbworkid || record.mediatype !== current.mediatype
      })
    ].slice(0, 50)
    localStorage.setItem("lastPageViews", JSON.stringify(next))
  } catch {
    // A storage failure must not break reading.
  }
}

onMounted(writeLastPageView)
```

Keep the type and function in this page; do not change template or styles.

- [ ] **Step 4: Run focused and integration verification**

Run:

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 yarn playwright test test/e2e/reader.behavior.spec.ts test/e2e/history.behavior.spec.ts --project=desktop-chromium
NUXT_IGNORE_LOCK=1 yarn playwright test test/ssr/reader.spec.ts test/ssr/history.spec.ts --project=ssr
yarn typecheck
yarn build
```

Expected: all commands pass, the Reader makes no new network request, and no
visual baseline changes.

- [ ] **Step 5: Inspect and commit**

Run `git diff --check`, inspect `git diff --stat` and `git status --short`, and
confirm only the plan/spec, Reader page, and Reader behavior test are tracked.
Commit with:

```bash
git add docs/superpowers/specs/2026-07-17-nuxt-reader-history-producer-design.md \
  docs/superpowers/plans/2026-07-17-nuxt-reader-history-producer.md \
  'nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue' \
  nuxt/test/e2e/reader.behavior.spec.ts nuxt/test/fixtures/v2-server.mjs
git commit -m "feat(nuxt): persist reader history"
```
