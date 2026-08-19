# Stage Artifact Promotion and Production Observability Design

**Date:** 2026-08-19

**Status:** Approved design

**Frontend repository:** `/Users/johan/.codex/worktrees/8c5c/littb`

**Application/backend repository:** `/Users/johan/dev/lb-backend`

**Infrastructure repository:** `/Users/johan/dev/lb-infra`

## Objective

Release the Nuxt rewrite safely without making remote CI a release gate. The
team will run the complete release suite locally, deploy one immutable image to
Stage, obtain editorial approval there, and promote the exact same image digest
to production. Production safety will be completed by deployment-aware backend,
Nuxt, and browser observability, with human-controlled rollback.

## Decisions

1. Local release verification is authoritative. CI may remain useful for
   feedback, but its absence or current obsolete state does not block release.
2. Stage is the acceptance environment. Automated Stage smoke and recorded
   editorial approval are both required.
3. Production receives the exact Stage image digest. Production is never
   rebuilt from a branch, tag, or source checkout.
4. Production configuration is supplied at runtime and is not baked into the
   container image.
5. Grafana evaluates production signals and sends firing/resolved notifications
   through the existing NATS/Slack path. It never deploys or rolls back code.
6. A named human release operator decides rollback using explicit thresholds,
   defining user journeys, and telemetry health.
7. Hydration mismatches are a first-class, privacy-safe browser event rather
   than an inferred generic JavaScript exception.

## Existing Foundation

The current stack already provides most of the transport:

- Nuxt and FastAPI emit the typed `lb.observability.v1` event envelope.
- Request IDs and W3C trace IDs correlate Nuxt proxy requests with FastAPI.
- The browser reports bounded errors, unhandled rejections, API failures, and
  chunk failures to the same-origin `/_observability/events` intake.
- Nuxt reconstructs trusted environment, deployment SHA, timestamp, severity,
  fingerprint, and correlation fields before signing browser batches to the
  internal FastAPI endpoint.
- Vector validates and redacts events, writes them to OpenSearch, and exposes
  counters, duration histograms, ingestion timestamps, and delivery health to
  Prometheus.
- Grafana already provisions the LB application dashboard and Stage alerts for
  application-error spikes, chunk failures, 5xx ratio, ingestion silence, and
  Vector delivery failure.
- A controlled Stage verifier proves browser intake, Nuxt/FastAPI correlation,
  privacy rejection, Grafana state transitions, and firing/resolved delivery to
  NATS.

The missing work is exact artifact promotion, production-scoped jobs and alert
rules, hydration-specific capture, and a release runbook that joins these
pieces into one go/no-go decision.

## Release Artifact Contract

### Local verification record

The release operator starts from a clean, committed frontend revision and runs
the repository-owned release commands using the pinned Node runtime. The record
must contain:

- frontend Git SHA;
- unit, SSR, desktop/mobile E2E, lint, typecheck, architecture-policy,
  maintainability, semantic-review, and production-build results;
- worker/shard counts, pass/fail/skip/retry counts, and elapsed times;
- confirmation that committed visual baselines were not changed by the run;
- confirmation that no owned fixture, Nuxt, Playwright, or semantic-review
  process remains.

A failed gate invalidates the release candidate. Retrying a failing behavioral
assertion does not create a releasable record; infrastructure retries remain
visible and are assessed under the repository's measured runner policy.

### Build once

The approved frontend SHA is built once into a container image. The registry
tag may contain the Git SHA for operator readability, but the promotion
identity is the registry digest. The build record binds:

```text
frontend_git_sha -> image_tag -> image_digest -> builder_job
```

Stage and production jobs both use the digest-qualified image reference. A tag
that resolves to the same bytes is insufficient evidence because tags are
mutable.

### Stage acceptance

Stage deployment records the frontend SHA and image digest in Nomad job
metadata and runtime observability labels. Automated acceptance requires:

- healthy allocation and Consul service checks;
- a runtime identity response or header whose SHA and image digest match the
  candidate;
- the complete read-only live Stage smoke suite;
- the Strindberg author-works regression and other defining journeys;
- healthy observability ingestion and a controlled firing/resolved verification;
- no unexpected production dependency escape.

Editorial approval is recorded against the same Stage job version, Git SHA,
and image digest. A later Stage deployment invalidates that approval.

### Production promotion

The production promotion command accepts the approved Stage job identity, not
an arbitrary source ref. Before Nomad registration it must:

1. read the running Stage allocation's image digest and deployment SHA;
2. verify them against the local release and editorial-approval record;
3. verify the production jobspec references that exact digest;
4. validate and plan the Nomad job;
5. display the candidate, current production version, and rollback target;
6. require an explicit human confirmation;
7. register production detached with a check index where practical.

The command must fail closed on a mutable tag, dirty release record, changed
Stage allocation, absent editorial approval, missing rollback target, or
unhealthy observability pipeline.

## Production Runtime Boundary

Production infrastructure is canonical in `/Users/johan/dev/lb-infra`.
Production uses host networking, Consul service registration, and public Caddy
ingress in accordance with the existing Nomad conventions. Secrets use
task-scoped Nomad Variables synchronized from SOPS; they are never command-line
arguments, image values, logs, or committed plaintext.

The production job must explicitly define and test:

- public host and Caddy/TLS tags;
- backend v2 and legacy API service origins;
- managed content origin;
- Reader text, image, facsimile, and export source origin;
- observability environment `production`, frontend Git SHA, image digest,
  allowed browser origin, and HMAC secret;
- replica count, static/allocated ports, CPU and memory;
- readiness and service checks;
- reschedule, restart, update, and rollback behavior.

The public production hostname must not be used as the upstream Reader source
if that would proxy `/txt`, `/bilder`, or `/export/faksimil` back into the same
frontend. The implementation must identify and verify the internal or legacy
origin before production registration.

## Hydration Observability Contract

### Typed event

The backend OpenAPI contract adds `browser.hydration_error` as an error event
with the existing bounded browser attributes. Its trusted event shape is:

- `event_name`: `browser.hydration_error`;
- `event_kind`: `error`;
- `producer`: `browser`;
- `service`: `lb-frontend`;
- `error_type`: `HydrationMismatch`;
- `resource_kind`: `document`;
- deployment/environment/fingerprint fields reconstructed by Nuxt;
- correlation identifiers only when supplied through the existing opaque token.

No hydration diagnostic, HTML, component props, DOM text, URL, query, stack,
user agent, IP address, cookie, or selected text crosses the browser intake.

### Capture lifecycle

Hydration mismatch detection is installed by the existing early Nuxt client
observability plugin before Vue hydrates the root. Vue 3 emits detailed mismatch
warnings and one terminal `console.error` message. The implementation will:

- chain any existing Vue `warnHandler` and capture only exact Vue hydration
  mismatch classifications;
- temporarily wrap `console.error` only during initial hydration to detect the
  exact terminal mismatch signal that does not necessarily pass through the
  Vue warn handler;
- preserve original console calls and argument identity;
- emit one deduplicated `browser.hydration_error` per initial page hydration;
- restore the original console method at `app:mounted` and on plugin cleanup;
- fail open if classification or delivery itself fails.

The classifier is a pure, tested function. It recognizes only the installed
Vue/Nuxt hydration diagnostics; generic warnings and errors continue through
their existing paths. The reporter stores the classification, never the
diagnostic text.

## Production Metrics, Dashboard, and Alerts

Vector's existing event-name, environment, service, producer, status-class,
and deployment-SHA labels are sufficient. The hydration event requires no
unbounded label and no new raw log field.

The LB application dashboard gains an explicit hydration panel grouped by
environment and deployment SHA. Production release review fixes the dashboard
variables to `environment=production` and the promoted SHA.

Production alert rules are separate from Stage rules and use production labels,
titles, routing, and runbook context:

| Signal | Warning | Critical / rollback candidate |
| --- | --- | --- |
| Hydration mismatch | Any event during the staffed rollout window | At least 3 events in 10 minutes |
| HTTP 5xx absolute count | More than 3 in 5 minutes | Sustained or increasing during investigation |
| HTTP 5xx ratio | Dashboard evidence | More than 5% of at least 20 requests in 10 minutes |
| Browser chunk errors | Repeated event for promoted SHA | At least 3 in 10 minutes |
| Generic browser/application errors | More than 5 in 5 minutes | Sustained spike attributable to promoted SHA |
| Observability ingestion | Delayed timestamp | Missing for 15 minutes or absent |
| Vector/OpenSearch delivery | Retrying or buffer growth | Drops, unavailable scrape target, or sustained component errors |

Thresholds are initial operational policy, not application constants. Changes
remain version-controlled and require a controlled Stage firing/recovery test.
Production alert notifications include deployment SHA, dashboard link, runbook,
and suggested checks. They do not contain raw event messages.

## Human Rollback Policy

No alert automatically changes Nomad state. The release operator keeps the
previous digest-qualified image and job version ready throughout the rollout.

Immediate manual rollback is authorized when any of these occurs:

- a defining production smoke journey fails;
- a critical 5xx, hydration, or chunk-error threshold is reached and is
  attributable to the promoted SHA;
- a severe visual/editorial defect is confirmed;
- telemetry becomes unavailable, so the team cannot determine whether the
  release is safe;
- backend saturation or dependency failure starts after promotion and resolves
  when traffic returns to the previous frontend.

The operator may hold and investigate a warning while traffic remains healthy.
Rollback uses the recorded previous production job version and image digest;
it never rebuilds or retags an old source revision.

## Observation Window

1. Before promotion, the Stage observability verifier and controlled
   firing/resolved test must pass.
2. Immediately after production registration, verify allocation, service,
   runtime identity, telemetry ingestion, and defining smoke journeys.
3. Repeat production smoke at 15 and 60 minutes.
4. Keep one release operator actively monitoring for the first hour.
5. Review the deployment-SHA dashboard again on the next working day before
   closing the release record.

Production completion records the Git SHA, image digest, Stage and production
job versions, allocations, editorial approval, smoke results, alert state,
dashboard link, and final go/no-go decision.

## Testing Strategy

### Backend application contract

- RED/GREEN Pydantic model tests for `browser.hydration_error`.
- Internal intake acceptance and rejection tests.
- OpenAPI snapshot regeneration and deterministic generated-client check.
- Existing privacy and replay protections remain unchanged.

### Frontend

- Pure classifier tests for each installed Vue hydration diagnostic and nearby
  non-hydration warnings.
- Plugin tests prove handler chaining, one-event deduplication, console
  preservation, restoration at `app:mounted`, and fail-open behavior.
- Same-origin intake tests prove the event is reconstructed and signed without
  diagnostic text.
- A real SSR/browser regression deliberately creates a test-only hydration
  mismatch, observes one sanitized fixture event, and proves ordinary rendering
  continues.
- Existing full unit, SSR, desktop/mobile, live Stage, lint, typecheck, policy,
  maintainability, semantic-review, and build gates remain mandatory locally.

### Infrastructure and release operations

- Static tests parse the production Nomad job, Caddy tags, task-scoped secret
  references, digest-only image contract, health checks, update strategy, and
  deployment metadata.
- Promotion tests use fake Nomad/registry responses to reject tag drift,
  Stage/release mismatch, missing approval, absent rollback, and unhealthy
  telemetry.
- Grafana tests parse every production rule and require environment, event,
  thresholds, routing, annotations, dashboard, and runbook ownership.
- Vector fixture tests accept the new event and prove no raw diagnostic field is
  indexed or promoted to a metric label.
- The Stage verifier proves dashboard queries, ingestion, privacy, and controlled
  firing/resolved delivery before any production promotion.

## Repository and Change Isolation

The frontend worktree is currently clean. Both `/Users/johan/dev/lb-backend`
and `/Users/johan/dev/lb-infra` contain pre-existing user changes and untracked
files. Implementation must record status and targeted diffs before every task,
edit only named files, stage explicit paths or hunks, and never stash, reset,
clean, overwrite, or commit unrelated work.

Cross-repository order is:

1. backend typed event and OpenAPI;
2. generated frontend client, hydration capture, and intake tests;
3. infrastructure Vector/dashboard/alerts/runbook;
4. production jobspec and Stage-to-production promotion tooling;
5. local full release verification;
6. Stage deployment, editorial review, observability verification, and only
   then a separately authorized production promotion.

## Non-goals

- Remote CI as a release gate.
- Automatic rollback or autonomous deployment.
- Rebuilding an editorially approved image for production.
- Collecting browser messages, stacks, DOM, queries, or user-identifying data.
- Replacing Vector, OpenSearch, Prometheus, Grafana, NATS, or Slack.
- Deploying to Stage or production as part of design/implementation work without
  a separate explicit authorization at the deployment step.
