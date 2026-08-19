# Fast test runner and production-readiness audit design

## Status

Approved in conversation on 2026-08-19. This document defines the implementation
contract; it does not authorize a production deployment.

## Problem

The Nuxt unit suite has 96 files and 2,829 tests. On an 18-core development
machine, the default Vitest run repeatedly times out the first ESLint policy test
at its generic five-second limit. The same test passes alone in about 1.55
seconds, while a full run with an explicit twelve-worker cap passes all 2,829
tests. The failure is cold ESLint initialization under aggregate worker load,
not an assertion or application regression.

The larger browser bottleneck is structural. `nuxt/playwright.config.ts`
deliberately uses one worker because browser and SSR tests share and mutate one
fixture server. Many tests also hard-code port 4100. Raising the existing worker
count would let unrelated tests reset or reconfigure the same fixture concurrently
and would make the suite faster only by making it nondeterministic. The last
complete desktop/mobile run took roughly 18.4 minutes with one worker.

Finally, staging is deployed and validated, but the repository currently exposes
only a staging Nomad jobspec and staging deploy script. A production-readiness
claim requires an explicit audit of the remaining cutover path rather than an
assumption that a successful staging deployment is itself a production plan.

## Goals

1. Make the default unit suite reliable under parallel load without globally
   relaxing test timeouts.
2. Use the laptop's CPU capacity to shorten SSR and desktop/mobile Playwright
   execution while preserving fixture isolation and test determinism.
3. Keep worker selection safe on smaller CI hosts.
4. Preserve a single command for each existing suite and propagate any shard
   failure as a nonzero command result.
5. Produce an evidence-backed production-readiness audit and a concrete ordered
   path from the current staging state to a production cutover.

## Non-goals

- Changing application behavior or production source code.
- Deploying, pushing, merging, changing Nomad jobs, or accessing credentials.
- Making tests pass by retrying assertions or hiding failures.
- Running multiple workers against one mutable fixture server.
- Treating historical staging identifiers as current runtime guarantees.

## Unit runner design

`nuxt/vitest.config.ts` will set `maxWorkers` to the smaller of twelve and
Node's `availableParallelism()`. This gives the 18-core laptop twelve workers
while avoiding oversubscription on smaller CI machines. Both Vitest projects
inherit the same cap.

Only the first ESLint quality test receives a 15-second timeout. It uniquely
pays the cold ESLint/plugin initialization cost; later cases reuse that state.
The generic Vitest timeout remains unchanged, so unrelated hangs still fail in
five seconds.

The pre-change RED authority is the reproducible full-suite timeout. The
post-change authority is the unchanged ESLint assertion passing within its
explicit budget and the complete unit suite passing with the configured worker
cap. A configuration unit test will pin the adaptive cap so it cannot silently
return to an unbounded default.

## Isolated Playwright sharding

### Execution model

A small Node orchestrator under `nuxt/scripts/` will run Playwright in four
parallel subprocesses by default. The effective shard count is bounded by
`availableParallelism()` and may be overridden with an explicit positive
environment variable for constrained or diagnostic runs.

Each subprocess receives:

- one Playwright shard (`--shard=i/n`);
- `--workers=1`, preserving serial execution inside its mutable fixture;
- a unique `LBAPI_FIXTURE_PORT`;
- a unique `LITTB_NUXT_TEST_PORT`;
- a unique `NUXT_BUILD_DIR` under a run-owned directory in
  `node_modules/.cache/littb-playwright/`;
- a unique `PLAYWRIGHT_OUTPUT_DIR`; and
- `NUXT_IGNORE_LOCK=1` so isolated Nuxt development servers may coexist.

The existing `test:ssr` command will invoke the orchestrator for the `ssr`
project. The existing `test:e2e` command will invoke it for the desktop and
mobile projects. Callers keep the same public commands.

The orchestrator will forward output, return zero only when every shard returns
zero, and terminate remaining children when one shard fails or the parent
receives an interrupt. It must never leave fixture, Nuxt, or Playwright
processes behind. It removes only its own run directory after success, failure,
or interruption. `nuxt.config.ts` and `playwright.config.ts` retain their current
defaults when the isolation variables are absent.

### Port authority

Every operational fixture or application origin in `nuxt/test/e2e/` and
`nuxt/test/ssr/` will derive from `LBAPI_FIXTURE_PORT` and
`LITTB_NUXT_TEST_PORT`, retaining 4100 and 3000 as defaults. Literal URLs used
only as inert unit-test data are outside this migration.

This is a mechanical transport-boundary change: assertions, fixture modes,
routes, screenshots, and product behavior remain unchanged. A static unit test
will reject new hard-coded operational 4100/3000 origins in browser and SSR
specs.

### Shard authority

Unit tests will cover:

- adaptive default shard count;
- explicit valid and invalid overrides;
- unique deterministic port allocation;
- unique Nuxt build and Playwright output directories;
- exact Playwright project/shard/worker arguments;
- nonzero failure propagation; and
- sibling termination plus run-owned directory cleanup on failure or signal.

A focused RED will first demonstrate that the current suite cannot execute two
isolated shards because hard-coded fixture origins still point both processes at
4100. GREEN requires two concurrent representative shards to use distinct
fixture and Nuxt ports successfully. Final verification runs all configured SSR
shards and all configured desktop/mobile shards and records elapsed time.

## Live-stage smoke parallelism

`playwright.nuxt-live.config.js` targets an already-running immutable staging
deployment and does not manipulate the local fixture. Its sixteen tests perform
read-only navigation/search assertions. It will use `fullyParallel: true` and
an adaptive worker count capped at four. The live preflight remains a single
global setup, and retries remain disabled.

No live-stage run is part of implementation unless network access and the stage
environment are intentionally available. Configuration tests must still pin the
parallelism contract locally.

## Verification gates

The implementation is complete only when the exact changed tree passes:

1. focused runner/configuration units;
2. full `yarn test:unit` with the configured adaptive workers;
3. full sharded `yarn test:ssr`;
4. full sharded `yarn test:e2e` for desktop and mobile;
5. `yarn lint`;
6. `yarn typecheck`;
7. `yarn policy:check`;
8. `yarn quality:maintainability`;
9. `yarn build`;
10. `git diff --check`; and
11. process/port hygiene after the runs.

The browser run must have zero failures and zero retries. Intentional skips may
remain. Performance is reported as evidence rather than encoded as a brittle
wall-clock assertion.

## Production-readiness audit

After runner verification, a read-only audit will classify each area as ready,
conditionally ready, or blocked:

- immutable build/image provenance;
- production Nomad/service/routing topology;
- production configuration and secrets;
- backend and managed-content dependencies;
- database/index/schema compatibility;
- security headers, robots/indexing, and origin policy;
- observability, alerts, dashboards, and deploy markers;
- capacity, health checks, rescheduling, and resource limits;
- CI enforcement of Node 22, unit, SSR, E2E, lint, types, policy,
  maintainability, build, and semantic-review integrity;
- production smoke and acceptance coverage;
- rollback mechanics and operator runbook;
- DNS/TLS/cutover sequencing; and
- post-cutover monitoring and rollback thresholds.

The audit will distinguish repository evidence, observed staging evidence, and
items requiring infrastructure-owner confirmation. It will not invent a
production jobspec or declare production readiness while required production
topology, CI, rollback, or operational evidence is absent.

## Expected delivery

The code change will be committed separately from this design. The final report
will include worker counts, before/after durations, complete verification
results, the production-readiness classification, blocking gaps, and an ordered
cutover checklist. No production deployment will occur without a later explicit
authorization.
