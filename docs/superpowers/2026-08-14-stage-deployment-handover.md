# Stage deployment handover — 2026-08-14

## Completion update — 2026-08-17

The stage deployment and the production author-works regression follow-up are
complete. The deployment-script authentication fix was committed as
`4d8bfd566de1f415df47efc4dc7fe62473e9bd8d`, and the author-works production fix
was committed as `317f6a7e4321c0864b45ddfed51884587302adbc`. The final
test-inclusive deployed SHA was
`7b41bf014f978afa908eb399f1b719e270d70639`, using image
`registry.service.consul:5000/lb-frontend:7b41bf014f978afa908eb399f1b719e270d70639`.

Nomad job `lb-frontend-stage` deployed successfully as version `33`, with
deployment ID `64ea38a2`. At verification, allocation
`3041fa8a-25fa-4c1e-354f-3ecd95aadaf8` was `running` with `0` restarts. The
public route was https://stage.litteraturbanken.se/.

The exact Strindberg live regression passed `1/1`, and the complete live stage
suite passed `16/16`. At completion, the semantic review state was `664`
approved, `0` unreviewed, `0` stale, `0` changes-requested, and `0` oversized.
The branch and remote-tracking ref both pointed to the final SHA
`7b41bf014f978afa908eb399f1b719e270d70639`, and the worktree was clean.

The handoff's “No deployment has been performed yet,” credential blocker, and
resume/deploy instructions are superseded completion-era history and must not
be replayed. Later users should verify current stage health before any new
deployment: the identifiers above are historical observations from 2026-08-17,
not a promise about current runtime state.

## Objective

Finish the verified Nuxt route-shell/loading work by deploying the exact final
revision to staging and running the live Nuxt E2E suite against
`https://stage.litteraturbanken.se`.

No deployment has been performed yet.

## Repository state at pause

- Worktree: `/Users/johan/.codex/worktrees/8c5c/littb`
- Branch: `codex/nuxt-v2-statistics`
- Committed HEAD: `0d70ae41eecd479a16e6b62764aa790537025e71`
- Two reviewed deployment-path files are intentionally uncommitted:
  - `scripts/deploy-stage.sh`
  - `nuxt/test/unit/stage-deployment.spec.ts`
- No Playwright, Nuxt, fixture, or semantic-review runner is active.
- Ports `3000` and `4100` were free at pause.

Do not discard the two uncommitted files. They add the missing forwarding of
`NOMAD_TOKEN` to the Python dispatch request as `X-Nomad-Token`, without adding
the token to the JSON payload or output.

## Final committed corrections

- `737f1bf3` — fixes the SLA late-response test's stale `/api/...` interceptor;
  the application now requests `/nuxt-api/...`.
- `adc278c7` — raises only the mobile Dramawebben plays visual allowance from
  3,200 to 3,300 pixels. The difference was a stable 3,290 pixels caused by the
  intentional accessible `#555/#767676` colors replacing legacy `#999`; no
  baseline or product CSS was changed.
- `0d70ae41` — fixes mobile Library narrowing-menu clipping. The form overflow
  is visible only while the narrowing multiselect is active; other open menus
  and closed geometry retain the legacy behavior.

The semantic ledger remains current at 664 approved packets with zero stale,
unreviewed, changes-requested, or oversized packets. No semantic refresh was
needed after `0d70ae41`.

## Frozen local verification

Exact verified revision: `0d70ae41eecd479a16e6b62764aa790537025e71`
using Node `v22.22.0`.

- Unit: 96 files, 2,828 passed
- SSR: 611 passed
- Lint: passed
- Typecheck: passed
- Policy: passed, 480 files audited
- Maintainability: passed, `new=0 known=3 resolved=127`
- Production build: passed
- Cumulative `git diff --check b827a3ec..HEAD`: passed
- Full desktop/mobile Playwright, one worker: 1,003 passed, 9 skipped,
  0 failed, 0 retries; 1,012 total in 18.4 minutes

The formerly failing SLA, mobile Dramawebben visual, and mobile Library
history/multiselect cases all passed in that full run.

## Reviewed uncommitted deployment-script fix

Root cause: `scripts/deploy-stage.sh` uses Nomad CLI for validation/deployment,
but dispatches the builder through inline Python. The CLI inherits
`NOMAD_TOKEN`; the Python request previously omitted the corresponding
`X-Nomad-Token` header.

Current WIP behavior:

- reads `NOMAD_TOKEN` only from the inherited environment;
- adds it only as optional `X-Nomad-Token` on the dispatch request;
- leaves behavior unchanged when the token is absent or empty;
- never adds the token to the JSON payload or printed output.

TDD/review evidence:

- RED: focused deployment unit had 3 passed / 1 failed because token forwarding
  was absent.
- GREEN: focused deployment unit 4/4.
- Scoped ESLint: passed.
- `bash -n scripts/deploy-stage.sh`: passed.
- Embedded Python compilation: passed in independent review.
- Diff check: passed.
- Independent review: CLEAN, no Critical or Important findings.

## Remaining blocker

The task environment has neither `NOMAD_ADDR` nor `NOMAD_TOKEN`. The correct
control-plane address is:

```sh
export NOMAD_ADDR=http://nomad.infra.lb.se
```

Unauthenticated Nomad access reaches the control plane but returns HTTP 403.
No approved local token source was found. Make a deploy-capable token available
to the resumed task's environment through an approved credential source. Do not
paste the token into chat or commit it to the repository.

## Resume procedure

1. Confirm the preserved WIP and runner hygiene:

   ```sh
   cd /Users/johan/.codex/worktrees/8c5c/littb
   git status --short
   git diff -- scripts/deploy-stage.sh nuxt/test/unit/stage-deployment.spec.ts
   ps -axo pid,ppid,command | rg 'playwright test|nuxt dev|fixture-server|run-independent-semantic'
   ```

2. Re-run the focused deployment checks:

   ```sh
   cd /Users/johan/.codex/worktrees/8c5c/littb/nuxt
   export PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/bin:/bin
   yarn vitest run test/unit/stage-deployment.spec.ts --reporter=dot
   yarn eslint test/unit/stage-deployment.spec.ts
   bash -n ../scripts/deploy-stage.sh
   git diff --check -- ../scripts/deploy-stage.sh test/unit/stage-deployment.spec.ts
   ```

3. Commit exactly those two files. The reviewed WIP must be committed before
   deployment because the script rejects a dirty worktree.

4. Confirm the final commit is clean and record its SHA. The production Nuxt
   application was fully verified at `0d70ae41`; this follow-up commit changes
   only the root deployment script and its unit test.

5. Export the approved credentials without printing them:

   ```sh
   export NOMAD_ADDR=http://nomad.infra.lb.se
   test -n "${NOMAD_TOKEN:-}"
   ```

6. Deploy the exact clean commit:

   ```sh
   cd /Users/johan/.codex/worktrees/8c5c/littb
   scripts/deploy-stage.sh "$(git rev-parse HEAD)"
   ```

   The script pushes the current branch, validates the jobspec, dispatches the
   SHA-pinned multi-architecture image build, waits for completion, and submits
   `lb-frontend-stage` detached.

7. Verify deployment ownership and health:

   ```sh
   nomad job status lb-frontend-stage
   nomad job inspect lb-frontend-stage | jq -r '.Meta.git_sha'
   nomad job allocs -json lb-frontend-stage | jq -r '.[] | [.ID,.ClientStatus,.TaskStates.frontend.State] | @tsv'
   curl -fsS https://stage.litteraturbanken.se/robots.txt
   curl -fsS -o /dev/null -w '%{http_code}\n' https://stage.litteraturbanken.se/
   curl -fsS -o /dev/null -w '%{http_code}\n' https://stage.litteraturbanken.se/api/v2/openapi.json
   ```

   Confirm the Nomad job metadata SHA equals the exact deployed commit and the
   allocation is running/healthy. Inspect allocation logs if it is not.

8. Run live stage E2E from the repository root:

   ```sh
   cd /Users/johan/.codex/worktrees/8c5c/littb
   export PATH=/Users/johan/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/bin:/bin
   LITTB_NUXT_LIVE_ORIGIN=https://stage.litteraturbanken.se yarn test:e2e:nuxt-live
   ```

   This uses `playwright.nuxt-live.config.js`, performs the live preflight, and
   runs the Nuxt live Chromium suite with one worker and no retries.

9. Record the deployment job/version, allocation ID, image/SHA, public route,
   and exact live E2E count in the final report.

## Rollback reference

If the allocation is unhealthy after deployment, inspect history before acting:

```sh
nomad job history -p lb-frontend-stage
nomad job status lb-frontend-stage
```

Use the established Nomad rollback procedure only after identifying the last
healthy job version; do not redeploy an unpinned or dirty revision.
