# LB Unified Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task by task. Use `superpowers:test-driven-development` for each behavior change and `superpowers:verification-before-completion` before every completion claim.

**Goal:** Deliver a privacy-safe, correlated observability pipeline for the browser, Nuxt server, FastAPI backend, Vector, OpenSearch, Prometheus, Grafana, NATS, and the existing Slack review workflow, with repeatable staging proof.

**Architecture:** Applications emit a typed `lb.observability.v1` envelope with W3C trace context and request IDs. Browser events enter through a constrained same-origin Nuxt endpoint and an HMAC-authenticated FastAPI endpoint. Vector 0.57 validates and redacts application JSON, derives complete metrics, samples only ordinary success documents, writes to a lifecycle-managed OpenSearch alias, and exposes pipeline health to Prometheus. Grafana provisions a unified dashboard and alerts through the existing NATS/Slack relay.

**Technology:** Nuxt 4/H3/Vue, TypeScript, FastAPI/Pydantic, Python structured logging, OpenAPI code generation, Vector VRL, OpenSearch ISM, Prometheus, Grafana file provisioning, Nomad, NATS, Slack.

**Design:** `docs/superpowers/specs/2026-07-29-lb-unified-observability-design.md`

## Repository and Safety Rules

- Frontend: `/Users/johan/.codex/worktrees/8c5c/littb`
- Backend: `/Users/johan/dev/lb-backend`
- Infrastructure: `/Users/johan/dev/lb-infra`
- Preserve every pre-existing dirty backend and infrastructure change. Record `git status --short` and targeted diffs before editing; never stash, reset, or overwrite user work.
- Commit only the files or hunks belonging to the task being completed.
- Never commit a Slack token, HMAC key, OpenSearch password, or a generated decrypted secret.
- Do not deploy an unvalidated Nomad job. Follow the staging gateway/service registration conventions in `lb-nomad-job-ops`.

## Task 1: Define the Closed Backend Event Contract

**Files:**

- Create: `/Users/johan/dev/lb-backend/lbapi/v2/observability_models.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_observability_models.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/models.py`

**Step 1: Write failing model tests**

Cover the `lb.observability.v1` envelope, all enums, UUID/hex identifier constraints, UTC timestamps, route-template constraints, the initial event catalog, and event-specific closed attribute models. Assert that raw URL/query/body/IP/user-agent keys, unknown event names, and unknown attributes fail validation.

Run:

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/pytest -q test_lbapi/v2/test_observability_models.py
```

Expected: FAIL because the models do not exist.

**Step 2: Implement the smallest closed Pydantic contract**

Use `ConfigDict(extra="forbid")` on every public object. Model `event_name` and `attributes` as a discriminated union so OpenAPI and generated TypeScript retain event-specific static types. Include helpers for normalized error fingerprints without accepting raw stack text as an indexed field.

**Step 3: Prove the contract and public-schema closure**

Run:

```bash
virtual_env/bin/pytest -q test_lbapi/v2/test_observability_models.py test_lbapi/v2/test_openapi.py
virtual_env/bin/ruff check lbapi/v2/observability_models.py test_lbapi/v2/test_observability_models.py
virtual_env/bin/ruff format --check lbapi/v2/observability_models.py test_lbapi/v2/test_observability_models.py
```

Expected: PASS.

**Step 4: Commit**

```bash
git add lbapi/v2/observability_models.py lbapi/v2/models.py test_lbapi/v2/test_observability_models.py
git commit -m "feat(api): define typed observability events"
```

## Task 2: Add FastAPI Correlation and Structured Logging

**Files:**

- Create: `/Users/johan/dev/lb-backend/lbapi/observability.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/test_observability_middleware.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/web.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/app.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/models.py`

**Step 1: Write failing ASGI middleware tests**

Assert that a request without headers gets `X-Request-ID` and a valid W3C trace ID, a request with valid context preserves it, invalid/oversized values are replaced, Nuxt and FastAPI span IDs differ, and one JSON completion/failure line is emitted without query strings or request bodies. Assert typed API errors include the request ID.

Run:

```bash
virtual_env/bin/pytest -q test_lbapi/test_observability_middleware.py
```

Expected: FAIL.

**Step 2: Implement pure ASGI correlation middleware**

Use `contextvars` for request/trace/span context, `time.monotonic_ns()` for duration, and a JSON formatter/helper that emits the exact envelope to stdout. Add middleware to the outer app so mounted `/v2` routes share context. Update v2 error responses to include an optional request ID without exposing exception messages.

**Step 3: Verify focused and existing error behavior**

Run:

```bash
virtual_env/bin/pytest -q \
  test_lbapi/test_observability_middleware.py \
  test_lbapi/v2/test_api.py \
  test_lbapi/v2/test_openapi.py
virtual_env/bin/ruff check lbapi/observability.py lbapi/web.py lbapi/v2/app.py lbapi/v2/models.py test_lbapi/test_observability_middleware.py
```

Expected: PASS.

**Step 4: Commit**

Stage only the observability hunks in already-dirty files, inspect the staged diff, then commit:

```bash
git diff --cached --check
git commit -m "feat(api): correlate and structure request logs"
```

## Task 3: Add the Signed Internal Event Intake

**Files:**

- Create: `/Users/johan/dev/lb-backend/lbapi/v2/observability.py`
- Create: `/Users/johan/dev/lb-backend/test_lbapi/v2/test_observability_api.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/v2/app.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/observability.py`
- Modify: `/Users/johan/dev/lb-backend/openapi/v2.json`

**Step 1: Write failing authentication and replay tests**

Test canonical HMAC signing, correct signature, missing/incorrect signature, expired/future timestamp, repeated event IDs, maximum ten-event batch, body-size enforcement at the proxy boundary, validation errors, and fail-safe JSON logging. Use a deterministic test secret; never a real secret.

**Step 2: Implement `POST /v2/internal/observability/events`**

Read the key from a secret file path or injected environment value, compare signatures with `hmac.compare_digest`, enforce a short timestamp window, and keep a bounded TTL replay cache. Mark the route internal and exclude it from public navigation while retaining its schema for code generation. Emit each accepted event as trusted structured JSON.

**Step 3: Refresh and verify OpenAPI**

```bash
virtual_env/bin/pytest -q test_lbapi/v2/test_observability_api.py test_lbapi/v2/test_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py
virtual_env/bin/python scripts/export_v2_openapi.py --check
virtual_env/bin/ruff check lbapi/v2/observability.py test_lbapi/v2/test_observability_api.py
```

Expected: PASS and a deliberate OpenAPI snapshot diff containing only the new contract/operation and request ID field.

**Step 4: Commit**

```bash
git add lbapi/v2/observability.py lbapi/v2/app.py test_lbapi/v2/test_observability_api.py openapi/v2.json
git commit -m "feat(api): accept signed observability events"
```

## Task 4: Migrate Slack Review Events Without Losing the Workflow

**Files:**

- Create: `/Users/johan/dev/lb-backend/test_lbapi/test_review_events.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/web.py`
- Modify: `/Users/johan/dev/lb-backend/lbapi/observability.py`
- Modify: `/Users/johan/dev/lb-backend/jobs/lb-backend-stage.nomad`

**Step 1: Write failing behavior tests**

For page, download, QR, library, quick-search, missing-EPUB, and error reports, assert the typed business event is always emitted. Assert only the existing manually reviewed categories dual-write to their established Slack channels. Assert payloads exclude raw search text, arbitrary query strings, IPs, bodies, and credentials. Assert no Slack call occurs when the secret is absent.

**Step 2: Remove the hard-coded token and centralize delivery**

Read Slack credentials from a mounted secret, instantiate the client lazily, and make Slack delivery best-effort. Replace ad-hoc endpoint dictionaries with typed event helpers. Keep channel names stable for the migration period.

**Step 3: Run focused security regression tests**

```bash
virtual_env/bin/pytest -q test_lbapi/test_review_events.py test_lbapi/test_epub.py test_lbapi/test_misc.py
! rg -n 'xox[pboa]-[A-Za-z0-9-]+' lbapi jobs scripts
virtual_env/bin/ruff check lbapi/web.py lbapi/observability.py test_lbapi/test_review_events.py
```

Expected: PASS and no token match.

**Step 4: Commit**

```bash
git commit -m "security(api): sanitize review event delivery"
```

## Task 5: Generate Frontend Types and Add Nuxt Correlation

**Files:**

- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/api/generated/lbapi.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/server/utils/observability.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/server/middleware/observability.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/observability-server.spec.ts`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/server/utils/backend-proxy.ts`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/api/client.ts`

**Step 1: Regenerate and prove static types**

Run the backend exporter, then:

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
LB_BACKEND_DIR=/Users/johan/dev/lb-backend invoke codegen
cd nuxt && yarn api:check
```

Add a compile-only contract test proving a business event's attributes narrow from `event_name`, and forbidden keys fail with `@ts-expect-error`.

**Step 2: Write failing server correlation tests**

Assert Nuxt assigns/returns `X-Request-ID`, generates W3C context, never includes query values in the route field, forwards both headers in `proxyBackendRequest`, and emits one JSON completion/failure event. Assert invalid incoming identifiers are replaced.

**Step 3: Implement the middleware and proxy propagation**

Use H3 event context for identifiers and monotonic duration. Keep the request event non-blocking and stdout-only. Ensure the generated API client can receive correlation headers without adding a global composable.

**Step 4: Verify**

```bash
yarn vitest run test/unit/observability-server.spec.ts test/unit/backend-proxy.spec.ts test/unit/api-client.spec.ts
yarn lint
yarn typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add nuxt/app/lib/api/generated/lbapi.ts nuxt/server/utils/observability.ts nuxt/server/middleware/observability.ts nuxt/server/utils/backend-proxy.ts nuxt/app/lib/api/client.ts nuxt/test/unit/observability-server.spec.ts
git commit -m "feat(nuxt): propagate observability context"
```

## Task 6: Add Same-Origin Browser Intake and Capture

**Files:**

- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/observability/events.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/lib/observability/browser.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/app/plugins/observability.client.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/server/api/observability/events.post.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/observability-browser.spec.ts`
- Create: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/ssr/observability-api.spec.ts`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/nuxt.config.ts`

**Step 1: Write failing browser and intake tests**

Cover Vue errors, global errors, unhandled rejections, chunk errors, error normalization/fingerprinting, batching, ten-event cap, 16 KiB cap, deduplication, same-origin rejection, rate limiting, `sendBeacon` fallback, keepalive fetch, and failure isolation. Assert search phrases, selected text, URL queries, cookies, IPs, and full user-agent strings are absent.

**Step 2: Implement typed capture and the server endpoint**

Import the generated OpenAPI event types. Do not recreate the backend model manually. The H3 endpoint validates content type, origin, size, batch count, and a bounded in-memory rate/dedup cache, then signs the exact canonical bytes sent to FastAPI. Configuration names are explicit and private.

**Step 3: Verify**

```bash
yarn vitest run test/unit/observability-browser.spec.ts
yarn playwright test --project=ssr test/ssr/observability-api.spec.ts
yarn lint
yarn typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add nuxt/app/lib/observability nuxt/app/plugins/observability.client.ts nuxt/server/api/observability/events.post.ts nuxt/test/unit/observability-browser.spec.ts nuxt/test/ssr/observability-api.spec.ts nuxt/nuxt.config.ts
git commit -m "feat(nuxt): capture privacy-safe browser events"
```

## Task 7: Repair Vector, Add Redaction, and Bootstrap Storage

**Files:**

- Modify: `/Users/johan/dev/lb-infra/jobs/vector.nomad`
- Create: `/Users/johan/dev/lb-infra/tests/test_lb_application_log_pipeline.py`

**Step 1: Snapshot overlapping user changes**

```bash
cd /Users/johan/dev/lb-infra
git status --short
git diff -- jobs/vector.nomad jobs/grafana.nomad jobs/prometheus.nomad
```

Preserve all existing Grafana/SAOB changes and edit only observability-specific regions.

**Step 2: Write failing infrastructure contract tests**

Assert the pinned Vector image is `0.57.0-alpine`; `api_version = "v8"`; `suppress_type_name = true`; no dangerous environment interpolation flag; `lb-app-events` ISM/template/bootstrap alias; explicit mappings; 30-day deletion; daily/5 GiB rollover; disk buffering; trusted-envelope filtering; allowlist rebuilding; full-event metrics before sampling; five-percent ordinary-success sampling; and Prometheus exporter/service registration.

Run:

```bash
virtual_env/bin/pytest -q tests/test_lb_application_log_pipeline.py
```

Expected: FAIL.

**Step 3: Implement the new application pipeline**

Keep the existing pipeline-log stream working. Render the discovered OpenSearch endpoint into the Vector template. Build application documents field-by-field in VRL and deliberately delete the original event. Route sanitized unstructured errors separately. Configure persistent disk buffers and exported internal metrics.

**Step 4: Validate locally**

Extract the rendered static Vector config fixture used by the test and run:

```bash
docker run --rm -v "$PWD/tmp/vector-test:/etc/vector:ro" timberio/vector:0.57.0-alpine validate /etc/vector/vector.yaml
nomad job validate jobs/vector.nomad
virtual_env/bin/pytest -q tests/test_lb_application_log_pipeline.py tests/test_opensearch_hardening.py
```

Expected: PASS.

**Step 5: Commit only the Vector/storage hunks**

```bash
git diff --check
git diff --cached
git commit -m "feat(observability): repair and harden application log shipping"
```

## Task 8: Scrape Vector Metrics and Provision Pipeline Alerts

**Files:**

- Modify: `/Users/johan/dev/lb-infra/jobs/prometheus.nomad`
- Modify: `/Users/johan/dev/lb-infra/jobs/prometheus.rules.nomad-consul.yml.tpl`
- Create: `/Users/johan/dev/lb-infra/tests/test_lb_observability_metrics.py`

**Step 1: Write failing scrape/rule tests**

Require Vector service discovery, environment/job labels, and rules for drops, sustained retries, buffer pressure, and ingestion silence. Require actionable annotations and a stage-safe routing label.

**Step 2: Add scrape configuration and Prometheus rules**

Use the registered Vector metrics service rather than static node addresses. Make missing telemetry distinguishable from zero errors.

**Step 3: Verify**

```bash
virtual_env/bin/pytest -q tests/test_lb_observability_metrics.py tests/test_prometheus_nomad_client_alerts.py
nomad job validate jobs/prometheus.nomad
```

Expected: PASS.

**Step 4: Commit**

```bash
git commit -m "feat(observability): monitor Vector delivery health"
```

## Task 9: Provision the Unified Grafana Dashboard and Application Alerts

**Files:**

- Create: `/Users/johan/dev/lb-infra/observability/grafana/LB/lb-application-observability.json`
- Create: `/Users/johan/dev/lb-infra/observability/grafana/LB/alerting/lb-application-observability.yaml`
- Modify: `/Users/johan/dev/lb-infra/jobs/grafana.nomad`
- Create: `/Users/johan/dev/lb-infra/tests/test_lb_observability_dashboard.py`
- Create: `/Users/johan/dev/lb-infra/tests/test_lb_observability_alerts.py`

**Step 1: Write failing provisioning tests**

Validate stable UIDs, datasource references, environment/service/producer/deployment variables, error and latency panels, browser panels, fingerprint and correlation drill-down, business volumes, ingestion lag, Vector delivery health, alert thresholds, pending periods, runbook/dashboard links, and NATS-only stage routing.

**Step 2: Add dashboard and alert provisioning**

Use Prometheus for complete rates/latency and OpenSearch for sampled event detail. Do not embed credentials. Preserve the pre-existing dirty Grafana/SAOB changes and follow the current LB folder seeding conventions.

**Step 3: Verify JSON/YAML and Grafana job**

```bash
python -m json.tool observability/grafana/LB/lb-application-observability.json >/dev/null
virtual_env/bin/pytest -q tests/test_lb_observability_dashboard.py tests/test_lb_observability_alerts.py tests/test_grafana_nomad_alerts.py
nomad job validate jobs/grafana.nomad
```

Expected: PASS.

**Step 4: Commit only observability files/hunks**

```bash
git commit -m "feat(observability): provision unified Grafana views and alerts"
```

## Task 10: Wire Staging Secrets and Deployment Metadata

**Files:**

- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/jobs/lb-frontend-stage.nomad`
- Modify: `/Users/johan/dev/lb-backend/jobs/lb-backend-stage.nomad`
- Modify: `/Users/johan/dev/lb-infra/secrets/nomad.sops.yaml` using SOPS, never plaintext tooling
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/nuxt/test/unit/stage-deployment.spec.ts`
- Modify: `/Users/johan/dev/lb-backend/test_lbapi/test_stage_deployment.py`
- Create: `/Users/johan/dev/lb-infra/tests/test_lb_observability_secrets.py`

**Step 1: Write failing deployment-contract tests**

Require `environment=stage`, immutable deployment SHA, internal backend origin, secret-file mounts for the HMAC key and Slack token, no secret value in environment or Nomad metadata, health checks, and no public Caddy route for the backend internal intake.

**Step 2: Generate and install secrets safely**

Use the repository's SOPS workflow. Mount the same random HMAC material read-only into Nuxt and FastAPI. Migrate Slack credentials to a backend-only mounted file. Do not print secret contents in shell output.

**Step 3: Verify jobs and tests**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
python -m pytest -q test/test_tasks.py
cd nuxt && yarn vitest run test/unit/stage-deployment.spec.ts
nomad job validate ../jobs/lb-frontend-stage.nomad

cd /Users/johan/dev/lb-backend
virtual_env/bin/pytest -q test_lbapi/test_stage_deployment.py
nomad job validate jobs/lb-backend-stage.nomad
```

**Step 4: Commit repository-local changes separately**

- Frontend: `deploy(stage): wire Nuxt observability`
- Backend: `deploy(stage): wire API observability`
- Infra secrets reference: `ops(observability): provision stage event secrets`

## Task 11: Add a Repeatable Verification Harness and Runbook

**Files:**

- Create: `/Users/johan/dev/lb-infra/scripts/verify_lb_observability.py`
- Create: `/Users/johan/dev/lb-infra/tests/test_verify_lb_observability.py`
- Modify: `/Users/johan/dev/lb-infra/docs/OBSERVABILITY.md`
- Modify: `/Users/johan/.codex/worktrees/8c5c/littb/tasks.py`
- Add focused task tests in the frontend repository's existing task-test location

**Step 1: Write failing harness/task tests**

The verifier accepts environment/base URLs and a generated sentinel ID, never secrets as command-line arguments. It must check producer ingestion, shared trace correlation, forbidden canary absence, Grafana dashboard availability, alert/NATS evidence, Vector metrics, and Nomad health. Dry-run output must show every read-only check without exposing credentials. Add an Invoke task that runs the full stage verification.

**Step 2: Implement read-only verification plus explicit fault-test modes**

Separate normal read-only verification from controlled alert and OpenSearch interruption modes. Fault injection must require an explicit flag, capture pre-state, set a deadline, and always restore state in `finally`. Document expected Pending/Firing/Normal/Resolved transitions and the buffer drain checks.

**Step 3: Verify**

```bash
cd /Users/johan/dev/lb-infra
virtual_env/bin/pytest -q tests/test_verify_lb_observability.py
python scripts/verify_lb_observability.py --help

cd /Users/johan/.codex/worktrees/8c5c/littb
invoke --list | rg 'observability'
```

Expected: PASS.

**Step 4: Commit**

- Infra: `test(observability): add staging verification harness`
- Frontend: `build: add observability verification task`

## Task 12: Full Local Quality Gate

Run fresh commands and preserve their complete output or exit status:

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/ruff check lbapi test_lbapi
virtual_env/bin/ruff format --check lbapi test_lbapi
virtual_env/bin/pytest -q
virtual_env/bin/python scripts/export_v2_openapi.py --check

cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn api:check
yarn policy:check
yarn lint
yarn typecheck
yarn test:unit
yarn test:ssr
yarn build

cd /Users/johan/dev/lb-infra
virtual_env/bin/pytest -q
nomad job validate jobs/vector.nomad
nomad job validate jobs/prometheus.nomad
nomad job validate jobs/grafana.nomad
nomad job validate jobs/grafana-alert-relay.nomad
```

Fix regressions at their source. Do not weaken unrelated tests or lint rules. Commit any focused corrections before deployment.

## Task 13: Deploy to Stage in Dependency Order

Follow `lb-nomad-job-ops` and record allocation/deployment IDs.

1. Apply the OpenSearch bootstrap and repaired Vector job.
2. Confirm the sink writes a synthetic `observability.verification` document and Vector drop counters remain zero.
3. Deploy Prometheus and Grafana provisioning; confirm datasource, dashboard UID, and alert rules through their APIs.
4. Deploy the backend with `/Users/johan/dev/lb-backend/scripts/deploy-stage.sh`.
5. Deploy the frontend with its existing `invoke stage` workflow.
6. Confirm all Nomad allocations, service registrations, and checks are healthy before proceeding.

If any dependency fails, stop the rollout at that layer. Do not deploy later producers into an unverified sink.

## Task 14: Execute the Staging Verification Gate

Using the verification harness and browser automation where needed, prove:

1. one browser sentinel, one Nuxt-server sentinel, and one FastAPI sentinel are queryable;
2. one real Nuxt-to-FastAPI request has a shared trace ID and separate spans;
3. dashboard panels return non-error data for stage;
4. an alert moves Pending → Firing → Normal/Resolved and reaches the NATS-only relay path;
5. unique forbidden canaries for raw query, selected text, cookie, authorization, IP, body, and user agent return zero OpenSearch hits and do not appear in relay payloads;
6. a controlled OpenSearch interruption causes disk buffering, restoration drains the buffer, sentinel counts match, and drop counters remain zero;
7. Vector, OpenSearch, Prometheus, Grafana, alert relay, backend, and frontend allocations and checks are healthy; and
8. application smoke tests still pass at `https://stage.litteraturbanken.se`.

Save a timestamped verification report containing commands, sanitized outputs, sentinel IDs, Grafana screenshots, alert history, and Nomad allocation IDs. Rerun the focused local suites after any staging correction.

## Task 15: Completion Review

Use `superpowers:requesting-code-review` for a cross-repository review of security, privacy, correctness, operational failure modes, and test quality. Resolve every high/medium finding and rerun the affected gates. Then use `superpowers:verification-before-completion` and compare fresh evidence line-by-line with the 13 design verification requirements.

Only then mark the goal complete. Report repository commits, deployed Nomad versions, dashboard URL/UID, active alert rules, retention/sampling settings, proof artifacts, and any explicitly deferred non-goal.
