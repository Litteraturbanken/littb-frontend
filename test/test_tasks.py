import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import tasks


ROOT = Path(__file__).resolve().parents[1]


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


def initialize_visual_repository(repository: Path) -> str:
    baseline = repository / "nuxt" / "test" / "visual" / "baselines" / "authority.png"
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
    return run_git(repository, "rev-parse", "HEAD").stdout.strip()


class InvokeTasksTest(unittest.TestCase):
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
            "quality.release",
        ):
            self.assertIn(task_name, result.stdout)

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

    def test_codegen_generate_uses_the_configured_node_runtime(self) -> None:
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

        with patch.object(
            tasks.Settings, "from_environment", return_value=settings
        ), patch.object(
            tasks, "_nuxt_node_environment", return_value=node_environment
        ), patch.object(tasks, "_run") as run:
            tasks.codegen_generate.body(context)

        run.assert_called_once_with(
            context,
            ["yarn", "api:generate"],
            settings.nuxt_dir,
            env={
                "LBAPI_OPENAPI_SCHEMA": "http://127.0.0.1:8000/v2/openapi.json",
                **node_environment,
            },
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
                    [
                        "yarn", "tsc", "--noEmit", "--skipLibCheck",
                        "--moduleResolution", "bundler", "--module", "esnext",
                        "--target", "es2022", "--strict",
                        "test/nuxt/library-contract.ts",
                    ],
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

    def test_contract_quality_runs_all_standalone_and_library_contract_gates(self) -> None:
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

        compile_prefix = [
            "yarn", "tsc", "--noEmit", "--skipLibCheck",
            "--moduleResolution", "bundler", "--module", "esnext",
            "--target", "es2022",
        ]
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
                    [
                        *compile_prefix,
                        "--strict",
                        "test/nuxt/author-works-contract.ts",
                    ],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    [*compile_prefix, "--strict", "test/nuxt/library-contract.ts"],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    [*compile_prefix, "--strict", "test/nuxt/reader-source-info-contract.ts"],
                    settings.nuxt_dir,
                    env=node_environment,
                ),
                call(
                    context,
                    [*compile_prefix, "--strict", "test/nuxt/renderable-html-contract.ts"],
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
            ["yarn", "typecheck"],
        ])

    def test_release_quality_composes_fail_fast_gates_and_immutable_visual_check(self) -> None:
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

    def test_visual_baseline_gate_accepts_a_clean_authority_checkout(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_rejects_a_committed_change_after_authority(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            baseline = repository / "nuxt/test/visual/baselines/authority.png"
            baseline.write_bytes(b"committed later")
            self.assertEqual(run_git(repository, "add", str(baseline)).returncode, 0)
            self.assertEqual(
                run_git(repository, "commit", "-qm", "change visual baseline").returncode,
                0,
            )

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_rejects_a_staged_tracked_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            baseline = repository / "nuxt/test/visual/baselines/authority.png"
            baseline.write_bytes(b"staged")
            self.assertEqual(run_git(repository, "add", str(baseline)).returncode, 0)
            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_rejects_an_unstaged_tracked_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            (repository / "nuxt/test/visual/baselines/authority.png").write_bytes(b"unstaged")
            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_rejects_even_an_ignored_untracked_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            (repository / ".gitignore").write_text("nuxt/test/visual/baselines/new.png\n")
            (repository / "nuxt/test/visual/baselines/new.png").write_bytes(b"untracked")
            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_rejects_an_ordinary_untracked_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            (repository / "nuxt/test/visual/baselines/new.png").write_bytes(b"untracked")

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_reads_assume_unchanged_files_from_disk(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            relative_path = "nuxt/test/visual/baselines/authority.png"
            self.assertEqual(
                run_git(repository, "update-index", "--assume-unchanged", relative_path).returncode,
                0,
            )
            (repository / relative_path).write_bytes(b"hidden assume-unchanged change")

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_reads_skip_worktree_files_from_disk(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            relative_path = "nuxt/test/visual/baselines/authority.png"
            self.assertEqual(
                run_git(repository, "update-index", "--skip-worktree", relative_path).returncode,
                0,
            )
            (repository / relative_path).write_bytes(b"hidden skip-worktree change")

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, authority)

    def test_visual_baseline_gate_resolves_repository_root_from_a_subdirectory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            authority = initialize_visual_repository(repository)
            (repository / "nuxt/test/visual/baselines/authority.png").write_bytes(b"subdirectory change")

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository / "nuxt", authority)

    def test_visual_baseline_gate_rejects_an_invalid_authority(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            initialize_visual_repository(repository)

            with self.assertRaises(tasks.Exit):
                tasks._verify_visual_baselines(repository, "not-an-authority")

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
