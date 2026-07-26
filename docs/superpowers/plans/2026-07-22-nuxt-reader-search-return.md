# Nuxt Reader contextual search navigation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore exact full-text-search return navigation and the author-scoped Search link in the Nuxt Reader without changing its visual design.

**Architecture:** The existing Search page attaches a validated same-origin raw source full path to each rendered Reader link. The Reader parses that page-locally and renders ordinary NuxtLinks inside the existing legacy list structure; no store, composable, backend call, or new CSS is introduced.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Vue Router/NuxtLink, TypeScript, Playwright, Vitest.

## Global Constraints

- Preserve current visuals, legacy class names, DOM ordering, copy, and responsive layout.
- Use NuxtLink/router push navigation for both handoffs; browser Back must restore the Reader.
- Preserve the exact source `/sök` path and raw query representation, including unknown keys and duplicates.
- Accept only a relative decoded `/sök` pathname with a valid `fras`, no fragment, no recursive `s_return`, and at most 8,192 UTF-16 code units.
- Keep fetch ownership page-local and add no composable, shared store, cookie, or browser-storage compatibility layer.
- Do not add or modify CSS for this slice.
- Follow RED/GREEN TDD and record the expected failing output before production edits.
- Do not commit or stage changes: the shared worktree contains existing uncommitted migration work.

---

### Task 1: Search-origin contract and Reader handoffs

**Files:**
- Modify: `nuxt/app/lib/text-search.ts`
- Modify: `nuxt/app/pages/sök.vue`
- Modify: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Test: `nuxt/test/unit/text-search.spec.ts`
- Test: `nuxt/test/e2e/text-search.behavior.spec.ts`
- Test: `nuxt/test/e2e/reader.behavior.spec.ts`

**Interfaces:**
- Consumes: the existing canonical Reader href returned by `buildTextSearchReaderHref`, the current Search browser pathname/query, and the accepted typed Reader author.
- Produces: `attachTextSearchReturnHref(readerHref, searchFullPath): string`, `parseTextSearchReturnHref(query): string | null`, a return `NuxtLink`, and an author-scoped Search `NuxtLink`.

- [ ] **Step 1: Add failing pure-contract tests**

Add unit cases that express the public contract before implementing it:

```ts
const reader = "/författare/A/titlar/T/sida/1/etext?q=frihet&hit=0"
const origin = "/s%C3%B6k?fras=frihet&traffsida=2&utm=a+b&repeat=%2f&repeat=%2F"
const attached = attachTextSearchReturnHref(reader, origin)
expect(parseTextSearchReturnHref(Object.fromEntries(new URL(attached, "https://x").searchParams)))
  .toBe(origin)
```

Reject absolute/protocol-relative paths, other local paths, fragments,
backslashes, controls, malformed percent sequences, absent/blank/overlong
phrases, arrays/duplicates, recursive `s_return`, and origins longer than 8,192
characters. Assert invalid attachment returns the original Reader href and
invalid parsing returns `null`.

- [ ] **Step 2: Run the pure tests and verify RED**

Run:

```bash
cd nuxt && yarn vitest run test/unit/text-search.spec.ts
```

Expected: failure because `attachTextSearchReturnHref` and
`parseTextSearchReturnHref` are not exported.

- [ ] **Step 3: Implement the bounded pure contract**

Add a shared private validator and the two exports. Preserve the validated
origin string itself rather than rebuilding it from `URLSearchParams`. Append
one origin with URLSearchParams only after validating both the source and the
Reader href. The parser accepts a single string value and delegates to the same
validator.

- [ ] **Step 4: Run the pure tests and verify GREEN**

Run:

```bash
cd nuxt && yarn vitest run test/unit/text-search.spec.ts
```

Expected: all `text-search.spec.ts` tests pass with no new warning or error.

- [ ] **Step 5: Add failing Search/Reader browser tests**

Add focused Playwright coverage that:

```ts
await openSearch(page,
  "/s%C3%B6k?fras=frihet&traffsida=2&avancerad=1&forfattare=StrindbergA&utm=a+b&repeat=%2f&repeat=%2F")
const readerHref = await page.locator("#results .match a").first().getAttribute("href")
await page.goto(readerHref!)
const back = page.locator("#search_nav").getByRole("link", { name: "Tillbaka till sökningen" })
await expect(back).toHaveAttribute("href",
  "/s%C3%B6k?fras=frihet&traffsida=2&avancerad=1&forfattare=StrindbergA&utm=a+b&repeat=%2f&repeat=%2F")
```

Click the return link, assert restored Search results and query, then use
`page.goBack()` and assert the Reader hit/marker returns. Reload the Reader and
assert the link remains. Add absence cases for direct and Reader-local search,
a faksimil case that records zero e-text-hit calls, and an author-link case
whose exact target is `/s%C3%B6k?avancerad&forfattare=S%C3%B6derbergH` and whose
destination selects that author.

- [ ] **Step 6: Run the focused browser tests and verify RED**

Run:

```bash
cd nuxt && yarn playwright test \
  test/e2e/text-search.behavior.spec.ts \
  test/e2e/reader.behavior.spec.ts \
  --project=desktop-chromium \
  --grep "return|author-scoped"
```

Expected: failures because neither contextual link exists and Search result
Reader hrefs have no `s_return`.

- [ ] **Step 7: Wire Search origin at render time**

Import `attachTextSearchReturnHref` in `sök.vue`. Add a page-local
`currentSearchFullPath()` that returns client
`window.location.pathname + window.location.search` and a server fallback of
`route.fullPath` without a fragment. Add `readerHrefWithReturn(href)` and use it
for both title and match NuxtLinks. Do not put the origin in accepted result
view state or request identity, so unrelated query-only changes update the
link without a backend refetch.

- [ ] **Step 8: Render the two Reader NuxtLinks**

Import `parseTextSearchReturnHref`. Compute the accepted return href and an
active-origin flag requiring scalar `q` and `hit`. Let the toolkit teleport
render for either an e-text hit or an active explicit origin; gate the hit
count/arrows/index controls on the e-text `searchState`, retain `Stäng
träffvisningen`, then render:

```vue
<li v-if="searchReturnHref">
  <NuxtLink :to="searchReturnHref">Tillbaka till sökningen</NuxtLink>
</li>
```

Replace the inert author-search row with:

```vue
<li>
  <NuxtLink :to="{ path: '/s%C3%B6k', query: { avancerad: null, forfattare: reader.author.id } }">
    Sök i författarens texter
  </NuxtLink>
</li>
```

Keep all existing list classes/order and make no stylesheet edit.

- [ ] **Step 9: Run focused tests and verify GREEN**

Run the command from Step 6, then:

```bash
cd nuxt && yarn typecheck
```

Expected: focused browser tests and typecheck pass.

- [ ] **Step 10: Compare Angular and Nuxt authority**

At the same desktop viewport, use the deterministic Reader-hit fixture to
capture Angular with `SearchStateService.queryparams` populated and Nuxt with
the matching `s_return`. Assert `#search_nav .ctrls` row order is first, last,
direct, close, return; compare computed typography, margins, line height, and
link color. Record screenshots and ensure no CSS file changed.

- [ ] **Step 11: Run regression verification**

Run:

```bash
cd nuxt && yarn vitest run test/unit/text-search.spec.ts
cd nuxt && yarn playwright test test/e2e/text-search.behavior.spec.ts --project=desktop-chromium
cd nuxt && yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium
cd nuxt && yarn typecheck
cd .. && git diff --check
```

Expected: all commands exit zero; the Reader suite retains the intentional
mobile-only horizontal-scroll skip only when the mobile project is included.
