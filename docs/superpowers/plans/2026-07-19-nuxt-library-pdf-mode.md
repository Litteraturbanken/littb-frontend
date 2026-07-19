# Nuxt Library PDF Mode Implementation Plan

> **Execution rule:** implement task-by-task with RED/GREEN tests, a focused
> commit, and independent review before the next production task.

**Goal:** Enable the legacy PDF work-list mode in both `/bibliotek` and `/epub`
shells while preserving the reviewed Library appearance and page-local model.

**Design:**
`docs/superpowers/specs/2026-07-19-nuxt-library-pdf-mode-design.md`

**Frontend base:** `9799691c`

## Non-negotiable contracts

- Do not edit Angular production files or copied global styles.
- Do not create a one-use composable or separate PDF page.
- Keep `/bibliotek` and `/epub` shell metadata distinct.
- Fetch only the active mode; no inactive-tab count fan-out in this slice.
- Preserve unrelated and repeated query keys while owning `visa`, `filter`,
  `sort`, and `sida`.
- Validate every synthesized path and download destination before rendering it.
- Preserve all existing relevance and EPUB behavior and visual baselines.

## Task 1: Freeze deterministic PDF fixture contracts

**Files:**

- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Add: `nuxt/test/fixtures/library-pdf-data.mjs`
- Modify: `nuxt/test/unit/v2-server.spec.ts`

### RED

Add fixture tests for `GET /api/query_string/etext,faksimil,pdf` PDF predicates.
Require deterministic cases for:

- page one and page two;
- each legacy work sort;
- sanitized filter composition;
- one exported e-text and one exported faksimil represented only by
  `{ type: "pdf", size }`;
- one indexed `mediatype:pdf` representation with no export;
- one grouped direct-PDF plus export collision proving direct-PDF precedence;
- duplicate export descriptors proving deterministic first-match behavior;
- a restricted export rejected by the grouping/parser contract;
- differing `work_authors[0]` and `main_author` identities;
- empty results;
- absent and null `suggest`;
- malformed top-level response;
- unsafe/missing row fields, including control characters, unsafe `lbworkid`,
  and a safe-but-unsupported `audio` media type;
- delayed identities by filter, sort, `from`, and `to`;
- transport failure;
- exact private/public request-ledger reset and readback.

Assert the exact query predicate:

```text
((export>type:pdf AND license:pd) OR mediatype:pdf)
```

and its filtered `AND` form. Run the focused fixture suite and capture the
expected failures.

### GREEN

Create one shared PDF fixture module consumed by the fixture server, SSR/browser
tests, and Angular authority capture. Do not model provider-owned PDF URLs or
filenames: real export descriptors are `{ type, size }`, while all routes and
filenames are synthesized by the page model. Give at least one response unequal
`hits` and `distinct_hits` so pagination ownership is executable. Extend the
fixture server without changing existing EPUB identities or ledgers. Make
delay/failure controls independently resettable and safe with outstanding
requests.

Run:

```bash
cd nuxt
yarn vitest run test/unit/v2-server.spec.ts
```

Commit only Task 1 files.

## Task 2: Specify SSR route, response, and safety behavior

**Files:**

- Modify: `nuxt/test/ssr/library.spec.ts`

### RED

Add SSR tests proving:

- `/bibliotek?visa=pdf` uses the Library shell and PDF active tab;
- `/epub?visa=pdf` uses the standalone shell and PDF active tab;
- missing `visa` on `/epub` still defaults to EPUB;
- default/invalid PDF sort normalizes to `popularitet`;
- invalid/fractional/negative/zero pages normalize to page one;
- page two produces exact `from=100&to=200` bounds;
- all four PDF sort expressions are exact;
- free text is sanitized and combined with the PDF predicate;
- title links use `faksimil` only for selected indexed PDF rows and retain
  `etext`/`faksimil` for export-backed rows;
- author links encode one safe segment;
- download anchors synthesize exact `/txt/{lbworkid}/{lbworkid}.pdf` or
  `/export/faksimil/{lbworkid}.pdf` hrefs plus safe legacy filenames;
- raw representations group by `(titlepath, lbworkid)`, direct PDFs take
  precedence, duplicate export descriptors render one action, and filename
  authors follow `work_authors`, then `authors`, then `main_author`;
- unsafe controls, slashes, dot segments, `lbworkid`, and unsupported media are
  omitted without invalidating an otherwise independent group;
- pagination uses `distinct_hits`, not raw hits;
- valid empty and failed/malformed states remain distinct;
- unrelated repeated query keys survive generated tab/sort/page hrefs;
- SSR makes exactly one private active-mode request.

Run the Library SSR suite and retain the failures before production edits.

## Task 3: Implement page-local PDF state and renderer

**Files:**

- Modify: `nuxt/app/pages/bibliotek.vue`

### GREEN

Implement only the behavior specified by Task 2:

1. Extend the mode/state discriminants with `pdf`.
2. Keep the EPUB and PDF work-sort table shared.
3. Add a strict PDF response/group parser and safe download helper. It must
   ignore provider `url`/`filename`, group representations, prefer real PDFs,
   and otherwise select the first public-domain PDF export.
4. Add the exact PDF request predicate to the existing query-string request
   builder.
5. Reuse current abort/version/owned-navigation/hydration logic for PDF.
6. Turn both deferred PDF buttons into ordinary active-mode anchors.
7. Reuse the existing work table and pagination DOM, switching only the
   mode-specific row destinations and download filename.
8. Keep every unrelated tab deferred and visually unchanged.

Do not move fetch/model code out of `<script setup>`. Do not loosen the EPUB
parser or alter its URL behavior to accommodate PDF.

Run:

```bash
cd nuxt
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3038 yarn playwright test test/ssr/library.spec.ts --project=ssr
yarn typecheck
LBAPI_OPENAPI_SCHEMA=../../lb-backend/openapi/v2.json yarn api:check
```

Then rerun the existing Library behavior suite to catch regressions. Commit
Task 2 and Task 3 together only after the RED/GREEN evidence is complete.

## Task 4: Prove client navigation and stale-request behavior

**Files:**

- Modify: `nuxt/test/e2e/library.behavior.spec.ts`

### RED

Add browser tests for:

- Library EPUB -> PDF -> EPUB tab switching without document reload;
- standalone EPUB -> PDF while retaining the standalone shell;
- 300 ms PDF filtering and immediate submit/reset;
- every PDF sort and reset to page one;
- next/previous/numeric pagination;
- Back/Forward restoration across mode/filter/sort/page;
- delayed PDF result superseded by a newer PDF request;
- delayed PDF result superseded by EPUB or relevance mode;
- no duplicate hydration request;
- one public active-mode request per committed state;
- exact title, author, and download anchor semantics;
- empty/error states with no leaked provider detail;
- no hydration warnings, console errors, or page errors.

Use the existing fixture ledgers; do not infer requests only from visible rows.
Run the focused browser suite and retain the failures.

### GREEN

Make the smallest page-local corrections necessary. Production changes remain
limited to `bibliotek.vue`; fixture defects belong in Task 1 files. Re-run:

```bash
cd nuxt
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3038 yarn playwright test test/ssr/library.spec.ts --project=ssr
yarn typecheck
```

Commit Task 4 tests and any reviewed correction separately.

## Task 5: Capture Angular authority and enforce zero-redesign parity

**Files:**

- Modify: `nuxt/test/visual/capture-library-epub-angular.spec.ts`
- Modify: `nuxt/test/e2e/library.visual.spec.ts`
- Read: `nuxt/test/fixtures/library-pdf-data.mjs`
- Add only the required deterministic PDF baseline images under the existing
  Library visual snapshot directory.

### RED authority capture

Extend the isolated Angular authority with the shared PDF fixture for a populated
desktop and mobile state in both Library and standalone shells. Its exact legacy
request intentionally includes `pdfOnly=true`, `author_aggregation=true`, and
`imported_aggregation=false`, plus the existing inactive count fan-out; do not
mistake that authority traffic for Nuxt's one-active-request contract. The
firewall must reject production data, unregistered assets, query drift, and
unexpected extra requests. Add executable baselines named
`library-pdf-{desktop,mobile}.png` and
`standalone-pdf-{desktop,mobile}.png`, while proving existing relevance/EPUB
baselines remain byte-identical.

### GREEN Nuxt comparison

Add matching Nuxt states and compare at the repository's strict Library visual
threshold. Inspect every generated image. Correct only Nuxt markup or narrowly
scoped page CSS; do not edit copied shared styles, Angular source, or existing
baselines.

Run the complete Library authority and visual commands documented in the
existing test files, including:

```bash
yarn playwright test --config=playwright.library-epub-angular.config.ts
```

Then rerun existing relevance and EPUB comparisons.

Commit authority/baselines separately from the Nuxt visual assertions where the
existing Library workflow does so.

## Task 6: Whole-slice verification and review

Request an independent spec/quality review across the design base through the
final Task 5 commit. Fix every Critical or Important finding with a focused
RED/GREEN regression test; adjudicate Minor findings explicitly.

Run fresh verification:

```bash
cd nuxt
yarn vitest run test/unit/v2-server.spec.ts
NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=3038 yarn playwright test test/ssr/library.spec.ts --project=ssr
yarn playwright test test/e2e/library.behavior.spec.ts --project=desktop-chromium
yarn playwright test test/e2e/library.visual.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn test:unit
yarn typecheck
yarn build
LBAPI_OPENAPI_SCHEMA=../../lb-backend/openapi/v2.json yarn api:check
git diff --check
```

Also run the Angular authority command from the capture spec and verify no
unreviewed actual/diff artifacts remain. Finally smoke both live routes against
the local backend, checking populated rows, a PDF download URL, tab switching,
and browser warnings/errors without changing server ownership.
