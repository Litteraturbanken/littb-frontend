# Nuxt production-readiness audit — 2026-08-19

## Executive verdict

The frontend application, application observability, Stage artifact identity,
infrastructure observability, release approval, and production promotion tooling
are **ready in local code and test evidence**. Production promotion is still a
**NO-GO** because the required live operator sequence has not started.

CI is advisory for this release candidate. The authoritative evidence is the
earlier complete local backend, infrastructure, and frontend matrix plus the
proportional post-fix gates recorded below. The exact final reviewed frontend
runtime and semantic-evidence head is
`3fdfb06b6b2782193e7a6602097b68ef9544577f`; the later audit commit is
documentation-only and is deliberately excluded from the runtime identity to
avoid a self-reference. Matching dependency revisions are backend
`5f2866e911aa7133d9bab5496a2e090a125b6a02` and infrastructure promotion code
`a029c12fafd24a045782ed5244b8f09ddc648d46` before its runbook-only closeout.

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
| Seven-file observability/live-job/release/promotion pytest matrix | 246 passed | 6.08 s |
| Nomad secret mapping validation | 23 mappings validated | 0.16 s |
| Observability verifier dry run | passed; read-only Stage plan printed | 0.06 s |

The passing matrix covers application log ingestion, dashboards, alerts,
read-only verification, the production frontend job, release approval, and the
promotion CLI. The CLI now parses a local `nomad job run -output` rendering of the
private committed jobspec snapshot before planning and again after confirmation,
and fails closed unless the rendered image, metadata, runtime identity, and both
Reader origin inputs match the approved candidate. Fourteen adversarial cases
proved that mismatches cannot reach planning or submission. This is checked-in
tooling evidence, not evidence that the CLI has been run against a live candidate.

### Earlier complete frontend matrix

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

This complete matrix preceded the final multi-event replay-conflict recovery. It
remains broad regression evidence; it is not presented as a post-fix full rerun.

### Proportional frontend gates after replay recovery

| Gate | Parallelism | Result | Wall time |
| --- | --- | --- | ---: |
| Focused replay RED | selected two intake tests | 2 expected failures in the old whole-batch `409` branch | 1.04 s |
| Focused replay GREEN | selected two intake tests | 2 passed; 34 skipped by selection | 0.89 s |
| Complete observability intake unit file | default Vitest file runner | 36 passed | 1.29 s |
| Observability SSR route | one fixed-port worker | 6 passed | 4.68 s |
| `yarn test:reader-runtime-proxy` | one configured worker | local production build plus 18 built-output proxy tests passed | 19.75 s |
| ESLint | default | passed, zero warnings | 9.79 s |
| Typecheck | default | passed | 8.28 s |
| Architecture policy | default | passed, 505 files | 2.76 s |
| Maintainability | default | `new=0 known=3 resolved=127` | 8.11 s |
| Semantic review check | default | 681 approved; every other state zero | 8.57 s |
| Semantic review queue | default | no work remains | 8.57 s |

There is no maintained aggregate local release or serial command in
`nuxt/package.json`. The built-output Reader gate is therefore an explicit local
release command rather than an invented aggregate or a new CI requirement. It
rebuilds `.output`, then owns a production-server and Reader-origin lifecycle for
the integration file, so keeping its configured single-worker run isolated avoids
sharing generated output and processes with other suites:

```bash
cd nuxt
yarn test:reader-runtime-proxy
```

The SSR shards completed 193, 185, and 170 tests before the isolated 65-test
lane. E2E shard results were 401 ordinary passes plus one flaky pass and one
skip; 347 passes; and 254 ordinary passes plus one flaky pass and eight skips.
No whole-command retry was needed. The two recovered tests were the authored
document navigation URL wait and the Text Search mounted-root visual wait; both
remain visible release-observation concerns rather than final failures.

Independent semantic review was refreshed until the runner reported `No
independent semantic review work remains`. Eleven earlier Important findings were
reproduced with focused failing tests and remediated before the complete matrix.
The later runtime review found that an accepted-response-lost multi-event retry
could remain trapped behind the backend's atomic replay conflict. The fix splits a
conflicted batch into bounded per-ID recovery, commits replayed and newly accepted
IDs locally, and releases only unresolved IDs. Its two focused scenarios failed
before the fix and passed after it. The three resulting stale semantic packets were
independently approved and committed in `3fdfb06b`; final check/queue remain clean
at 681 approved with no unresolved Critical or Important finding.

## Readiness matrix

| Area | Status | Evidence and remaining requirement |
| --- | --- | --- |
| Application behavior, parity, and local build | Ready | The earlier complete unit, SSR, desktop/mobile browser, static, architecture, maintainability, and local production-build matrix passed; the final built-output Reader proxy gate also passed against the reviewed runtime head. |
| Application observability | Ready | Browser delivery, intake, per-ID replay recovery, timeout, rate-limit, correlation, identity, and server-event code passed focused post-fix tests and independent semantic review. |
| Backend hydration and generated contract | Ready | 1,954 backend v2 tests and the exact OpenAPI snapshot check passed; the documented blocking Ruff subset is clean. |
| Infrastructure observability | Ready | Log pipeline, dashboard, alert, verifier, and secret-mapping tests passed; live Stage alert delivery is still pending. |
| Release approval and promotion tooling | Ready | Production job, approval, and promotion suites passed locally, including fail-closed rendered candidate identity checks before plan and apply; the CLI has not been applied or used to mutate Nomad. |
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
