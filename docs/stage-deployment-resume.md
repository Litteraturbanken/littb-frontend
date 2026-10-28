# Resuming an interrupted frontend Stage deployment

Run from the clean primary `stage` checkout, using the configured infrastructure
adapter as for a normal deployment:

```sh
WAIT_FOR_BUILD=1 LB_INFRA_REPOSITORY=/Users/johan/dev/lb-infra \
  ./scripts/deploy-stage.sh --resume
```

The original lease and immutable release identity are saved atomically in
`.stage-receipts/frontend-pending.json` before Nomad registration. The normal
exit trap only removes temporary working files. It retains this journal on
health, network, browser-test, capture, or record failure. A pending journal
blocks another release; do not merge a new candidate before resolving it.

Resume holds the same infrastructure deployment lock as a normal deployment.
It checks the candidate, original manifest, live image, jobspec, job version,
modify index, public identity and unrelated component identities. It reruns the
public resource check and the complete live browser gate, then captures and
records the receipt through the infrastructure adapter. It does not rebuild an
image or register a Nomad job. A failed record push can retry only the exact
single manifest commit against its unchanged parent; unrelated commits or
remote changes are rejected.

The journal is removed only after the record is committed and pushed. Receipts
remain available in `.stage-receipts/`. If interrupted after registration but
before the new modify index was saved, only the immediate next job version with
the intended immutable identity can be adopted. If registration never happened,
or another deployment or manifest update intervened, resume stops and retains
the evidence for investigation. Missing journals cannot be recreated by this
command.

Validate the workflow before changes:

```sh
LB_INFRA_REPOSITORY=/Users/johan/dev/lb-infra python3 -m unittest discover \
  -s test -p test_stage_release.py
cd nuxt
yarn test:unit test/unit/stage-deployment.spec.ts
```

The Python tests require the infrastructure adapter's configured Python runtime
(currently 3.14.7). They use its actual lease/manifest/receipt models with mocked
network and Git operations. No test deploys a job.
