"""Developer tasks for the Litteraturbanken frontend migration."""

from __future__ import annotations

import os
import shlex
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from invoke import Collection, Context, Exit, task


ROOT = Path(__file__).resolve().parent


def _default_backend_dir() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--git-common-dir"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        common_directory = Path(result.stdout.strip())
        if not common_directory.is_absolute():
            common_directory = ROOT / common_directory
        common_directory = common_directory.resolve()
        if common_directory.name == ".git":
            return common_directory.parent.parent / "lb-backend"
    return ROOT.parent / "lb-backend"


def _environment_path(name: str, default: Path) -> Path:
    return Path(os.environ.get(name, str(default))).expanduser().resolve()


def _environment_port(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default))
    try:
        port = int(raw)
    except ValueError as error:
        raise Exit(f"{name} must be an integer, got {raw!r}") from error
    if not 1 <= port <= 65535:
        raise Exit(f"{name} must be between 1 and 65535, got {port}")
    return port


@dataclass(frozen=True)
class Settings:
    backend_app: str
    backend_dir: Path
    backend_host: str
    backend_port: int
    nuxt_dir: Path
    nuxt_port: int

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            backend_app=os.environ.get("LB_BACKEND_APP", "lbapi.web:app"),
            backend_dir=_environment_path(
                "LB_BACKEND_DIR", _default_backend_dir()
            ),
            backend_host=os.environ.get("LB_BACKEND_HOST", "127.0.0.1"),
            backend_port=_environment_port("LB_BACKEND_PORT", 8000),
            nuxt_dir=_environment_path("NUXT_DIR", ROOT / "nuxt"),
            nuxt_port=_environment_port("NUXT_PORT", 3020),
        )


def _backend_python(settings: Settings) -> str:
    configured = os.environ.get("LB_BACKEND_PYTHON")
    if configured:
        return configured
    virtualenv_python = settings.backend_dir / "virtual_env" / "bin" / "python"
    return str(virtualenv_python) if virtualenv_python.is_file() else sys.executable


def _backend_command(settings: Settings) -> list[str]:
    return [
        _backend_python(settings),
        "-m",
        "uvicorn",
        settings.backend_app,
        "--reload",
        "--host",
        settings.backend_host,
        "--port",
        str(settings.backend_port),
    ]


def _nuxt_command(settings: Settings) -> list[str]:
    return ["yarn", "dev", "--port", str(settings.nuxt_port)]


def _nuxt_environment(settings: Settings) -> dict[str, str]:
    backend_origin = f"http://{settings.backend_host}:{settings.backend_port}"
    return {
        "LBAPI_PROXY_TARGET": backend_origin,
        "NUXT_API_BASE": f"{backend_origin}/v2",
    }


def _openapi_schema(settings: Settings) -> str:
    return os.environ.get(
        "LBAPI_OPENAPI_SCHEMA",
        f"http://{settings.backend_host}:{settings.backend_port}/v2/openapi.json",
    )


def _openapi_snapshot(settings: Settings) -> Path:
    return settings.backend_dir / "openapi" / "v2.json"


def _check_backend_openapi(context: Context, settings: Settings) -> None:
    _run(
        context,
        [_backend_python(settings), "scripts/export_v2_openapi.py", "--check"],
        settings.backend_dir,
    )


def _check_nuxt_contract(
    context: Context,
    settings: Settings,
    contract_file: str,
) -> None:
    _run(
        context,
        [
            "yarn",
            "tsc",
            "--noEmit",
            "--skipLibCheck",
            "--moduleResolution",
            "bundler",
            "--module",
            "esnext",
            "--target",
            "es2022",
            "--strict",
            contract_file,
        ],
        settings.nuxt_dir,
    )


def _backend_has_v2(settings: Settings) -> bool:
    return (settings.backend_dir / "lbapi" / "v2" / "app.py").is_file()


def _require_v2_backend(settings: Settings) -> None:
    if not _backend_has_v2(settings):
        raise Exit(
            f"Backend directory {settings.backend_dir} does not contain lbapi/v2/app.py. "
            "Check out the matching v2 backend branch or set LB_BACKEND_DIR."
        )


def _run(context: Context, command: Sequence[str], directory: Path, **kwargs: object) -> None:
    if not directory.is_dir():
        raise Exit(f"Directory does not exist: {directory}")
    with context.cd(str(directory)):
        context.run(
            shlex.join(command),
            pty=sys.stdin.isatty() and sys.stdout.isatty(),
            **kwargs,
        )


def _port_is_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.2):
            return True
    except OSError:
        return False


def _stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except ProcessLookupError:
        return
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


class _ShutdownRequested(Exception):
    def __init__(self, signum: int) -> None:
        self.signum = signum


def _install_shutdown_handlers() -> dict[int, object]:
    previous_handlers: dict[int, object] = {}

    def request_shutdown(signum: int, _frame: object) -> None:
        raise _ShutdownRequested(signum)

    for name in ("SIGINT", "SIGTERM", "SIGHUP"):
        signum = getattr(signal, name, None)
        if signum is not None:
            previous_handlers[signum] = signal.signal(signum, request_shutdown)
    return previous_handlers


def _restore_shutdown_handlers(previous_handlers: dict[int, object]) -> None:
    for signum, handler in previous_handlers.items():
        signal.signal(signum, handler)


def _run_development_servers(settings: Settings) -> None:
    specifications = [
        ("backend", _backend_command(settings), settings.backend_dir, {}),
        (
            "nuxt",
            _nuxt_command(settings),
            settings.nuxt_dir,
            _nuxt_environment(settings),
        ),
    ]
    processes: list[tuple[str, subprocess.Popen[bytes]]] = []
    previous_handlers = _install_shutdown_handlers()
    shutdown: _ShutdownRequested | None = None

    try:
        for name, command, directory, environment in specifications:
            if not directory.is_dir():
                raise Exit(f"Directory does not exist: {directory}")
            print(f"Starting {name}: {shlex.join(command)}", flush=True)
            process = subprocess.Popen(
                command,
                cwd=directory,
                env={**os.environ, **environment},
                start_new_session=True,
            )
            processes.append((name, process))

        while True:
            for name, process in processes:
                return_code = process.poll()
                if return_code is not None:
                    raise Exit(
                        f"{name} server exited with status {return_code}",
                        code=return_code or 1,
                    )
            time.sleep(0.25)
    except _ShutdownRequested as error:
        shutdown = error
        print(f"Stopping development servers after signal {error.signum}…", flush=True)
    except KeyboardInterrupt:
        print("Stopping development servers…", flush=True)
    finally:
        for _, process in reversed(processes):
            _stop_process(process)
        _restore_shutdown_handlers(previous_handlers)

    if shutdown is not None:
        raise Exit(
            f"Development servers stopped by signal {shutdown.signum}",
            code=128 + shutdown.signum,
        )


@task(name="backend", help={"app": "Override the ASGI app, for example package.web:app."})
def dev_backend(context: Context, app: str | None = None) -> None:
    """Run the FastAPI backend with reload enabled."""
    settings = Settings.from_environment()
    if app:
        settings = Settings(**{**settings.__dict__, "backend_app": app})
    _run(context, _backend_command(settings), settings.backend_dir)


@task(name="nuxt")
def dev_nuxt(context: Context) -> None:
    """Run the Nuxt development server."""
    settings = Settings.from_environment()
    _run(
        context,
        _nuxt_command(settings),
        settings.nuxt_dir,
        env=_nuxt_environment(settings),
    )


@task(name="all", default=True)
def dev_all(_context: Context) -> None:
    """Run the backend and Nuxt development servers together."""
    settings = Settings.from_environment()
    _require_v2_backend(settings)
    _run_development_servers(settings)


@task(name="generate", default=True)
def codegen_generate(context: Context) -> None:
    """Regenerate the TypeScript API types from the backend OpenAPI schema."""
    settings = Settings.from_environment()
    _run(
        context,
        ["yarn", "api:generate"],
        settings.nuxt_dir,
        env={"LBAPI_OPENAPI_SCHEMA": _openapi_schema(settings)},
    )


@task(name="check")
def codegen_check(context: Context) -> None:
    """Check that generated TypeScript API types match the OpenAPI schema."""
    settings = Settings.from_environment()
    snapshot = _openapi_snapshot(settings)
    _check_backend_openapi(context, settings)
    _run(
        context,
        ["yarn", "api:check"],
        settings.nuxt_dir,
        env={"LBAPI_OPENAPI_SCHEMA": str(snapshot)},
    )


@task(name="test")
def test_task(context: Context) -> None:
    """Run the Nuxt unit tests."""
    settings = Settings.from_environment()
    _run(context, ["yarn", "test:unit"], settings.nuxt_dir)


@task
def e2e(context: Context) -> None:
    """Run the focused Playwright smoke checks against the live Nuxt stack."""
    settings = Settings.from_environment()
    backend_origin = f"http://{settings.backend_host}:{settings.backend_port}"
    nuxt_origin = f"http://127.0.0.1:{settings.nuxt_port}"
    _run(
        context,
        ["yarn", "test:e2e:nuxt-live"],
        ROOT,
        env={
            "LITTB_BACKEND_ORIGIN": backend_origin,
            "LITTB_NUXT_LIVE_ORIGIN": nuxt_origin,
        },
    )


@task
def typecheck(context: Context) -> None:
    """Type-check the Nuxt application."""
    settings = Settings.from_environment()
    _run(context, ["yarn", "typecheck"], settings.nuxt_dir)


@task(name="backend")
def quality_backend(context: Context) -> None:
    """Run the backend v2 static checks and tests."""
    settings = Settings.from_environment()
    python = _backend_python(settings)
    _run(
        context,
        [python, "-m", "mypy", "--config-file", "mypy.ini", "lbapi/v2"],
        settings.backend_dir,
    )
    _run(
        context,
        [python, "-m", "ruff", "check", "lbapi/v2", "--select", "E4,E7,E9,F,S"],
        settings.backend_dir,
    )
    _run(
        context,
        [python, "-m", "pytest", "-q", "test_lbapi/v2"],
        settings.backend_dir,
    )


@task(name="contract")
def quality_contract(context: Context) -> None:
    """Run generated, compile-time, backend, and Nuxt contract checks."""
    settings = Settings.from_environment()
    python = _backend_python(settings)
    codegen_check.body(context)
    for contract_file in (
        "test/nuxt/author-works-contract.ts",
        "test/nuxt/library-contract.ts",
        "test/nuxt/reader-source-info-contract.ts",
    ):
        _check_nuxt_contract(context, settings, contract_file)
    _run(
        context,
        [
            python,
            "-m",
            "pytest",
            "-q",
            "test_lbapi/v2/test_library_provider.py",
            "test_lbapi/v2/test_library_api.py",
        ],
        settings.backend_dir,
    )
    _run(
        context,
        ["yarn", "vitest", "run", "test/unit/library-contract.spec.ts"],
        settings.nuxt_dir,
    )


@task(name="library")
def quality_library(context: Context) -> None:
    """Run the focused typed Library backend and Nuxt quality gates."""
    settings = Settings.from_environment()
    python = _backend_python(settings)
    _run(
        context,
        [
            python,
            "-m",
            "pytest",
            "-q",
            "test_lbapi/v2/test_library_models.py",
            "test_lbapi/v2/test_library_provider.py",
            "test_lbapi/v2/test_library_api.py",
        ],
        settings.backend_dir,
    )
    codegen_check.body(context)
    _check_nuxt_contract(context, settings, "test/nuxt/library-contract.ts")
    _run(context, ["yarn", "typecheck"], settings.nuxt_dir)
    _run(
        context,
        [
            "yarn",
            "vitest",
            "run",
            "test/unit/library-contract.spec.ts",
            "test/unit/library-navigation.spec.ts",
            "test/unit/library-tooltip.spec.ts",
            "test/unit/v2-server.spec.ts",
        ],
        settings.nuxt_dir,
    )
    _run(
        context,
        [
            "yarn",
            "playwright",
            "test",
            "test/ssr/library.spec.ts",
            "--project=ssr",
        ],
        settings.nuxt_dir,
    )


@task
def status(_context: Context) -> None:
    """Show configured development paths, URLs, and listener status."""
    settings = Settings.from_environment()
    backend_url = f"http://{settings.backend_host}:{settings.backend_port}"
    nuxt_url = f"http://127.0.0.1:{settings.nuxt_port}"
    backend_state = "listening" if _port_is_open(settings.backend_host, settings.backend_port) else "stopped"
    nuxt_state = "listening" if _port_is_open("127.0.0.1", settings.nuxt_port) else "stopped"
    print(f"Backend: {settings.backend_dir}")
    print(f"         {backend_url} ({backend_state})")
    print(f"Backend v2: {'available' if _backend_has_v2(settings) else 'missing'}")
    print(f"OpenAPI: {_openapi_schema(settings)}")
    print(f"Nuxt:    {settings.nuxt_dir}")
    print(f"         {nuxt_url} ({nuxt_state})")


dev = Collection("dev")
dev.add_task(dev_all)
dev.add_task(dev_backend)
dev.add_task(dev_nuxt)

codegen = Collection("codegen")
codegen.add_task(codegen_generate)
codegen.add_task(codegen_check)

quality = Collection("quality")
quality.add_task(quality_backend)
quality.add_task(quality_contract)
quality.add_task(quality_library)

ns = Collection()
ns.add_collection(dev)
ns.add_collection(codegen)
ns.add_collection(quality)
ns.add_task(e2e)
ns.add_task(test_task)
ns.add_task(typecheck)
ns.add_task(status)
