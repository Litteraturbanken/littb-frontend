# Nuxt production-readiness audit — 2026-08-19

## Executive verdict

The frontend application, application observability, Stage artifact identity,
infrastructure observability, release approval, and production promotion tooling
are **ready in local code and test evidence**. Production promotion is still a
**NO-GO** because the required live operator sequence has not started.

CI is advisory for this release candidate. The authoritative evidence is the
complete local backend, infrastructure, and frontend matrix recorded below,
including an independently refreshed semantic-review ledger with no remaining
work. The local frontend implementation and generated review evidence were
verified through `008d0dab7af6`; the later readiness-audit commit is documentation
only. Matching dependency revisions were backend `5f2866e911aa` and infrastructure
`b3cae8ecfb0e` before this runbook-only closeout.

No Stage or production deployment occurred. No image was built or pushed, no
registry or Nomad write was issued, and no DNS, secret, alert, or other live
infrastructure mutation was performed. `yarn build` created only the local Nuxt
build output used by the verification matrix.

## Authoritative local evidence

### Backend

| Gate | Result | Wall time |
| --- | --- | ---: |
| `pytest -q test_lbapi/v2` | 1,954 passed | 3.16 s |
| OpenAPI snapshot check | passed | 1.07 s |
| Blocking Ruff subset `E4,E7,E9,F,S` | passed | 0.03 s |
| Literal all-rule Ruff inventory from the task brief | 4,725 existing diagnostics; advisory by committed backend policy | 0.06 s |

The backend's committed `docs/v2-quality.md` defines the production Ruff subset
as blocking and the stable-plus-preview all-rule inventory as advisory. The
literal `ruff check lbapi/v2 test_lbapi/v2` command therefore remains noisy and
is recorded as a tooling-command mismatch rather than hidden or weakened.

### Infrastructure and promotion tooling

| Gate | Result | Wall time |
| --- | --- | ---: |
| Seven-file observability/live-job/release/promotion pytest matrix | 232 passed | 6.54 s |
| Nomad secret mapping validation | 23 mappings validated | 0.16 s |
| Observability verifier dry run | passed; read-only Stage plan printed | 0.06 s |

The passing matrix covers application log ingestion, dashboards, alerts,
read-only verification, the production frontend job, release approval, and the
promotion CLI. It proves the checked-in tooling behavior; it is not evidence that
the tooling has been run against a live candidate.

### Frontend

| Gate | Parallelism | Result | Wall time |
| --- | --- | --- | ---: |
| Unit | repository-configured parallel Vitest projects | 104 files, 2,922 passed | 83.29 s |
| SSR | three concurrent one-worker shards, then one isolated fixed-port worker | 613 passed; 0 skipped; 0 retries | 50.11 s |
| Desktop/mobile E2E | three concurrent Playwright shards, one worker each | 1,013 collected: 1,002 ordinary passes, 2 flaky passes after one retry each, 9 skipped | 506.77 s |
| ESLint | default | passed, zero warnings | 8.41 s |
| Typecheck | default | passed | 6.95 s |
| Architecture policy | default | passed, 505 files | 2.37 s |
| Maintainability | default | `new=0 known=3 resolved=127` | 6.71 s |
| Semantic review check | default | 681 approved; 0 unreviewed, stale, changes-requested, or oversized | 5.93 s |
| Semantic review queue | default | no work remains | 5.76 s |
| Production build | default | passed | 16.49 s |

The SSR shards completed 193, 185, and 170 tests before the isolated 65-test
lane. E2E shard results were 401 ordinary passes plus one flaky pass and one
skip; 347 passes; and 254 ordinary passes plus one flaky pass and eight skips.
No whole-command retry was needed. The two recovered tests were the authored
document navigation URL wait and the Text Search mounted-root visual wait; both
remain visible release-observation concerns rather than final failures.

Independent semantic review was refreshed until the runner reported `No
independent semantic review work remains`. Eleven Important findings were
reproduced with focused failing tests and remediated before the final matrix;
there were no unresolved Critical or Important findings. Generated review
evidence was committed separately in `008d0dab`.

## Readiness matrix

| Area | Status | Evidence and remaining requirement |
| --- | --- | --- |
| Application behavior, parity, and local build | Ready | Complete unit, SSR, desktop/mobile browser, static, architecture, maintainability, and local production-build gates passed. |
| Application observability | Ready | Browser delivery, intake, replay, timeout, rate-limit, correlation, identity, and server-event code passed focused tests, full tests, and independent semantic review. |
| Backend hydration and generated contract | Ready | 1,954 backend v2 tests and the exact OpenAPI snapshot check passed; the documented blocking Ruff subset is clean. |
| Infrastructure observability | Ready | Log pipeline, dashboard, alert, verifier, and secret-mapping tests passed; live Stage alert delivery is still pending. |
| Release approval and promotion tooling | Ready | Production job, approval, and promotion suites passed locally; the CLI has not been applied or used to mutate Nomad. |
| CI | Advisory | CI does not block this release candidate; the recorded complete local matrices are authoritative. |
| Reader production dependency origin | Pending operator action | Confirm a separately verified, non-public-looping `READER_SOURCE_BASE`; do not infer it from the public route. |
| Stage candidate | Pending operator action | Build the immutable image through the authorized release path and deploy that exact SHA/digest to Stage. |
| Automated live acceptance | Pending operator action | Run identity-bound live tests against the deployed Stage candidate. |
| Controlled Stage alert verification | Pending operator action | Exercise the approved controlled alert procedure with staffed operators and capture notification evidence. |
| Editorial acceptance | Pending operator action | Complete and commit the exact `lb.frontend.release.v1` approval for the accepted Stage SHA/digest/allocation. |
| Production promotion | Pending operator action | Validate/plan, review the rollback target, then apply only with separate explicit authorization and the interactive confirmation. |
| Staffed production observation | Pending operator action | Keep release and rollback operators present, run production smoke, observe candidate-scoped dashboards/alerts, and record the final decision. |

## Required operator sequence

1. Confirm the internal Reader dependency origin and operator access without
   printing or copying credentials into command arguments or logs.
2. Build and publish one immutable candidate through the authorized release
   mechanism, then deploy that exact SHA and digest to Stage.
3. Run the automated live Stage suite and confirm runtime identity, allocation
   health, dependency behavior, main user flows, and zero unacceptable skips.
4. Perform the controlled Stage alert verification and retain alert-routing and
   notification evidence.
5. Obtain editorial acceptance and commit the closed release approval tied to
   the exact Stage allocation, SHA, image reference, and digest.
6. Run the production promotion CLI in validation/plan mode, review the current
   production rollback identity, and stop if any Stage or production snapshot
   changes.
7. With separate authorization and staffed rollback coverage, run interactive
   production promotion, production identity verification, automated and manual
   smoke checks, and the agreed observation window.

## Go/no-go rule

Local code and tooling are ready to begin the operator-controlled Stage sequence.
Production remains **NO-GO** until every pending operator action above has exact,
timestamped evidence tied to the same immutable frontend SHA and digest. Any
identity drift, unhealthy allocation, failed live test, uncontrolled alert,
editorial rejection, or loss of trustworthy telemetry stops promotion.
