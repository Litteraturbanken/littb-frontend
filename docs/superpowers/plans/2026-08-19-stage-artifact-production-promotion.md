# Stage Artifact Production Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Nuxt frontend once, prove and approve that exact digest on Stage, and promote the unchanged digest to a production Nomad job with human-controlled rollback.

**Architecture:** The frontend exposes trusted runtime identity and Stage deploys a digest-qualified image. Infrastructure owns a production Nomad job, a versioned approval record, and a fail-closed promotion CLI that compares Stage, approval, production input, and rollback state before registration.

**Tech Stack:** Bash, Python 3, Vitest, Playwright, Docker Registry HTTP API, Nomad 2, Consul, Caddy, SOPS-backed Nomad Variables, JSON release records.

**Spec:** `docs/superpowers/specs/2026-08-19-stage-artifact-promotion-production-observability-design.md`

## Global Constraints

- Frontend repository: `/Users/johan/.codex/worktrees/8c5c/littb`.
- Infrastructure repository: `/Users/johan/dev/lb-infra`.
- Complete both observability plans before any live promotion.
- Preserve every pre-existing dirty infrastructure file and stage explicit paths/hunks.
- Build once; Stage and production use the same `registry/repository@sha256:<64 hex>` reference.
- A mutable tag is never a promotion identity.
- Production infrastructure is canonical in `lb-infra`.
- Use host networking, Docker `network_mode = "host"`, Consul services, and public Caddy tags.
- Use task-scoped Nomad Variables for the production observability HMAC secret.
- `reader_source_base` is a required, separately verified non-public-looping origin.
- No automatic rollback.
- No Stage or production deployment without separate explicit authorization.

---

### Task 1: Expose and Test Runtime Deployment Identity

**Files:**
- Modify: `nuxt/nuxt.config.ts`
- Create: `nuxt/server/routes/_deployment.get.ts`
- Create: `nuxt/server/utils/deployment-identity.ts`
- Create: `nuxt/test/unit/deployment-identity.spec.ts`
- Create: `nuxt/test/ssr/deployment-identity.spec.ts`
- Modify: `nuxt/playwright.config.ts`

**Interfaces:**
- Produces: `deploymentIdentity(config): DeploymentIdentity`.
- Produces: `GET /_deployment` JSON `{schema_version, environment, git_sha, image_digest}`.

- [ ] **Step 1: Write RED unit and SSR tests**

Use this exact public response type:

```ts
export interface DeploymentIdentity {
  schema_version: "lb.frontend.deployment.v1"
  environment: "stage" | "production" | "development"
  git_sha: string
  image_digest: string
}
```

Require 40 lowercase hex for `git_sha` and `sha256:` plus 64 lowercase hex for `image_digest`. Invalid values become all-zero sentinel values only in development; Stage/production return HTTP 503 when either identity is invalid. Assert `cache-control: no-store` and no registry host/tag is exposed.

- [ ] **Step 2: Run RED**

```bash
cd nuxt
yarn vitest run test/unit/deployment-identity.spec.ts --reporter=verbose
yarn playwright test test/ssr/deployment-identity.spec.ts \
  --project=ssr --workers=1 --reporter=line
```

Expected: FAIL because the identity utility/route does not exist.

- [ ] **Step 3: Implement runtime identity**

Add private runtime config:

```ts
deploymentImageDigest: process.env.IMAGE_DIGEST || "",
```

Implement normalization without accepting tags or full image refs. The route reads `deploymentEnvironment`, `deploymentGitSha`, and `deploymentImageDigest`, sets `cache-control: no-store`, and returns the closed object. Extend Playwright's owned Nuxt command with deterministic test `IMAGE_DIGEST=sha256:${"b".repeat(64)}`.

- [ ] **Step 4: Run GREEN and commit**

```bash
cd nuxt
yarn vitest run test/unit/deployment-identity.spec.ts test/unit/nuxt-config.spec.ts
yarn playwright test test/ssr/deployment-identity.spec.ts \
  --project=ssr --workers=1
yarn eslint server/routes/_deployment.get.ts \
  server/utils/deployment-identity.ts test/unit/deployment-identity.spec.ts \
  test/ssr/deployment-identity.spec.ts playwright.config.ts nuxt.config.ts
yarn typecheck
cd ..
git add nuxt/nuxt.config.ts nuxt/playwright.config.ts \
  nuxt/server/routes/_deployment.get.ts \
  nuxt/server/utils/deployment-identity.ts \
  nuxt/test/unit/deployment-identity.spec.ts \
  nuxt/test/ssr/deployment-identity.spec.ts
git diff --cached --check
git commit -m "feat(deploy): expose immutable runtime identity"
```

### Task 2: Make Stage Deploy the Registry Digest

**Files:**
- Modify: `scripts/deploy-stage.sh`
- Modify: `jobs/lb-frontend-stage.nomad`
- Modify: `nuxt/test/unit/stage-deployment.spec.ts`
- Modify: `test/e2e/nuxt_live_preflight.cjs`
- Modify: `test/e2e/playwright_e2e.spec.js`
- Modify: `playwright.nuxt-live.config.js`

**Interfaces:**
- Produces: `resolve_registry_digest(image_ref)` behavior in the Stage script.
- Produces env `IMAGE_DIGEST` and Nomad meta `image_digest`.
- Live preflight optionally consumes `LITTB_EXPECTED_GIT_SHA` and `LITTB_EXPECTED_IMAGE_DIGEST` together.

- [ ] **Step 1: Write deployment RED tests**

Extend the static unit to require:

- Registry `HEAD /v2/<repository>/manifests/<sha-tag>` with an OCI/Docker manifest Accept header.
- Exact `Docker-Content-Digest` validation.
- deployed image reference `${registry}/${image}@${digest}`.
- jobspec variables/meta/env for Git SHA and digest.
- rejection of missing/malformed digest before `nomad run`.

Extend live config tests to require both expected identity variables or neither. Extend preflight to fetch `/_deployment` and compare exact SHA/digest when configured.

- [ ] **Step 2: Run RED**

```bash
cd nuxt
yarn vitest run test/unit/stage-deployment.spec.ts \
  test/unit/nuxt-live-runner.spec.ts --reporter=verbose
```

Expected: FAIL because Stage still submits a tag-qualified image and live preflight does not verify identity.

- [ ] **Step 3: Resolve the digest safely**

After the builder completes, use inline Python to parse the configured registry/repository/tag, issue a manifest HEAD request, and print only a validated `sha256:<64 lowercase hex>` value. The function must reject redirects to another authority, missing headers, authentication errors, and non-digest values. Construct:

```bash
image_digest="$(resolve_registry_digest "$image_ref")"
immutable_image_ref="${registry_host}/${image_name}@${image_digest}"
```

Pass `-var image="$immutable_image_ref" -var image_digest="$image_digest" -var git_sha="$git_sha"` to validate and run. Never print credentials.

- [ ] **Step 4: Update Stage identity and live checks**

Add jobspec variable `image_digest`, job meta, `IMAGE_DIGEST`, and `NUXT_DEPLOYMENT_IMAGE_DIGEST`. The entrypoint verifies the digest pattern. The live suite checks `/_deployment` before other tests when expected identity is configured and adds one test asserting the same identity after hydration journeys.

- [ ] **Step 5: Run GREEN and commit**

```bash
cd nuxt
yarn vitest run test/unit/stage-deployment.spec.ts \
  test/unit/nuxt-live-runner.spec.ts
yarn eslint test/unit/stage-deployment.spec.ts \
  test/unit/nuxt-live-runner.spec.ts
node --check ../test/e2e/nuxt_live_preflight.cjs
node --check ../test/e2e/playwright_e2e.spec.js
bash -n ../scripts/deploy-stage.sh
git diff --check -- ../scripts/deploy-stage.sh ../jobs/lb-frontend-stage.nomad \
  ../playwright.nuxt-live.config.js ../test/e2e/nuxt_live_preflight.cjs \
  ../test/e2e/playwright_e2e.spec.js test/unit/stage-deployment.spec.ts \
  test/unit/nuxt-live-runner.spec.ts
cd ..
git add scripts/deploy-stage.sh jobs/lb-frontend-stage.nomad \
  playwright.nuxt-live.config.js test/e2e/nuxt_live_preflight.cjs \
  test/e2e/playwright_e2e.spec.js \
  nuxt/test/unit/stage-deployment.spec.ts \
  nuxt/test/unit/nuxt-live-runner.spec.ts
git commit -m "feat(deploy): pin staging by image digest"
```

Do not run the Stage deployment.

### Task 3: Add the Production Frontend Nomad Job

**Files:**
- Create: `/Users/johan/dev/lb-infra/jobs/lb-frontend-live.nomad`
- Modify: `/Users/johan/dev/lb-infra/config/nomad-secret-map.yaml`
- Create: `/Users/johan/dev/lb-infra/tests/test_lb_frontend_live_job.py`

**Interfaces:**
- Produces Nomad job `lb-frontend-live`, service `lb-frontend-live`.
- Required variables: `image`, `image_digest`, `git_sha`, `reader_source_base`.
- Defaults: public host `litteraturbanken.se`, port `3021`, backend `http://lb-backend-live.service.consul:5001`, content `https://red.litteraturbanken.se`.

- [ ] **Step 1: Record dirty infra state and write RED tests**

```bash
cd /Users/johan/dev/lb-infra
git status --short
git diff -- config/nomad-secret-map.yaml
```

Create tests requiring:

- `image` matches digest-qualified form and entrypoint fails otherwise;
- host networking at group and Docker task;
- group count `2`, rolling `max_parallel = 1`, `auto_revert = true`;
- `constraint { distinct_hosts = true }` so the two fixed-port allocations cannot share a node;
- service/public Caddy tags for `litteraturbanken.se`;
- readiness check on `/_deployment` and restart policy;
- exact Git SHA/digest metadata and environment;
- backend production service URLs;
- required Reader source and a startup guard rejecting the public host as its authority;
- task secret path `nomad/jobs/lb-frontend-live/frontend/frontend`;
- no host secret mount or static Nomad token.

- [ ] **Step 2: Run RED**

```bash
python3 -m pytest -q tests/test_lb_frontend_live_job.py
```

Expected: FAIL because the jobspec is absent.

- [ ] **Step 3: Implement the production job**

Use required variables and this secret block:

```hcl
secret "runtime" {
  provider = "nomad"
  path     = "nomad/jobs/lb-frontend-live/frontend/frontend"
  config { namespace = "default" }
}
```

Inject `${secret.runtime.observability_hmac_secret}` as `NUXT_OBSERVABILITY_HMAC_SECRET`; do not materialize it. Set production runtime environment/allowed origin, SHA, digest, API/content/Reader bases, `HOST`, and allocated port. Use two allocations constrained to distinct hosts, host networking, fixed `3021`, public Caddy tags, readiness, restart/reschedule, and rolling update.

Add to the secret map:

```yaml
- namespace: default
  path: nomad/jobs/lb-frontend-live/frontend/frontend
  items:
    observability_hmac_secret: lb_observability_hmac_secret
```

Do not edit the encrypted value; it already exists in SOPS.

- [ ] **Step 4: Run GREEN, secret validation, and Nomad validation**

```bash
python3 -m pytest -q tests/test_lb_frontend_live_job.py
python3 scripts/nomad_secrets.py validate
nomad job validate \
  -var 'image=registry.service.consul:5000/lb-frontend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
  -var 'image_digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
  -var 'git_sha=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' \
  -var 'reader_source_base=https://reader-origin.invalid' \
  jobs/lb-frontend-live.nomad
```

Expected: tests, secret-map validation, and jobspec validation pass. This does not register the job.

- [ ] **Step 5: Commit only owned paths**

```bash
git add jobs/lb-frontend-live.nomad tests/test_lb_frontend_live_job.py
git add -p config/nomad-secret-map.yaml
git diff --cached --check
git commit -m "feat(nomad): define production frontend"
```

### Task 4: Add a Versioned Editorial Approval Record

**Files:**
- Create: `/Users/johan/dev/lb-infra/schemas/lb-frontend-release-v1.schema.json`
- Create: `/Users/johan/dev/lb-infra/releases/lb-frontend/README.md`
- Create: `/Users/johan/dev/lb-infra/observability/lb_frontend_release.py`
- Create: `/Users/johan/dev/lb-infra/tests/test_lb_frontend_release.py`

**Interfaces:**
- Produces: `ReleaseApproval.from_path(path: Path) -> ReleaseApproval`.
- Produces: `validate_release_approval(value: object) -> ReleaseApproval`.
- JSON schema version: `lb.frontend.release.v1`.

- [ ] **Step 1: Write RED validation tests**

The accepted JSON object is exactly:

```json
{
  "schema_version": "lb.frontend.release.v1",
  "frontend_git_sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "image_ref": "registry.service.consul:5000/lb-frontend@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "image_digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "stage_job": "lb-frontend-stage",
  "stage_job_version": 34,
  "stage_allocation_id": "3041fa8a-25fa-4c1e-354f-3ecd95aadaf8",
  "automated_acceptance": {
    "completed_at": "2026-08-19T14:00:00Z",
    "live_tests_passed": 16,
    "live_tests_failed": 0,
    "observability_verified": true
  },
  "editorial_approval": {
    "approved_at": "2026-08-19T15:00:00Z",
    "approved_by": "Editorial team",
    "decision": "approved"
  }
}
```

Reject unknown/missing keys, mutable image tags, digest mismatch, malformed IDs/timestamps, zero tests, failures, false observability, non-approved decisions, and unsafe approver text.

- [ ] **Step 2: Run RED**

```bash
python3 -m pytest -q tests/test_lb_frontend_release.py
```

Expected: FAIL because schema/module are absent.

- [ ] **Step 3: Implement closed parsing**

Use frozen dataclasses and explicit type/pattern/range checks; do not coerce values. Validate schema JSON against the same cases. `from_path` rejects symlinks and files not owned by the current repository root. README documents creating the record only after automated Stage acceptance and editorial review, then committing it in a separate infra commit.

- [ ] **Step 4: Run GREEN and commit**

```bash
python3 -m pytest -q tests/test_lb_frontend_release.py
python3 -m json.tool schemas/lb-frontend-release-v1.schema.json >/dev/null
git add schemas/lb-frontend-release-v1.schema.json \
  releases/lb-frontend/README.md \
  observability/lb_frontend_release.py tests/test_lb_frontend_release.py
git diff --cached --check
git commit -m "feat(release): validate editorial approval"
```

### Task 5: Add the Fail-Closed Promotion CLI

**Files:**
- Create: `/Users/johan/dev/lb-infra/scripts/promote_lb_frontend.py`
- Create: `/Users/johan/dev/lb-infra/tests/test_promote_lb_frontend.py`
- Modify: `/Users/johan/dev/lb-infra/docs/runbooks/lb-observability.md`
- Create: `/Users/johan/dev/lb-infra/docs/runbooks/lb-frontend-release.md`

**Interfaces:**
- CLI: `python3 scripts/promote_lb_frontend.py --approval PATH --reader-source-base URL [--apply]`.
- Default mode validates and plans only.
- `--apply` requires interactive exact confirmation `promote <git-sha>`.

- [ ] **Step 1: Write fake-Nomad RED tests**

Inject a command runner and require the CLI to:

1. load the closed approval record;
2. require clean tracked infra paths and a committed approval record;
3. inspect `lb-frontend-stage` and match job version, SHA, image ref, and digest;
4. require healthy running Stage allocations;
5. run `verify_lb_observability.py --environment stage` read-only;
6. inspect current `lb-frontend-live` as the rollback target;
7. validate and plan the production job with exact variables;
8. reject `reader_source_base` whose authority equals `litteraturbanken.se`;
9. print candidate/current/rollback identities but no secret/environment values;
10. stop after plan unless `--apply` and exact confirmation are present;
11. apply with `nomad job run -detach -check-index=<current modify index>`;
12. verify deployment, allocations, `/_deployment`, production observability read-only mode, and smoke-command instructions.

Reject missing rollback state for updates, Stage drift, mutable tags, unhealthy telemetry, failed plan, concurrent index changes, and noninteractive apply.

- [ ] **Step 2: Run RED**

```bash
python3 -m pytest -q tests/test_promote_lb_frontend.py
```

Expected: FAIL because the promotion CLI does not exist.

- [ ] **Step 3: Implement deterministic orchestration**

Use `subprocess.run([...], shell=False, capture_output=True, text=True)` behind an injected `run_command`. Parse only JSON Nomad output. Build argument arrays, never shell strings. Normal mode ends after successful `nomad job plan`. Apply mode reads from a TTY and requires:

```text
promote <40-character-frontend-sha>
```

The CLI never dispatches a build, retags an image, edits an approval record, or rolls back automatically.

- [ ] **Step 4: Document promotion and rollback**

The release runbook includes:

```bash
export FRONTEND_SHA="$(git rev-parse HEAD)"
export READER_SOURCE_BASE="https://reader-origin.internal.example"

python3 scripts/promote_lb_frontend.py \
  --approval "releases/lb-frontend/${FRONTEND_SHA}.json" \
  --reader-source-base "$READER_SOURCE_BASE"

python3 scripts/promote_lb_frontend.py \
  --approval "releases/lb-frontend/${FRONTEND_SHA}.json" \
  --reader-source-base "$READER_SOURCE_BASE" \
  --apply
```

The runbook states that `READER_SOURCE_BASE` must be replaced with the separately verified, non-public-looping origin before either command is run. Document human rollback using the recorded previous job version/digest and the alert thresholds from the observability runbook.

- [ ] **Step 5: Run GREEN and commit**

```bash
python3 -m pytest -q \
  tests/test_promote_lb_frontend.py \
  tests/test_lb_frontend_release.py \
  tests/test_lb_frontend_live_job.py
python3 -m py_compile scripts/promote_lb_frontend.py \
  observability/lb_frontend_release.py
git add scripts/promote_lb_frontend.py tests/test_promote_lb_frontend.py \
  docs/runbooks/lb-frontend-release.md docs/runbooks/lb-observability.md
git diff --cached --check
git commit -m "feat(release): promote approved frontend digest"
```

### Task 6: Close the Local Release Candidate Without Deploying

**Files:**
- Modify: `docs/superpowers/2026-08-19-production-readiness-audit.md`
- Modify: `/Users/johan/dev/lb-infra/docs/runbooks/lb-frontend-release.md`
- No other intended changes.

**Interfaces:**
- Consumes all prior tasks.
- Produces an evidence-backed predeployment handoff; deployment remains separately authorized.

- [ ] **Step 1: Run complete backend and infrastructure gates**

```bash
cd /Users/johan/dev/lb-backend
virtual_env/bin/pytest -q test_lbapi/v2
virtual_env/bin/ruff check lbapi/v2 test_lbapi/v2
virtual_env/bin/python scripts/export_v2_openapi.py --check

cd /Users/johan/dev/lb-infra
python3 -m pytest -q tests/test_lb_application_log_pipeline.py \
  tests/test_lb_observability_dashboard.py \
  tests/test_lb_observability_alerts.py \
  tests/test_verify_lb_observability.py \
  tests/test_lb_frontend_live_job.py \
  tests/test_lb_frontend_release.py \
  tests/test_promote_lb_frontend.py
python3 scripts/nomad_secrets.py validate
python3 scripts/verify_lb_observability.py --dry-run
```

Expected: every command exits zero without network mutation.

- [ ] **Step 2: Run the complete frontend release matrix**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
yarn test:unit
yarn test:ssr --reporter=dot
yarn test:e2e --reporter=dot
yarn lint
yarn typecheck
yarn policy:check
yarn quality:maintainability
yarn quality:review:check
yarn quality:review:queue
yarn build
```

Expected: all gates pass; record workers, counts, skips, retries, and elapsed times.

- [ ] **Step 3: Verify process, port, visual, and repository hygiene**

```bash
cd /Users/johan/.codex/worktrees/8c5c/littb
git status --short
git diff --check
lsof -nP -iTCP:3000-3005 -iTCP:4100-4108 -iTCP:24678-24682 -sTCP:LISTEN || true
ps -axo pid,ppid,command | rg \
  'run-playwright-shards|run-ssr-suite|playwright test|nuxt dev|fixture-server|run-independent-semantic-review' || true
```

Identify unrelated listeners by cwd and leave them untouched. Confirm the visual baseline tree is unchanged.

- [ ] **Step 4: Revise the readiness audit**

Record that CI is advisory, not a release blocker. Mark application observability and promotion tooling Ready only when their tests and exact reviews pass. Keep live deployment, editorial acceptance, production dependency-origin confirmation, controlled Stage alert verification, and production promotion as explicit pending operator actions.

- [ ] **Step 5: Commit documentation and perform final review**

```bash
git add docs/superpowers/2026-08-19-production-readiness-audit.md
git diff --cached --check
git commit -m "docs: record production promotion readiness"
```

Review exact ranges in all three repositories. Fix all Critical/Important findings. Stop with a clean frontend worktree and preserved unrelated backend/infra state. Do not build, push, deploy, alter DNS, sync secrets, fire controlled alerts, or promote production until the user explicitly authorizes those external actions.
