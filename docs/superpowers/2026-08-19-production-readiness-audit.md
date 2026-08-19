# Nuxt production-readiness audit — 2026-08-19

## Executive verdict

The Nuxt rewrite at application revision `7b4d81f8369c` is a locally verified
release candidate, but the repository and platform are **not yet ready for a
production cutover**.

Application confidence is high: the complete unit, SSR, desktop/mobile browser,
static-analysis, semantic-review, production-build, and live-stage smoke gates
passed. The accelerated browser suite completes in 8.4 minutes with three
isolated shards, down from 18.4 minutes in the prior serial run.

Production readiness remains blocked by release engineering and operations:

- the checked-in GitHub Actions workflow uses unsupported Node 18, installs
  before checkout, and runs the obsolete Angular `serve-dist` path;
- only a staging Nomad jobspec and staging deploy script exist;
- no reviewed production hostname, routing, secrets, capacity, health-check,
  rollout, monitoring, or rollback configuration exists in this repository;
- the current candidate has not been built, attested, or deployed as one
  immutable production image;
- no production-origin smoke or cutover rehearsal has been performed.

No deployment, infrastructure mutation, DNS change, or credential access was
performed as part of this audit.

## Scope and evidence classes

This audit covers the Nuxt frontend repository and the evidence locally
available at the audited revision. It distinguishes three evidence classes:

1. **Repository evidence** — committed source, tests, jobspecs, scripts, and
   documentation.
2. **Observed evidence** — commands run locally or against the public staging
   origin on 2026-08-19.
3. **Operator confirmation required** — infrastructure, secrets, capacity,
   routing, alerting, and release controls that cannot be established from this
   repository alone.

The historical staging deployment recorded in
`docs/superpowers/2026-08-14-stage-deployment-handover.md` used revision
`7b41bf014f97`. The current live smoke proves staging behavior and availability,
but its preflight does not expose or assert the deployed Git SHA. It must not be
interpreted as proof that staging runs the audited revision.

## Verification evidence

| Gate | Parallelism | Result | Elapsed | Evidence class |
| --- | ---: | --- | ---: | --- |
| Unit | up to 12 Vitest workers | 102 files, 2,861 passed | 85.72 s | Observed locally |
| SSR | 3 isolated shards plus serial stateful Reader lane | 611 passed | 60.15 s | Observed locally |
| Desktop/mobile E2E | 3 isolated shards, 1 Playwright worker each | 1,003 passed, 9 skipped, 0 final failures | 505.75 s | Observed locally |
| Live staging smoke | 4 read-only workers | 16 passed | 19.22 s | Observed against `https://stage.litteraturbanken.se` |
| ESLint | n/a | passed, zero warnings | n/a | Observed locally |
| Typecheck | n/a | passed | n/a | Observed locally |
| Architecture policy | n/a | passed, 491 files | n/a | Observed locally |
| Maintainability | n/a | passed: `new=0 known=3 resolved=127` | n/a | Observed locally |
| Semantic review | n/a | 664 approved; 0 unreviewed, stale, changes-requested, or oversized | n/a | Repository and observed locally |
| Production build | n/a | passed | n/a | Observed locally |

The browser default is deliberately three shards. A measured four-shard full
run was unstable under concurrent cold Nuxt compilation on this laptop, while
the three-shard run completed successfully and cut wall time by about 54% from
the previous 1,107.25-second serial run. Two cold Vite startup attempts were
recovered by the single retry allowed only in multi-shard mode. The serial lane
retains zero retries. This is a test-infrastructure accommodation, not evidence
of an application assertion failure, but CI should track retry counts and fail
if they trend upward.

## Readiness matrix

| Area | Status | Evidence and remaining requirement |
| --- | --- | --- |
| Application behavior and parity | Ready | Full unit, SSR, browser, visual, and live-stage suites passed. |
| Static, architectural, and semantic quality | Ready | Lint, typecheck, policy, maintainability, build, and the 664-packet semantic ledger are green. |
| Test runtime and isolation | Ready with monitoring | Three private-port/build/output shards are stable and materially faster. Multi-shard cold starts permit one retry; CI must retain retry reporting. |
| Staging behavior | Conditional | Live 16/16 passed, but the smoke preflight does not prove the deployed SHA. Add a deployment identity endpoint/header and assert it. |
| Immutable candidate image | Blocked | No SHA-pinned image for `7b4d81f8369c` was built, pushed, signed/attested, or scanned in this audit. |
| CI enforcement | Blocked | `.github/workflows/e2e.yml` is obsolete: Node 18.17.1, checkout after an install step, Angular `serve-dist`, and no Nuxt release matrix. |
| Production topology and deploy path | Blocked | Only `jobs/lb-frontend-stage.nomad` and `scripts/deploy-stage.sh` exist. A reviewed production jobspec and promotion/deploy procedure are absent. |
| Production hostname, TLS, and ingress | Blocked | The production hostname and Caddy/DNS/TLS ownership are not defined here. Staging documentation also disagrees between `stage.litteraturbanken.se` and `lb-frontend.pub.lb.se`. |
| Production config and secrets | Blocked | Production backend/content origins, observability secret path, allowed origins, registry access, and Nomad policy require operator definition and validation. |
| Backend/content compatibility | Conditional | Staging live tests exercise the current public backend contract. Production backend/data version and content reachability must be pinned and checked before cutover. |
| Security and privacy | Conditional | Application boundary tests and policy are strong. Production headers, CSP, origin policy, robots behavior, image provenance, and secret delivery require an environment-level review. |
| Health checks and capacity | Blocked | Staging has one 500 MHz/768 MiB allocation and checks only `/robots.txt`. Production replicas, resource limits, readiness semantics, failure domains, and load evidence are undefined. |
| Observability and alerting | Blocked | Application observability code exists, but this repository does not prove deployed dashboards, alerts, ingestion health, on-call ownership, or tested notification delivery for production. |
| Production smoke and performance | Blocked | The live suite is origin-parameterized, but no production-candidate origin exists. Lighthouse/load testing and dependency failure drills remain unexecuted for the candidate. |
| Rollback | Blocked | Staging history guidance exists, but no production job history, last-known-good image, rollback command, decision threshold, owner, or rehearsal evidence exists. |
| Cutover and post-cutover operations | Blocked | No approved traffic-switch plan, maintenance window, stakeholder sign-off, monitoring period, or rollback threshold is recorded. |

## Required path to production

### 1. Establish the production contract

- Name the production hostname and owners for DNS, TLS, Caddy/Consul, Nomad,
  backend, content, observability, and release approval.
- Pin the production backend and content endpoints and validate their contracts
  against this frontend.
- Define expected traffic, availability target, replica count, CPU/memory,
  failure-domain placement, and acceptable startup/response latency.

Exit evidence: an approved production configuration record with owners,
hostnames, dependencies, capacity assumptions, and secret references—never raw
secret values.

### 2. Create the production release path

- Add a production Nomad jobspec rather than parameterizing staging implicitly.
- Add a production promotion/deploy command that requires a clean, reachable,
  approved commit and an existing immutable SHA-pinned image.
- Replace `/robots.txt` as the sole health signal with a lightweight readiness
  endpoint that verifies the Nuxt server is ready without placing load on
  external dependencies; keep an independent end-to-end dependency probe.
- Require at least two allocations or document and approve the single-instance
  availability risk.

Exit evidence: reviewed jobspec, dry-run/validation output, exact image digest,
secret mounts, service registration, health checks, and rollback target.

### 3. Make CI an actual release gate

- Replace the obsolete workflow with checkout first, Node 22.22 (or another
  engine-compatible pinned version), frozen installs, cached Playwright
  browsers, and the Nuxt commands documented in `docs/quality.md`.
- Enforce unit, SSR, lint, typecheck, architecture policy, maintainability,
  semantic-ledger integrity, production build, and desktop/mobile E2E.
- Keep the measured three-shard browser default, publish shard reports/traces,
  and surface retry counts. Do not increase to four without another full-run
  stability measurement.
- Protect the production branch so a green release workflow and required review
  are mandatory.

Exit evidence: a pull request and main-branch run green on the exact candidate
SHA, with retained test reports and no hidden continue-on-error behavior.

### 4. Build and qualify one immutable candidate

- Build once from the approved Git SHA using the digest-pinned Node 22 Dockerfile.
- Push by immutable digest/SHA, generate provenance/SBOM as required by the
  platform, and perform the approved vulnerability scan.
- Deploy that exact image to a no-traffic or staging slot and expose the running
  Git SHA so automation can reject revision drift.

Exit evidence: Git SHA, image tag and digest, build job, scan/attestation, Nomad
job version/allocation, and a successful runtime identity assertion.

### 5. Run production-shaped acceptance

- Run the 16-test live smoke against the candidate origin with four workers and
  zero retries.
- Exercise the Strindberg author-works route, Library, Search, Reader,
  Dramawebben, Statistics, managed content, downloads, and same-origin backend
  proxies against production-shaped data.
- Run accessibility, representative visual, Lighthouse, security-header,
  robots, TLS, and dependency-failure checks.
- Run a load/capacity test sufficient to validate replica and resource choices.

Exit evidence: timestamped reports tied to the candidate SHA/image digest and
an explicit list of accepted skips or thresholds.

### 6. Rehearse rollback before traffic

- Identify and verify the last-known-good production image and Nomad version.
- Rehearse rollback in the no-traffic/staging environment, including config and
  secret compatibility.
- Define measurable rollback triggers: elevated 5xx, failed health checks,
  latency, browser error rate, backend saturation, or critical user-flow smoke
  failure.

Exit evidence: successful rehearsal, exact commands, elapsed recovery time,
decision owner, and rollback thresholds.

### 7. Cut over with bounded risk

- Confirm TLS and DNS before traffic, then use a canary or otherwise bounded
  traffic transition if the platform supports it.
- Run the production-origin smoke immediately after each traffic increment.
- Watch application, proxy, backend, and infrastructure signals through an
  agreed observation window; keep the rollback operator present.
- Record the deployed SHA/image digest, job version, allocations, route, smoke
  result, dashboards, incidents, and final go/no-go decision.

## Go/no-go rule

Production cutover is **NO-GO** until every Blocked row above has concrete,
reviewed evidence and every Conditional row is closed against the exact
candidate image. Passing local and staging application tests is necessary but
does not substitute for a production release system, immutable candidate
identity, capacity evidence, monitoring, or rehearsed rollback.
