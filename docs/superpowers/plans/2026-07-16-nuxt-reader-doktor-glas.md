# Nuxt Doktor Glas Reader Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the exact Doktor Glas page `-2` e-text route in Nuxt from live runtime metadata and one live page fragment, with stable SSR/browser coverage and legacy-compatible reader visuals.

**Architecture:** A page-sized Nitro API boundary resolves a legacy work representation and exactly one `/txt` HTML page into a small typed response. A route-specific Vue page owns fetching, metadata, navigation links, and rendering; shared and work-specific published styles preserve the source typography.

**Tech Stack:** Nuxt 4, Nitro/H3, Vue 3, TypeScript, SCSS, Playwright.

**Design:** `docs/superpowers/specs/2026-07-16-nuxt-reader-doktor-glas-design.md`

**Audited base:** `b5579de`

## Constraints

- Fetch metadata and the requested page at runtime; do not hard-code `lb1728740`, page index `2`, or source HTML.
- Return one page fragment only and do not cache upstream responses.
- Keep state page-local; introduce no one-use composable or shared store.
- Use ordinary previous/next anchor URLs and preserve SSR without a loading-only shell.
- Support e-text only in this slice; reject other media types clearly.
- Do not add history, logging, faksimil, contents/search/focus controls, keyboard handling, author/library pages, or deployment hardening.
- Do not modify the Angular application or backend repository.

---

### Task 1: Characterize the exact reader contract in failing tests

**Files:**
- Create: `nuxt/test/fixtures/reader-data.mjs`
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/playwright.config.ts`
- Create: `nuxt/test/ssr/reader.spec.ts`
- Create: `nuxt/test/e2e/reader.behavior.spec.ts`

- [ ] Add a small synthetic work-info fixture with Doktor Glas route metadata, page names `-3`, `-2`, and `-1`, and a small synthetic page fragment containing representative source markup. Add deterministic shared/work CSS and image responses plus request recording/reset endpoints. The fixture is test data, not a copy of the published page.
- [ ] Configure the test Nuxt server's private reader-source base and `/txt`/`/bilder` proxy target to use the fixture origin.
- [ ] Add an SSR test for the exact Unicode URL asserting status 200, legacy-compatible title/description, visible source text, page context, previous/next URLs, stylesheet URLs, and no loading-only page.
- [ ] Add SSR error coverage for an unknown page returning 404 rather than a false reader.
- [ ] Add a browser test asserting the hydrated visible text, body class, reader/typography hooks, ordinary navigation URLs, no hydration errors, and exactly one metadata plus one source-page upstream request.
- [ ] Run `cd nuxt && yarn playwright test test/ssr/reader.spec.ts test/e2e/reader.behavior.spec.ts --project=ssr --project=desktop-chromium` and verify RED because the route/API do not exist.

### Task 2: Implement the page-sized runtime reader endpoint

**Files:**
- Modify: `nuxt/nuxt.config.ts`
- Create: `nuxt/shared/types/reader.ts`
- Create: `nuxt/server/api/reader/[author]/[title]/[page]/[mediatype].get.ts`

- [ ] Add a private `readerSourceBase` runtime setting and development proxies for published `/txt` and `/bilder` assets.
- [ ] Define the normalized `ReaderPage` response used by the endpoint and Vue page.
- [ ] Validate route parameters and e-text media type, fetch `/api/get_work_info`, validate/select the exact representation, resolve the requested page and its neighbors, and fetch the zero-padded one-page `/txt` fragment with `username=app`.
- [ ] Normalize only display metadata, navigation names, CSS URLs, and the one HTML fragment. Convert upstream/malformed/not-found cases to non-leaking 404/502 errors.
- [ ] Run the focused reader Playwright command and confirm the tests advance from route-not-found to page-rendering failures, with endpoint requests recorded exactly once.

### Task 3: Render the SSR reader route and preserve its visual language

**Files:**
- Create: `nuxt/app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue`
- Create: `nuxt/app/assets/styles/reader.scss`

- [ ] Validate the media/path shape and fetch the same-origin normalized endpoint with page-local `useAsyncData`.
- [ ] Set `Doktor Glas sida -2 etext | Litteraturbanken`, a descriptive summary, shared/work stylesheet links, and `focus page-reading ready` body classes from resolved data.
- [ ] Render the trusted source fragment inside `.reader_main .etext.txt`, plus concise author/title/imprint/page context and ordinary previous/next anchors.
- [ ] Port the minimum reader layout/background/responsive SCSS needed for the exact state, reusing existing shell and mobile rules.
- [ ] Run the focused reader Playwright command and iterate to GREEN.

### Task 4: Compare, verify, and commit the complete slice

**Files:**
- Modify only the files above if comparison exposes a bounded parity defect.

- [ ] Capture or inspect the live Angular Doktor Glas `-2` state and the local fixture-backed Nuxt state at the same desktop viewport; compare text hierarchy, white reading surface, page context, and navigation placement.
- [ ] Run `cd nuxt && yarn typecheck`.
- [ ] Run `cd nuxt && yarn playwright test test/ssr/reader.spec.ts --project=ssr`.
- [ ] Run `cd nuxt && yarn playwright test test/e2e/reader.behavior.spec.ts --project=desktop-chromium`.
- [ ] Run the relevant existing statistics behavior test to prove its Doktor Glas link still targets the reader route.
- [ ] Run `git diff --check` and inspect `git status --short` so `.superpowers` and unrelated work remain uncommitted.
- [ ] Commit implementation, tests, and plan with a scoped message and report the exact testable URL, commits, verification output, deferred behaviors, and remaining concerns.
