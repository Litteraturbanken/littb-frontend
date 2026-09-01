import json
import os
import subprocess
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


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


class SearchSurfaceHandler(BaseHTTPRequestHandler):
    response_mode = "failed"

    def do_GET(self) -> None:
        path = unquote(urlparse(self.path).path)
        if path == "/v2/openapi.json":
            self._json(
                {
                    "openapi": "3.1.0",
                    "paths": {"/dictionary/articles": {"get": {}}},
                }
            )
            return
        if path == "/bibliotek":
            self._html(
                """
                <div id="__nuxt">
                  <h1>Botanisera i biblioteket</h1>
                  <main data-library-mounted="true">
                    <input data-library-filter>
                    <a data-library-tab="works" aria-current="page">Verk</a>
                    <a data-library-sort="popularitet" class="active">Popularitet</a>
                    <button data-library-advanced aria-expanded="true">Utökad</button>
                    <section data-library-advanced-panel>Filter</section>
                  </main>
                </div>
                <script>
                const root = document.querySelector("#__nuxt");
                root.__vue_app__ = {};
                const advanced = document.querySelector("[data-library-advanced]");
                advanced.addEventListener("click", () => {
                  const open = advanced.getAttribute("aria-expanded") === "true";
                  advanced.setAttribute("aria-expanded", String(!open));
                  document.querySelector("[data-library-advanced-panel]")?.remove();
                  if (!open) advanced.insertAdjacentHTML(
                    "afterend", "<section data-library-advanced-panel>Filter</section>"
                  );
                });
                document.querySelector("[data-library-filter]").addEventListener(
                  "input",
                  () => fetch("/api/v2/library/search", { method: "POST" }).catch(() => {})
                );
                </script>
                """
            )
            return
        if path == "/sök":
            advanced = "avancerad=1" in self.path
            panel = '<section id="text-search-advanced-panel">Filter</section>' if advanced else ""
            css_class = "advanced" if advanced else "simple"
            title = "Enkel sökning" if advanced else "Utökad sökning"
            self._html(
                f"""
                <div id="__nuxt">
                  <main data-search-root data-search-mounted="true" class="{css_class}">
                    <h1>Sök i texterna</h1>
                    <label>Sökfras <input value="kyrka"></label>
                    <button data-search-advanced title="{title}">Söktyp</button>
                    {panel}
                  </main>
                </div>
                <script>
                document.querySelector("#__nuxt").__vue_app__ = {{}};
                fetch("/api/v2/text-search/results", {{ method: "POST" }}).catch(() => {{}});
                </script>
                """
            )
            return
        self._html('<div id="__nuxt"></div><script>document.querySelector("#__nuxt").__vue_app__ = {};</script>')

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in {
            "/api/v2/library/search",
            "/api/v2/text-search/results",
        }:
            self.send_error(404)
            return
        if self.response_mode == "failed":
            self._json({"error": "controlled failure"}, status=503)
            return
        if path.endswith("library/search"):
            self._json({"mode": "works", "items": [], "total_works": 0})
        else:
            self._json(
                {
                    "query": "kyrka",
                    "page": 1,
                    "page_size": 30,
                    "snapshot": "test-snapshot",
                    "totals": {"occurrences": 0, "documents": 0, "works": 0},
                    "author_facets": [],
                    "works": [],
                }
            )

    def _html(self, body: str) -> None:
        encoded = body.encode()
        self.send_response(200)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _json(self, body: object, status: int = 200) -> None:
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, _format: str, *_arguments: object) -> None:
        pass


class NuxtLivePlaywrightTest(unittest.TestCase):
    def run_search_surface(self, response_mode: str, grep: str) -> subprocess.CompletedProcess[str]:
        SearchSurfaceHandler.response_mode = response_mode
        server = ThreadingHTTPServer(("127.0.0.1", 0), SearchSurfaceHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            origin = f"http://127.0.0.1:{server.server_port}"
            return run_live_playwright(
                "--grep",
                grep,
                backend_origin=origin,
                nuxt_origin=origin,
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_conventional_e2e_scripts_use_the_nuxt_live_configuration(self) -> None:
        package = json.loads((ROOT / "package.json").read_text())

        self.assertEqual(package["scripts"]["test"], "yarn test:e2e:nuxt-live")
        self.assertEqual(package["scripts"]["test:e2e"], "yarn test:e2e:nuxt-live")
        self.assertEqual(package["scripts"]["test:ui"], "yarn test:e2e:nuxt-live --ui")
        self.assertEqual(
            package["scripts"]["test:debug"],
            "yarn test:e2e:nuxt-live --debug",
        )

    def test_config_lists_the_complete_live_smoke_surface(self) -> None:
        result = run_live_playwright("--list")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Total: 19 tests in 1 file", result.stdout)
        for title in (
            "loads and hydrates the home page",
            "loads the advanced Library route and exercises its controls",
            "hydrates simple text search with its route query",
            "hydrates advanced text search with its route query",
            "loads and hydrates Hjalmar Söderberg's author route",
            "loads Strindberg's production author works payload",
            "loads etext Reader content and navigates to the next page",
            "opens source information when one person has multiple contributor roles",
            "validates a bounded diverse corpus of real source information",
            "loads facsimile Reader content and exposes its OCR layer",
            "opens the Svenska reader dictionary embed",
            "loads lb12106 Editor etext and navigates to the next page",
            "reports the unavailable lb12106 Editor facsimile manifest honestly",
            "retains Editor next-page interaction coverage",
            "loads and hydrates the presentations landing page",
            "loads and hydrates the Dramawebben landing page",
            "retains About content during client-side tab navigation",
            "restores Reader route and state after NuxtLink history navigation",
            "retains the expected deployment identity after hydrated journeys",
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
            "Nuxt preflight failed: http://127.0.0.1:10/",
            result.stderr + result.stdout,
        )

    def test_library_smoke_rejects_a_failed_same_origin_search_response(self) -> None:
        result = self.run_search_surface(
            "failed",
            "loads the advanced Library route",
        )

        self.assertNotEqual(result.returncode, 0, result.stdout)

    def test_both_text_search_smokes_reject_empty_success_responses(self) -> None:
        result = self.run_search_surface("empty", "text search")

        self.assertNotEqual(result.returncode, 0, result.stdout)


if __name__ == "__main__":
    unittest.main()
