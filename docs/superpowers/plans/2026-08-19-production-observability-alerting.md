# Production Observability Alerting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing LB application observability stack with hydration visibility and actionable production alerts delivered through the current Grafana-to-NATS/Slack path.

**Architecture:** Vector retains the existing bounded event dimensions. Grafana adds one hydration panel and a separate production rule group; the verifier becomes environment-aware without permitting uncontrolled production fault injection. All rollback decisions remain human-controlled.

**Tech Stack:** Python 3, pytest, Vector 0.57 VRL, Prometheus/PromQL, Grafana file provisioning, OpenSearch, NATS, Nomad HCL.

**Spec:** `docs/superpowers/specs/2026-08-19-stage-artifact-promotion-production-observability-design.md`

## Global Constraints

- Infrastructure repository: `/Users/johan/dev/lb-infra`.
- Complete `docs/superpowers/plans/2026-08-19-hydration-observability.md` first.
- Preserve all existing dirty infrastructure files and stage explicit hunks only.
- Never stash, reset, clean, overwrite, or commit unrelated work.
- Reuse `lb_observability_events_total`; do not create unbounded labels.
- Production alerts notify humans and never call Nomad or deployment scripts.
- Production alert labels must say `environment=production`.
- Controlled fault injection remains Stage-only.
- Never print or commit observability credentials.
- Do not deploy Grafana, Vector, or any Nomad job without separate authorization.

---

### Task 1: Prove Hydration Events Survive the Vector Boundary

**Files:**
- Modify: `/Users/johan/dev/lb-infra/observability/vector/lb-application-events-tests.toml`
- Modify: `/Users/johan/dev/lb-infra/tests/test_lb_application_log_pipeline.py`

**Interfaces:**
- Consumes: `browser.hydration_error` from the completed application plan.
- Produces: existing metric labels `event_name`, `environment`, `service`, `producer`, and `deployment_git_sha` for the hydration event.

- [ ] **Step 1: Record protected infrastructure state**

```bash
cd /Users/johan/dev/lb-infra
git status --short
git diff -- observability/vector/lb-application-events-tests.toml \
  tests/test_lb_application_log_pipeline.py jobs/vector.nomad
```

Expected: preserve any unrelated modifications; `jobs/vector.nomad` should not require a production change.

- [ ] **Step 2: Add a failing Vector fixture assertion**

Add a test input containing a valid `browser.hydration_error`, plus forbidden `message`, `html`, `url`, and `stack` keys. Require the redacted event to retain only:

```toml
assert_eq!(.event_name, "browser.hydration_error")
assert_eq!(.error_type, "HydrationMismatch")
assert_eq!(.attributes.resource_kind, "document")
assert!(!exists(.message))
assert!(!exists(.html))
assert!(!exists(.url))
assert!(!exists(.stack))
```

Require the metric record to contain the bounded hydration event name and deployment SHA.

- [ ] **Step 3: Run RED**

```bash
cd /Users/johan/dev/lb-infra
python3 -m pytest -q tests/test_lb_application_log_pipeline.py
python3 scripts/verify_vector_application_config.py
```

Expected: the static test fails until the fixture contains hydration authority; the current Vector config itself should validate.

- [ ] **Step 4: Complete the fixture without changing production Vector config**

Add the hydration fixture and extend `test_vector_transform_tests_cover_allowlisting_filtering_and_metrics()` to require its name and privacy assertions. Do not add diagnostic fields to the allowlist or metric labels.

- [ ] **Step 5: Run GREEN and commit**

```bash
python3 -m pytest -q \
  tests/test_lb_application_log_pipeline.py \
  tests/test_vector_application_pipeline.py
python3 scripts/verify_vector_application_config.py
git add observability/vector/lb-application-events-tests.toml \
  tests/test_lb_application_log_pipeline.py
git diff --cached --check
git commit -m "test(observability): cover hydration events"
```

Expected: Vector validation passes and exactly two paths are committed.

### Task 2: Add Hydration Visibility to the LB Dashboard

**Files:**
- Modify: `/Users/johan/dev/lb-infra/observability/grafana/LB/lb-application-observability.json`
- Modify: `/Users/johan/dev/lb-infra/tests/test_lb_observability_dashboard.py`

**Interfaces:**
- Produces: panel title `Hydration mismatches`.
- Consumes: `lb_observability_events_total{event_name="browser.hydration_error"}`.

- [ ] **Step 1: Write the dashboard RED test**

Add:

```python
def test_dashboard_has_deployment_scoped_hydration_panel() -> None:
    expression = _expressions(_panel("Hydration mismatches"))
    assert 'event_name="browser.hydration_error"' in expression
    assert 'environment=~"$environment"' in expression
    assert 'deployment_git_sha=~"$deployment_git_sha"' in expression
    assert "sum by (deployment_git_sha)" in expression
    assert "or vector(0)" in expression
```

- [ ] **Step 2: Run RED**

```bash
cd /Users/johan/dev/lb-infra
python3 -m pytest -q tests/test_lb_observability_dashboard.py
```

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Add the minimal panel**

Add one Prometheus time-series panel using:

```promql
sum by (deployment_git_sha) (
  increase(lb_observability_events_total{
    environment=~"$environment",
    service="lb-frontend",
    producer="browser",
    deployment_git_sha=~"$deployment_git_sha",
    event_name="browser.hydration_error"
  }[$__rate_interval])
) or vector(0)
```

Place it beside `Browser failures`; preserve dashboard UID, variables, datasource ownership, and existing panel IDs.

- [ ] **Step 4: Run GREEN and commit**

```bash
python3 -m pytest -q tests/test_lb_observability_dashboard.py
python3 -m json.tool observability/grafana/LB/lb-application-observability.json >/dev/null
git add observability/grafana/LB/lb-application-observability.json \
  tests/test_lb_observability_dashboard.py
git diff --cached --check
git commit -m "feat(observability): chart hydration mismatches"
```

### Task 3: Provision Separate Production Alert Rules

**Files:**
- Modify: `/Users/johan/dev/lb-infra/observability/grafana/LB/alerting/lb-application-observability.yaml`
- Modify: `/Users/johan/dev/lb-infra/tests/test_lb_observability_alerts.py`
- Modify by isolated hunk: `/Users/johan/dev/lb-infra/jobs/grafana.nomad`

**Interfaces:**
- Produces: Grafana group `lb-application-observability-production`.
- Produces: terminal notification route matching service `lb-observability` and environment `production`.

- [ ] **Step 1: Snapshot the already-dirty Grafana job**

```bash
cd /Users/johan/dev/lb-infra
git status --short
git diff -- jobs/grafana.nomad > /tmp/lb-grafana-pre-observability.diff
git diff -- observability/grafana/LB/alerting/lb-application-observability.yaml \
  tests/test_lb_observability_alerts.py
```

Expected: save the user's existing Grafana-job diff for comparison. Never stage the whole job blindly.

- [ ] **Step 2: Write production-rule RED tests**

Refactor the test helper to return groups by name. Require the existing Stage group unchanged and a production group containing these UIDs:

```python
{
    "lb-hydration-warning-production",
    "lb-hydration-critical-production",
    "lb-5xx-count-production",
    "lb-5xx-ratio-production",
    "lb-browser-chunk-errors-production",
    "lb-app-errors-spike-production",
    "lb-observability-ingestion-silent-production",
    "lb-observability-delivery-failure-production",
}
```

Assert exact environment labels and PromQL thresholds:

```text
hydration warning: > 0 over 10m
hydration critical: >= 3 over 10m
5xx count: > 3 over 5m
5xx ratio: > 0.05 and request count >= 20 over 10m
chunk errors: >= 3 over 10m
application errors: > 5 over 5m
ingestion lag: > 900 seconds or absent
delivery: drops/errors/down/absent
```

Require dashboard and runbook annotations, deployment-SHA wording, and no deployment webhook/action.

- [ ] **Step 3: Run RED**

```bash
python3 -m pytest -q tests/test_lb_observability_alerts.py
```

Expected: FAIL because only the Stage group exists.

- [ ] **Step 4: Add the production group and notification route**

Add a second YAML group with `environment="production"` in every PromQL selector and `environment: production` in every label set. Use `warning` for the any-hydration and absolute-count alerts; use `critical` for critical hydration, 5xx ratio, ingestion silence, and delivery failure. Keep `noDataState: OK`; absence is explicit only in pipeline expressions.

In the existing notification-policy template in `jobs/grafana.nomad`, add one terminal route:

```yaml
- receiver: infra-events-only
  object_matchers:
    - [service, =, lb-observability]
    - [environment, =, production]
  continue: false
```

Do not disturb the user's other Grafana-job edits.

- [ ] **Step 5: Run GREEN and inspect isolated hunk ownership**

```bash
python3 -m pytest -q \
  tests/test_lb_observability_alerts.py \
  tests/test_grafana_alert_relay_format.py
python3 - <<'PY'
from pathlib import Path
import yaml
yaml.safe_load(Path("observability/grafana/LB/alerting/lb-application-observability.yaml").read_text())
PY
git diff -- jobs/grafana.nomad
```

Expected: tests pass and the new Grafana hunk contains only the production route in addition to the pre-recorded user diff.

- [ ] **Step 6: Stage only the owned Grafana hunk and commit**

Use `git add -p jobs/grafana.nomad` and stage only the production policy route. Then:

```bash
git add observability/grafana/LB/alerting/lb-application-observability.yaml \
  tests/test_lb_observability_alerts.py
git diff --cached --check
git diff --cached -- jobs/grafana.nomad
git commit -m "feat(observability): alert on production regressions"
```

Expected: unrelated Grafana job modifications remain unstaged.

### Task 4: Make Verification Environment-Aware and Update the Runbook

**Files:**
- Modify: `/Users/johan/dev/lb-infra/scripts/verify_lb_observability.py`
- Modify: `/Users/johan/dev/lb-infra/tests/test_verify_lb_observability.py`
- Modify: `/Users/johan/dev/lb-infra/docs/runbooks/lb-observability.md`
- Modify: `/Users/johan/dev/lb-infra/docs/OBSERVABILITY.md`

**Interfaces:**
- Produces: `EnvironmentProfile(name, frontend_job, backend_job, expected_alert_uids)`.
- Produces CLI: `--environment {stage,production}` defaulting to `stage`.
- Production mode is always read-only; `--write-probes` and `--fault-test` remain Stage-only.

- [ ] **Step 1: Write verifier policy RED tests**

Require:

```python
STAGE_PROFILE = EnvironmentProfile(
    name="stage",
    frontend_job="lb-frontend-stage",
    backend_job="lb-backend-stage",
    expected_alert_uids=STAGE_ALERT_UIDS,
)
PRODUCTION_PROFILE = EnvironmentProfile(
    name="production",
    frontend_job="lb-frontend-live",
    backend_job="lb-backend-live",
    expected_alert_uids=PRODUCTION_ALERT_UIDS,
)
```

Test parser default Stage, explicit production, production job/label/dashboard checks, and rejection of either production plus `--write-probes` or production plus `--fault-test` before network I/O.

- [ ] **Step 2: Run RED**

```bash
python3 -m pytest -q tests/test_verify_lb_observability.py
```

Expected: FAIL because environment selection does not exist.

- [ ] **Step 3: Implement profiles and read-only production verification**

Add the frozen dataclass and parser choice. Replace hard-coded Stage job names, label matchers, frontend/backend origins, and alert UIDs with the selected profile. Keep synthetic payloads and fault tests Stage-only with this exact validation:

```python
if profile.name == "production" and (args.write_probes or args.fault_test):
    parser.error("production observability verification is read-only")
```

- [ ] **Step 4: Document operator response**

Add production first-response steps to the runbook:

1. fix dashboard variables to `production` and the promoted SHA;
2. verify Vector/ingestion before treating quiet charts as healthy;
3. inspect 5xx, hydration, chunk, and generic browser signals;
4. notify the release operator;
5. use the recorded previous digest/job version for human rollback;
6. never paste event bodies or credentials into Slack.

Document the one-hour staffed window and next-working-day review in `docs/OBSERVABILITY.md`.

- [ ] **Step 5: Run GREEN and full infra tests**

```bash
python3 -m pytest -q \
  tests/test_verify_lb_observability.py \
  tests/test_lb_observability_dashboard.py \
  tests/test_lb_observability_alerts.py \
  tests/test_lb_application_log_pipeline.py
python3 scripts/verify_lb_observability.py --dry-run
```

Expected: tests and Stage-default dry run pass. Do not invoke production network verification yet.

- [ ] **Step 6: Commit and review the exact infrastructure range**

```bash
git add scripts/verify_lb_observability.py \
  tests/test_verify_lb_observability.py \
  docs/runbooks/lb-observability.md docs/OBSERVABILITY.md
git diff --cached --check
git commit -m "docs(observability): define production response"
```

Review all commits from this plan. Fix every Critical/Important finding. A live Grafana/Vector deployment and controlled firing/recovery require separate authorization and occur only after the production-promotion plan is complete.
