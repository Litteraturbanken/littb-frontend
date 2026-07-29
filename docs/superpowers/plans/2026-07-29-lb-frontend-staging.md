# LB Frontend Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce clean, immutable frontend and backend release commits and serve the complete Nuxt site at `https://lb-frontend.pub.lb.se` through the Litteraturbanken Nomad public ingress.

**Architecture:** Package the Nuxt Nitro output in an exact-SHA multi-architecture image and deploy it as a host-networked Nomad service. Keep `lb-backend-stage` independent, deploy it with its existing script, and proxy browser-facing API paths through Nitro so the browser never needs Consul DNS or cross-origin backend access.

**Tech Stack:** Nuxt 4, Nitro/H3, Node 22.22.0, Yarn 1, Docker, Nomad, Consul, Caddy, Vitest, Playwright, Invoke, Lighthouse.

## Global Constraints

- The public URL is exactly `https://lb-frontend.pub.lb.se`.
- Use `/Users/johan/dev/lb-backend/scripts/deploy-stage.sh` unchanged for the backend.
- Use host networking at the Nomad group and Docker task levels.
- Do not set Docker `dns_servers`; use the node resolver chain.
- Build and deploy exact Git SHA image tags; never use `latest`.
- Run Nomad jobs with `nomad run -detach`.
- Preserve unrelated dirty-worktree changes in all repositories.
- Do not change the established visual design.
- Do not report completion until live browser checks cover the full named surface and both deployed SHAs are recorded.

---

### Task 1: Make generated frontend artifacts self-cleaning

**Files:**
- Modify: `.gitignore`
- Modify: `nuxt/.gitignore`
- Create: `nuxt/test/unit/repository-hygiene.spec.ts`

**Interfaces:**
- Consumes: repository root and Git `check-ignore` behavior.
- Produces: durable ignore ownership for root/Nuxt reports, browser state, and transient visual results.

- [ ] **Step 1: Write the failing ignore-contract test**

Create a Vitest case that sends these paths to `git check-ignore --stdin` and expects every one back:

```ts
const generated = [
  "output/playwright/local.png",
  ".superpowers/brainstorm/.last-port",
  "nuxt/output/lighthouse/report.json",
  "nuxt/test-results-visual-extra/result/error-context.md",
  "nuxt/.playwright-cli/console.log",
  "nuxt/.playwright-mcp/session.json"
]
```

The same test must assert `git check-ignore nuxt/app/app.vue` exits nonzero.

- [ ] **Step 2: Run RED**

```sh
cd nuxt
yarn vitest run test/unit/repository-hygiene.spec.ts
```

Expected: FAIL because several generated paths are not ignored.

- [ ] **Step 3: Add narrowly scoped rules**

Add to root `.gitignore`:

```gitignore
/.superpowers/brainstorm/
/output/
```

Add to `nuxt/.gitignore`:

```gitignore
.playwright-cli/
.playwright-mcp/
output/
test-results-visual-extra/
```

- [ ] **Step 4: Run GREEN and preview cleanup**

```sh
yarn vitest run test/unit/repository-hygiene.spec.ts
cd ..
git clean -ndX -- output .superpowers/brainstorm nuxt/output nuxt/test-results-visual-extra nuxt/.playwright-cli nuxt/.playwright-mcp
```

Expected: the test passes and the dry run lists only the six generated areas.

- [ ] **Step 5: Delete only reviewed generated paths and commit**

```sh
git clean -fdX -- output .superpowers/brainstorm nuxt/output nuxt/test-results-visual-extra nuxt/.playwright-cli nuxt/.playwright-mcp
git add .gitignore nuxt/.gitignore nuxt/test/unit/repository-hygiene.spec.ts
git commit -m "chore: keep staging worktree free of generated output"
```

Never include `.superpowers/audits`, `docs`, `nuxt/app`, `nuxt/server`, `nuxt/test`, or visual baselines in the cleanup command.

### Task 2: Consolidate the authored Nuxt release candidate

**Files:**
- Review/commit: `.superpowers/audits/*.md`
- Review/commit: `docs/superpowers/{plans,specs}/*.md`
- Review/commit: `nuxt/{app,public,server,shared,test}/**`
- Review/commit: `nuxt/*.config.ts`, `nuxt/scripts/**`, `nuxt/package.json`, `nuxt/yarn.lock`, `tasks.py`

**Interfaces:**
- Consumes: accumulated migration, parity, type, and Lighthouse work.
- Produces: an auditable release-candidate source tree without untracked authored files or diagnostics.

- [ ] **Step 1: Inventory and scan**

```sh
git status --short
git diff --check
git ls-files --others --exclude-standard | sort
rg -n "404 diagnostic|x-compression-|debugger\\b|TODO|FIXME" nuxt/app nuxt/server nuxt/scripts nuxt/test || true
rg -n 'T''BD|PLACE''HOLDER|implement la''ter|fill in det''ails' .superpowers/audits docs/superpowers || true
```

Expected: every remaining untracked path is deliberate authored material.

- [ ] **Step 2: Commit reviewed documentation separately**

```sh
git add .superpowers/audits docs/superpowers/plans docs/superpowers/specs
git diff --cached --check
git commit -m "docs: preserve Nuxt migration parity record"
```

- [ ] **Step 3: Run the release-candidate checks**

```sh
invoke quality.frontend
cd nuxt
yarn playwright test --project=desktop-chromium test/e2e/library-multiselect-parity.behavior.spec.ts test/e2e/reader-final-parity.behavior.spec.ts test/e2e/text-search.behavior.spec.ts
yarn playwright test --project=desktop-chromium test/e2e/library.visual.spec.ts test/e2e/reader-final-parity.visual.spec.ts --grep-invert "Nya vägar"
yarn playwright test --config=playwright.reader-assets-production.config.ts
cd ..
```

Expected: static/unit/build/SSR checks, focused behavior, authoritative visuals, and production asset checks pass. The known pre-existing Nya Vägar screenshot mismatch remains excluded while its behavior test is included.

- [ ] **Step 4: Commit the application release candidate**

```sh
git add nuxt/app nuxt/public nuxt/server nuxt/shared nuxt/test nuxt/nuxt.config.ts nuxt/playwright*.ts nuxt/vitest.config.ts nuxt/scripts nuxt/package.json nuxt/yarn.lock tasks.py
git diff --cached --check
git diff --cached --stat
git commit -m "feat(nuxt): integrate staging release candidate"
```

Inspect the staged diff first; it must not contain `.output`, reports, or browser state.

### Task 3: Add bounded same-origin backend proxies for production Nitro

**Files:**
- Create: `nuxt/server/utils/backend-proxy.ts`
- Create: `nuxt/server/routes/api/index.ts`
- Create: `nuxt/server/routes/api/[...path].ts`
- Create: `nuxt/server/routes/api/v2/[...path].ts`
- Create: `nuxt/test/unit/backend-proxy.spec.ts`
- Modify: `nuxt/test/e2e/reader-assets-production.behavior.spec.ts`
- Modify: `nuxt/playwright.reader-assets-production.config.ts`

**Interfaces:**
- Produces: `safeBackendPath(value: string | undefined): string` and `proxyBackendRequest(event, base, path): Promise<unknown>`.
- Preserves: exact Nitro reader/editor/document/dictionary routes over the catch-all legacy proxy.

- [ ] **Step 1: Write failing proxy tests**

```ts
expect(safeBackendPath("authors/SöderbergH")).toBe("authors/S%C3%B6derbergH")
expect(() => safeBackendPath("../private")).toThrowError(/Invalid backend path/u)
expect(() => safeBackendPath("reader\\private")).toThrowError(/Invalid backend path/u)
```

Extend the production Playwright test to require HTTP 200 from `/api/v2/openapi.json` and `/api/?q=kyrka`, while an existing exact `/api/reader/**` route still resolves through Nitro.

- [ ] **Step 2: Run RED**

```sh
cd nuxt
yarn vitest run test/unit/backend-proxy.spec.ts
yarn playwright test --config=playwright.reader-assets-production.config.ts
```

- [ ] **Step 3: Implement safe H3 forwarding**

Reject missing/empty segments, `.`, `..`, backslashes, C0 controls, and DEL; encode each decoded segment. Forward only `GET`, `HEAD`, and `POST` with:

```ts
const target = `${base.replace(/\/$/u, "")}/${safePath}${getRequestURL(event).search}`
return proxyRequest(event, target)
```

The V2 catch-all uses `runtimeConfig.apiBase`; legacy routes use `runtimeConfig.libraryApiBase`. The legacy index forwards `/api/` without invoking the non-empty-path validator. Do not add a broad `/api/**` route rule.

- [ ] **Step 4: Run GREEN and commit**

```sh
yarn vitest run test/unit/backend-proxy.spec.ts test/unit/v2-server.spec.ts
yarn playwright test --config=playwright.reader-assets-production.config.ts
yarn typecheck
yarn lint
cd ..
git add nuxt/server/utils/backend-proxy.ts nuxt/server/routes/api nuxt/test/unit/backend-proxy.spec.ts nuxt/test/e2e/reader-assets-production.behavior.spec.ts nuxt/playwright.reader-assets-production.config.ts
git commit -m "feat(nuxt): proxy staging backend through Nitro"
```

### Task 4: Package Nitro as a minimal Node 22 image

**Files:**
- Create: `nuxt/Dockerfile`
- Create: `nuxt/.dockerignore`
- Create: `nuxt/test/unit/stage-deployment.spec.ts`

**Interfaces:**
- Consumes: Nuxt package/lock/source files.
- Produces: a non-root image running `node .output/server/index.mjs` on `HOST`/`PORT`.

- [ ] **Step 1: Write the failing packaging contract**

Assert the Dockerfile pins `node:22.22.0-alpine`, uses frozen Yarn install, runs `yarn build`, copies only `.output` to the runtime stage, selects `USER node`, and has the exact Node entrypoint. Assert `.dockerignore` excludes `.git`, dependencies, `.nuxt`, `.output`, reports, tests, and browser state.

- [ ] **Step 2: Run RED**

```sh
cd nuxt
yarn vitest run test/unit/stage-deployment.spec.ts
```

- [ ] **Step 3: Implement the image**

```dockerfile
FROM node:22.22.0-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY . .
RUN yarn build

FROM node:22.22.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3020
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3020
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 4: Run GREEN and a real container smoke**

```sh
yarn vitest run test/unit/stage-deployment.spec.ts
docker build -t lb-frontend:staging-smoke .
docker run --detach --rm --name lb-frontend-staging-smoke --network host -e PORT=3029 lb-frontend:staging-smoke
for attempt in $(seq 1 30); do curl --fail --silent http://127.0.0.1:3029/robots.txt && break; sleep 1; done
curl --fail --silent --show-error http://127.0.0.1:3029/robots.txt
docker stop lb-frontend-staging-smoke
```

- [ ] **Step 5: Commit**

```sh
cd ..
git add nuxt/Dockerfile nuxt/.dockerignore nuxt/test/unit/stage-deployment.spec.ts
git commit -m "build(nuxt): package immutable Nitro runtime"
```

### Task 5: Add the frontend Nomad job and exact-SHA deploy script

**Files:**
- Create: `jobs/lb-frontend-stage.nomad`
- Create: `scripts/deploy-stage.sh`
- Modify: `nuxt/test/unit/stage-deployment.spec.ts`
- Modify: `nuxt/README.md`

**Interfaces:**
- Consumes: variables `image`, `git_sha`, `caddy_host`, `http_port`; parameterized job `docker-builder-multiarch`.
- Produces: service job `lb-frontend-stage` and command `scripts/deploy-stage.sh [git-ref]`.

- [ ] **Step 1: Extend the failing deployment contract**

Assert the jobspec has job name, both host-network declarations, `${meta.bind_ip}`, static port 3020, the four Caddy tags, `/robots.txt` health check, no `dns_servers`, and `NUXT_API_BASE=http://lb-backend-stage.service.consul:5003/v2`. Assert the script contains a resolved exact SHA, builder metadata `CONTEXT_DIR=nuxt`, `IMAGE=lb-frontend`, `TAG=<sha>`, `PUSH_GHCR=false`, and `nomad run -detach`, with no `:latest`.

- [ ] **Step 2: Run RED**

```sh
cd nuxt
yarn vitest run test/unit/stage-deployment.spec.ts
```

- [ ] **Step 3: Implement the jobspec**

Define exact variables:

```hcl
variable "datacenters" { type = list(string); default = ["local"] }
variable "image" { type = string }
variable "git_sha" { type = string }
variable "caddy_host" { type = string; default = "lb-frontend.pub.lb.se" }
variable "http_port" { type = number; default = 3020 }
```

Use one service allocation with bounded restart/reschedule, host networking, 500 MHz CPU, and 768 MB memory. The Docker task uses the immutable variable image, `force_pull=true`, host network, and:

```hcl
entrypoint = ["/bin/sh", "-ec"]
args = ["export HOST=0.0.0.0 PORT=$${NOMAD_PORT_http}; exec node .output/server/index.mjs"]
```

Set `GIT_SHA`, `IMAGE_REF`, `NUXT_API_BASE=http://lb-backend-stage.service.consul:5003/v2`, `NUXT_LIBRARY_API_BASE=http://lb-backend-stage.service.consul:5003`, `NUXT_CONTENT_BASE=https://red.litteraturbanken.se`, and `NUXT_READER_SOURCE_BASE=https://litteraturbanken.se`. Register at `${meta.bind_ip}` with:

```hcl
tags = [
  "lb-frontend",
  "stage",
  "caddy-host=${var.caddy_host}",
  "caddy-ingress=public",
  "caddy-https=on",
  "caddy-tls=internal",
]
```

The entrypoint must fail before Node starts when `GIT_SHA` or `IMAGE_REF` is empty. Add an HTTP service check for `GET /robots.txt` every 10 seconds with a 3-second timeout and a `check_restart` limit of three after a 2-minute grace period.

- [ ] **Step 4: Implement the deployment script from the proven backend script**

Copy `/Users/johan/dev/lb-backend/scripts/deploy-stage.sh` and apply only these substitutions:

```text
lb-backend-stage -> lb-frontend-stage
lb-backend -> lb-frontend
CONTEXT_DIR "." -> CONTEXT_DIR "nuxt"
jobs/lb-backend-stage.nomad -> jobs/lb-frontend-stage.nomad
https://stage.litteraturbanken.se/api/ -> https://lb-frontend.pub.lb.se/
```

Retain dirty-tree refusal, named-branch requirement, branch push, Nomad HTTP dispatch, idempotency token, builder wait/timeout, validation, and detached run. Make it executable.

- [ ] **Step 5: Document deployment and rollback**

Add a staging section to `nuxt/README.md` containing these exact operational commands:

```sh
scripts/deploy-stage.sh
nomad job status lb-frontend-stage
nomad job history -p lb-frontend-stage
previous_version="$(nomad job history -json lb-frontend-stage | jq -r 'map(.Version) | sort | reverse | .[1]')"
test "$previous_version" != null
nomad job revert -detach lb-frontend-stage "$previous_version"
```

State that images are SHA-pinned at `registry.service.consul:5000/lb-frontend:<git-sha>` and the route is `https://lb-frontend.pub.lb.se`.

- [ ] **Step 6: Validate and commit**

```sh
cd nuxt
yarn vitest run test/unit/stage-deployment.spec.ts
cd ..
bash -n scripts/deploy-stage.sh
nomad job validate -var "image=registry.service.consul:5000/lb-frontend:test-sha" -var "git_sha=test-sha" jobs/lb-frontend-stage.nomad
git add jobs/lb-frontend-stage.nomad scripts/deploy-stage.sh nuxt/test/unit/stage-deployment.spec.ts nuxt/README.md
git commit -m "ops: add frontend staging Nomad deployment"
```

### Task 6: Expand the live smoke suite to the staging surface

**Files:**
- Modify: `test/e2e/playwright_e2e.spec.js`
- Modify: `test/e2e/nuxt_live_preflight.cjs`
- Modify: `playwright.nuxt-live.config.js`

**Interfaces:**
- Consumes: `LITTB_NUXT_LIVE_ORIGIN`.
- Produces: serial live checks for home, library, search, authors, Reader/OCR/dictionary, Editor, presentations, Dramawebben, and router history.

- [ ] **Step 1: Add failing checks before deployment**

Retain all current interactive tests. Add HTTP 200, Nuxt hydration, defining content, and zero-console-error assertions for:

```text
/
/bibliotek?avancerat=1&visa=works&sort=popularitet
/sök?fras=kyrka
/sök?fras=kyrka&avancerad=1
/författare/SöderbergH
/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext
/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil
/editor/lb12106/ix/0/f
/presentationer
/dramawebben
```

Add one NuxtLink navigation followed by `page.goBack()` and assert the prior route and reader state return. Continue exercising dictionary lookup, Reader next-page, Editor next-page, advanced Library controls, and text-search hydration.

- [ ] **Step 2: Run against local production Nitro**

Start the backend and production Nuxt server, then:

```sh
LITTB_NUXT_LIVE_ORIGIN=http://127.0.0.1:3020 yarn test:e2e:nuxt-live
```

Expected: every live check passes locally.

- [ ] **Step 3: Commit**

```sh
git add test/e2e/playwright_e2e.spec.js test/e2e/nuxt_live_preflight.cjs playwright.nuxt-live.config.js
git commit -m "test: cover complete frontend staging surface"
```

### Task 7: Prepare and deploy the existing backend staging job

**Files in `/Users/johan/dev/lb-backend`:**
- Commit: `lbapi/v2/work_manifest_provider.py`
- Commit: `test_lbapi/v2/test_work_manifest_provider.py`
- Commit: `jobs/lb-backend-stage.nomad`
- Preserve: unrelated red/live job changes and personal scratch files
- Use unchanged: `scripts/deploy-stage.sh`

**Interfaces:**
- Consumes: clean named deployment branch.
- Produces: healthy `lb-backend-stage.service.consul:5003` with V2 routes from an exact SHA.

- [ ] **Step 1: Verify and commit the backend V2 change**

```sh
cd /Users/johan/dev/lb-backend
virtual_env/bin/python -m pytest -q test_lbapi/v2/test_work_manifest_provider.py test_lbapi/v2/test_work_manifest_api.py
virtual_env/bin/python -m mypy --config-file mypy.ini lbapi/v2
virtual_env/bin/python -m ruff check lbapi/v2 test_lbapi/v2
git add lbapi/v2/work_manifest_provider.py test_lbapi/v2/test_work_manifest_provider.py
git commit -m "fix: prefer public work titles in manifests"
```

- [ ] **Step 2: Verify and commit the scheduler change separately**

```sh
virtual_env/bin/python -m pytest -q test_lbapi/test_stage_deployment.py
nomad job validate -var "image=registry.service.consul:5000/lb-backend:test-sha" -var "git_sha=test-sha" jobs/lb-backend-stage.nomad
git add jobs/lb-backend-stage.nomad
git commit -m "ops: allow staging backend on available Nomad clients"
```

Do not stage red/live jobs or scratch files.

- [ ] **Step 3: Create a clean deployment worktree**

```sh
git worktree add -b codex/lb-backend-stage-v2 /Users/johan/.codex/worktrees/lb-backend-stage-v2 HEAD
cd /Users/johan/.codex/worktrees/lb-backend-stage-v2
git status --short
```

Expected: clean deployment worktree; original backend workspace retains unrelated work.

- [ ] **Step 4: Run the existing script unchanged**

```sh
/Users/johan/.codex/worktrees/lb-backend-stage-v2/scripts/deploy-stage.sh
```

Expected: push, successful multi-architecture build, detached backend deployment, exact SHA/image output.

- [ ] **Step 5: Verify backend service**

```sh
nomad job status lb-backend-stage
alloc_id="$(nomad job allocs -json lb-backend-stage | jq -r '[.[] | select(.ClientStatus=="running")][0].ID')"
nomad alloc status "$alloc_id"
nomad alloc logs "$alloc_id" api
curl --fail --silent --show-error https://stage.litteraturbanken.se/api/v2/openapi.json >/dev/null
```

### Task 8: Run the final frontend gate, deploy, and verify publicly

**Files:**
- No new source expected.
- Ignored output: Lighthouse and Playwright reports.

**Interfaces:**
- Consumes: clean frontend branch and healthy backend.
- Produces: healthy `lb-frontend-stage`, public route, deployment evidence.

- [ ] **Step 1: Run the complete frontend release gate**

```sh
cd /Users/johan/.codex/worktrees/8c5c/littb
invoke quality.frontend
cd nuxt
yarn playwright test --config=playwright.reader-assets-production.config.ts
yarn lighthouse:reader --runs 3 --clean
cd ..
git diff --check
git status --short
```

Expected: every command passes and the worktree is clean.

- [ ] **Step 2: Deploy the exact frontend commit**

```sh
scripts/deploy-stage.sh
```

- [ ] **Step 3: Verify Nomad, Consul, and Caddy ingress**

```sh
nomad job status lb-frontend-stage
alloc_id="$(nomad job allocs -json lb-frontend-stage | jq -r '[.[] | select(.ClientStatus=="running")][0].ID')"
nomad alloc status "$alloc_id"
nomad alloc logs "$alloc_id" frontend
consul catalog services | rg '^lb-frontend-stage\\b'
curl --fail --silent --show-error https://lb-frontend.pub.lb.se/robots.txt
curl --fail --silent --show-error https://lb-frontend.pub.lb.se/ >/dev/null
```

If routing fails:

```sh
/Users/johan/dev/lb-infra/util/connect.sh nomad-ingress cat /etc/caddy/Caddyfile | rg -n -C 6 'lb-frontend\\.pub\\.lb\\.se'
```

- [ ] **Step 4: Run the full live browser suite**

```sh
LITTB_NUXT_LIVE_ORIGIN=https://lb-frontend.pub.lb.se yarn test:e2e:nuxt-live
```

Expected: every named surface and interaction passes without console errors.

- [ ] **Step 5: Audit public staging and record immutable evidence**

Capture Lighthouse from the public Reader URL. Correctness categories, console errors, and failed resources remain blocking; record public-network performance separately from localhost variance:

```sh
cd nuxt
yarn lighthouse 'https://lb-frontend.pub.lb.se/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext' \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags='--headless=new --no-sandbox' \
  --output=html --output=json \
  --output-path=output/lighthouse/lb-frontend-stage
cd ..
```

Then verify SHAs:

```sh
frontend_sha="$(git rev-parse HEAD)"
backend_sha="$(git -C /Users/johan/.codex/worktrees/lb-backend-stage-v2 rev-parse HEAD)"
nomad job inspect lb-frontend-stage | jq -r '.Meta.git_sha'
nomad job inspect lb-backend-stage | jq -r '.Meta.git_sha'
git status --short
git -C /Users/johan/.codex/worktrees/lb-backend-stage-v2 status --short
printf 'frontend=%s\\nbackend=%s\\n' "$frontend_sha" "$backend_sha"
```

Expected: Nomad metadata equals local Git SHAs, both deployment worktrees are clean, and the final report includes the public URL, allocation IDs, image refs, live test count, and Lighthouse artifact.
