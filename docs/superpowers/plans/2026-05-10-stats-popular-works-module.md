# Stats Popular Works Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the stats page popular-work list logic into a framework-neutral module with unit coverage, leaving the AngularJS component as a thin adapter.

**Architecture:** Create `app/scripts/features/stats/popularWorks.mjs` as the pure model for stats popular-work query options, list trimming, author fallback, and URL construction. Keep `app/scripts/components/stats-page/index.js` responsible for AngularJS registration, backend calls, and assigning controller state. Use a small Node `.mjs` unit spec to prove the pure module works without AngularJS.

**Tech Stack:** AngularJS 1.7, Vite ES modules, Node `assert/strict`, Playwright E2E.

---

## File Structure

- Create: `app/scripts/features/stats/popularWorks.mjs`
  - Owns the stats popular-work constants and pure helpers.
- Create: `test/unit/stats-popular-works.spec.mjs`
  - Runs in Node without AngularJS and imports only the pure module.
- Create: `test/unit/run-unit-tests.mjs`
  - Runs the stats module spec and compiles/runs the existing TypeScript query module spec from a temporary directory.
- Modify: `app/scripts/components/stats-page/index.js`
  - Imports the pure helpers and delegates model decisions to them.
- Modify: `package.json`
  - Adds a `test:unit` script for the unit runner.
- Modify: `docs/superpowers/specs/2026-05-10-syntax-modernization-design.md`
  - Records the stats popular works module as the first reference example for the module-plus-adapter pattern.

## Task 1: Add Unit Test Runner And RED Stats Module Spec

**Files:**
- Modify: `package.json`
- Create: `test/unit/stats-popular-works.spec.mjs`

- [ ] **Step 1: Add the unit script**

Add `test:unit` after `test:e2e` in `package.json`:

```json
"test:unit": "node test/unit/run-unit-tests.mjs",
```

- [ ] **Step 2: Write the failing unit spec**

Create `test/unit/stats-popular-works.spec.mjs`:

```js
import assert from "node:assert/strict"
import {
    POPULAR_WORKS_FETCH_SIZE,
    POPULAR_WORKS_LIMIT,
    getPopularWorkAuthor,
    getPopularWorksQueryOptions,
    getPopularWorkUrl,
    selectPopularWorks
} from "../../app/scripts/features/stats/popularWorks.mjs"

assert.strictEqual(POPULAR_WORKS_LIMIT, 30)
assert.strictEqual(POPULAR_WORKS_FETCH_SIZE, 100)

const queryOptions = getPopularWorksQueryOptions()
assert.strictEqual(queryOptions.q, "*")
assert.strictEqual(queryOptions.sort_field, "popularity|desc")
assert.strictEqual(queryOptions.partial_string, true)
assert.strictEqual(queryOptions.author_aggs, true)
assert.strictEqual(queryOptions.to, 100)
assert.ok(queryOptions.include.includes("main_author.authorid"))
assert.ok(queryOptions.include.includes("authors.full_name"))

assert.deepStrictEqual(
    selectPopularWorks([{ title: "one" }, { title: "two" }, { title: "three" }], 2),
    [{ title: "one" }, { title: "two" }]
)

const mainAuthor = { authorid: "main" }
const nestedAuthor = { authorid: "nested" }
const workAuthor = { authorid: "work" }

assert.strictEqual(getPopularWorkAuthor({ main_author: mainAuthor }), mainAuthor)
assert.strictEqual(getPopularWorkAuthor({ authors: [nestedAuthor] }), nestedAuthor)
assert.strictEqual(getPopularWorkAuthor({ work_authors: [workAuthor] }), workAuthor)
assert.deepStrictEqual(getPopularWorkAuthor({}), {})

assert.strictEqual(
    getPopularWorkUrl({
        mediatypes: [{ label: "pdf", url: "txt/lb1/lb1.pdf" }]
    }),
    "/txt/lb1/lb1.pdf"
)

assert.strictEqual(
    getPopularWorkUrl({
        main_author: { authorid: "StrindbergA" },
        work_titleid: "giftas",
        startpagename: "sida_1",
        mediatype: "etext"
    }),
    "/författare/StrindbergA/titlar/giftas/sida/sida_1/etext"
)

console.log("stats popular works tests: ok")
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm run test:unit
```

Expected: fails with `ERR_MODULE_NOT_FOUND` for `app/scripts/features/stats/popularWorks.mjs`.

## Task 2: Implement The Pure Stats Popular Works Module

**Files:**
- Create: `app/scripts/features/stats/popularWorks.mjs`

- [ ] **Step 1: Create the feature directory and module**

Create `app/scripts/features/stats/popularWorks.mjs`:

```js
export const POPULAR_WORKS_LIMIT = 30
export const POPULAR_WORKS_FETCH_SIZE = 100

export const POPULAR_WORKS_INCLUDE =
    "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain," +
    "main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type," +
    "work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword,authors.authorid,authors.surname,authors.full_name"

export function getPopularWorksQueryOptions() {
    return {
        sort_field: "popularity|desc",
        q: "*",
        include: POPULAR_WORKS_INCLUDE,
        partial_string: true,
        author_aggs: true,
        to: POPULAR_WORKS_FETCH_SIZE
    }
}

export function selectPopularWorks(titles = [], limit = POPULAR_WORKS_LIMIT) {
    return titles.slice(0, limit)
}

export function getPopularWorkAuthor(title = {}) {
    return (
        title.main_author ||
        (title.authors && title.authors[0]) ||
        (title.work_authors && title.work_authors[0]) ||
        {}
    )
}

export function getPopularWorkUrl(title = {}) {
    const mediatypes = title.mediatypes || []
    const mediatype =
        mediatypes.find(item => ["etext", "faksimil", "infopost"].includes(item.label)) ||
        mediatypes[0]

    if (mediatype && mediatype.url) {
        return mediatype.url.startsWith("/") ? mediatype.url : `/${mediatype.url}`
    }

    const author = getPopularWorkAuthor(title)
    return `/författare/${author.authorid}/titlar/${title.work_titleid || title.titleid}/sida/${
        title.startpagename
    }/${title.mediatype}`
}
```

- [ ] **Step 2: Verify GREEN for the unit spec**

Run:

```bash
npm run test:unit
```

Expected: exits 0 and prints `stats popular works tests: ok`.

- [ ] **Step 3: Commit the pure module and unit test**

Run:

```bash
git add package.json app/scripts/features/stats/popularWorks.mjs test/unit/stats-popular-works.spec.mjs
git commit -m "Extract stats popular works model"
```

Expected: commit contains only the unit script, new pure module, and new unit spec.

## Task 3: Adapt The AngularJS Stats Component

**Files:**
- Modify: `app/scripts/components/stats-page/index.js`

- [ ] **Step 1: Import the pure helpers**

At the top of `app/scripts/components/stats-page/index.js`, add:

```js
import {
    POPULAR_WORKS_LIMIT,
    getPopularWorkAuthor,
    getPopularWorksQueryOptions,
    getPopularWorkUrl,
    selectPopularWorks
} from "../../features/stats/popularWorks.mjs"
```

- [ ] **Step 2: Replace inline constants and options**

In `$onInit`, replace the local `popularWorksLimit`, `popularWorksFetchSize`, and `popularWorksInclude` constants plus the inline options object with:

```js
const popularWorksOptions = getPopularWorksQueryOptions()
```

Then call:

```js
this.backend
    .getTitles("etext,faksimil,pdf", popularWorksOptions)
    .then(({ titles }) => {
        this.titleList = selectPopularWorks(titles)
    })

this.backend.getEpub(POPULAR_WORKS_LIMIT).then(({ data }) => (this.epubList = data))
```

- [ ] **Step 3: Delegate controller helper methods**

Replace the method bodies with:

```js
getPopularWorkAuthor(title) {
    return getPopularWorkAuthor(title)
}

getPopularWorkUrl(title) {
    return getPopularWorkUrl(title)
}
```

- [ ] **Step 4: Run focused unit and E2E checks**

Run:

```bash
npm run test:unit
npm test -- --reporter=list -g "Stats"
```

Expected:
- Unit script exits 0 and prints `stats popular works tests: ok`.
- Playwright Stats test exits 0.

- [ ] **Step 5: Commit the adapter update**

Run:

```bash
git add app/scripts/components/stats-page/index.js
git commit -m "Use stats model from AngularJS component"
```

Expected: commit touches only the stats AngularJS component.

## Task 4: Document The First Reference Module

**Files:**
- Modify: `docs/superpowers/specs/2026-05-10-syntax-modernization-design.md`

- [ ] **Step 1: Add the reference example note**

In Milestone 1 after the task list, add:

```markdown
Reference example:

- Stats popular works uses `app/scripts/features/stats/popularWorks.mjs` for query options, list trimming, author fallback, and URL construction.
- `app/scripts/components/stats-page/index.js` remains the AngularJS adapter that calls `backend` and binds data to the template.
- `test/unit/run-unit-tests.mjs` runs the stats module spec and the existing query module spec without booting AngularJS.
```

- [ ] **Step 2: Run the stale-baseline scan**

Run:

```bash
rg -n "23 of 24|24 total|23 passing|23 passed|24 tests|40\\+|20\\+" docs/superpowers/specs/2026-05-10-syntax-modernization-design.md TESTING.md
```

Expected: no output.

- [ ] **Step 3: Commit the documentation update**

Run:

```bash
git add docs/superpowers/specs/2026-05-10-syntax-modernization-design.md
git commit -m "Document stats module reference example"
```

Expected: commit touches only the design spec.

## Task 5: Final Verification

**Files:**
- Inspect: `playwright.config.js`

- [ ] **Step 1: Confirm the tree and dev port**

Run:

```bash
git status --short --untracked-files=all
lsof -nP -iTCP:9000 -sTCP:LISTEN
```

Expected:
- Git status has no tracked changes or unignored generated output.
- `lsof` has no output before Playwright starts Vite.

- [ ] **Step 2: Run unit, build, and E2E baseline**

Run:

```bash
npm run test:unit
npm run build
npm test -- --reporter=list
```

Expected:
- Unit script exits 0 and prints both `stats popular works tests: ok` and `extended query utilities tests: ok`.
- Build exits 0; existing Sass/Browserslist/runtime asset warnings are acceptable.
- E2E reports 26 passed and one known `Reader > should show SO modal` failure.

- [ ] **Step 3: Confirm generated output remains ignored**

Run:

```bash
git status --short --untracked-files=all
git check-ignore -v test-results playwright-report .playwright-cli .playwright-mcp
```

Expected:
- Git status is clean.
- Ignore check points at `.gitignore` for generated Playwright/helper paths.
