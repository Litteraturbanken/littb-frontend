# Hydration Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one privacy-safe `browser.hydration_error` event from Vue's initial hydration through Nuxt's signed intake to the generated FastAPI contract.

**Architecture:** FastAPI remains the schema authority and adds one discriminated browser event. Nuxt regenerates the client, recognizes the event in its compact browser intake, and installs a short-lived hydration observer that chains Vue's warning handler and restores a temporary `console.error` wrapper after `app:mounted`. No diagnostic text leaves the browser.

**Tech Stack:** Python 3.11, FastAPI, Pydantic 2, OpenAPI, TypeScript 5.9, Nuxt 4.4, Vue 3.5, Vitest 4, Playwright 1.61.

**Spec:** `docs/superpowers/specs/2026-08-19-stage-artifact-promotion-production-observability-design.md`

## Global Constraints

- Backend repository: `/Users/johan/dev/lb-backend`.
- Frontend repository: `/Users/johan/.codex/worktrees/8c5c/littb`.
- Record `git status --short` and targeted diffs before each task.
- Never stash, reset, clean, overwrite, or commit unrelated backend work.
- The browser sends only event ID, event name, `HydrationMismatch`, `document`, and an optional opaque correlation token.
- Never send console text, HTML, DOM text, props, URL/query, stack, user agent, IP, cookie, or selected text.
- Preserve the original Vue warning handler and console call exactly.
- Restore temporary console interception after initial `app:mounted`.
- Follow RED/GREEN TDD and commit each repository independently.
- Do not deploy.

---

### Task 1: Extend the Backend Event Contract

**Files:**
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/observability_models.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_observability_models.py`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_observability_api.py`
- Modify: `/Users/johan/dev/lb-backend/openapi/v2.json`

**Interfaces:**
- Produces: `BrowserHydrationErrorEvent` discriminated by `event_name == "browser.hydration_error"`.
- Produces: generated OpenAPI schema consumed by frontend Task 2.

- [ ] **Step 1: Capture the backend baseline and protected paths**

```bash
cd /Users/johan/dev/lb-backend
git status --short
git diff -- lbapi/v2/observability_models.py \
  test_lbapi/v2/test_observability_models.py \
  test_lbapi/v2/test_observability_api.py openapi/v2.json
```

Expected: record any existing path-specific changes. Stop if an intended path already contains unrelated edits that cannot be isolated by hunk.

- [ ] **Step 2: Write the failing model and intake tests**

Add `browser.hydration_error` to `EXPECTED_EVENT_NAMES`. Add a payload derived from `_request_event_payload()` with:

```python
{
    "event_name": "browser.hydration_error",
    "event_kind": "error",
    "service": "lb-frontend",
    "producer": "browser",
    "error_type": "HydrationMismatch",
    "attributes": {"component": None, "resource_kind": "document"},
}
```

Assert `TypeAdapter(ObservabilityEvent)` returns a distinct hydration event and rejects extra `message`, `html`, `url`, and `stack` fields. In `test_observability_api.py`, sign the same event and assert status `202`, one emitted event, and exact event name/type/resource kind.

- [ ] **Step 3: Run RED**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/pytest -q \
  test_lbapi/v2/test_observability_models.py \
  test_lbapi/v2/test_observability_api.py
```

Expected: FAIL because the event is absent from the catalog/discriminated union.

- [ ] **Step 4: Add the minimal Pydantic event**

Add the catalog name and this class beside the existing browser event classes:

```python
class BrowserHydrationErrorEvent(ObservabilityEventBase):
    """Represent a sanitized Vue hydration mismatch."""

    event_name: Literal["browser.hydration_error"]
    event_kind: Literal["error"]
    attributes: BrowserErrorAttributes
```

Add `BrowserHydrationErrorEvent` to `ObservabilityEvent`. Do not add attributes or loosen `ErrorType`.

- [ ] **Step 5: Run GREEN and regenerate OpenAPI**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/pytest -q \
  test_lbapi/v2/test_observability_models.py \
  test_lbapi/v2/test_observability_api.py \
  test_lbapi/v2/test_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py --check
virtual_env/bin/ruff check lbapi/v2/observability_models.py \
  test_lbapi/v2/test_observability_models.py \
  test_lbapi/v2/test_observability_api.py
virtual_env/bin/ruff format --check lbapi/v2/observability_models.py \
  test_lbapi/v2/test_observability_models.py \
  test_lbapi/v2/test_observability_api.py
```

Expected: all commands pass and the OpenAPI diff contains only the new event schema/union mapping.

- [ ] **Step 6: Commit the backend contract explicitly**

```bash
cd /Users/johan/dev/lb-backend
git add lbapi/v2/observability_models.py \
  test_lbapi/v2/test_observability_models.py \
  test_lbapi/v2/test_observability_api.py openapi/v2.json
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(observability): classify hydration failures"
```

Expected: exactly four intended paths are committed; pre-existing user files remain untouched.

### Task 2: Regenerate the Frontend Contract and Compact Intake

**Files:**
- Modify: `nuxt/app/lib/api/generated/lbapi.ts`
- Modify: `nuxt/app/lib/observability/events.ts`
- Modify: `nuxt/app/lib/observability/browser.ts`
- Modify: `nuxt/server/utils/observability-intake.ts`
- Modify: `nuxt/test/unit/observability-contract.spec.ts`
- Modify: `nuxt/test/unit/observability-browser.spec.ts`
- Modify: `nuxt/test/unit/observability-intake.spec.ts`
- Modify: `nuxt/test/ssr/observability-api.spec.ts`

**Interfaces:**
- Consumes: backend `BrowserHydrationErrorEvent` OpenAPI schema.
- Produces: `BrowserEventName` including `browser.hydration_error`.
- Produces: compact intake tuple `browser.hydration_error` / `HydrationMismatch` / `document`.

- [ ] **Step 1: Regenerate from the exact backend snapshot**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
LB_BACKEND_DIR=/Users/johan/dev/lb-backend invoke codegen.generate
cd nuxt
yarn api:check
```

Expected: generated TypeScript changes only for the new backend event.

- [ ] **Step 2: Write failing frontend boundary tests**

In `observability-contract.spec.ts`, define:

```ts
type HydrationEvent = Extract<
  ObservabilityEvent,
  { event_name: "browser.hydration_error" }
>
```

Construct a valid event with `error_type: "HydrationMismatch"` and `resource_kind: "document"`. Assert a raw diagnostic key is a compile-time error. Extend browser reporter and intake tests to enqueue/accept the compact event and reject the same event with any other error type or resource kind. Extend SSR intake to assert the forwarded trusted event contains no diagnostic field.

- [ ] **Step 3: Run RED**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn vitest run \
  test/unit/observability-contract.spec.ts \
  test/unit/observability-browser.spec.ts \
  test/unit/observability-intake.spec.ts --reporter=verbose
yarn playwright test test/ssr/observability-api.spec.ts \
  --project=ssr --workers=1 --grep "hydration"
```

Expected: generated type exists, but compact browser/intake allowlists reject or normalize the new event.

- [ ] **Step 4: Add exact allowlist support**

Add `BrowserHydrationErrorEvent` to `BrowserEvent` in `events.ts`. Add `browser.hydration_error` to both browser event-name sets and `HydrationMismatch` to both error-type sets. In intake validation, require this exact pair to use `resource_kind === "document"`; existing event combinations remain unchanged.

Use one shared predicate per side:

```ts
function validHydrationClassification(
  eventName: BrowserEventName,
  errorType: string,
  resourceKind: string
): boolean {
  if (eventName === "browser.hydration_error") {
    return errorType === "HydrationMismatch" && resourceKind === "document"
  }

  return errorType !== "HydrationMismatch"
}
```

This is a bidirectional classification boundary: hydration events must use the exact hydration type/document tuple, and no other event may claim `HydrationMismatch`.

- [ ] **Step 5: Run GREEN**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn vitest run \
  test/unit/observability-contract.spec.ts \
  test/unit/observability-browser.spec.ts \
  test/unit/observability-intake.spec.ts --reporter=verbose
yarn playwright test test/ssr/observability-api.spec.ts \
  --project=ssr --workers=1
yarn typecheck
```

Expected: focused units, complete observability SSR intake, and typecheck pass.

- [ ] **Step 6: Commit the generated boundary**

```bash
git add nuxt/app/lib/api/generated/lbapi.ts \
  nuxt/app/lib/observability/events.ts \
  nuxt/app/lib/observability/browser.ts \
  nuxt/server/utils/observability-intake.ts \
  nuxt/test/unit/observability-contract.spec.ts \
  nuxt/test/unit/observability-browser.spec.ts \
  nuxt/test/unit/observability-intake.spec.ts \
  nuxt/test/ssr/observability-api.spec.ts
git diff --cached --check
git commit -m "feat(observability): accept hydration events"
```

### Task 3: Install a Bounded Initial-Hydration Observer

**Files:**
- Create: `nuxt/app/lib/observability/hydration.ts`
- Modify: `nuxt/app/plugins/observability.client.ts`
- Create: `nuxt/test/unit/observability-hydration.spec.ts`
- Modify: `nuxt/test/unit/observability-browser.spec.ts`

**Interfaces:**
- Produces: `isHydrationDiagnostic(value: unknown): boolean`.
- Produces: `installHydrationObserver(options: HydrationObserverOptions): () => void`.
- Consumes: `BrowserObservabilityReporter.capture(error, metadata)`.

- [ ] **Step 1: Write classifier and lifecycle RED tests**

Test these diagnostics as true:

```ts
[
  "Hydration completed but contains mismatches.",
  "Hydration text mismatch in",
  "Hydration children mismatch on",
  "Hydration text content mismatch on",
  "Hydration node mismatch:"
]
```

Test nearby Nuxt guidance such as `"this will cause hydration errors"`, generic warnings, objects, and errors as false. With fake Vue config/console/onMounted, assert:

- previous `warnHandler` is called with the original `this` and arguments;
- original `console.error` is called with the original `this` and arguments;
- warning plus terminal error emits one callback;
- non-hydration calls emit zero;
- mounted cleanup restores exact handler/method identities;
- explicit cleanup is idempotent.

- [ ] **Step 2: Run RED**

```bash
cd nuxt
yarn vitest run test/unit/observability-hydration.spec.ts --reporter=verbose
```

Expected: FAIL because `hydration.ts` does not exist.

- [ ] **Step 3: Implement the pure observer**

Use these interfaces:

```ts
import type { AppConfig } from "vue"

type WarnHandler = NonNullable<AppConfig["warnHandler"]>

interface HydrationObserverOptions {
  vueConfig: Pick<AppConfig, "warnHandler">
  consoleObject: Pick<Console, "error">
  onHydration: () => void
  onMounted: (cleanup: () => void) => void
}

export function isHydrationDiagnostic(value: unknown): boolean
export function installHydrationObserver(
  options: HydrationObserverOptions
): () => void
```

Classification is exact terminal equality or a string that starts with `Hydration ` and contains ` mismatch`. The callback takes no diagnostic argument. Preserve and restore the prior handlers, report once, and catch only observer/callback failures so console behavior remains unchanged.

- [ ] **Step 4: Wire the plugin without retaining text**

In plugin setup:

```ts
const hydrationError = new Error()
hydrationError.name = "HydrationMismatch"
installHydrationObserver({
  vueConfig: nuxtApp.vueApp.config,
  consoleObject: console,
  onHydration: () => void reporter.capture(hydrationError, {
    eventName: "browser.hydration_error",
    resourceKind: "document"
  }),
  onMounted: cleanup => nuxtApp.hooks.hookOnce("app:mounted", cleanup)
})
```

Do not pass the warning/error message into `capture`.

- [ ] **Step 5: Run GREEN and privacy assertions**

```bash
cd nuxt
yarn vitest run \
  test/unit/observability-hydration.spec.ts \
  test/unit/observability-browser.spec.ts --reporter=verbose
yarn eslint app/lib/observability/hydration.ts \
  app/plugins/observability.client.ts \
  test/unit/observability-hydration.spec.ts
yarn typecheck
```

Expected: all pass and serialized compact events contain no tested diagnostic text.

- [ ] **Step 6: Commit the observer**

```bash
git add nuxt/app/lib/observability/hydration.ts \
  nuxt/app/plugins/observability.client.ts \
  nuxt/test/unit/observability-hydration.spec.ts \
  nuxt/test/unit/observability-browser.spec.ts
git diff --cached --check
git commit -m "feat(observability): report hydration mismatches"
```

### Task 4: Prove Real Vue Hydration Delivery

**Files:**
- Create: `nuxt/test/e2e/observability-hydration.behavior.spec.ts`
- Modify: `nuxt/test/fixtures/v2-server.mjs`

**Interfaces:**
- Consumes: live client observer and existing fixture observability ledger.
- Produces: one real browser regression proving mismatch, sanitization, and continued rendering.

- [ ] **Step 1: Write the real browser regression**

Intercept the home document, fetch the real response, replace only the known server-rendered home H1 text with `Server-only mismatch sentinel`, and fulfill the modified HTML. Do not modify client JavaScript. Reset the fixture observability ledger first.

Assert after hydration:

```ts
await expect(page.getByRole("heading", { level: 1 })).toHaveText("Litteraturbanken")
expect(forwarded.event_name).toBe("browser.hydration_error")
expect(forwarded.error_type).toBe("HydrationMismatch")
expect(forwarded.attributes.resource_kind).toBe("document")
expect(JSON.stringify(forwarded)).not.toContain("mismatch sentinel")
```

Also assert exactly one forwarded hydration event and no page exception.

- [ ] **Step 2: Prove test authority**

Temporarily disable the plugin observer registration and run:

```bash
cd nuxt
yarn playwright test test/e2e/observability-hydration.behavior.spec.ts \
  --project=desktop-chromium --workers=1 --reporter=line
```

Expected: FAIL because the ledger has zero hydration events. Restore the observer immediately.

- [ ] **Step 3: Run GREEN**

```bash
cd nuxt
yarn playwright test test/e2e/observability-hydration.behavior.spec.ts \
  --project=desktop-chromium --workers=1 --reporter=line
```

Expected: 1 passed, no application failure, exactly one sanitized event.

- [ ] **Step 4: Run broad frontend and backend gates**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/pytest -q test_lbapi/v2/test_observability_models.py \
  test_lbapi/v2/test_observability_api.py test_lbapi/v2/test_openapi.py

cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
yarn test:ssr --reporter=dot
yarn lint
yarn typecheck
yarn policy:check
yarn quality:maintainability
yarn build
```

Expected: every command exits zero.

- [ ] **Step 5: Commit browser authority and review both repositories**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git add nuxt/test/e2e/observability-hydration.behavior.spec.ts \
  nuxt/test/fixtures/v2-server.mjs
git diff --cached --check
git commit -m "test(observability): prove hydration reporting"
```

Review exact backend and frontend commit ranges. Fix every Critical/Important finding before continuing to the production-observability plan.
