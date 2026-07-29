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
VISUAL_BASELINE_PATH = "nuxt/test/visual/baselines"


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


def _infra_dir() -> Path:
    return _environment_path(
        "LB_INFRA_DIR",
        _default_backend_dir().parent / "lb-infra",
    )


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


def _nuxt_node_environment(settings: Settings) -> dict[str, str]:
    version_file = settings.nuxt_dir / ".nvmrc"
    if not version_file.is_file():
        raise Exit(f"Nuxt Node version file does not exist: {version_file}")
    version = version_file.read_text().strip().removeprefix("v")
    if not version:
        raise Exit(f"Nuxt Node version file is empty: {version_file}")
    nvm_directory = Path(os.environ.get("NVM_DIR", str(Path.home() / ".nvm")))
    node_directory = nvm_directory / "versions" / "node" / f"v{version}" / "bin"
    return {
        "PATH": os.pathsep.join((str(node_directory), os.environ.get("PATH", "")))
    }


def _openapi_schema(settings: Settings) -> str:
    return os.environ.get(
        "LBAPI_OPENAPI_SCHEMA",
        f"http://{settings.backend_host}:{settings.backend_port}/v2/openapi.json",
    )


def _openapi_snapshot(settings: Settings) -> Path:
    return settings.backend_dir / "openapi" / "v2.json"


def _export_backend_openapi(context: Context, settings: Settings) -> None:
    _run(
        context,
        [_backend_python(settings), "scripts/export_v2_openapi.py"],
        settings.backend_dir,
    )


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
        env=_nuxt_node_environment(settings),
    )


def _verify_visual_baselines(
    repository: Path = ROOT,
    authority: str = "06add2bb",
) -> None:
    root_result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=repository,
        capture_output=True,
        text=True,
        check=False,
    )
    if root_result.returncode != 0:
        raise Exit("Unable to resolve the visual-baseline repository root")
    repository_root = Path(root_result.stdout.strip()).resolve()

    authority_result = subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"{authority}^{{commit}}"],
        cwd=repository_root,
        capture_output=True,
        check=False,
    )
    if authority_result.returncode != 0:
        raise Exit("The immutable visual-baseline authority is invalid")

    committed_result = subprocess.run(
        ["git", "diff", "--quiet", f"{authority}..HEAD", "--", VISUAL_BASELINE_PATH],
        cwd=repository_root,
        check=False,
    )
    if committed_result.returncode == 1:
        raise Exit("Committed visual baselines differ from the immutable authority")
    if committed_result.returncode != 0:
        raise Exit("Unable to compare committed visual baselines with the authority")

    staged_result = subprocess.run(
        ["git", "diff", "--cached", "--quiet", authority, "--", VISUAL_BASELINE_PATH],
        cwd=repository_root,
        check=False,
    )
    if staged_result.returncode == 1:
        raise Exit("Staged visual baselines differ from the immutable authority")
    if staged_result.returncode != 0:
        raise Exit("Unable to compare staged visual baselines with the authority")

    tree_result = subprocess.run(
        ["git", "ls-tree", "-r", "-z", "--full-tree", authority, "--", VISUAL_BASELINE_PATH],
        cwd=repository_root,
        capture_output=True,
        check=False,
    )
    if tree_result.returncode != 0:
        raise Exit("Unable to read the immutable visual-baseline authority")

    authority_blobs: dict[str, bytes] = {}
    for record in tree_result.stdout.split(b"\0"):
        if not record:
            continue
        try:
            metadata, encoded_path = record.split(b"\t", 1)
            mode, object_type, object_id = metadata.split(b" ", 2)
            relative_path = encoded_path.decode("utf-8")
        except (UnicodeDecodeError, ValueError) as error:
            raise Exit("The immutable visual-baseline authority is malformed") from error
        if object_type != b"blob" or mode == b"120000":
            raise Exit("The immutable visual-baseline authority contains a non-file entry")
        authority_blobs[relative_path] = object_id

    baseline_root = repository_root / VISUAL_BASELINE_PATH
    component = repository_root
    for part in Path(VISUAL_BASELINE_PATH).parts:
        component /= part
        if component.is_symlink():
            raise Exit("Visual baseline symlinks are forbidden")
        if not component.exists():
            break
    filesystem_files: dict[str, Path] = {}
    if baseline_root.exists():
        for path in baseline_root.rglob("*"):
            if path.is_symlink():
                raise Exit("Visual baseline symlinks are forbidden")
            if path.is_file():
                filesystem_files[path.relative_to(repository_root).as_posix()] = path

    if set(authority_blobs) != set(filesystem_files):
        raise Exit("The visual baseline tree differs from the immutable authority")
    for relative_path, object_id in authority_blobs.items():
        blob_result = subprocess.run(
            ["git", "cat-file", "blob", object_id.decode("ascii")],
            cwd=repository_root,
            capture_output=True,
            check=False,
        )
        if blob_result.returncode != 0:
            raise Exit("Unable to read an immutable visual-baseline blob")
        if filesystem_files[relative_path].read_bytes() != blob_result.stdout:
            raise Exit(f"Visual baseline bytes differ from authority: {relative_path}")


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


def _require_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise Exit(f"{label} deployment script does not exist: {path}")


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
    _export_backend_openapi(context, settings)
    _run(
        context,
        ["yarn", "api:generate"],
        settings.nuxt_dir,
        env={
            "LBAPI_OPENAPI_SCHEMA": str(_openapi_snapshot(settings)),
            **_nuxt_node_environment(settings),
        },
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
        env={
            "LBAPI_OPENAPI_SCHEMA": str(snapshot),
            **_nuxt_node_environment(settings),
        },
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
        "test/nuxt/observability-contract.ts",
        "test/nuxt/reader-editor-manifest-contract.ts",
        "test/nuxt/reader-source-info-contract.ts",
        "test/nuxt/renderable-html-contract.ts",
    ):
        _check_nuxt_contract(context, settings, contract_file)
    _run(
        context,
        [
            python,
            "-m",
            "pytest",
            "-q",
            "test_lbapi/v2/test_work_manifest_provider.py",
            "test_lbapi/v2/test_work_manifest_api.py",
            "test_lbapi/v2/test_library_provider.py",
            "test_lbapi/v2/test_library_api.py",
        ],
        settings.backend_dir,
    )
    _run(
        context,
        ["yarn", "vitest", "run", "test/unit/library-contract.spec.ts"],
        settings.nuxt_dir,
        env=_nuxt_node_environment(settings),
    )


@task(name="frontend")
def quality_frontend(context: Context) -> None:
    """Run every blocking Nuxt policy, static, unit, build, and SSR gate."""
    settings = Settings.from_environment()
    environment = _nuxt_node_environment(settings)
    for command in (
        ["yarn", "policy:check"],
        ["yarn", "lint"],
        ["yarn", "typecheck"],
        ["yarn", "test:unit"],
        ["yarn", "build"],
        ["yarn", "test:ssr"],
    ):
        _run(context, command, settings.nuxt_dir, env=environment)


@task(name="reader-editor")
def quality_reader_editor(context: Context) -> None:
    """Run the focused typed Reader and Editor contract and parity gates."""
    settings = Settings.from_environment()
    python = _backend_python(settings)
    environment = _nuxt_node_environment(settings)
    _run(
        context,
        [
            python,
            "-m",
            "pytest",
            "-q",
            "test_lbapi/v2/test_work_manifest_models.py",
            "test_lbapi/v2/test_work_manifest_provider.py",
            "test_lbapi/v2/test_work_manifest_api.py",
        ],
        settings.backend_dir,
    )
    codegen_check.body(context)
    _check_nuxt_contract(
        context,
        settings,
        "test/nuxt/reader-editor-manifest-contract.ts",
    )
    for command in (
        ["yarn", "typecheck"],
        ["yarn", "lint"],
        [
            "yarn",
            "vitest",
            "run",
            "test/unit/work-manifest-client.spec.ts",
            "test/unit/reader-source.spec.ts",
            "test/unit/editor-reader-html.spec.ts",
        ],
        [
            "yarn",
            "playwright",
            "test",
            "test/ssr/reader.spec.ts",
            "test/ssr/reader-shorthand.spec.ts",
            "test/ssr/editor-reader.spec.ts",
            "--project=ssr",
        ],
    ):
        _run(context, command, settings.nuxt_dir, env=environment)


@task(name="release")
def quality_release(context: Context) -> None:
    """Run the complete backend, contract, frontend, browser, and visual gate."""
    settings = Settings.from_environment()
    quality_backend.body(context)
    quality_contract.body(context)
    quality_frontend.body(context)
    _run(
        context,
        ["yarn", "test:e2e"],
        settings.nuxt_dir,
        env=_nuxt_node_environment(settings),
    )
    _verify_visual_baselines(ROOT)


@task(name="library")
def quality_library(context: Context) -> None:
    """Run the focused typed Library backend and Nuxt quality gates."""
    settings = Settings.from_environment()
    python = _backend_python(settings)
    node_environment = _nuxt_node_environment(settings)
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
    _run(
        context,
        ["yarn", "typecheck"],
        settings.nuxt_dir,
        env=node_environment,
    )
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
        env=node_environment,
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
        env=node_environment,
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


@task(
    help={
        "backend_ref": "Backend Git ref passed to its staging script.",
        "frontend_ref": "Frontend Git ref passed to its staging script.",
    },
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


@task(
    help={
        "dry_run": "List safe staging checks without contacting services.",
        "fault_test": "Optional controlled fault: alert or opensearch.",
        "allow_disruption": "Required explicit opt-in for the opensearch fault.",
    },
)
def observability(
    context: Context,
    dry_run: bool = False,
    fault_test: str = "",
    allow_disruption: bool = False,
) -> None:
    """Run the unified staging observability verification harness."""
    infra_dir = _infra_dir()
    verifier = infra_dir / "scripts" / "verify_lb_observability.py"
    _require_file(verifier, "Observability verifier")
    command = [sys.executable, str(verifier)]
    if dry_run:
        command.append("--dry-run")
    if fault_test:
        command.extend(("--fault-test", fault_test))
    if allow_disruption:
        command.append("--allow-disruption")
    _run(context, command, infra_dir)


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
quality.add_task(quality_frontend)
quality.add_task(quality_library)
quality.add_task(quality_reader_editor)
quality.add_task(quality_release)

ns = Collection()
ns.add_collection(dev)
ns.add_collection(codegen)
ns.add_collection(quality)
ns.add_task(e2e)
ns.add_task(test_task)
ns.add_task(typecheck)
ns.add_task(status)
ns.add_task(stage)
ns.add_task(observability)
