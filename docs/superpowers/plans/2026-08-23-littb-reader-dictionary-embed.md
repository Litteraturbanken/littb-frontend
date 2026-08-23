# Litteraturbanken Reader Dictionary Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Reader's default SO 2009 lookup with the approved `svenska.se` SO/SAOB embed while retaining an explicit legacy rollback mode.

**Architecture:** The Reader keeps its selection indicator and modal ownership. A focused composable owns the fixed-origin iframe session, timeout, stale-request invalidation, and validated message protocol; the existing backend lookup remains reachable only when runtime mode is `legacy`.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript 5.9, Headless UI, Vitest, Playwright, Nitro, FastAPI OpenAPI client, Nomad.

**Spec:** `/Users/johan/.codex/worktrees/8c5c/littb/docs/superpowers/specs/2026-08-23-reader-svenska-dictionary-embed-design.md`

## Global Constraints

- Execute after the observability-contract plan and after the public `svenska.se` embed route are available.
- Keep selected words out of telemetry and cross-window messages.
- Accept messages only from the configured exact origin, current iframe window, protocol version 1, and active request ID.
- Stage and production use `https://svenska.se`; do not iframe authenticated `stage.svenska.se`.
- Runtime mode is exactly `embed` or `legacy`; invalid values fail closed to `legacy`.
- The iframe sandbox begins with `allow-scripts allow-same-origin` only.
- Preserve Reader selection, route invalidation, modal focus restoration, and body scroll locking.
- Complete local backend, contract, frontend, E2E, maintainability, and semantic-review gates before staging.

---

### Task 1: Regenerate and accept dictionary outcome telemetry

**Files:**
- Regenerate: `nuxt/app/lib/api/generated/lbapi.ts`
- Create: `nuxt/app/lib/observability/dictionary-lookup.ts`
- Modify: `nuxt/server/utils/observability-intake.ts`
- Modify: `nuxt/test/unit/observability-intake.spec.ts`
- Create: `nuxt/test/unit/dictionary-lookup-observability.spec.ts`
- Modify: `nuxt/test/nuxt/observability-contract.ts`

**Interfaces:**
- Consumes: backend `DictionaryLookupAttributes.outcome` and `.selected_dictionary` from the observability plan.
- Produces: `reportDictionaryLookupOutcome` and a strict browser-intake union accepted by `/_observability/events`.

- [ ] **Step 1: Regenerate the client from the exact backend commit**

Start the isolated backend worktree at port 8000, then run from `nuxt/`:

```bash
LBAPI_OPENAPI_SCHEMA=http://127.0.0.1:8000/v2/openapi.json yarn api:generate
```

Expected: only `DictionaryLookupAttributes.outcome` and
`DictionaryLookupAttributes.selected_dictionary` are added to the generated dictionary
event schema.

- [ ] **Step 2: Write failing intake and reporter tests**

Assert a minimal browser payload:

```ts
{
  events: [{
    event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e",
    event_name: "business.dictionary_lookup",
    word_length: 7,
    outcome: "both",
    selected_dictionary: "so",
    duration_ms: 125
  }]
}
```

is converted by Nitro into a signed full event with `service: "lb-frontend"`,
`producer: "browser"`, `found: true`, and no word/query/URL. Add rejection cases for
unknown outcomes, `saol`, extra fields, word lengths outside 1-100, negative/oversized
durations, and mixed private data.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
yarn vitest run test/unit/observability-intake.spec.ts test/unit/dictionary-lookup-observability.spec.ts
```

Expected: the intake rejects the business event and the reporter module is absent.

- [ ] **Step 4: Implement the narrow reporter and trusted adapter**

Use these types:

```ts
export type DictionaryLookupOutcome =
  | "opened" | "so" | "saob" | "both" | "empty" | "child_error" | "timeout"
export type DictionaryLookupSelection = "so" | "saob" | null

export function reportDictionaryLookupOutcome(options: {
  durationMs: number
  endpoint?: string
  fetch?: typeof globalThis.fetch
  outcome: DictionaryLookupOutcome
  selectedDictionary: DictionaryLookupSelection
  wordLength: number
}): Promise<void>
```

POST one closed event with `keepalive: true`; swallow delivery failures. Extend the
server intake parser with a discriminated union. Derive `found` as true for
`so|saob|both`, false for `empty`, and null otherwise. The trusted server, not the
browser, supplies timestamp, deployment identity, service, producer, severity, and
signed forwarding envelope.

- [ ] **Step 5: Run contract and focused checks**

```bash
yarn vitest run test/unit/observability-intake.spec.ts test/unit/dictionary-lookup-observability.spec.ts
yarn api:check
npx tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext test/nuxt/observability-contract.ts
yarn lint
```

Expected: all pass.

- [ ] **Step 6: Commit telemetry support**

```bash
git add nuxt/app/lib/api/generated/lbapi.ts nuxt/app/lib/observability/dictionary-lookup.ts nuxt/server/utils/observability-intake.ts nuxt/test/unit/observability-intake.spec.ts nuxt/test/unit/dictionary-lookup-observability.spec.ts nuxt/test/nuxt/observability-contract.ts
git commit -m "feat(observability): ingest Reader dictionary outcomes"
```

### Task 2: Define fixed embed configuration and message validation

**Files:**
- Create: `nuxt/app/lib/reader-dictionary-embed.ts`
- Create: `nuxt/test/unit/reader-dictionary-embed.spec.ts`
- Modify: `nuxt/nuxt.config.ts`
- Modify: `nuxt/test/unit/nuxt-config.spec.ts`

**Interfaces:**
- Produces: `readerDictionaryMode`, `svenskaReaderEmbedOrigin`,
  `buildReaderDictionaryEmbedUrl`, `buildSvenskaDictionaryUrl`, and
  `parseReaderLookupMessage`.

- [ ] **Step 1: Write failing configuration and protocol tests**

Cover:

```ts
expect(readerDictionaryMode("embed")).toBe("embed")
expect(readerDictionaryMode("unexpected")).toBe("legacy")
expect(svenskaReaderEmbedOrigin("https://svenska.se/path")).toBeNull()
expect(buildReaderDictionaryEmbedUrl({
  origin: "https://svenska.se",
  requestId,
  word: "förgås"
})).toBe(`https://svenska.se/embed/reader?word=f%C3%B6rg%C3%A5s&requestId=${requestId}`)
expect(buildSvenskaDictionaryUrl("https://svenska.se", "förgås"))
  .toBe("https://svenska.se/?q=f%C3%B6rg%C3%A5s&activeTab=alla&exactMatch=true")
```

Message tests reject wrong origin/source in the caller, wrong type/version/request ID,
duplicate or unknown dictionaries, `saol`, extra fields, and any word/URL/HTML property.

- [ ] **Step 2: Run tests and confirm failure**

Run: `yarn vitest run test/unit/reader-dictionary-embed.spec.ts test/unit/nuxt-config.spec.ts`

Expected: missing module/config assertions fail.

- [ ] **Step 3: Implement closed configuration**

Add public runtime values:

```ts
readerDictionaryMode: process.env.NUXT_PUBLIC_READER_DICTIONARY_MODE || "legacy",
svenskaReaderEmbedOrigin:
  process.env.NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN || "https://svenska.se",
```

The helper requires an origin-only HTTPS URL in non-development use and a UUID request
ID. It normalizes no arbitrary path and accepts no source from route/query/API data.

- [ ] **Step 4: Run focused tests, typecheck, and policy**

```bash
yarn vitest run test/unit/reader-dictionary-embed.spec.ts test/unit/nuxt-config.spec.ts
yarn typecheck
yarn policy:check
```

Expected: all pass.

- [ ] **Step 5: Commit the configuration boundary**

```bash
git add nuxt/app/lib/reader-dictionary-embed.ts nuxt/test/unit/reader-dictionary-embed.spec.ts nuxt/nuxt.config.ts nuxt/test/unit/nuxt-config.spec.ts
git commit -m "feat(reader): configure trusted Svenska embed"
```

### Task 3: Implement the iframe session lifecycle

**Files:**
- Create: `nuxt/app/composables/useReaderDictionaryEmbed.ts`
- Create: `nuxt/test/unit/reader-dictionary-embed-lifecycle.spec.ts`

**Interfaces:**
- Consumes: Task 2 URL/message helpers and Task 1 telemetry reporter.
- Produces: `start(word)`, `close()`, `frame`, `session`, `status`, `handleMessage`, and `handleFrameLoad`.

- [ ] **Step 1: Write failing lifecycle tests with fake timers**

Test that `start("hund")` creates a UUID-correlated URL, reports `opened`, and enters
`loading`; a valid `result` enters `result`; `empty`/`error` enter terminal states;
eight seconds without a valid terminal message becomes `timeout`; a newer start, close,
route change, wrong origin, wrong frame window, or stale request ID makes late messages
no-ops; every terminal path clears its timer.

- [ ] **Step 2: Run the lifecycle test and confirm failure**

Run: `yarn vitest run test/unit/reader-dictionary-embed-lifecycle.spec.ts`

Expected: missing composable failure.

- [ ] **Step 3: Implement the composable**

Use this public state:

```ts
type EmbedStatus = "closed" | "loading" | "result" | "empty" | "error" | "timeout"
type EmbedSession = {
  requestId: string
  startedAt: number
  src: string
  word: string
}
```

Register one `window.message` listener on mount and remove it on unmount. Verify
`event.origin`, `event.source === frame.value?.contentWindow`, parsed envelope, and active
request ID before mutation. Report `opened` and one terminal outcome only; map result
payloads to `so`, `saob`, or `both` and preserve the child's selected dictionary.

- [ ] **Step 4: Run focused quality checks**

```bash
yarn vitest run test/unit/reader-dictionary-embed-lifecycle.spec.ts test/unit/reader-dictionary-embed.spec.ts test/unit/dictionary-lookup-observability.spec.ts
yarn lint
yarn typecheck
yarn quality:maintainability
```

Expected: all pass and no new maintainability finding.

- [ ] **Step 5: Commit lifecycle**

```bash
git add nuxt/app/composables/useReaderDictionaryEmbed.ts nuxt/test/unit/reader-dictionary-embed-lifecycle.spec.ts
git commit -m "feat(reader): manage dictionary iframe lifecycle"
```

### Task 4: Integrate the embed into the existing Reader modal

**Files:**
- Modify: `nuxt/app/components/reader/ReaderDictionaryLookup.vue`
- Modify: `nuxt/app/components/reader/ReaderDictionaryDialog.vue`
- Modify: `nuxt/app/assets/styles/nuxt.scss`
- Modify: `nuxt/test/unit/reader-dictionary.spec.ts`

**Interfaces:**
- Consumes: Task 3 lifecycle; retains the current legacy API and sanitized HTML path.
- Produces: embed-first modal UI with explicit runtime rollback.

- [ ] **Step 1: Add failing component-level assertions**

Extend Reader dictionary tests to assert the source contains the configured mode branch,
the dialog iframe has:

```html
sandbox="allow-scripts allow-same-origin"
referrerpolicy="origin"
```

and an accessible title `Slå upp <word> i SO och SAOB`. Assert loading uses `role=status`,
empty uses `Hittade inget uppslag`, unavailable/timeout use `Ordboken kunde inte laddas`,
the parent fallback links to
`https://svenska.se/?q=<encoded-word>&activeTab=alla&exactMatch=true`, and the close
button remains initial focus.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `yarn vitest run test/unit/reader-dictionary.spec.ts test/unit/reader-dictionary-embed-lifecycle.spec.ts`

Expected: iframe/modal assertions fail.

- [ ] **Step 3: Wire embed mode without disturbing selection behavior**

Keep `showIndicator`, delayed selection inspection, double-click recovery, and document
listeners unchanged. In `lookup()`, branch once on validated runtime mode:

```ts
if (mode === "embed") {
  embed.start(selected.word)
  return
}
await lookupLegacy(selected.word)
```

Route changes and unmount call both legacy cancellation and `embed.close()`. Modal open
is true for a live embed session or valid legacy article. Change the embed-mode action
label to `Slå upp ${word} i SO och SAOB`; retain the legacy label in rollback mode.

- [ ] **Step 4: Render responsive modal states**

The dialog accepts a discriminated prop union for `legacy` and `embed`. Embed mode shows
the generic title `Slå upp ord`, loading/status text, and the iframe only after a valid
session exists. Keep the iframe mounted through child `empty`/`error` so its own visible
state remains authoritative, while parent status supplies a fallback if no child is
reachable. Use a bounded `min(72vh, 760px)` content height with internal iframe scrolling.

- [ ] **Step 5: Run focused tests and maintainability**

```bash
yarn vitest run test/unit/reader-dictionary.spec.ts test/unit/reader-dictionary-embed*.spec.ts
yarn lint
yarn typecheck
yarn quality:maintainability
```

Expected: all pass.

- [ ] **Step 6: Commit Reader UI integration**

```bash
git add nuxt/app/components/reader/ReaderDictionaryLookup.vue nuxt/app/components/reader/ReaderDictionaryDialog.vue nuxt/app/assets/styles/nuxt.scss nuxt/test/unit/reader-dictionary.spec.ts
git commit -m "feat(reader): show current SO and SAOB lookup"
```

### Task 5: Add deterministic cross-origin browser coverage

**Files:**
- Modify: `nuxt/test/fixtures/v2-server.mjs`
- Modify: `nuxt/playwright.config.ts`
- Modify: `nuxt/test/unit/playwright-config.spec.ts`
- Modify: `nuxt/test/e2e/reader-production.behavior.spec.ts`
- Modify: `nuxt/test/e2e/reader-assets-production.behavior.spec.ts`
- Modify: `nuxt/playwright.reader-assets-production.config.ts`
- Verify: `nuxt/playwright.dictionary-production.config.ts`
- Verify: `nuxt/test/e2e/reader-dictionary-production.behavior.spec.ts`

**Interfaces:**
- Consumes: fixture origin as a real cross-origin iframe source.
- Produces: deterministic browser tests for success, failure, stale messages, timeout, focus, mobile, and legacy rollback.

- [ ] **Step 1: Add a fixture embed page and ledger**

Add `GET /svenska-embed/reader` that validates `word` and `requestId`, renders a small
SO/SAOB tab document, and posts a configurable protocol message to the referrer origin.
Add reset/read endpoints for an embed request ledger. Never interpolate unescaped query
values into HTML; serialize fixture values through `JSON.stringify` and HTML-escape
visible text.

- [ ] **Step 2: Configure normal suites for embed mode**

Add to development and reader-assets production server commands:

```text
NUXT_PUBLIC_READER_DICTIONARY_MODE=embed
NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN=http://127.0.0.1:<fixture-port>
```

Keep `playwright.dictionary-production.config.ts` explicitly in `legacy` mode so the old
private backend proxy remains a tested rollback path.

- [ ] **Step 3: Rewrite Reader behavior tests around frame messages**

Replace assertions about `._so_article` and `/api/v2/dictionary/articles` with assertions
about the titled iframe, its `frameLocator`, SO/SAOB tabs, empty and unavailable states,
body modal class, close focus, newer-lookup wins, and route-change invalidation. Add a
forged-message test from the parent origin and a stale request-ID test. Keep existing OCR,
manual selection, and keyboard-created selection coverage.

- [ ] **Step 4: Add timeout and mobile scrolling tests**

Configure the fixture not to post for one word. Install Playwright's page clock before
opening the modal, call `page.clock.fastForward(8_001)`, and assert the timeout state
without a wall-clock sleep. In the mobile project, assert the modal fits the viewport,
the iframe scrolls internally, and the Reader page behind it does not scroll.

- [ ] **Step 5: Run focused browser suites**

```bash
yarn playwright test test/e2e/reader-production.behavior.spec.ts --project=desktop-chromium --project=mobile-chromium
yarn playwright test --config=playwright.reader-assets-production.config.ts
yarn playwright test --config=playwright.dictionary-production.config.ts
```

Expected: embed suites pass without hitting the legacy dictionary endpoint; the explicit
legacy config still proves the backend proxy.

- [ ] **Step 6: Commit browser coverage**

```bash
git add nuxt/test/fixtures/v2-server.mjs nuxt/playwright.config.ts nuxt/test/unit/playwright-config.spec.ts nuxt/test/e2e/reader-production.behavior.spec.ts nuxt/test/e2e/reader-assets-production.behavior.spec.ts nuxt/playwright.reader-assets-production.config.ts nuxt/playwright.dictionary-production.config.ts nuxt/test/e2e/reader-dictionary-production.behavior.spec.ts
git commit -m "test(reader): cover cross-origin dictionary embed"
```

### Task 6: Configure stage and production rollback controls

**Files:**
- Modify: `jobs/lb-frontend-stage.nomad`
- Modify: `nuxt/test/unit/stage-deployment.spec.ts`
- Modify in `/Users/johan/dev/lb-infra`: `jobs/lb-frontend-live.nomad`
- Modify in `/Users/johan/dev/lb-infra`: `tests/test_lb_frontend_live_job.py`

**Interfaces:**
- Produces: `embed` mode with public `https://svenska.se` origin in stage and production; `legacy` remains an explicit config rollback.

- [ ] **Step 1: Write failing jobspec assertions**

Assert both stage and live jobs contain exactly:

```text
NUXT_PUBLIC_READER_DICTIONARY_MODE       = "embed"
NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN = "https://svenska.se"
```

Assert neither contains `stage.svenska.se`, a wildcard, or a user-controlled variable.

- [ ] **Step 2: Run deployment tests and confirm failure**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt && yarn vitest run test/unit/stage-deployment.spec.ts
cd /Users/johan/dev/lb-infra && uv run pytest -q tests/test_lb_frontend_live_job.py
```

Expected: missing environment-variable assertions fail.

- [ ] **Step 3: Add fixed stage and live environment values**

Add the exact values from Step 1 to each frontend task. Update closed environment-name
inventory assertions. Do not modify the existing artifact promotion, image digest, or
observability secret paths.

- [ ] **Step 4: Run deployment tests**

Repeat Step 2.

Expected: all selected deployment tests pass.

- [ ] **Step 5: Commit each repository independently**

In `littb`:

```bash
git add jobs/lb-frontend-stage.nomad nuxt/test/unit/stage-deployment.spec.ts
git commit -m "deploy(reader): enable Svenska dictionary embed on stage"
```

In an isolated `lb-infra` worktree, because its main checkout is dirty:

```bash
git add jobs/lb-frontend-live.nomad tests/test_lb_frontend_live_job.py
git commit -m "deploy(reader): enable Svenska dictionary embed in production"
```

### Task 7: Complete gates, staging review, and rollback rehearsal

**Files:**
- Verify only: all files changed by Tasks 1-6.

**Interfaces:**
- Produces: stage-approved artifacts and a rehearsed rollback command/configuration.

- [ ] **Step 1: Run the complete Litteraturbanken local release gate**

From the `littb` root, run: `invoke quality.release`

Expected: backend, generated contract, policy, lint, maintainability, semantic review,
typecheck, unit, build, SSR, behavior, visual, and flake gates all pass.

- [ ] **Step 2: Run the production-build specialty suites**

```bash
cd nuxt
yarn playwright test --config=playwright.reader-assets-production.config.ts
yarn playwright test --config=playwright.dictionary-production.config.ts
```

Expected: both embed artifact behavior and legacy rollback proxy behavior pass.

- [ ] **Step 3: Deploy the Litteraturbanken artifact to stage**

Run the existing `scripts/deploy-stage.sh` workflow from the clean reviewed commit.

Expected: both allocations become healthy and `/_deployment` reports the expected commit and image digest.

- [ ] **Step 4: Perform cross-site smoke checks**

On `https://stage.litteraturbanken.se`, verify `hund`, a currently confirmed SAOB-only
word, and a no-result token. Check SO-first tabs, SAOB automatic fallback, q-links,
keyboard close/focus restoration, mobile internal scrolling, CSP/frame console output,
and absence of hydration errors. Confirm the iframe source is `https://svenska.se`, not
`stage.svenska.se`.

- [ ] **Step 5: Verify privacy-safe telemetry**

Inspect the structured event stream for `business.dictionary_lookup` outcomes
`opened`, `both`, `saob`, and `empty`. Confirm `selected_dictionary` is bounded and the
selected words do not occur in event JSON, routes, fingerprints, or error details.

- [ ] **Step 6: Rehearse rollback on stage**

Set `NUXT_PUBLIC_READER_DICTIONARY_MODE=legacy` in a temporary stage jobspec run using
the same image digest, redeploy, and run the existing legacy dictionary production test.
Restore `embed` using the same digest and confirm the iframe returns. Record both Nomad
deployment evaluations in the release notes.

- [ ] **Step 7: Hand off production promotion**

Provide the editorial reviewers with the stage URLs, tested words, deployed SHAs for
`lb-backend`, `svenska.se`, `littb`, and `lb-infra`, image digests, gate outputs, observed
telemetry, and the one-line rollback setting. Production promotion uses only those
reviewed artifacts.
