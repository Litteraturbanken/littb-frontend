"""Exercise the Stage builder shell without contacting Git, Docker, or Nomad."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SHA = "a" * 40


class StageBuilderTests(unittest.TestCase):
    def run_builder(self, **overrides):
        source = (ROOT / "jobs/lb-frontend-stage-builder.nomad").read_text()
        script = source.split("data        = <<EOT\n", 1)[1].split("\nEOT", 1)[0]
        script = script.replace("$${", "${")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src/nuxt").mkdir(parents=True)
            log = root / "commands.jsonl"
            fake = f'''#!{sys.executable}
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
if name == "sudo":
    sys.exit(1)
with open(os.environ["COMMAND_LOG"], "a") as output:
    output.write(json.dumps([name, *sys.argv[1:]]) + "\\n")
if name == "git" and sys.argv[1:] == ["rev-parse", "HEAD"]:
    print(os.environ["CHECKOUT_SHA"])
'''
            for name in ("git", "docker", "sudo"):
                executable = root / name
                executable.write_text(fake)
                executable.chmod(0o755)
            env = {
                **os.environ,
                "PATH": f"{root}:{os.environ['PATH']}",
                "COMMAND_LOG": str(log),
                "CHECKOUT_SHA": SHA,
                "NOMAD_TASK_DIR": directory,
                "NOMAD_META_GIT_REF": SHA,
                "NOMAD_META_TAG": SHA,
                "NOMAD_META_GIT_URL": "https://github.com/Litteraturbanken/littb-frontend.git",
                "NOMAD_META_CONTEXT_DIR": "nuxt",
                "NOMAD_META_IMAGE": "lb-frontend",
                "NOMAD_META_BUILD_ARGS": f"NUXT_BUILD_ID={SHA}",
                "NOMAD_META_PUSH_GHCR": "false",
                **overrides,
            }
            result = subprocess.run(["/bin/sh"], input=script, text=True,
                                    env=env, capture_output=True)
            commands = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            return result, commands

    def test_fetches_exact_commit_and_builds_only_amd64(self):
        result, commands = self.run_builder()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(["git", "fetch", "--depth=1", "https://github.com/Litteraturbanken/littb-frontend.git", SHA], commands)
        docker = [command for command in commands if command[0] == "docker"]
        self.assertEqual(len(docker), 2)
        self.assertEqual(docker[0][1:5], ["buildx", "build", "--platform", "linux/amd64"])
        self.assertIn(f"NUXT_BUILD_ID={SHA}", docker[0])
        self.assertEqual(docker[1], ["docker", "push", f"registry.service.consul:5000/lb-frontend:{SHA}"])

    def test_wrong_checkout_never_builds_or_pushes(self):
        result, commands = self.run_builder(CHECKOUT_SHA="b" * 40)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(command[0] == "docker" for command in commands))

    def test_invalid_source_or_destination_never_fetches(self):
        for overrides in ({"NOMAD_META_GIT_REF": "main"},
                          {"NOMAD_META_TAG": "latest"},
                          {"NOMAD_META_REGISTRY_HOST": "other.example"},
                          {"NOMAD_META_PUSH_GHCR": "true"}):
            with self.subTest(overrides=overrides):
                result, commands = self.run_builder(**overrides)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(commands, [])
