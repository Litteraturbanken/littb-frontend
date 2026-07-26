import json
import os
import subprocess
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_live_playwright(
    *arguments: str,
    backend_origin: str = "http://127.0.0.1:9",
    nuxt_origin: str = "http://127.0.0.1:10",
) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.update(
        {
            "LITTB_BACKEND_ORIGIN": backend_origin,
            "LITTB_NUXT_LIVE_ORIGIN": nuxt_origin,
        }
    )
    return subprocess.run(
        [
            "yarn",
            "test:e2e:nuxt-live",
            *arguments,
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


class OpenApiHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/v2/openapi.json":
            self.send_error(404)
            return
        body = json.dumps(
            {
                "openapi": "3.1.0",
                "paths": {"/dictionary/articles": {"get": {}}},
            }
        ).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_arguments: object) -> None:
        pass


class NuxtLivePlaywrightTest(unittest.TestCase):
    def test_conventional_e2e_scripts_use_the_nuxt_live_configuration(self) -> None:
        package = json.loads((ROOT / "package.json").read_text())

        self.assertEqual(package["scripts"]["test"], "yarn test:e2e:nuxt-live")
        self.assertEqual(package["scripts"]["test:e2e"], "yarn test:e2e:nuxt-live")
        self.assertEqual(package["scripts"]["test:ui"], "yarn test:e2e:nuxt-live --ui")
        self.assertEqual(
            package["scripts"]["test:debug"],
            "yarn test:e2e:nuxt-live --debug",
        )

    def test_config_lists_only_the_five_live_smoke_checks(self) -> None:
        result = run_live_playwright("--list")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Total: 5 tests in 1 file", result.stdout)
        for title in (
            "loads the Nuxt library shell",
            "navigates one Reader page",
            "opens a typed dictionary article",
            "navigates one Editor page",
            "hydrates the text-search route",
        ):
            self.assertIn(title, result.stdout)

    def test_backend_preflight_fails_with_the_exact_required_endpoint(self) -> None:
        result = run_live_playwright("--grep", "Nuxt library")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "Backend preflight failed: http://127.0.0.1:9/v2/openapi.json",
            result.stderr + result.stdout,
        )

    def test_nuxt_preflight_runs_after_a_valid_backend_preflight(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), OpenApiHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            backend_origin = f"http://127.0.0.1:{server.server_port}"
            result = run_live_playwright(
                "--grep",
                "Nuxt library",
                backend_origin=backend_origin,
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "Nuxt preflight failed: http://127.0.0.1:10/_nuxt/@vite/client",
            result.stderr + result.stdout,
        )


if __name__ == "__main__":
    unittest.main()
