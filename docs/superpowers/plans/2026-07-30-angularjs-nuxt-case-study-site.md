# AngularJS-to-Nuxt Case-Study Microsite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, evidence, validate, and publish an unlisted Swedish editorial microsite about Litteraturbanken's AngularJS-to-Nuxt rewrite.

**Architecture:** Create a standalone Sites/vinext project at `/Users/johan/dev/lb-rewrite-case-study`. Checked-in measurement scripts produce immutable raw artifacts and normalized typed evidence; a one-route React site consumes only that normalized local data and renders fourteen anchored chapters plus methodology appendices. The main Litteraturbanken frontend remains unchanged.

**Tech Stack:** Sites vinext starter, React, TypeScript, Vite, CSS, Zod, Node.js measurement scripts, Lighthouse, Playwright, Vitest, Testing Library, axe-core, and the Sites connector.

## Global Constraints

- Site language is Swedish and copy is written for non-technical staff.
- The tone is candid, calm, evidence-based, and neither defensive nor promotional.
- The result is a continuous editorial marketing site, not slides and not a dashboard.
- The site has no authentication and must state that its unlisted URL is not an access-control boundary.
- Emit `robots` metadata and headers equivalent to `noindex, nofollow`.
- Do not add routes or visual changes to the main Nuxt application.
- Freeze frontend revision `7511e5bd411db20abad11f69961775d0f0f71b86` and backend revision `d8a18ec1fca1a87a9a79e175f4ff2ed3d6a9a441`.
- Treat AngularJS revision `1f942453c31f8d9e5ae600fa7ec183e2603dcd46` as unverified until a deployed-bundle fingerprint matches.
- Use optimized deployed Nuxt output, never a development server, for performance evidence.
- Keep application code, tests, styles, generated code, fixtures, configuration, and vendored code separate in line counts.
- Keep every raw Lighthouse run and use medians rather than best runs.
- Separate external facts, local measurements, and interpretations in structured data.
- Do not display a missing measurement as zero or silently substitute another route.
- Respect `prefers-reduced-motion`; all content must remain understandable without motion.
- Use no model-authored SVG illustrations.
- The finished site must print as a coherent report.
- Keep the Sites development server alive through build and hosting, then stop it.

---

### Task 1: Initialize the standalone Sites project and evidence schema

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/.openai/hosting.json`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/data/schema.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/data/site-content.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/data/schema.test.ts`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/package.json`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/vite.config.ts`

**Interfaces:**
- Produces: `ClaimSchema`, `SourceSchema`, `RouteEvidenceSchema`, `BenchmarkSchema`, `SiteEvidenceSchema`, and `SiteEvidence`.
- Produces: `validateSiteEvidence(value: unknown): SiteEvidence`.
- Later tasks consume the schema and never import raw artifacts directly into UI components.

- [ ] **Step 1: Initialize the project and retain the setup session**

Run the Sites plugin initializer from the empty project directory:

```bash
mkdir -p /Users/johan/dev/lb-rewrite-case-study
cd /Users/johan/dev/lb-rewrite-case-study
/Users/johan/.codex/plugins/cache/openai-bundled/sites/0.1.31/scripts/init-site.sh "$PWD"
```

Expected: the Sites vinext starter and `.openai/hosting.json` exist; do not run the initializer again.

- [ ] **Step 2: Start the retained development server**

Run:

```bash
npm run dev
```

Expected: retain the process and record the exact printed Local URL. Open that URL once in Codex and keep the server alive.

- [ ] **Step 3: Add test and evidence dependencies**

Run:

```bash
npm install zod
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom playwright axe-core lighthouse chrome-launcher tsx
```

Add scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "measure:html": "tsx scripts/measure-initial-html.ts",
  "measure:lighthouse": "tsx scripts/measure-lighthouse.ts",
  "measure:source": "tsx scripts/measure-source.ts",
  "evidence:normalize": "tsx scripts/normalize-evidence.ts",
  "evidence:verify": "tsx scripts/verify-evidence.ts",
  "visual:verify": "playwright test"
}
```

- [ ] **Step 4: Write failing schema tests**

Create tests that prove required claims cannot omit source or measurement IDs and that unavailable values require a reason:

```ts
import { describe, expect, it } from "vitest"
import { validateSiteEvidence } from "../../app/data/schema"

describe("site evidence", () => {
  it("rejects an external fact without a source", () => {
    expect(() => validateSiteEvidence({
      sources: [],
      claims: [{
        id: "angular-eol",
        kind: "external_fact",
        text: "AngularJS support upphörde i januari 2022.",
        sourceIds: []
      }],
      routes: [],
      benchmarks: [],
      limitations: []
    })).toThrow()
  })

  it("requires a reason for unavailable measurements", () => {
    expect(() => validateSiteEvidence({
      sources: [],
      claims: [],
      routes: [],
      benchmarks: [{
        id: "legacy-commit",
        status: "unavailable",
        value: null,
        unit: "revision",
        reason: ""
      }],
      limitations: []
    })).toThrow()
  })
})
```

- [ ] **Step 5: Run the schema tests and verify red**

Run:

```bash
npm test -- test/data/schema.test.ts
```

Expected: FAIL because `app/data/schema.ts` does not exist.

- [ ] **Step 6: Implement the schema**

Define discriminated Zod unions:

```ts
import { z } from "zod"

export const SourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  accessedAt: z.string().date()
})

export const ClaimSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("external_fact"),
    text: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("local_measurement"),
    text: z.string().min(1),
    benchmarkIds: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("interpretation"),
    text: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).min(1)
  })
])

export const BenchmarkSchema = z.discriminatedUnion("status", [
  z.object({
    id: z.string().min(1),
    status: z.literal("measured"),
    value: z.number(),
    unit: z.string().min(1),
    rawArtifactIds: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    id: z.string().min(1),
    status: z.literal("unavailable"),
    value: z.null(),
    unit: z.string().min(1),
    reason: z.string().min(1)
  })
])

export const RouteEvidenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().startsWith("/"),
  performanceIncluded: z.boolean()
})

export const SiteEvidenceSchema = z.object({
  sources: z.array(SourceSchema),
  claims: z.array(ClaimSchema),
  routes: z.array(RouteEvidenceSchema),
  benchmarks: z.array(BenchmarkSchema),
  limitations: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    explanation: z.string().min(1)
  }))
}).superRefine((evidence, context) => {
  const sourceIds = new Set(evidence.sources.map(source => source.id))
  const benchmarkIds = new Set(evidence.benchmarks.map(item => item.id))
  for (const claim of evidence.claims) {
    if (claim.kind === "external_fact") {
      for (const id of claim.sourceIds) if (!sourceIds.has(id)) {
        context.addIssue({ code: "custom", message: `Unknown source ${id}` })
      }
    }
    if (claim.kind === "local_measurement") {
      for (const id of claim.benchmarkIds) if (!benchmarkIds.has(id)) {
        context.addIssue({ code: "custom", message: `Unknown benchmark ${id}` })
      }
    }
  }
})

export type SiteEvidence = z.infer<typeof SiteEvidenceSchema>
export const validateSiteEvidence = (value: unknown): SiteEvidence =>
  SiteEvidenceSchema.parse(value)
```

- [ ] **Step 7: Run the schema test and commit**

Run:

```bash
npm test -- test/data/schema.test.ts
```

Expected: PASS.

Commit:

```bash
git add .
git commit -m "feat: initialize rewrite case-study evidence model"
```

### Task 2: Capture revision, route, and initial-HTML evidence

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/routes.json`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/revisions.json`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/sources.json`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/lib/http-evidence.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/measure-initial-html.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/verify-legacy-revision.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/scripts/http-evidence.test.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/raw/html/.gitkeep`

**Interfaces:**
- Produces: `HtmlEvidence` with `status`, `bytes`, `title`, `description`, `canonical`, `meaningfulTextCharacters`, and `linkCount`.
- Produces: one raw JSON and one raw HTML file per deployment and route.
- Produces: `evidence/revisions.json` with explicit `verified | unverified` provenance.

- [ ] **Step 1: Record the frozen route and source inventory**

Write seven route records, marking home, library, text search, and OCR reader as `performanceIncluded: true`; mark author, facsimile, and editor false for Lighthouse but true for HTML/parity evidence.

Store the authoritative source:

```json
{
  "id": "angularjs-support-status",
  "title": "AngularJS: Version Support Status",
  "publisher": "AngularJS",
  "url": "https://docs.angularjs.org/misc/version-support-status",
  "accessedAt": "2026-07-30"
}
```

- [ ] **Step 2: Write failing HTML parser tests**

Test SSR-rich and shell-only fixtures:

```ts
import { describe, expect, it } from "vitest"
import { summarizeHtml } from "../../scripts/lib/http-evidence"

describe("summarizeHtml", () => {
  it("counts meaningful initial content", () => {
    const result = summarizeHtml(
      "<html><head><title>Doktor Glas</title><meta name='description' content='Roman'></head><body><main><a href='/bok'>Läs boken</a><p>En lång inledande text.</p></main><script>ignored()</script></body></html>"
    )
    expect(result.title).toBe("Doktor Glas")
    expect(result.description).toBe("Roman")
    expect(result.linkCount).toBe(1)
    expect(result.meaningfulTextCharacters).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 3: Run the parser test and verify red**

Run:

```bash
npm test -- test/scripts/http-evidence.test.ts
```

Expected: FAIL because `summarizeHtml` is missing.

- [ ] **Step 4: Implement the HTML summarizer and collector**

Use `DOMParser` from the starter-compatible server runtime or a small parser dependency already present. Remove `script`, `style`, `noscript`, and template content before counting collapsed visible text. Count anchors with non-empty safe `href`; extract title, description, and canonical metadata exactly.

The collector must:

```ts
export type Deployment = {
  id: "legacy" | "nuxt"
  baseUrl: string
}

export type HtmlEvidence = {
  deployment: Deployment["id"]
  routeId: string
  requestedUrl: string
  finalUrl: string
  status: number
  bytes: number
  title: string | null
  description: string | null
  canonical: string | null
  meaningfulTextCharacters: number
  linkCount: number
  capturedAt: string
}
```

Fetch `https://red.litteraturbanken.se` and `https://stage.litteraturbanken.se`, save response bytes before parsing, retain redirect destination, and fail when a listed route is not 200 on both deployments.

- [ ] **Step 5: Verify parser green and collect**

Run:

```bash
npm test -- test/scripts/http-evidence.test.ts
npm run measure:html
```

Expected: parser PASS; fourteen JSON summaries and fourteen HTML artifacts exist.

- [ ] **Step 6: Verify the legacy revision without overclaiming**

Build the AngularJS candidate revision in a temporary Git worktree using its documented production build. Hash the produced JavaScript and CSS assets and compare them to downloaded `red.litteraturbanken.se` assets.

Write:

```json
{
  "legacy": {
    "candidateGitSha": "1f942453c31f8d9e5ae600fa7ec183e2603dcd46",
    "status": "verified",
    "method": "deployed bundle fingerprint",
    "capturedAt": "2026-07-30"
  },
  "nuxt": {
    "gitSha": "7511e5bd411db20abad11f69961775d0f0f71b86",
    "status": "verified",
    "method": "Nomad immutable deployment metadata"
  },
  "backend": {
    "gitSha": "d8a18ec1fca1a87a9a79e175f4ff2ed3d6a9a441",
    "status": "verified",
    "method": "Nomad immutable deployment metadata"
  }
}
```

If asset hashes differ, write legacy `status: "unverified"` and describe it as “deployed snapshot captured 2026-07-30”; do not keep the `verified` example.

- [ ] **Step 7: Commit**

```bash
git add evidence scripts test
git commit -m "feat: capture revision and initial HTML evidence"
```

### Task 3: Measure categorized source and verification scope

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/measure-source.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/measure-quality.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/scripts/source-categories.test.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/raw/source/.gitkeep`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/raw/quality/.gitkeep`

**Interfaces:**
- Produces: `SourceCategory = "application" | "tests" | "styles" | "generated" | "fixtures" | "configuration" | "vendored"`.
- Produces per-revision physical and nonblank line totals by category and language.
- Produces command evidence for lint, TypeScript, unit, SSR, Playwright, visual, architecture, and API-contract checks.

- [ ] **Step 1: Write failing path-category tests**

```ts
import { describe, expect, it } from "vitest"
import { categorizePath } from "../../scripts/measure-source"

describe("categorizePath", () => {
  it.each([
    ["nuxt/app/pages/index.vue", "application"],
    ["nuxt/test/ssr/home.spec.ts", "tests"],
    ["nuxt/app/assets/styles/main.scss", "styles"],
    ["nuxt/app/lib/api/generated/lbapi.ts", "generated"],
    ["nuxt/test/fixtures/v2-server.mjs", "fixtures"],
    ["nuxt/nuxt.config.ts", "configuration"],
    ["bower_components/angular/angular.js", "vendored"]
  ])("%s is %s", (path, category) => {
    expect(categorizePath(path)).toBe(category)
  })
})
```

- [ ] **Step 2: Run red**

Run:

```bash
npm test -- test/scripts/source-categories.test.ts
```

Expected: FAIL because `categorizePath` is missing.

- [ ] **Step 3: Implement tree-based line counting**

Use `git ls-tree -r --name-only <revision>` and `git show <revision>:<path>` so both frontend revisions are measured without changing the working tree. Count physical and nonblank lines for text extensions only. Record ignored binary and oversize files. Apply category rules in strict priority: vendored, generated, fixtures, tests, styles, configuration, application.

- [ ] **Step 4: Implement quality-command evidence**

Run exact commands in the frozen Nuxt and backend repositories and save stdout, stderr, exit code, start/end time, revision, and tool version:

```text
yarn lint
yarn typecheck
yarn vitest run
yarn playwright test --project=ssr
python -m pytest test_lbapi/v2 -q
python -m mypy lbapi/v2
python -m ruff check lbapi/v2 test_lbapi/v2
```

Do not interpret a test count as coverage. Record skipped, failed, and passed outcomes separately.

- [ ] **Step 5: Run green and collect**

```bash
npm test -- test/scripts/source-categories.test.ts
npm run measure:source
tsx scripts/measure-quality.ts
```

Expected: test PASS; source and quality raw artifacts include revision and tool versions.

- [ ] **Step 6: Commit**

```bash
git add evidence scripts test
git commit -m "feat: measure rewrite source and quality scope"
```

### Task 4: Capture repeatable Lighthouse evidence

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/lib/statistics.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/measure-lighthouse.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/capture-comparison-screenshots.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/scripts/statistics.test.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/raw/lighthouse/.gitkeep`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/raw/screenshots/.gitkeep`

**Interfaces:**
- Produces: `median(values: number[]): number`.
- Produces three raw Lighthouse JSON files for each performance route, deployment, and device profile.
- Produces normalized medians without discarding outliers from raw data.

- [ ] **Step 1: Write failing median tests**

```ts
import { describe, expect, it } from "vitest"
import { median } from "../../scripts/lib/statistics"

describe("median", () => {
  it("sorts odd samples", () => expect(median([9, 2, 5])).toBe(5))
  it("averages the center pair", () => expect(median([8, 2, 4, 6])).toBe(5))
  it("rejects empty input", () => expect(() => median([])).toThrow())
})
```

- [ ] **Step 2: Run red**

```bash
npm test -- test/scripts/statistics.test.ts
```

Expected: FAIL because `median` is missing.

- [ ] **Step 3: Implement median and the Lighthouse runner**

Use one detected Chromium executable and record its exact version. For each of four performance routes, run legacy/Nuxt × mobile/desktop × three cold-cache samples sequentially. Use identical Lighthouse throttling and viewport configuration per device. Save raw JSON before normalization.

Extract only audited values that exist:

```ts
type LighthouseSample = {
  performance: number | null
  accessibility: number | null
  seo: number | null
  bestPractices: number | null
  ttfbMs: number | null
  fcpMs: number | null
  lcpMs: number | null
  cls: number | null
  tbtMs: number | null
  speedIndexMs: number | null
  transferredBytes: number | null
  javascriptBytes: number | null
  requestCount: number | null
}
```

If any sample fails, retain its error artifact and mark the route/configuration unavailable; do not calculate a median from two samples.

- [ ] **Step 4: Capture matched legacy/Nuxt screenshots**

Use Playwright Chromium with identical viewport, device scale factor, color
scheme, font readiness, image readiness, and cold navigation for both
deployments. Capture home, library, OCR reader, and facsimile reader at
1440×1000 and 390×844. Save one PNG plus a JSON record containing URL, final
URL, viewport, captured timestamp, and revision/deployment provenance for each
side. A pair is eligible for `BeforeAfter` only when both pages return 200 and
the route identity and content selection match.

- [ ] **Step 5: Run the focused test and measurements**

```bash
npm test -- test/scripts/statistics.test.ts
npm run measure:lighthouse
tsx scripts/capture-comparison-screenshots.ts
```

Expected: test PASS; 48 raw reports exist or an explicit unavailable record
explains each incomplete configuration; eligible screenshot pairs have complete
provenance records.

- [ ] **Step 6: Commit**

```bash
git add evidence scripts test
git commit -m "feat: capture repeatable Lighthouse evidence"
```

### Task 5: Normalize and verify the complete evidence snapshot

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/normalize-evidence.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/verify-evidence.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/data/evidence.generated.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/docs/METHODOLOGY.md`
- Create: `/Users/johan/dev/lb-rewrite-case-study/docs/SOURCES.md`
- Create: `/Users/johan/dev/lb-rewrite-case-study/docs/LIMITATIONS.md`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/data/evidence.test.ts`

**Interfaces:**
- Produces: `siteEvidence` validated by `SiteEvidenceSchema`.
- Produces: deterministic normalized output sorted by stable IDs.
- Produces: methodology, sources, and limitation documents that match displayed data.

- [ ] **Step 1: Write failing evidence-link tests**

Test that every claim resolves its cited IDs, every measured benchmark resolves raw artifacts, all routes have both deployment records, and all Lighthouse medians have exactly three raw samples.

- [ ] **Step 2: Run red**

```bash
npm test -- test/data/evidence.test.ts
```

Expected: FAIL because `evidence.generated.ts` is absent.

- [ ] **Step 3: Implement deterministic normalization**

Read raw artifact manifests, validate all records, compute medians, and emit TypeScript with:

```ts
import { validateSiteEvidence } from "./schema"

export const siteEvidence = validateSiteEvidence({
  sources: [],
  claims: [],
  routes: [],
  benchmarks: [],
  limitations: []
})
```

Replace the empty arrays with normalized values generated from artifacts. Include explicit unavailable benchmark records for unverified legacy revision provenance, differing backend environments, missing field data, and any incomplete run.

- [ ] **Step 4: Write methodology and limitation documents**

Document hardware, OS, Chromium, Lighthouse, viewport, throttling, cache policy, sample count, median rule, exact dates, Git revisions, route URLs, backend-environment difference, physical/nonblank line definition, and artifact paths.

State plainly that results measure current deployments, not historic user experience or framework performance in isolation.

- [ ] **Step 5: Verify green**

```bash
npm run evidence:normalize
npm run evidence:verify
npm test -- test/data/evidence.test.ts
```

Expected: all commands PASS and a second normalization creates no diff.

- [ ] **Step 6: Commit**

```bash
git add app/data evidence docs scripts test
git commit -m "feat: normalize case-study evidence snapshot"
```

### Task 6: Build the editorial narrative and responsive visual system

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/ChapterNav.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/EvidenceCard.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/Chapter.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/ArchitectureStory.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/QualityLayers.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/ObservabilityStory.tsx`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/app/page.tsx`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/app/globals.css`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/app/layout.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/ui/narrative.test.tsx`

**Interfaces:**
- `Chapter` consumes `{ id, eyebrow, title, lead, children }`.
- `EvidenceCard` consumes a validated claim plus resolved evidence.
- `ChapterNav` consumes the fourteen stable chapter IDs and labels.
- Components render no unvalidated numbers and make no network requests.

- [ ] **Step 1: Write failing narrative tests**

Assert fourteen ordered chapter headings, Swedish page language, skip link, no-index metadata, and a visible disclosure that the URL is not access control.

- [ ] **Step 2: Run red**

```bash
npm test -- test/ui/narrative.test.tsx
```

Expected: FAIL against the starter page.

- [ ] **Step 3: Replace the starter with the full editorial structure**

Remove `app/_sites-preview` imports and temporary starter metadata. Build all fourteen chapters with concise Swedish copy from the approved design. Lead with:

```text
Samma bibliotek. En ny teknisk grund.
Litteraturbanken har flyttat från AngularJS till Nuxt och Vue — för att bli synligare, lättare att underhålla och tryggare att fortsätta utveckla.
```

Use the old system's achievements as the second chapter before discussing end of support. Explain jargon at first use and prefer “servern skickar en färdig sida” over “SSR” in primary copy.

- [ ] **Step 4: Implement the visual system**

Define CSS custom properties for paper, ink, burgundy, muted gold, border, and focus colors. Use a responsive editorial grid, large readable measure, visible focus states, native details styling, print styles, and reduced-motion media queries. Avoid decorative animation and horizontal overflow.

- [ ] **Step 5: Implement accessible architecture, quality, and observability stories**

Use semantic HTML and CSS boxes/arrows rather than SVG:

```text
AngularJS: Tomt HTML-skal → JavaScript laddas → data hämtas → innehåll visas
Nuxt: Förfrågan → servern hämtar data → innehåll + metadata skickas → Vue tar över interaktion
```

Quality layers must distinguish who typed code from how correctness is established. Observability must show:

```text
Webbläsare + Nuxt + FastAPI → strukturerade händelser → Vector → Grafana + larm
```

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- test/ui/narrative.test.tsx
npm run build
```

Expected: PASS; no starter skeleton remains.

Commit:

```bash
git add app test package.json package-lock.json
git commit -m "feat: build rewrite case-study narrative"
```

### Task 7: Add interactive evidence comparisons and appendices

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/InitialHtmlCompare.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/PerformanceCompare.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/ParityMatrix.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/Appendices.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/app/components/BeforeAfter.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/ui/interactions.test.tsx`
- Create: `/Users/johan/dev/lb-rewrite-case-study/public/og.png`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/app/page.tsx`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/app/layout.tsx`
- Modify: `/Users/johan/dev/lb-rewrite-case-study/app/globals.css`

**Interfaces:**
- `InitialHtmlCompare` consumes two `HtmlEvidence` records for one route.
- `PerformanceCompare` consumes measured or unavailable medians and always exposes a text table.
- `BeforeAfter` consumes two verified captures and descriptive labels.
- `Appendices` consumes sources, methodology links, and limitations.

- [ ] **Step 1: Write failing interaction tests**

Test button semantics, selected route/device state, keyboard activation, unavailable evidence explanation, source links, and a reduced-motion rendering that omits animated transitions.

- [ ] **Step 2: Run red**

```bash
npm test -- test/ui/interactions.test.tsx
```

Expected: FAIL because comparison components do not exist.

- [ ] **Step 3: Implement the comparisons**

Use buttons with `aria-pressed` for legacy/Nuxt, mobile/desktop, and route choices. Keep both values in the DOM when a visual chart changes, with the inactive values available in the adjacent table. `InitialHtmlCompare` shows a concise crawler preview plus exact text/link/metadata counts. `PerformanceCompare` labels medians and sample count. `ParityMatrix` uses text labels `Verifierad`, `Delvis`, and `Återstår`.

- [ ] **Step 4: Implement appendices and print behavior**

Render methodology, sources, raw artifact index, and limitations as native `<details>` sections with direct anchors. Print CSS expands every details section, removes sticky controls, prints URLs after external links, and renders comparison tables instead of toggled views.

- [ ] **Step 5: Generate exactly one social preview**

Once headline, palette, and typography are stable, call image generation once for a 1200×630 card using:

```text
Create a restrained editorial social preview for an internal Swedish Litteraturbanken case study. Warm paper background, charcoal literary typography, muted burgundy accent, the exact headline “Samma bibliotek. En ny teknisk grund.” and subtitle “Från AngularJS till Nuxt och Vue”. Use a subtle before/after architectural motif, no logos invented, no dashboard styling, high legibility at small size.
```

Inspect the resulting text. If text is wrong or illegible, retry once; otherwise save it as `public/og.png`. Add absolute-host Open Graph and X metadata. If both attempts fail inspection, omit `og:image`.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- test/ui/interactions.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add app public test
git commit -m "feat: add evidence comparisons and appendices"
```

### Task 8: Add browser, accessibility, visual, print, and source verification

**Files:**
- Create: `/Users/johan/dev/lb-rewrite-case-study/playwright.config.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/e2e/case-study.spec.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/test/e2e/visual.spec.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/scripts/verify-sources.ts`
- Create: `/Users/johan/dev/lb-rewrite-case-study/docs/EDITORIAL-GUIDE.md`
- Create: `/Users/johan/dev/lb-rewrite-case-study/docs/VISUAL-VERIFICATION.md`
- Create: `/Users/johan/dev/lb-rewrite-case-study/evidence/visual/.gitkeep`

**Interfaces:**
- Produces screenshot evidence at 390×844, 1440×1000, and 1920×1080.
- Produces a PDF-friendly print check.
- Produces a source-verification report without changing evidence content.

- [ ] **Step 1: Write end-to-end tests**

Cover:

```ts
test("supports direct chapter links and keyboard controls", async ({ page }) => {
  await page.goto("/#prestanda")
  await expect(page.getByRole("heading", { name: /Resultat som går att mäta/i })).toBeInViewport()
  await page.getByRole("button", { name: /Mobil/i }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("button", { name: /Mobil/i })).toHaveAttribute("aria-pressed", "true")
})

test("contains no serious accessibility violations", async ({ page }) => {
  await page.goto("/")
  const results = await page.evaluate(async () => {
    const axe = await import("axe-core")
    return axe.run(document)
  })
  expect(results.violations.filter(item => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([])
})
```

Also test `robots` metadata, reduced motion, print media, external source links, no broken in-page anchors, and no horizontal scrolling.

- [ ] **Step 2: Run browser tests red/green**

Run:

```bash
npx playwright install chromium
npm run visual:verify
```

Fix only product defects demonstrated by failures, then rerun until PASS.

- [ ] **Step 3: Capture and inspect visual evidence**

Capture the full page and representative evidence sections at 390×844, 1440×1000, and 1920×1080. Inspect each image for clipping, unreadable copy, accidental empty space, focus obscuration, misleading charts, and archival imagery contrast. Record every checked viewport and any accepted limitation in `docs/VISUAL-VERIFICATION.md`.

- [ ] **Step 4: Verify external sources**

Fetch each source with a descriptive user agent, require an HTTP success or stable redirect, and record status, final URL, and checked timestamp. Fail on missing source IDs and network errors in online verification mode.

- [ ] **Step 5: Write the editorial guide**

Explain the intended reading sequence, where to open methodology details, which claims require qualification, and which metrics must not be presented as framework-only or historical results.

- [ ] **Step 6: Run the full local gate and commit**

```bash
npm test
npm run evidence:verify
npm run build
npm run visual:verify
tsx scripts/verify-sources.ts
```

Expected: every command exits zero; visual report lists all three viewports.

Commit:

```bash
git add .
git commit -m "test: verify case-study accessibility and evidence"
```

### Task 9: Create, save, publish, and inspect the Sites deployment

**Files:**
- Modify: `/Users/johan/dev/lb-rewrite-case-study/.openai/hosting.json`

**Interfaces:**
- Consumes: a clean pushed commit containing the exact validated site.
- Produces: one Sites project ID persisted unchanged in `.openai/hosting.json`.
- Produces: a saved version and production deployment URL.

- [ ] **Step 1: Read the hosting skill and project configuration**

Read the complete `sites-hosting` skill and `.openai/hosting.json`. Confirm no `project_id` exists before creating the project. Never invent or transform Sites IDs.

- [ ] **Step 2: Create the Sites project exactly once**

Call `sites_create_site` with an internal Swedish title and description. Persist the returned opaque ID as `project_id` in `.openai/hosting.json`. Keep access public/unlisted because the user requested security by obscurity rather than authentication.

- [ ] **Step 3: Create and push the exact source repository state**

Use the Sites source-repository tool once, configure its returned remote without printing credentials, commit the persisted hosting configuration, and push the exact commit that will be packaged.

Verify:

```bash
git status --short
git rev-parse HEAD
git ls-remote --heads sites
```

Expected: clean tree and remote branch at the exact local commit.

- [ ] **Step 4: Save the validated version**

Create the source archive from the pushed commit, not the mutable working directory. Call `sites_save_site_version` with the exact pushed `commit_sha` and archive. Record the returned immutable version number.

- [ ] **Step 5: Deploy and wait for terminal success**

Call `sites_deploy_site_version` for the saved version. If status is non-terminal, poll with `sites_get_deployment_status` until success or a concrete failure.

- [ ] **Step 6: Inspect the published deployment**

Open the production URL once. Verify:

- Swedish title and hero copy;
- `noindex, nofollow`;
- direct `#prestanda` navigation;
- source links;
- comparison controls;
- reduced-motion behavior;
- no horizontal overflow at mobile width;
- desktop and projector layout;
- print stylesheet;
- worker logs contain no application errors.

- [ ] **Step 7: Run final verification-before-completion**

Freshly run:

```bash
npm test
npm run evidence:verify
npm run build
npm run visual:verify
```

Confirm the published deployment points at the saved version whose source commit matches `git rev-parse HEAD`.

- [ ] **Step 8: Stop the retained development server and hand off**

Stop the retained development server only after publication succeeds. Return the production Sites URL as the primary deliverable, plus a concise note that it is unlisted/no-index but not authenticated.
