# LB Unified Observability Design

**Date:** 2026-07-29
**Status:** Approved
**Scope:** Nuxt hybrid frontend, FastAPI backend, and the existing `lb-infra` Vector/OpenSearch/Grafana stack

## Objective

Provide one privacy-safe, production-ready view of browser, Nuxt server, FastAPI, and operational events. Operators must be able to start from a visible failure or alert, identify the affected deployment and route, and follow one request across the Nuxt and FastAPI boundaries. The design must retain the useful manual-review Slack workflows while moving operational detection and alerting to Grafana.

Completion requires staging evidence from every producer, successful request correlation, working dashboards and alert lifecycle, proven redaction, proven buffering and recovery, healthy Nomad allocations, and passing frontend, backend, and infrastructure test suites.

## Existing Stack and Immediate Defect

`lb-infra` already provides the right foundation:

- a Nomad system job for Vector;
- OpenSearch with Grafana provisioning;
- Prometheus;
- a Grafana alert webhook relay that can publish to NATS and Slack;
- version-controlled dashboard and alert provisioning; and
- existing Slack review events emitted by the backend.

The current Vector-to-OpenSearch path is not usable. The deployed Vector 0.39 sink emits an `_type` bulk metadata field that OpenSearch 3.7 rejects. Vector allocations and their HTTP health endpoint remain healthy while events are dropped, so process health alone is insufficient. The first infrastructure change therefore repairs and instruments this path rather than introducing Loki or another parallel log store.

## Chosen Architecture

```text
Browser errors and typed events
             |
             v
same-origin Nuxt event intake --HMAC--> FastAPI internal event intake
             |                              |
Nuxt SSR/server structured stdout           | FastAPI request/error/business stdout
             |                              |
             +-------------+----------------+
                           v
                    Vector system agents
                     |               |
                     v               v
          OpenSearch lb-app-events   Prometheus metrics
                     |               |
                     +-------+-------+
                             v
                           Grafana
                             |
                  existing alert webhook relay
                     |                  |
                     v                  v
                    NATS              Slack
```

This reuses the deployed operational stack, fixes its incompatibility, and keeps product code independent of the storage engine. The event schema remains trace-compatible so Tempo or another OpenTelemetry backend can be added later without changing the public event vocabulary.

Rejected alternatives:

- **Add Loki beside OpenSearch.** This duplicates storage, lifecycle, access, and operating procedures without first making the existing stack reliable.
- **Adopt full OpenTelemetry tracing and Tempo now.** Distributed spans are valuable, but introducing another backend before logs, correlation, and privacy boundaries are dependable expands the failure surface too far.

## Event Contract

All trusted application events use the versioned `lb.observability.v1` envelope. Required and optional fields are modeled in Pydantic, exposed in OpenAPI, and generated into frontend TypeScript. Producers do not construct untyped dictionaries outside the shared helpers.

| Field | Purpose |
| --- | --- |
| `schema_version` | Constant `lb.observability.v1` |
| `timestamp` | UTC event time |
| `event_id` | Globally unique deduplication key |
| `event_name` | Stable dotted event name |
| `event_kind` | `request`, `error`, `business`, `security`, or `verification` |
| `severity` | `debug`, `info`, `warning`, `error`, or `critical` |
| `service` | `lb-frontend` or `lb-backend` |
| `producer` | `browser`, `nuxt-server`, `fastapi`, or `vector` |
| `environment` | `development`, `stage`, or `production` |
| `deployment_git_sha` | Immutable code version |
| `request_id` | Request lookup key |
| `trace_id` / `span_id` | W3C-compatible correlation identifiers |
| `route` | Sanitized route template, never a raw URL |
| `http_method` | Allowlisted HTTP method |
| `status_code` | HTTP status when relevant |
| `duration_ms` | Monotonic request duration |
| `error_type` | Sanitized exception class or browser category |
| `error_fingerprint` | Stable digest of normalized error identity |
| `attributes` | Event-specific, allowlisted typed attributes |

Initial event names are:

- `request.completed`, `request.failed`;
- `error.unhandled`, `error.handled`;
- `browser.error`, `browser.unhandled_rejection`, `browser.chunk_error`;
- `upstream.failed`;
- `business.search_submitted`, `business.quicksearch_navigation`, `business.library_filter`;
- `business.reader_page`, `business.epub_download`, `business.qr_opened`;
- `business.dictionary_lookup`, `business.epub_missing`; and
- `observability.verification`.

The event catalog defines the exact attribute model for each name. Unknown event names and unknown attributes are rejected at the trusted intake boundary.

## Privacy and Security Boundary

Observability is not user profiling. The system never stores:

- raw search phrases or selected text;
- full URLs or arbitrary query strings;
- request or response bodies;
- cookies, authorization headers, or credentials;
- raw client IP addresses; or
- complete user-agent strings.

It may store normalized route templates; allowlisted author, work, page, and media identifiers; boolean feature flags; lengths and result counts; status and duration; deployment SHA; request and trace identifiers; and sanitized error types and fingerprints.

Privacy is enforced twice:

1. Pydantic and generated TypeScript models allow only the documented event-specific attributes.
2. Vector rebuilds the stored document from an allowlist and drops all other fields before indexing.

The browser posts only to `POST /api/observability/events` on the same origin. The Nuxt handler accepts JSON only, limits each body to 16 KiB and ten events, applies per-origin/IP rate limits without persisting the IP, and deduplicates event IDs. It forwards validated events to the backend over the internal network with an HMAC signature and timestamp. FastAPI validates the signature, enforces a short replay window, and validates the typed batch. The shared secret is provided through the existing SOPS/host-secret mechanism and is never committed.

The hard-coded Slack token currently present in the backend must be removed. Slack delivery reads a mounted secret. Existing manual-review events are dual-written during migration, but their Slack payloads are reduced to the same privacy-safe allowlist.

## Correlation

Nuxt assigns a valid request ID and W3C trace context at public ingress. It returns `X-Request-ID` to the browser and forwards `traceparent` plus `X-Request-ID` through the backend proxy. FastAPI preserves valid incoming identifiers and creates them when absent. Nuxt and FastAPI create distinct span IDs while sharing a trace ID.

All server log events created while handling the request receive this context. Typed API errors may expose the request ID so a browser error or support report can be joined to server events. Invalid or oversized correlation headers are replaced, not reflected.

## Producers

### Nuxt server

An H3 server middleware establishes correlation context and emits one completion or failure event per request. Backend proxy failures emit `upstream.failed` with the sanitized route, status, duration, and correlation identifiers. It must not delay the response while shipping an event.

### Browser

A client-only Nuxt plugin captures Vue/Nuxt errors, `window.error`, unhandled rejections, and chunk-load failures. It normalizes and fingerprints errors, batches events, and uses `sendBeacon` or a keepalive fetch. Capture failures are silent and never interfere with navigation. Business events use typed helpers and do not duplicate telemetry during hydration.

### FastAPI

A pure ASGI middleware establishes or preserves correlation context and emits request completion/failure events. Exception handlers add the request ID to typed errors and emit structured errors without logging request bodies. Business-event helpers replace ad-hoc Slack dictionaries and can dual-write selected manual-review events.

All application events are emitted as single-line JSON on stdout. Unexpected unstructured stderr remains available as a sanitized `runtime.unstructured` fallback event, but it is never treated as a trusted application envelope.

## Vector and Storage

Vector is upgraded to the pinned stable `timberio/vector:0.57.0-alpine` image. Because recent Vector releases disable environment interpolation by default for security, Nomad templates render the static OpenSearch endpoint into the configuration; dangerous environment interpolation is not enabled.

The Elasticsearch-compatible sink explicitly sets `api_version = "v8"` and `suppress_type_name = true`, preventing `_type` from reappearing. It uses a disk buffer, bounded backpressure, acknowledgements, and retries. Internal Vector metrics are exported to Prometheus and registered as a service so a healthy process with a failing sink cannot appear healthy at the system level.

Trusted JSON events are parsed and rebuilt through the field allowlist. Metrics are derived before any success-event sampling. Error, slow-request, business, security, and verification documents are retained in full. Ordinary successful request documents are sampled at five percent after their metrics are emitted.

Documents are written through the `lb-app-events` alias into `lb-app-events-*`. An OpenSearch index template supplies explicit mappings. An ISM policy attaches automatically, rolls over daily or at 5 GiB, and deletes indices after 30 days. The alias and lifecycle policy are installed idempotently before the sink is enabled.

## Metrics, Dashboard, and Alerts

Vector derives counters and histograms from every trusted event and exposes them to Prometheus. The version-controlled Grafana dashboard provides:

- request rate, error rate, and 5xx rate by environment, service, and producer;
- p50, p90, and p99 latency;
- browser error and chunk-error trends;
- top error fingerprints with deployment comparison;
- request-ID and trace-ID drill-down links;
- business-event volumes;
- OpenSearch ingestion lag; and
- Vector received, sent, dropped, retry, and disk-buffer health.

Provisioned alerts cover:

- elevated error or 5xx rate;
- browser error spikes;
- a post-deployment regression;
- repeated high-volume fingerprints;
- Vector drops, sustained retries, or buffer pressure; and
- ingestion silence while the application is receiving traffic.

Alerts include environment, service, deployment SHA, dashboard links, and concise runbook guidance. Stage routes notifications to the relay's NATS-only endpoint. Production operational alerts may use the relay's Slack route. Manual-review business events remain a separate workflow and do not page operators.

## Deployment and Failure Behavior

Rollout order is:

1. OpenSearch template, lifecycle policy, alias, and observability secrets;
2. repaired Vector job and its Prometheus scrape;
3. Grafana datasource, dashboard, and alerts;
4. backend correlation, intake, structured events, and Slack secret migration;
5. Nuxt server correlation and browser intake; and
6. staged alert and failure verification.

Application producers fail open: observability failure cannot fail an application request. Vector buffers locally when OpenSearch is unavailable. A Vector rollback may restore the prior binary or configuration only if the broken `_type` sink behavior is not reintroduced; otherwise the new sink is disabled while the disk buffer is preserved. Grafana provisioning is file-based and reversible.

## Verification Gate

The work is complete only after fresh evidence demonstrates all of the following:

1. Contract tests reject unknown attributes and representative forbidden PII.
2. Nuxt tests cover rate limiting, batching, deduplication, correlation propagation, and browser capture failure behavior.
3. FastAPI tests cover correlation middleware, typed intake, HMAC authentication, replay rejection, exception behavior, and Slack dual-write selection.
4. Infrastructure tests validate Vector, OpenSearch mappings and policy, Grafana dashboard queries, alert provisioning, and secret references.
5. `vector validate` and every modified Nomad job validation pass.
6. Stage ingests one sentinel from the browser, Nuxt server, and FastAPI.
7. A Nuxt-to-FastAPI request appears under one trace ID with separate producer/span records.
8. A test alert transitions through pending, firing, normal, and resolved, and the NATS-only stage notification is observed.
9. Canary values placed in forbidden fields cannot be found anywhere in OpenSearch or alert payloads.
10. During a controlled OpenSearch interruption, Vector buffers events and drains them without loss after recovery.
11. Vector internal metrics show no drops, no sustained retry errors, and an empty recovered buffer.
12. All related Nomad allocations and service checks are healthy.
13. Frontend, backend, and infrastructure quality and regression suites pass.

The verification commands, sentinel identifiers, dashboard screenshots, alert-state evidence, and OpenSearch redaction queries are recorded in the staging runbook so the proof is repeatable.

## Deliberate Non-Goals

- Full distributed span storage and Tempo adoption.
- Loki or another parallel log store.
- Product analytics, user identity, sessions, or behavioral profiling.
- A major Grafana upgrade unrelated to the observability requirement.
