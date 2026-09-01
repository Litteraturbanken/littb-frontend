# Litteraturbanken Nuxt application

Install dependencies with `yarn install`. The postinstall hook prepares Nuxt's
generated types and ESLint configuration.

## Code quality

- `yarn lint` checks all handwritten Nuxt application, server, shared, test, and
  configuration code. Generated API types and build/test artifacts are excluded.
- `yarn lint:fix` applies ESLint's ordinary automatic fixes.
- `yarn typecheck` runs Nuxt and Vue type analysis.
- `yarn test:unit` runs the Vitest suite.

From the repository root, `invoke quality.contract` checks the backend's
committed OpenAPI snapshot and then checks this application's generated API
client against that file. It does not depend on a running backend.

For Reader/Editor manifest work, `invoke quality.reader-editor` runs the
focused backend models/provider/API tests, non-mutating snapshot and generated
client checks, the exact compile contract, Nuxt typecheck/lint and projection
units, and Reader/Editor SSR parity. Make schema changes backend-first, export
the committed OpenAPI snapshot, run `invoke codegen.generate`, and consume only
the resulting generated aliases in Nuxt.

Lint warnings fail the command. Do not add suppression comments or run broad
editor suggestions without a separate review.

See the [cross-repository V2 quality workflow](../docs/quality.md) for contract
ownership, the Reader/Editor layer matrix, managed assets outside OpenAPI, the
current lint baseline, and the full parity gate.

## Staging deployment

Run the deployment only from this repository's persistent Stage checkout:

```text
<littb>/.worktrees/stage
```

Set `LB_INFRA_REPOSITORY` to the persistent `lb-infra` Stage checkout. The
script acquires the shared Stage job lock, and the guard then requires a clean
local `stage` branch whose `HEAD` exactly matches freshly fetched
`origin/stage`. It refuses feature worktrees, stale Stage sources, and any
lease movement before planning or Nomad registration.

The guarded sequence builds the exact Stage commit with the shared multi-arch
builder, resolves the immutable registry digest, computes the committed
jobspec SHA-256, validates and CAS-registers Nomad, waits for every current
frontend allocation to be healthy, runs the public identity-bound smoke suite,
captures a receipt, and records the verified deployment in `lb-infra`:

```sh
export LB_INFRA_REPOSITORY=/path/to/lb-infra/.worktrees/stage
scripts/deploy-stage.sh
nomad job status lb-frontend-stage
nomad job history -p lb-frontend-stage
```

Images are SHA-pinned at
`registry.service.consul:5000/lb-frontend:<git-sha>`. The public route is
`https://lb-frontend.pub.lb.se`.

Stage resource ownership is fixed in the Nomad job and is not selectable by
the deploy operator:

- Nuxt server-side content uses
  `NUXT_CONTENT_BASE=https://red.litteraturbanken.se`.
- The allocation startup probe uses
  `PUBLIC_RESOURCE_ORIGIN=https://stage.litteraturbanken.se`.

Before Nuxt starts, the allocation verifies its immutable Git/image identity,
checks both exact origins, and performs a redirect-disabled 10-second GET of
`https://stage.litteraturbanken.se/red/css/etext.css`. Startup fails unless the
response is successful, nonempty, `text/css`, and no larger than 1 MiB. Logs
contain only status, normalized content type, and byte count. The job keeps two
allocations on distinct hosts and rolls one healthy allocation at a time.

The deploy script runs the identity-bound live suite against the canonical
Stage route before it captures the receipt. Its Playwright configuration uses
up to four workers. To repeat the smoke suite manually, set the two
`DEPLOYED_*` shell variables from the deploy summary and run:

```sh
: "${DEPLOYED_GIT_SHA:?set from the deploy summary}"
: "${DEPLOYED_IMAGE_DIGEST:?set from the deploy summary}"
LITTB_EXPECTED_GIT_SHA="$DEPLOYED_GIT_SHA" \
LITTB_EXPECTED_IMAGE_DIGEST="$DEPLOYED_IMAGE_DIGEST" \
LITTB_NUXT_LIVE_ORIGIN=https://stage.litteraturbanken.se \
  yarn test:e2e:nuxt-live
```

To roll back to the immediately preceding Nomad job version:

```sh
previous_version="$(nomad job history -json lb-frontend-stage | jq -r 'map(.Version) | sort | reverse | .[1]')"
test "$previous_version" != null
nomad job revert -detach lb-frontend-stage "$previous_version"
```

Do not run the deploy script again if capture succeeded but manifest recording
fails. The script reports the retained receipt below
`.stage-receipts/frontend-<git-sha>.json`; investigate the record failure and
use `lb-infra/scripts/stage.py reconcile frontend` with that receipt. The
shared guard prevents the script from silently redeploying an already-live
identity.
