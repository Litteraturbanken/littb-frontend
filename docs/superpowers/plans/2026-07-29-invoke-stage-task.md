# Invoke Staging Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit `invoke stage` command that deploys the configured backend and current frontend sequentially without duplicating either repository's deployment logic.

**Architecture:** The root Invoke task validates the two existing shell scripts, then runs the backend script and frontend script through the established `_run` helper. Both refs default to `HEAD`; Invoke itself performs no Git, image, Nomad, or health work.

**Tech Stack:** Python 3, Invoke, `unittest`, existing Bash deployment scripts.

## Global Constraints

- Work on the current branch and current worktree.
- Do not run `invoke stage`, either deployment script, `nomad run`, or any equivalent deployment action until the user explicitly asks.
- Use `LB_BACKEND_DIR` through `Settings.from_environment()`; do not hard-code a developer checkout in `tasks.py`.
- Run backend deployment before frontend deployment and stop on the first failure.
- Preserve all cleanliness, Git push, image build, Nomad, and health checks inside the existing shell scripts.

---

### Task 1: Expose the guarded staging orchestrator

**Files:**
- Modify: `test/test_tasks.py`
- Modify: `tasks.py`

**Interfaces:**
- Consumes: `Settings.from_environment()`, `_run(context, command, directory)`, `<backend>/scripts/deploy-stage.sh`, `<frontend>/scripts/deploy-stage.sh`.
- Produces: `stage(context: Context, backend_ref: str = "HEAD", frontend_ref: str = "HEAD") -> None` registered as the root `stage` task.

- [ ] **Step 1: Write the failing command-list and sequencing tests**

Add `stage` to `test_lists_the_public_development_tasks`, then add:

```python
def test_stage_runs_existing_backend_then_frontend_scripts(self) -> None:
    context = tasks.Context()
    settings = tasks.Settings(
        backend_app="example.web:app",
        backend_dir=Path("/configured/backend"),
        backend_host="127.0.0.1",
        backend_port=8000,
        nuxt_dir=Path("/configured/frontend/nuxt"),
        nuxt_port=3020,
    )
    with patch.object(
        tasks.Settings, "from_environment", return_value=settings
    ), patch.object(tasks, "_require_file") as require_file, patch.object(
        tasks, "_run"
    ) as run:
        tasks.stage.body(context, backend_ref="backend-sha", frontend_ref="frontend-sha")

    self.assertEqual(
        require_file.call_args_list,
        [
            call(settings.backend_dir / "scripts/deploy-stage.sh", "Backend"),
            call(ROOT / "scripts/deploy-stage.sh", "Frontend"),
        ],
    )
    self.assertEqual(
        run.call_args_list,
        [
            call(
                context,
                [str(settings.backend_dir / "scripts/deploy-stage.sh"), "backend-sha"],
                settings.backend_dir,
            ),
            call(
                context,
                [str(ROOT / "scripts/deploy-stage.sh"), "frontend-sha"],
                ROOT,
            ),
        ],
    )


def test_require_file_rejects_a_missing_deployment_script(self) -> None:
    with tempfile.TemporaryDirectory() as directory:
        missing = Path(directory) / "missing-deploy-stage.sh"
        with self.assertRaises(tasks.Exit) as raised:
            tasks._require_file(missing, "Backend")

    self.assertIn("deployment script does not exist", str(raised.exception))
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `python test/test_tasks.py InvokeTaskTests.test_lists_the_public_development_tasks InvokeTaskTests.test_stage_runs_existing_backend_then_frontend_scripts InvokeTaskTests.test_require_file_rejects_a_missing_deployment_script`

Expected: FAIL because `stage` is neither defined nor registered.

- [ ] **Step 3: Implement the minimal guarded task**

Add next to the other root tasks in `tasks.py`:

```python
def _require_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise Exit(f"{label} deployment script does not exist: {path}")


@task(
    help={
        "backend_ref": "Backend Git ref passed to its staging script.",
        "frontend_ref": "Frontend Git ref passed to its staging script.",
    }
)
def stage(
    context: Context,
    backend_ref: str = "HEAD",
    frontend_ref: str = "HEAD",
) -> None:
    """Deploy the backend and frontend staging jobs from explicit Git refs."""
    settings = Settings.from_environment()
    backend_script = settings.backend_dir / "scripts" / "deploy-stage.sh"
    frontend_script = ROOT / "scripts" / "deploy-stage.sh"
    _require_file(backend_script, "Backend")
    _require_file(frontend_script, "Frontend")
    _run(context, [str(backend_script), backend_ref], settings.backend_dir)
    _run(context, [str(frontend_script), frontend_ref], ROOT)
```

Register it with `ns.add_task(stage)`.

- [ ] **Step 4: Run focused verification and command discovery**

Run the Step 2 unittest command again.

Expected: PASS.

Run: `python -m invoke --help stage`

Expected: exit 0 and show `--backend-ref` and `--frontend-ref`. Do not run the task itself.

- [ ] **Step 5: Run the complete Invoke suite**

Run: `python test/test_tasks.py`

Expected: PASS with no deployment process started.

- [ ] **Step 6: Commit**

```bash
git add tasks.py test/test_tasks.py
git commit -m "feat: add guarded invoke staging task"
```
