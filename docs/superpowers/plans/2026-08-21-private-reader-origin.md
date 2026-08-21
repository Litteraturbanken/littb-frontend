# Private Reader Origin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision and rehearse a private, redundant Reader asset origin that cannot loop through the Nuxt production hostname.

**Architecture:** Two managed outer load balancers expose one path- and method-restricted private Caddy authority backed by both legacy content servers with the required upstream Host header. Legacy DNS publishes both private load-balancer addresses, while Nuxt, its Stage/production jobspecs, promotion tooling, and monitoring accept exactly that authority and reject deceptive empty responses before a new allocation becomes healthy.

**Tech Stack:** Caddy 2, dnsmasq, Ansible, HCL/Nomad, Nuxt 4/H3, Node.js 22 Fetch/Undici, Python 3.12/pytest, Vitest, Playwright, shell, Git.

**Spec:** `docs/superpowers/specs/2026-08-21-private-reader-origin-design.md`

## Global Constraints

- The canonical origin is exactly `http://reader-origin.int.lb.se` with no explicit port or trailing path.
- Production is not deployed by this plan.
- Reader routes are GET/HEAD-only and limited to `/txt/*`, `/bilder/*`, and `/export/faksimil/*`.
- Startup verification requires 2xx, `text/css`, a nonempty bounded body, no cross-origin redirect, and a total timeout.
- Ordinary Nuxt liveness remains independent of Reader availability after startup.
- Never forward Cookie, Authorization, or Proxy-Authorization to the legacy content hosts.
- Preserve unrelated dirty files and commits in all three repositories.
- Never print Reader response bodies, credentials, tokens, or secret material during verification.
- A failed outer-load-balancer DNS failover rehearsal is a release blocker, not a test to weaken.

---

### Task 1: Private DNS and dual-load-balancer origin

**Files:**
- Modify: `/Users/johan/dev/lb-meta/konfigfiler/lb-dns/etc/hosts.int.lb.se`
- Create: `/Users/johan/dev/lb-meta/tests/test_reader_origin_dns.py`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/ansible/roles/legacy-loadbalancer/files/Caddyfile`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/tests/test_legacy_loadbalancer_failover.py`
- Create: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/scripts/reader_origin_probe.py`
- Create: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/scripts/verify_reader_origin.py`
- Create: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/tests/test_verify_reader_origin.py`

**Interfaces:**
- Consumes: legacy hosts `lb-apache` and `lb-webserver-a`, both of which require `Host: litteraturbanken.se`.
- Produces: `http://reader-origin.int.lb.se`; `probe_asset(origin, path, *, method="GET", headers=None, connect_address=None, timeout=10.0, max_bytes=1_048_576) -> ProbeResult` in `reader_origin_probe.py`; and a read-only verifier CLI accepting `--origin`, optional `--resolve HOST:PORT:ADDRESS`, and representative path checks.

- [ ] **Step 1: Create failing DNS and Caddy contract tests**

Add a repository-local `unittest` which requires exactly two `reader-origin.int.lb.se` records with addresses `10.1.0.19` and `10.1.0.3`. Add infra tests which require one Caddy block containing:

```caddyfile
http://reader-origin.int.lb.se {
	@reader_assets {
		method GET HEAD
		path /txt/* /bilder/* /export/faksimil/*
	}
	handle @reader_assets {
		reverse_proxy http://lb-apache http://lb-webserver-a {
			lb_policy round_robin
			lb_try_duration 5s
			lb_try_interval 250ms
			health_uri /txt/css/lb1728740-etext.css
			health_interval 10s
			health_timeout 5s
			health_status 2xx
			health_headers {
				Host litteraturbanken.se
			}
			header_up Host litteraturbanken.se
			header_up X-Forwarded-Proto https
			header_up -Cookie
			header_up -Authorization
			header_up -Proxy-Authorization
		}
	}
	respond 404
}
```

The test must parse the block boundary and prove that no unrestricted fallback exists inside it.

- [ ] **Step 2: Run the focused tests and capture RED**

Run:

```bash
cd /Users/johan/dev/lb-meta
python3 -m unittest tests/test_reader_origin_dns.py
cd /Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821
/Users/johan/dev/lb-infra/virtual_env/bin/python -m pytest -q \
  tests/test_legacy_loadbalancer_failover.py \
  tests/test_verify_reader_origin.py
```

Expected: failures for the absent private authority/verifier, while pre-existing tests remain green.

- [ ] **Step 3: Implement the minimal DNS and Caddy source changes**

Add only the two DNS records to the `lb-meta` source. Add the exact restricted Caddy block to the managed load-balancer Caddyfile. Do not alter the existing public `litteraturbanken.se` block.

- [ ] **Step 4: Implement the bounded Reader-origin verifier**

`reader_origin_probe.py` must use the standard library HTTP client, disable redirects, cap each body at 1 MiB, and enforce a ten-second timeout. `verify_reader_origin.py` uses that helper to validate representative CSS, JPEG, PNG, EPUB Range, PDF Range, allowed HEAD, rejected POST, and rejected `/api/liveness`. It must report only path/status/type/byte-count summaries. A `--resolve` option must pass a connect address to `probe_asset` while preserving `Host: reader-origin.int.lb.se`, so each load balancer can be verified independently before DNS deployment.

- [ ] **Step 5: Run GREEN, Caddy validation, and repository scope checks**

Run:

```bash
cd /Users/johan/dev/lb-meta
python3 -m unittest tests/test_reader_origin_dns.py
cd /Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821
/Users/johan/dev/lb-infra/virtual_env/bin/python -m pytest -q \
  tests/test_legacy_loadbalancer_failover.py \
  tests/test_verify_reader_origin.py
caddy validate --config ansible/roles/legacy-loadbalancer/files/Caddyfile
git diff --check
git -C /Users/johan/dev/lb-meta diff --check
```

Expected: all focused tests and validation pass; only the intended files differ.

- [ ] **Step 6: Commit repository-local changes**

In `lb-meta`, stage only the two new DNS lines and focused test using an index patch; verify the existing mail/snapshot operator diff remains unstaged. Commit message: `Add private Reader origin DNS records`.

In `lb-infra`, commit only the Caddy/verifier/tests with message: `Provision private Reader origin boundary`.

---

### Task 2: Exact Nuxt origin policy and allocation preflight

**Files:**
- Modify: `nuxt/server/utils/reader-source-proxy.ts`
- Modify: `nuxt/test/unit/reader-source.spec.ts`
- Create: `nuxt/scripts/verify-reader-origin.mjs`
- Create: `nuxt/test/unit/reader-origin-preflight.spec.ts`
- Modify: `nuxt/Dockerfile`
- Modify: `jobs/lb-frontend-stage.nomad`
- Modify: `scripts/deploy-stage.sh`
- Modify: `nuxt/test/unit/stage-deployment.spec.ts`

**Interfaces:**
- Consumes: the exact origin from Task 1.
- Produces: `assertReaderOriginConfiguration(value, deploymentEnvironment)` in the proxy owner and a runtime CLI `node scripts/verify-reader-origin.mjs` copied into the production image.

- [ ] **Step 1: Add failing exact-origin proxy tests**

For deployment environments `staging` and `production`, require only `http://reader-origin.int.lb.se`. Add rejection cases for HTTPS, uppercase/trailing-dot host spellings, explicit port, trailing slash beyond the canonical URL representation, path/query/fragment, credentials, public production, either backend host, and either load-balancer IP. Preserve development fixture origins.

- [ ] **Step 2: Add failing preflight tests with a real local HTTP server**

The test server matrix must cover valid CSS, empty `200`, missing/wrong content type, 3xx, cross-origin redirect, oversized body, timeout/abort, HTTP error, and transport error. The successful request must target:

```text
/txt/css/lb1728740-etext.css
```

The CLI must exit nonzero without printing body bytes for every invalid case.

- [ ] **Step 3: Run the focused unit tests and capture RED**

Run:

```bash
cd nuxt
yarn vitest run test/unit/reader-source.spec.ts \
  test/unit/reader-origin-preflight.spec.ts \
  test/unit/stage-deployment.spec.ts --reporter=dot
```

Expected: failures for absent exact-origin and preflight behavior.

- [ ] **Step 4: Implement exact runtime validation and the preflight CLI**

For `staging` and `production`, compare the raw configured value to the exact canonical origin after the existing text/URL authority validation. The preflight script must use `AbortSignal.timeout(10_000)`, `redirect: "manual"`, accept only status 200-299 and `content-type` matching `/^text\/css(?:;|$)/iu`, read at most 1 MiB plus one byte, and fail on zero bytes or overflow. Export the check function for tests and run it only when the file is invoked as the CLI entry point.

- [ ] **Step 5: Ship and invoke the preflight in both Stage allocations**

Copy the script into the runtime image:

```dockerfile
COPY --from=build --chown=node:node /app/scripts/verify-reader-origin.mjs ./scripts/verify-reader-origin.mjs
```

Set the Stage jobspec and deploy script defaults to the canonical origin. Invoke:

```sh
node scripts/verify-reader-origin.mjs
```

after identity/origin validation but before `exec node .output/server/index.mjs`.

- [ ] **Step 6: Run GREEN and broad frontend gates**

Run:

```bash
cd nuxt
yarn vitest run test/unit/reader-source.spec.ts \
  test/unit/reader-origin-preflight.spec.ts \
  test/unit/stage-deployment.spec.ts --reporter=dot
yarn lint
yarn typecheck
yarn policy:check
yarn quality:maintainability
yarn build
cd ..
git diff --check
```

Expected: all commands exit zero and no production deployment occurs.

- [ ] **Step 7: Commit the exact frontend packet**

Commit message: `Require the private Reader origin`.

---

### Task 3: Production promotion contract, monitoring, and runbook

**Files:**
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/jobs/lb-frontend-live.nomad`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/scripts/promote_lb_frontend.py`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/scripts/verify_lb_observability.py`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/tests/test_lb_frontend_live_job.py`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/tests/test_promote_lb_frontend.py`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/tests/test_verify_lb_observability.py`
- Modify: `/Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821/docs/runbooks/lb-frontend-release.md`

**Interfaces:**
- Consumes: Task 1 origin, `probe_asset` from `scripts/reader_origin_probe.py`, and Task 2 runtime preflight command.
- Produces: production jobspec exact origin/default, promotion exact equality gate, and Stage/public Reader semantic monitoring.

- [ ] **Step 1: Add RED contracts for production and promotion**

Require the production jobspec to default and validate exactly `http://reader-origin.int.lb.se`, invoke the same preflight before Node, and reject every alternative origin. Require promotion to reject candidate CLI/environment input which is not exactly canonical and to compare both Stage env names against that value before plan and again after confirmation.

- [ ] **Step 2: Add RED observability tests**

Extend the Stage profile with one read-only public probe for:

```text
https://stage.litteraturbanken.se/txt/css/lb1728740-etext.css
```

Require 2xx, `text/css`, a nonempty body capped at 1 MiB, and no body/header logging. Keep the production probe defined but do not run a production mutation or deployment.

- [ ] **Step 3: Run focused RED**

Run:

```bash
cd /Users/johan/dev/lb-infra/.worktrees/stage-parity-20260821
/Users/johan/dev/lb-infra/virtual_env/bin/python -m pytest -q \
  tests/test_lb_frontend_live_job.py \
  tests/test_promote_lb_frontend.py \
  tests/test_verify_lb_observability.py
```

Expected: exact-origin/preflight/probe assertions fail.

- [ ] **Step 4: Implement production and promotion guards**

Use one constant `READER_SOURCE_BASE = "http://reader-origin.int.lb.se"` in the promotion owner. Do not retain the placeholder `.example` authority or accept user-selected origins. Rendered-job validation must compare both `READER_SOURCE_BASE` and `NUXT_READER_SOURCE_BASE` byte-for-byte to the constant before plan and immediately before `nomad job run`.

- [ ] **Step 5: Implement semantic Reader monitoring**

Import and call `probe_asset` from `reader_origin_probe.py`; never record payload bytes. A failed Reader probe must make the observability command fail with a path/status/type/size reason suitable for the release gate.

- [ ] **Step 6: Update the release runbook**

Document exact source repositories/commits, per-load-balancer `--resolve` verification, DNS answer checks, allocation-side preflight evidence, backend and load-balancer failure rehearsal, the multi-A Node/Undici release blocker, public Reader smoke tests, and consumer-first rollback order. Remove `https://reader-origin.internal.example`.

- [ ] **Step 7: Run GREEN and broad infra gates**

Run:

```bash
/Users/johan/dev/lb-infra/virtual_env/bin/python -m pytest -q tests
/Users/johan/dev/lb-infra/virtual_env/bin/python -m ruff check \
  scripts/promote_lb_frontend.py scripts/verify_lb_observability.py \
  scripts/verify_reader_origin.py tests/test_promote_lb_frontend.py \
  tests/test_verify_lb_observability.py tests/test_verify_reader_origin.py
nomad job validate \
  -var 'image=registry.service.consul:5000/lb-frontend@sha256:1111111111111111111111111111111111111111111111111111111111111111' \
  -var 'image_digest=sha256:1111111111111111111111111111111111111111111111111111111111111111' \
  -var 'git_sha=1111111111111111111111111111111111111111' \
  -var 'reader_source_base=http://reader-origin.int.lb.se' \
  jobs/lb-frontend-live.nomad
git diff --check
```

Expected: all tests/lint/validation pass.

- [ ] **Step 8: Commit the exact infra packet**

Commit message: `Gate releases on the private Reader origin`.

---

### Task 4: Independent source review and private-provider deployment

**Files:**
- Review exact commit ranges from Tasks 1-3.
- Live mutation targets: both managed load balancer Caddyfiles and `/etc/hosts.int.lb.se` on `lb-dns`.

**Interfaces:**
- Consumes: committed source packets and their test evidence.
- Produces: validated private provider boundary, without changing a frontend allocation yet.

- [ ] **Step 1: Obtain independent review of each repository range**

Reviewers must inspect exact parent/HEAD ranges, tests, path/method restrictions, redirect/body bounds, secret-header stripping, dirty-work preservation, rollback, and absence of production deployment. Fix all Critical and Important findings test-first, then re-review.

- [ ] **Step 2: Deploy Caddy to the standby load balancer first**

Render/validate locally, copy only the managed Caddyfile to a temporary remote path, validate remotely, atomically install, reload Caddy, and verify the private origin using `--resolve reader-origin.int.lb.se:80:10.1.0.3`. If any check fails, restore the prior file and stop.

- [ ] **Step 3: Deploy Caddy to the primary load balancer**

Repeat the same validate/install/reload/verify sequence for `10.1.0.19`. Confirm both remote files hash to the committed managed source.

- [ ] **Step 4: Patch live DNS without replacing unrelated live content**

Capture a remote checksum and backup, append exactly the two missing records only if absent, run `dnsmasq --test`, atomically install, reload dnsmasq, and verify:

```bash
dig +short @10.1.0.9 reader-origin.int.lb.se A
```

Expected sorted answers: `10.1.0.3` and `10.1.0.19` only. Confirm the pre-deployment file minus the two inserted lines is byte-identical to the post-deployment file minus those lines.

- [ ] **Step 5: Run provider-boundary and failover rehearsal**

Verify each address independently and DNS resolution from a real Stage/Nomad allocation. Temporarily disable one legacy upstream through a safe load-balancer test mechanism or isolated test configuration; prove requests continue through the other, then restore and validate. Test one unreachable outer-LB address using the same Node 22/Undici resolution path used by Nuxt. If it does not retry the other address, record the release blocker and stop before accepting the topology.

---

### Task 5: Stage consumer deployment and end-to-end acceptance

**Files:**
- Modify only audit/handover documentation if verification uncovers no source defect.
- Any defect found during rehearsal starts a new RED/GREEN task and separately reviewed commit.

**Interfaces:**
- Consumes: verified private provider, exact frontend commit, immutable image digest, and current Stage approval.
- Produces: two healthy Stage allocations using the private origin plus release evidence.

- [ ] **Step 1: Run local predeployment gates with parallel workers**

Run the frontend unit/SSR/E2E/lint/typecheck/policy/maintainability/build matrix using the repository's sharded runners and available laptop workers. Run infra focused/full tests. Confirm all repository worktrees and exact commit SHAs before deployment.

- [ ] **Step 2: Build and deploy the exact frontend commit to Stage**

Use `scripts/deploy-stage.sh <exact-sha>` with the normal digest resolver and Nomad token. Require an authenticated plan and rolling deployment. Do not override `READER_SOURCE_BASE`; the committed canonical default is authoritative.

- [ ] **Step 3: Verify allocation identity and startup preflight**

Require two healthy allocations on distinct nodes, zero restarts, exact SHA/image digest, exact Reader env values, and startup logs showing only a successful status/type/byte-count summary—never body content.

- [ ] **Step 4: Run Stage public acceptance**

Run the full Stage live suite with at least four workers, the read-only and write observability gates, built-output Reader proxy tests, public Reader navigation/assets/ranges, and browser console/hydration monitoring. Confirm no Reader request reaches public production.

- [ ] **Step 5: Rehearse consumer and provider failure behavior**

Roll one Stage allocation, verify the other serves traffic, test legacy-backend failover, and repeat the Node/Undici outer-LB failure case from within the deployed image. Restore every temporary failure before continuing.

- [ ] **Step 6: Record immutable evidence and continue the production audit**

Record exact source commits, image digest, Nomad job/deployment/allocation IDs, DNS answers, Caddy hashes, test counts/timings, observability sentinel, failure-rehearsal results, rollback commands, and remaining blockers in the release audit/handover. Then continue reviewing production topology, performance, security, and observability; do not declare production readiness while any release blocker remains.
