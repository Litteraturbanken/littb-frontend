# Stage integration

The primary checkout is the reviewed `stage` integration branch. Develop on a
named feature branch in a separate worktree; merge into `stage` only when the
change is ready for Stage review.

Do not run `nomad job run` or deploy from a feature worktree. Use
`scripts/deploy-stage.sh` only through the guarded infrastructure adapter in
`~/dev/lb-infra`.

The branch name does not prove what is live. Read
`~/dev/lb-infra/environments/stage/deployments.yaml` and the component identity
endpoint. A deployment may mutate only its selected component and must preserve
all unrelated live identities.
