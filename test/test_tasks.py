import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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
        check = run_invoke("--dry", "codegen.check")

        self.assertEqual(nuxt.returncode, 0, nuxt.stderr)
        self.assertIn("yarn dev --port 3456", nuxt.stdout)
        self.assertEqual(generate.returncode, 0, generate.stderr)
        self.assertIn("yarn api:generate", generate.stdout)
        self.assertEqual(check.returncode, 0, check.stderr)
        self.assertIn("yarn api:check", check.stdout)

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
