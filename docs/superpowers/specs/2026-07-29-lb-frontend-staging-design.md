# LB Frontend Staging Deployment Design

## Objective

Prepare the Nuxt migration for staging and make the complete site available at
`https://lb-frontend.pub.lb.se`. The deployment must be reproducible from exact
Git commits, use the existing Litteraturbanken Nomad and Caddy conventions, and
leave the application repositories clean enough that the deployed source can be
identified and rebuilt.

## Repository hygiene

The frontend worktree will be handled conservatively:

- Remove only confirmed generated output such as Nuxt build output, Lighthouse
  reports, Playwright transient output, and local browser-control state.
- Add those generated paths to the appropriate `.gitignore` files so the worktree
  stays clean after verification.
- Preserve authored migration source, tests, visual baselines, specifications,
  and audit reports until each has been reviewed and deliberately committed or
  discarded.
- Split the accumulated migration into coherent commits rather than one opaque
  cleanup commit. Each commit must pass the checks appropriate to its scope.
- Never reset or overwrite unrelated existing work in either the frontend,
  backend, or infrastructure repositories.

The backend staging script refuses dirty worktrees. Relevant V2 backend changes
will therefore be reviewed, verified, and committed before invoking the existing
deployment script. The script itself will not be replaced or duplicated.

## Deployment architecture

Frontend and backend remain separate Nomad jobs.

The backend is deployed with the existing command:

```sh
/Users/johan/dev/lb-backend/scripts/deploy-stage.sh
```

That script owns backend branch pushing, immutable multi-architecture image
building, and deployment of `lb-backend-stage`. The frontend consumes the
resulting Consul service rather than embedding a backend task in its allocation.

The frontend repository will gain:

- `nuxt/Dockerfile`: a multi-stage Node 22 build that installs from the frozen
  Yarn lockfile, builds Nitro, and copies only the production `.output` tree into
  the runtime image.
- `nuxt/.dockerignore`: excludes dependencies, local build/test output, reports,
  editor state, and other material not needed by the image build.
- `jobs/lb-frontend-stage.nomad`: the staging service specification.
- `scripts/deploy-stage.sh`: a fail-fast frontend deployment script modeled on
  the backend's proven script and the shared `docker-builder-multiarch` job.

The frontend image is tagged with its exact commit SHA as
`registry.service.consul:5000/lb-frontend:<git-sha>`. The deployment script must
refuse detached heads and dirty trees, validate the jobspec, push the current
branch, dispatch the existing multi-architecture builder, wait for a successful
build, run Nomad with `-detach`, and report job status and the public URL.

## Nomad service

`lb-frontend-stage` is a single service allocation in the `local` datacenter.
It uses host networking at both levels:

```hcl
network { mode = "host" }
config { network_mode = "host" }
```

The HTTP port defaults to static port `3020`. The service registers through
Consul at `${meta.bind_ip}` and advertises:

- `caddy-host=lb-frontend.pub.lb.se`
- `caddy-ingress=public`
- `caddy-https=on`
- `caddy-tls=internal`

No Docker DNS override is added. The container uses the node's established
resolver chain, which resolves the backend's Consul service name.

The task runs `node .output/server/index.mjs` with `HOST=0.0.0.0` and the Nomad
HTTP port. It receives server-only runtime configuration for the staging backend
and the established content sources. Public browser requests continue to use
same-origin `/api/v2` and `/api` paths; Nitro proxies only backend-owned API
paths while retaining its own reader, editor, and document endpoints.

The shallow Nomad health check uses `/robots.txt` so process liveness does not
flap when an external dependency is temporarily unavailable. Deployment
verification separately exercises dependency-backed pages and APIs.

## Request flow

```text
browser
  -> public Caddy ingress (lb-frontend.pub.lb.se)
  -> lb-frontend-stage Consul service
  -> Nuxt/Nitro SSR
       -> lb-backend-stage.service.consul:5003
       -> red.litteraturbanken.se managed content
       -> litteraturbanken.se reader assets and facsimiles
```

The browser never needs direct access to a `.service.consul` hostname. Nitro
performs server-side API requests and same-origin API proxying.

## Failure behavior and rollback

- Missing image or Git SHA values fail before Node starts.
- The job uses bounded restart and reschedule policies with a startup grace
  period suitable for Nitro.
- Health failure prevents the service from being advertised as healthy.
- The exact Git SHA is stored in Nomad job metadata and exposed to the container.
- Rollback uses Nomad job history or reruns the jobspec with the previous
  immutable image SHA; no mutable `latest` tag is used.
- Backend deployment failure stops the workflow before frontend deployment.
- Frontend smoke-test failure leaves diagnostics intact and is reported rather
  than being described as a successful staging release.

## Verification and definition of done

Before deployment:

1. Frontend lint, typecheck, unit tests, focused visual/behavior suites, and
   production build pass.
2. Backend release checks required by its staging workflow pass.
3. The frontend container builds locally and answers its health endpoint.
4. `nomad job validate` accepts the frontend jobspec with the exact image/SHA.

After deployment:

1. The backend deployment script completes and `lb-backend-stage` is healthy.
2. The frontend builder allocation completes and `lb-frontend-stage` is healthy.
3. `https://lb-frontend.pub.lb.se/robots.txt` and the home page return 200.
4. Browser smoke tests cover home, library, ordinary and advanced text search,
   author pages, e-text and facsimile readers, OCR and dictionary interaction,
   Editor facsimile, presentations, Dramawebben, and internal navigation/history.
5. Static assets and proxied reader/content resources load without console
   errors or mixed-content failures.
6. A production Lighthouse audit is captured from the public staging hostname.
7. Both application worktrees are clean and the deployed frontend/backend Git
   SHAs and image references are recorded.

The task is complete only when the public hostname works across these surfaces,
not merely when Nomad accepts the jobspec.
