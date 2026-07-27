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

        with patch.dict(
            os.environ,
            {"LB_BACKEND_PYTHON": "/configured/backend/virtual_env/bin/python"},
        ), patch.object(
            tasks.Settings, "from_environment", return_value=settings
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
                    "LBAPI_OPENAPI_SCHEMA": "/configured/backend/openapi/v2.json"
                }
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
