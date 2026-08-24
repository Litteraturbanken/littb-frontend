import inspect
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import tasks


ROOT = Path(__file__).resolve().parents[1]
VISUAL_BASELINE_PATH = Path("nuxt/test/visual/baselines")
VISUAL_BASELINE_MANIFEST_PATH = Path("nuxt/test/visual/baseline-review.json")


def run_invoke(*arguments: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    command_env = os.environ.copy()
    if env:
        command_env.update(env)
    return subprocess.run(
        [sys.executable, "-m", "invoke", *arguments],
        cwd=ROOT,
        env=command_env,
        capture_output=True,
        text=True,
        check=False,
    )


def run_git(repository: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *arguments],
        cwd=repository,
        capture_output=True,
        text=True,
        check=False,
    )


def visual_tree_id(repository: Path, revision: str) -> str:
    result = run_git(repository, "rev-parse", f"{revision}:{VISUAL_BASELINE_PATH.as_posix()}")
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


def stage_visual_manifest(repository: Path) -> str:
    index_tree = run_git(repository, "write-tree")
    if index_tree.returncode != 0:
        raise AssertionError(index_tree.stderr)
    baseline_tree = visual_tree_id(repository, index_tree.stdout.strip())
    manifest = repository / VISUAL_BASELINE_MANIFEST_PATH
    manifest.write_text(
        json.dumps({"version": 1, "baselineTree": baseline_tree}, indent=2) + "\n"
    )
    result = run_git(repository, "add", VISUAL_BASELINE_MANIFEST_PATH.as_posix())
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return baseline_tree


def initialize_visual_repository(repository: Path) -> str:
    baseline = repository / VISUAL_BASELINE_PATH / "authority.png"
    baseline.parent.mkdir(parents=True)
    baseline.write_bytes(b"authority")
    for arguments in (
        ("init", "-q"),
        ("config", "user.email", "quality@example.test"),
        ("config", "user.name", "Quality Gate"),
        ("add", "."),
        ("commit", "-qm", "visual authority"),
    ):
        result = run_git(repository, *arguments)
        if result.returncode != 0:
            raise AssertionError(result.stderr)
    stage_visual_manifest(repository)
    result = run_git(repository, "commit", "-qm", "review visual baselines")
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return run_git(repository, "rev-parse", "HEAD").stdout.strip()


class InvokeTaskTests(unittest.TestCase):
    def test_visual_baseline_gate_uses_the_review_manifest_without_a_historical_authority(self) -> None:
        parameters = inspect.signature(tasks._verify_visual_baselines).parameters

        self.assertEqual(
            getattr(tasks, "VISUAL_BASELINE_MANIFEST_PATH", None),
            VISUAL_BASELINE_MANIFEST_PATH.as_posix(),
        )
        self.assertNotIn("authority", parameters)

    def test_nuxt_contract_project_inherits_nuxt_aliases_and_covers_every_contract(self) -> None:
        config_path = ROOT / "nuxt" / "tsconfig.contracts.json"

        self.assertTrue(config_path.is_file(), "missing Nuxt contract tsconfig")
        config = json.loads(config_path.read_text())
        self.assertEqual(config["extends"], "./.nuxt/tsconfig.app.json")
        self.assertEqual(config["include"], ["test/nuxt/*-contract.ts"])
        self.assertTrue(config["compilerOptions"]["noEmit"])

    def test_default_backend_dir_is_discovered_from_the_main_repository(self) -> None:
        git_result = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout="/workspace/littb/.git\n",
            stderr="",
        )
        with patch.dict(os.environ, {}, clear=False), patch.object(
            tasks.subprocess,
            "run",
            return_value=git_result,
        ):
            os.environ.pop("LB_BACKEND_DIR", None)
            settings = tasks.Settings.from_environment()

        self.assertEqual(settings.backend_dir, Path("/workspace/lb-backend"))
        self.assertNotIn("/Users/", Path(tasks.__file__).read_text())

    def test_lists_the_public_development_tasks(self) -> None:
        result = run_invoke("--list")

        self.assertEqual(result.returncode, 0, result.stderr)
        for task_name in (
            "codegen",
            "codegen.check",
            "dev",
            "dev.backend",
            "dev.nuxt",
            "e2e",
            "status",
            "test",
            "typecheck",
            "quality.backend",
            "quality.contract",
            "quality.frontend",
            "quality.library",
            "quality.reader-editor",
            "quality.release",
            "observability",
            "stage",
        ):
            self.assertIn(task_name, result.stdout)

    def test_observability_delegates_to_infra_verifier_without_cli_credentials(self) -> None:
        context = tasks.Context()
        infra_dir = Path("/configured/lb-infra")
        verifier = infra_dir / "scripts" / "verify_lb_observability.py"

        with patch.dict(os.environ, {"LB_INFRA_DIR": str(infra_dir)}), patch.object(
            tasks,
            "_require_file",
        ) as require_file, patch.object(tasks, "_run") as run:
            tasks.observability.body(context, dry_run=True)

        require_file.assert_called_once_with(verifier, "Observability verifier")
        run.assert_called_once_with(
            context,
            [sys.executable, str(verifier), "--dry-run"],
            infra_dir,
        )

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
            tasks.Settings,
            "from_environment",
            return_value=settings,
        ), patch.object(tasks, "_require_file") as require_file, patch.object(
            tasks,
            "_run",
        ) as run:
            tasks.stage.body(
                context,
                backend_ref="backend-sha",
                frontend_ref="frontend-sha",
            )

        backend_script = settings.backend_dir / "scripts" / "deploy-stage.sh"
        frontend_script = ROOT / "scripts" / "deploy-stage.sh"
        self.assertEqual(
            require_file.call_args_list,
            [call(backend_script, "Backend"), call(frontend_script, "Frontend")],
        )
        self.assertEqual(
            run.call_args_list,
            [
                call(
                    context,
                    [str(backend_script), "backend-sha"],
                    settings.backend_dir,
                ),
                call(
                    context,
                    [str(frontend_script), "frontend-sha"],
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

    def test_status_reports_environment_overrides(self) -> None:
        result = run_invoke(
            "status",
            env={
                "LB_BACKEND_DIR": "/tmp/lb-backend-example",
                "LB_BACKEND_PORT": "8123",
                "NUXT_DIR": "/tmp/littb-nuxt-example",
                "NUXT_PORT": "3456",
            },
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("/tmp/lb-backend-example", result.stdout)
        self.assertIn("http://127.0.0.1:8123", result.stdout)
        self.assertIn("http://127.0.0.1:8123/v2/openapi.json", result.stdout)
        self.assertIn("Backend v2: missing", result.stdout)
        self.assertIn("/tmp/littb-nuxt-example", result.stdout)
        self.assertIn("http://127.0.0.1:3456", result.stdout)

    def test_backend_dry_run_uses_the_configured_app_and_port(self) -> None:
        result = run_invoke(
            "--dry",
            "dev.backend",
            env={
                "LB_BACKEND_APP": "example.web:api",
                "LB_BACKEND_DIR": str(ROOT),
                "LB_BACKEND_PORT": "8123",
            },
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("-m uvicorn example.web:api --reload", result.stdout)
        self.assertIn("--host 127.0.0.1 --port 8123", result.stdout)

    def test_nuxt_and_codegen_dry_runs_delegate_to_existing_scripts(self) -> None:
        nuxt = run_invoke("--dry", "dev.nuxt", env={"NUXT_PORT": "3456"})
        generate = run_invoke("--dry", "codegen")
        backend_dir = ROOT
        check = run_invoke(
            "--dry",
            "codegen.check",
            env={"LB_BACKEND_DIR": str(backend_dir)},
        )

        self.assertEqual(nuxt.returncode, 0, nuxt.stderr)
        self.assertIn("yarn dev --port 3456", nuxt.stdout)
        self.assertEqual(generate.returncode, 0, generate.stderr)
        self.assertIn("yarn api:generate", generate.stdout)
        self.assertEqual(check.returncode, 0, check.stderr)
        self.assertIn("scripts/export_v2_openapi.py --check", check.stdout)
        self.assertIn("yarn api:check", check.stdout)
        self.assertLess(
            check.stdout.index("scripts/export_v2_openapi.py --check"),
            check.stdout.index("yarn api:check"),
        )

    def test_codegen_check_passes_the_configured_snapshot_to_nuxt(self) -> None:
        settings = tasks.Settings(
            backend_app="example.web:app",
            backend_dir=Path("/configured/backend"),
            backend_host="127.0.0.1",
            backend_port=8000,
            nuxt_dir=Path("/configured/nuxt"),
            nuxt_port=3020,
        )
        context = tasks.Context()
        node_environment = {"PATH": "/configured/node/bin:/usr/bin"}

        with patch.dict(
            os.environ,
            {"LB_BACKEND_PYTHON": "/configured/backend/virtual_env/bin/python"},
        ), patch.object(
            tasks.Settings, "from_environment", return_value=settings
        ), patch.object(
            tasks, "_nuxt_node_environment", return_value=node_environment
        ), patch.object(tasks, "_run") as run:
            tasks.codegen_check.body(context)

        self.assertEqual(run.call_count, 2)
        self.assertEqual(
            run.call_args_list[0].args,
            (
                context,
                [
                    "/configured/backend/virtual_env/bin/python",
                    "scripts/export_v2_openapi.py",
                    "--check",
                ],
                settings.backend_dir,
            ),
        )
        self.assertEqual(run.call_args_list[0].kwargs, {})
        self.assertEqual(
            run.call_args_list[1].args,
            (context, ["yarn", "api:check"], settings.nuxt_dir),
        )
        self.assertEqual(
            run.call_args_list[1].kwargs,
            {
                "env": {
                    "LBAPI_OPENAPI_SCHEMA": "/configured/backend/openapi/v2.json",
                    **node_environment,
                }
            },
        )

    def test_codegen_generate_exports_snapshot_before_types(self) -> None:
        settings = tasks.Settings(
            backend_app="example.web:app",
            backend_dir=Path("/configured/backend"),
            backend_host="127.0.0.1",
            backend_port=8000,
            nuxt_dir=Path("/configured/nuxt"),
            nuxt_port=3020,
        )
        context = tasks.Context()
        node_environment = {"PATH": "/configured/node/bin:/usr/bin"}

        with patch.dict(
            os.environ,
            {
                "LB_BACKEND_PYTHON": "/configured/backend/virtual_env/bin/python",
                "LBAPI_OPENAPI_SCHEMA": "https://live.example.test/v2/openapi.json",
            },
        ), patch.object(
            tasks.Settings, "from_environment", return_value=settings
        ), patch.object(
            tasks, "_nuxt_node_environment", return_value=node_environment
        ), patch.object(tasks, "_run") as run:
            tasks.codegen_generate.body(context)

        self.assertEqual(
            run.call_args_list,
            [
                call(
                    context,
                    [
                        "/configured/backend/virtual_env/bin/python",
                        "scripts/export_v2_openapi.py",
                    ],
                    settings.backend_dir,
                ),
                call(
                    context,
                    ["yarn", "api:generate"],
                    settings.nuxt_dir,
                    env={
                        "LBAPI_OPENAPI_SCHEMA": "/configured/backend/openapi/v2.json",
                        **node_environment,
                    },
                ),
            ],
        )

    def test_backend_quality_dry_run_uses_pinned_repository_tools(self) -> None:
        result = run_invoke(
            "--dry", "quality.backend", env={"LB_BACKEND_DIR": str(ROOT)}
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("-m mypy --config-file mypy.ini lbapi/v2", result.stdout)
        self.assertIn("-m ruff check lbapi/v2 --select E4,E7,E9,F,S", result.stdout)
        self.assertIn("-m pytest -q test_lbapi/v2", result.stdout)

    def test_contract_quality_checks_snapshot_before_generated_client(self) -> None:
        result = run_invoke(
            "--dry", "quality.contract", env={"LB_BACKEND_DIR": str(ROOT)}
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("scripts/export_v2_openapi.py --check", result.stdout)
        self.assertIn("yarn api:check", result.stdout)
        self.assertLess(
            result.stdout.index("scripts/export_v2_openapi.py --check"),
            result.stdout.index("yarn api:check"),
        )

    def test_reader_editor_quality_dry_run_keeps_the_focused_gate_order(self) -> None:
        result = run_invoke(
            "--dry", "quality.reader-editor", env={"LB_BACKEND_DIR": str(ROOT)}
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        expected_steps = (
            "-m pytest -q test_lbapi/v2/test_work_manifest_models.py "
            "test_lbapi/v2/test_work_manifest_provider.py "
            "test_lbapi/v2/test_work_manifest_api.py",
            "scripts/export_v2_openapi.py --check",
            "yarn api:check",
            "yarn tsc --noEmit --project tsconfig.contracts.json",
            "yarn typecheck",
            "yarn lint",
            "yarn vitest run test/unit/work-manifest-client.spec.ts "
            "test/unit/reader-source.spec.ts test/unit/editor-reader-html.spec.ts",
            "yarn playwright test test/ssr/reader.spec.ts "
            "test/ssr/reader-shorthand.spec.ts test/ssr/editor-reader.spec.ts --project=ssr",
        )
        previous = -1
        for step in expected_steps:
            position = result.stdout.index(step)
            self.assertGreater(position, previous)
            previous = position

    def test_library_quality_runs_focused_backend_and_nuxt_gates(self) -> None:
        settings = tasks.Settings(
            backend_app="example.web:app",
            backend_dir=Path("/configured/backend"),
            backend_host="127.0.0.1",
            backend_port=8000,
            nuxt_dir=Path("/configured/nuxt"),
            nuxt_port=3020,
        )
        context = tasks.Context()
        node_environment = {"PATH": "/configured/node/bin:/usr/bin"}

        with patch.dict(
            os.environ,
            {"LB_BACKEND_PYTHON": "/configured/backend/virtual_env/bin/python"},
        ), patch.object(
            tasks.Settings, "from_environment", return_value=settings
        ), patch.object(
            tasks, "_nuxt_node_environment", return_value=node_environment
        ), patch.object(tasks, "_run") as run:
            tasks.quality_library.body(context)

        self.assertEqual(
            run.call_args_list,
            [
                call(
                    context,
                    [
                        "/configured/backend/virtual_env/bin/python",
                        "-m",
                        "pytest",
                        "-q",
                        "test_lbapi/v2/test_library_models.py",
                        "test_lbapi/v2/test_library_provider.py",
                        "test_lbapi/v2/test_library_api.py",
                    ],
                    settings.backend_dir,
                ),
                call(
                    context,
                    [
                        "/configured/backend/virtual_env/bin/python",
                        "scripts/export_v2_openapi.py",
                        "--check",
                    ],
                    settings.backend_dir,
                ),
                call(
                    context,
                    ["yarn", "api:check"],
                    settings.nuxt_dir,
                    env={
                        "LBAPI_OPENAPI_SCHEMA": "/configured/backend/openapi/v2.json",
                        **node_environment,
                    },
                ),
                call(
                    context,
                    ["yarn", "tsc", "--noEmit", "--project", "tsconfig.contracts.json"],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    ["yarn", "typecheck"],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    ["yarn", "quality:maintainability"],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    ["yarn", "quality:review:check"],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    [
                        "yarn", "vitest", "run",
                        "test/unit/library-contract.spec.ts",
                        "test/unit/library-navigation.spec.ts",
                        "test/unit/library-tooltip.spec.ts",
                        "test/unit/v2-server.spec.ts",
                    ],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    [
                        "yarn", "playwright", "test",
                        "test/ssr/library.spec.ts", "--project=ssr",
                    ],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
            ],
        )

    def test_contract_quality_runs_project_and_library_contract_gates(self) -> None:
        settings = tasks.Settings(
            backend_app="example.web:app",
            backend_dir=Path("/configured/backend"),
            backend_host="127.0.0.1",
            backend_port=8000,
            nuxt_dir=Path("/configured/nuxt"),
            nuxt_port=3020,
        )
        context = tasks.Context()
        node_environment = {"PATH": "/configured/node/bin:/usr/bin"}

        with patch.dict(
            os.environ,
            {"LB_BACKEND_PYTHON": "/configured/backend/virtual_env/bin/python"},
        ), patch.object(
            tasks.Settings, "from_environment", return_value=settings
        ), patch.object(
            tasks, "_nuxt_node_environment", return_value=node_environment
        ), patch.object(tasks, "_run") as run:
            tasks.quality_contract.body(context)

        self.assertEqual(
            run.call_args_list,
            [
                call(
                    context,
                    [
                        "/configured/backend/virtual_env/bin/python",
                        "scripts/export_v2_openapi.py",
                        "--check",
                    ],
                    settings.backend_dir,
                ),
                call(
                    context,
                    ["yarn", "api:check"],
                    settings.nuxt_dir,
                    env={
                        "LBAPI_OPENAPI_SCHEMA": "/configured/backend/openapi/v2.json",
                        **node_environment,
                    },
                ),
                call(
                    context,
                    ["yarn", "tsc", "--noEmit", "--project", "tsconfig.contracts.json"],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    [
                        "/configured/backend/virtual_env/bin/python",
                        "-m",
                        "pytest",
                        "-q",
                        "test_lbapi/v2/test_work_manifest_provider.py",
                        "test_lbapi/v2/test_work_manifest_api.py",
                        "test_lbapi/v2/test_library_provider.py",
                        "test_lbapi/v2/test_library_api.py",
                    ],
                    settings.backend_dir,
                ),
                call(
                    context,
                    [
                        "yarn", "vitest", "run",
                        "test/unit/library-contract.spec.ts",
                    ],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
            ],
        )

    def test_frontend_quality_runs_every_blocking_gate_in_order_under_node_22(self) -> None:
        with tempfile.TemporaryDirectory() as nuxt_dir:
            nuxt_path = Path(nuxt_dir)
            (nuxt_path / ".nvmrc").write_text("22.22.0\n")
            settings = tasks.Settings(
                backend_app="example.web:app",
                backend_dir=Path("/configured/backend"),
                backend_host="127.0.0.1",
                backend_port=8000,
                nuxt_dir=nuxt_path,
                nuxt_port=3020,
            )
            context = tasks.Context()

            with patch.dict(
                os.environ,
                {"NVM_DIR": "/configured/nvm", "PATH": "/usr/bin"},
            ), patch.object(
                tasks.Settings, "from_environment", return_value=settings
            ), patch.object(tasks, "_run") as run:
                tasks.quality_frontend.body(context)

        node_environment = {
            "PATH": "/configured/nvm/versions/node/v22.22.0/bin:/usr/bin"
        }
        self.assertEqual(
            run.call_args_list,
            [
                call(context, ["yarn", "policy:check"], settings.nuxt_dir, env=node_environment),
                call(context, ["yarn", "lint"], settings.nuxt_dir, env=node_environment),
                call(context, ["yarn", "quality:maintainability"], settings.nuxt_dir, env=node_environment),
                call(context, ["yarn", "quality:review:check"], settings.nuxt_dir, env=node_environment),
                call(context, ["yarn", "typecheck"], settings.nuxt_dir, env=node_environment),
                call(context, ["yarn", "test:unit"], settings.nuxt_dir, env=node_environment),
                call(context, ["yarn", "build"], settings.nuxt_dir, env=node_environment),
                call(context, ["yarn", "test:ssr"], settings.nuxt_dir, env=node_environment),
            ],
        )
        for invocation in run.call_args_list:
            self.assertNotIn("warn", invocation.kwargs)

    def test_frontend_stops_when_the_app_contract_fails_nuxt_typecheck(self) -> None:
        settings = tasks.Settings(
            backend_app="example.web:app",
            backend_dir=Path("/configured/backend"),
            backend_host="127.0.0.1",
            backend_port=8000,
            nuxt_dir=Path("/configured/nuxt"),
            nuxt_port=3020,
        )
        context = tasks.Context()
        node_environment = {"PATH": "/configured/node/bin:/usr/bin"}
        calls: list[list[str]] = []

        def run_gate(_context: tasks.Context, command: list[str], _directory: Path, **_kwargs: object) -> None:
            calls.append(command)
            if command == ["yarn", "typecheck"]:
                raise tasks.Exit("renderable-html-app-contract failed")

        with patch.object(
            tasks.Settings, "from_environment", return_value=settings
        ), patch.object(
            tasks, "_nuxt_node_environment", return_value=node_environment
        ), patch.object(tasks, "_run", side_effect=run_gate):
            with self.assertRaises(tasks.Exit):
                tasks.quality_frontend.body(context)

        self.assertEqual(calls, [
            ["yarn", "policy:check"],
            ["yarn", "lint"],
            ["yarn", "quality:maintainability"],
            ["yarn", "quality:review:check"],
            ["yarn", "typecheck"],
        ])

    def test_release_quality_composes_fail_fast_gates_and_reviewed_visual_check(self) -> None:
        with tempfile.TemporaryDirectory() as nuxt_dir:
            nuxt_path = Path(nuxt_dir)
            (nuxt_path / ".nvmrc").write_text("22.22.0\n")
            settings = tasks.Settings(
                backend_app="example.web:app",
                backend_dir=Path("/configured/backend"),
                backend_host="127.0.0.1",
                backend_port=8000,
                nuxt_dir=nuxt_path,
                nuxt_port=3020,
            )
            context = tasks.Context()
            calls = MagicMock()

            with patch.dict(
                os.environ,
                {"NVM_DIR": "/configured/nvm", "PATH": "/usr/bin"},
            ), patch.object(
                tasks.Settings, "from_environment", return_value=settings
            ), patch.object(
                tasks.quality_backend, "body", calls.backend
            ), patch.object(
                tasks.quality_contract, "body", calls.contract
            ), patch.object(
                tasks.quality_frontend, "body", calls.frontend
            ), patch.object(
                tasks, "_verify_visual_baselines", calls.visual
            ), patch.object(tasks, "_run", calls.run):
                tasks.quality_release.body(context)

        self.assertEqual(
            calls.mock_calls,
            [
                call.backend(context),
                call.contract(context),
                call.frontend(context),
                call.run(
                    context,
                    ["yarn", "test:e2e"],
                    settings.nuxt_dir,
                    env={"PATH": "/configured/nvm/versions/node/v22.22.0/bin:/usr/bin"},
                ),
                call.visual(tasks.ROOT),
            ],
        )

    def test_visual_baseline_gate_accepts_a_clean_reviewed_checkout(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)

            tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_committed_change_without_manifest_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            baseline = repository / VISUAL_BASELINE_PATH / "authority.png"
            baseline.write_bytes(b"committed later")
            self.assertEqual(
                run_git(repository, "add", baseline.relative_to(repository).as_posix()).returncode,
                0,
            )
            self.assertEqual(
                run_git(repository, "commit", "-qm", "change visual baseline").returncode,
                0,
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_accepts_a_committed_change_with_manifest_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            baseline = repository / VISUAL_BASELINE_PATH / "authority.png"
            baseline.write_bytes(b"reviewed update")
            self.assertEqual(
                run_git(repository, "add", baseline.relative_to(repository).as_posix()).returncode,
                0,
            )
            reviewed_tree = stage_visual_manifest(repository)
            self.assertEqual(
                run_git(repository, "commit", "-qm", "review visual update").returncode,
                0,
            )

            tasks._verify_visual_baselines(repository)

            self.assertEqual(reviewed_tree, visual_tree_id(repository, "HEAD"))

    def test_visual_baseline_gate_reports_committed_changes_since_explicit_review_base(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            review_base = initialize_visual_repository(repository)
            baseline = repository / VISUAL_BASELINE_PATH / "new.png"
            baseline.write_bytes(b"new reviewed baseline")
            self.assertEqual(
                run_git(repository, "add", baseline.relative_to(repository).as_posix()).returncode,
                0,
            )
            stage_visual_manifest(repository)
            self.assertEqual(
                run_git(repository, "commit", "-qm", "add reviewed baseline").returncode,
                0,
            )
            output = io.StringIO()

            with patch.dict(
                os.environ,
                {"VISUAL_BASELINE_REVIEW_BASE": review_base},
            ), redirect_stdout(output):
                tasks._verify_visual_baselines(repository)

            self.assertIn("A\tnuxt/test/visual/baselines/new.png", output.getvalue())
            self.assertIn("M\tnuxt/test/visual/baseline-review.json", output.getvalue())

    def test_visual_baseline_gate_falls_back_to_head_parent_for_change_reporting(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            baseline = repository / VISUAL_BASELINE_PATH / "authority.png"
            baseline.write_bytes(b"reviewed fallback update")
            self.assertEqual(
                run_git(repository, "add", baseline.relative_to(repository).as_posix()).returncode,
                0,
            )
            stage_visual_manifest(repository)
            self.assertEqual(
                run_git(repository, "commit", "-qm", "review fallback update").returncode,
                0,
            )
            output = io.StringIO()

            with patch.dict(os.environ, {}, clear=False), redirect_stdout(output):
                os.environ.pop("VISUAL_BASELINE_REVIEW_BASE", None)
                tasks._verify_visual_baselines(repository)

            self.assertIn("fallback: HEAD^", output.getvalue())
            self.assertIn("M\tnuxt/test/visual/baselines/authority.png", output.getvalue())

    def test_visual_baseline_gate_defaults_to_the_origin_head_merge_base(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            review_base = initialize_visual_repository(repository)
            baseline = repository / VISUAL_BASELINE_PATH / "authority.png"
            baseline.write_bytes(b"reviewed branch update")
            self.assertEqual(
                run_git(repository, "add", baseline.relative_to(repository).as_posix()).returncode,
                0,
            )
            stage_visual_manifest(repository)
            self.assertEqual(
                run_git(repository, "commit", "-qm", "review branch update").returncode,
                0,
            )
            self.assertEqual(
                run_git(
                    repository,
                    "update-ref",
                    "refs/remotes/origin/HEAD",
                    review_base,
                ).returncode,
                0,
            )
            output = io.StringIO()

            with patch.dict(os.environ, {}, clear=False), redirect_stdout(output):
                os.environ.pop("VISUAL_BASELINE_REVIEW_BASE", None)
                tasks._verify_visual_baselines(repository)

            self.assertIn(
                f"Visual baseline review base: {review_base} "
                "(merge-base with origin/HEAD)",
                output.getvalue(),
            )

    def test_visual_baseline_gate_falls_back_to_head_in_a_root_commit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            baseline = repository / VISUAL_BASELINE_PATH / "authority.png"
            baseline.parent.mkdir(parents=True)
            baseline.write_bytes(b"root authority")
            for arguments in (
                ("init", "-q"),
                ("config", "user.email", "quality@example.test"),
                ("config", "user.name", "Quality Gate"),
                ("add", "."),
            ):
                self.assertEqual(run_git(repository, *arguments).returncode, 0)
            stage_visual_manifest(repository)
            self.assertEqual(
                run_git(repository, "commit", "-qm", "root visual review").returncode,
                0,
            )
            head = run_git(repository, "rev-parse", "HEAD").stdout.strip()
            output = io.StringIO()

            with patch.dict(os.environ, {}, clear=False), redirect_stdout(output):
                os.environ.pop("VISUAL_BASELINE_REVIEW_BASE", None)
                tasks._verify_visual_baselines(repository)

            self.assertIn(
                f"Visual baseline review base: {head} (fallback: HEAD)",
                output.getvalue(),
            )

    def test_visual_baseline_gate_rejects_an_invalid_explicit_review_base(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)

            with patch.dict(
                os.environ,
                {"VISUAL_BASELINE_REVIEW_BASE": "not-a-commit"},
            ), self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_staged_tracked_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            baseline = repository / VISUAL_BASELINE_PATH / "authority.png"
            baseline.write_bytes(b"staged")
            self.assertEqual(run_git(repository, "add", str(baseline)).returncode, 0)
            baseline.write_bytes(b"authority")
            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_an_unstaged_tracked_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            (repository / VISUAL_BASELINE_PATH / "authority.png").write_bytes(b"unstaged")
            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_dirty_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            (repository / VISUAL_BASELINE_MANIFEST_PATH).write_text(
                '{"version": 1, "baselineTree": "dirty"}\n'
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_staged_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            manifest = repository / VISUAL_BASELINE_MANIFEST_PATH
            manifest.write_text('{"version": 1, "baselineTree": "staged"}\n')
            self.assertEqual(
                run_git(repository, "add", VISUAL_BASELINE_MANIFEST_PATH.as_posix()).returncode,
                0,
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_even_an_ignored_untracked_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            (repository / ".gitignore").write_text("nuxt/test/visual/baselines/new.png\n")
            (repository / VISUAL_BASELINE_PATH / "new.png").write_bytes(b"untracked")
            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_an_ordinary_untracked_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            (repository / VISUAL_BASELINE_PATH / "new.png").write_bytes(b"untracked")

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_assume_unchanged_even_when_bytes_match(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            relative_path = "nuxt/test/visual/baselines/authority.png"
            self.assertEqual(
                run_git(repository, "update-index", "--assume-unchanged", relative_path).returncode,
                0,
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_skip_worktree_even_when_bytes_match(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            relative_path = "nuxt/test/visual/baselines/authority.png"
            self.assertEqual(
                run_git(repository, "update-index", "--skip-worktree", relative_path).returncode,
                0,
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_resolves_repository_root_from_a_subdirectory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            (repository / VISUAL_BASELINE_PATH / "authority.png").write_bytes(b"subdirectory change")

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository / "nuxt")

    def test_visual_baseline_gate_rejects_a_manifest_with_the_wrong_tree(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            manifest = repository / VISUAL_BASELINE_MANIFEST_PATH
            manifest.write_text(
                json.dumps({"version": 1, "baselineTree": "0" * 40}) + "\n"
            )
            self.assertEqual(
                run_git(repository, "add", VISUAL_BASELINE_MANIFEST_PATH.as_posix()).returncode,
                0,
            )
            self.assertEqual(
                run_git(repository, "commit", "-qm", "wrong visual review").returncode,
                0,
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_missing_committed_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            self.assertEqual(
                run_git(repository, "rm", VISUAL_BASELINE_MANIFEST_PATH.as_posix()).returncode,
                0,
            )
            self.assertEqual(
                run_git(repository, "commit", "-qm", "remove visual review").returncode,
                0,
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_file_symlink_with_head_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            baseline = repository / "nuxt/test/visual/baselines/authority.png"
            target = repository / "authority-copy.png"
            target.write_bytes(b"authority")
            baseline.unlink()
            baseline.symlink_to(target)

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_manifest_symlink_with_head_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            manifest = repository / VISUAL_BASELINE_MANIFEST_PATH
            target = repository / "manifest-copy.json"
            target.write_bytes(manifest.read_bytes())
            manifest.unlink()
            manifest.symlink_to(target)

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_visual_baseline_gate_rejects_a_symlinked_ancestor_with_head_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)
            visual = repository / "nuxt/test/visual"
            external_visual = repository / "external-visual"
            shutil.copytree(visual, external_visual)
            shutil.rmtree(visual)
            visual.symlink_to(external_visual, target_is_directory=True)

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository)

    def test_release_quality_stops_after_the_first_failed_gate(self) -> None:
        context = tasks.Context()
        failure = tasks.Exit("backend failed")

        with patch.object(
            tasks.quality_backend, "body", side_effect=failure
        ) as backend, patch.object(
            tasks.quality_contract, "body"
        ) as contract, patch.object(
            tasks.quality_frontend, "body"
        ) as frontend, patch.object(tasks, "_run") as run:
            with self.assertRaises(tasks.Exit):
                tasks.quality_release.body(context)

        backend.assert_called_once_with(context)
        contract.assert_not_called()
        frontend.assert_not_called()
        run.assert_not_called()

    def test_e2e_dry_run_delegates_to_the_focused_nuxt_live_runner(self) -> None:
        result = run_invoke(
            "--dry",
            "e2e",
            env={"LB_BACKEND_PORT": "8123", "NUXT_PORT": "3456"},
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("yarn test:e2e:nuxt-live", result.stdout)

    def test_e2e_passes_the_configured_origins_to_playwright(self) -> None:
        with patch.dict(
            os.environ,
            {"LB_BACKEND_PORT": "8123", "NUXT_PORT": "3456"},
        ), patch.object(tasks, "_run") as run:
            tasks.e2e.body(tasks.Context())

        self.assertEqual(
            run.call_args.kwargs["env"],
            {
                "LITTB_BACKEND_ORIGIN": "http://127.0.0.1:8123",
                "LITTB_NUXT_LIVE_ORIGIN": "http://127.0.0.1:3456",
            },
        )

    def test_combined_dev_rejects_a_backend_without_the_v2_app(self) -> None:
        with tempfile.TemporaryDirectory() as backend_dir:
            result = run_invoke("dev", env={"LB_BACKEND_DIR": backend_dir})

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not contain lbapi/v2/app.py", result.stderr)

    def test_combined_dev_stops_both_children_when_sigterm_arrives(self) -> None:
        backend_process = MagicMock()
        nuxt_process = MagicMock()
        backend_process.poll.return_value = None
        nuxt_process.poll.return_value = None
        handlers: dict[int, object] = {}

        def install_handler(signum: int, handler: object) -> object:
            previous = handlers.get(signum, tasks.signal.SIG_DFL)
            handlers[signum] = handler
            return previous

        def send_sigterm(_seconds: float) -> None:
            handler = handlers[tasks.signal.SIGTERM]
            assert callable(handler)
            handler(tasks.signal.SIGTERM, None)

        with tempfile.TemporaryDirectory() as backend_dir, tempfile.TemporaryDirectory() as nuxt_dir:
            settings = tasks.Settings(
                backend_app="example.web:app",
                backend_dir=Path(backend_dir),
                backend_host="127.0.0.1",
                backend_port=8000,
                nuxt_dir=Path(nuxt_dir),
                nuxt_port=3020,
            )
            with patch.object(
                tasks.subprocess,
                "Popen",
                side_effect=[backend_process, nuxt_process],
            ), patch.object(tasks.signal, "signal", side_effect=install_handler), patch.object(
                tasks.time,
                "sleep",
                side_effect=send_sigterm,
            ), patch.object(tasks, "_stop_process") as stop_process:
                with self.assertRaises(tasks.Exit) as raised:
                    tasks._run_development_servers(settings)

        self.assertEqual(raised.exception.code, 128 + tasks.signal.SIGTERM)
        self.assertEqual(
            stop_process.call_args_list,
            [call(nuxt_process), call(backend_process)],
        )
        self.assertEqual(handlers[tasks.signal.SIGTERM], tasks.signal.SIG_DFL)

    def test_nuxt_environment_tracks_the_backend_origin(self) -> None:
        with patch.dict(
            os.environ,
            {"LB_BACKEND_HOST": "127.0.0.2", "LB_BACKEND_PORT": "8123"},
        ):
            settings = tasks.Settings.from_environment()

        self.assertEqual(
            tasks._nuxt_environment(settings),
            {
                "LBAPI_PROXY_TARGET": "http://127.0.0.2:8123",
                "NUXT_API_BASE": "http://127.0.0.2:8123/v2",
            },
        )


if __name__ == "__main__":
    unittest.main()
