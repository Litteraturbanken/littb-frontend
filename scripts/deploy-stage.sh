#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

case "${WAIT_FOR_BUILD-}" in
  1)
    ;;
  *)
    echo "WAIT_FOR_BUILD must be explicitly set to 1; staging was not deployed." >&2
    exit 2
    ;;
esac

if [ -n "${STAGE_DEPLOYMENT_LOCK_HELD+x}" ]; then
  echo "STAGE_DEPLOYMENT_LOCK_HELD is not a valid Stage deployment handoff." >&2
  exit 2
fi

validate_positive_integer() {
  local name="$1" default_value="$2" value
  value="${!name-$default_value}"
  if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
    echo "$name must be a positive canonical integer; staging was not deployed." >&2
    exit 2
  fi
  printf -v "$name" '%s' "$value"
  export "$name"
}

validate_positive_integer BUILD_TIMEOUT_SECONDS 1800
validate_positive_integer STAGE_HEALTH_TIMEOUT_SECONDS 600
validate_positive_integer STAGE_HEALTH_POLL_SECONDS 10

: "${LB_INFRA_REPOSITORY:?set to the persistent lb-infra stage checkout}"

if [ "${1:-}" = "--stage-lock-child" ]; then
  shift
  if [ "${LB_STAGE_LOCK_PARENT_PID:-}" != "$PPID" ]; then
    echo "Stage deployment lock handoff parent does not match." >&2
    exit 2
  fi
  python3 - "${LB_STAGE_LOCK_FD:-}" "${LB_STAGE_LOCK_PROOF_FD:-}" "$LB_INFRA_REPOSITORY" <<'PY'
import fcntl
import hashlib
import os
from pathlib import Path
import stat
import subprocess
import sys

try:
    lock_fd = int(sys.argv[1])
    proof_fd = int(sys.argv[2])
    infra_repository = Path(sys.argv[3]).resolve()
    common = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=infra_repository,
        capture_output=True,
        check=False,
        text=True,
    )
    if common.returncode != 0 or not common.stdout.strip():
        raise OSError("Git common directory is unavailable")
    expected = Path(common.stdout.strip()) / (
        ".stage-deployment-"
        + hashlib.sha256(b"lb-frontend-stage").hexdigest()
        + ".lock"
    )
    inherited = os.fstat(lock_fd)
    if not stat.S_ISREG(inherited.st_mode) or inherited.st_nlink != 1:
        raise OSError("inherited lock descriptor is not a safe regular file")
    probe_flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        probe_flags |= os.O_NOFOLLOW
    probe_fd = os.open(expected, probe_flags)
    try:
        observed = os.fstat(probe_fd)
        if (observed.st_dev, observed.st_ino) != (inherited.st_dev, inherited.st_ino):
            raise OSError("inherited lock descriptor does not identify the frontend lock")
    finally:
        os.close(probe_fd)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise OSError("inherited lock descriptor does not carry the parent lock") from None
    proof = os.read(proof_fd, 32)
    if len(proof) != 32 or os.read(proof_fd, 1):
        raise OSError("Stage lock handoff proof is invalid")
except (OSError, ValueError) as error:
    raise SystemExit(f"Stage deployment lock handoff failed: {error}") from None
PY
  lock_fd="${LB_STAGE_LOCK_FD:-}"
  proof_fd="${LB_STAGE_LOCK_PROOF_FD:-}"
  case "$lock_fd:$proof_fd" in
    *[!0-9:]*|:*|*:)
      echo "Stage deployment lock handoff descriptors are invalid." >&2
      exit 2
      ;;
  esac
  eval "exec ${lock_fd}<&-"
  eval "exec ${proof_fd}<&-"
  unset LB_STAGE_LOCK_FD LB_STAGE_LOCK_PROOF_FD LB_STAGE_LOCK_PARENT_PID
else
  exec python3 - "$repo_root/scripts/deploy-stage.sh" "$@" <<'PY'
import os
from pathlib import Path
import subprocess
import sys

infra_repository = Path(os.environ["LB_INFRA_REPOSITORY"]).resolve()
if str(infra_repository) not in sys.path:
    sys.path.insert(0, str(infra_repository))

from scripts.stage_guard import StageDeploymentLock, StageGuardError

try:
    with StageDeploymentLock.acquire("lb-frontend-stage", repository=infra_repository) as lock:
        proof_read, proof_write = os.pipe()
        try:
            os.write(proof_write, os.urandom(32))
        finally:
            os.close(proof_write)
        environment = os.environ.copy()
        environment.update({
            "LB_STAGE_LOCK_FD": str(lock.descriptor),
            "LB_STAGE_LOCK_PROOF_FD": str(proof_read),
            "LB_STAGE_LOCK_PARENT_PID": str(os.getpid()),
        })
        try:
            completed = subprocess.run(
                [sys.argv[1], "--stage-lock-child", *sys.argv[2:]],
                check=False,
                env=environment,
                pass_fds=(lock.descriptor, proof_read),
            )
        finally:
            os.close(proof_read)
except (OSError, StageGuardError) as error:
    raise SystemExit(f"Cannot acquire Stage deployment lock: {error}") from None

raise SystemExit(completed.returncode)
PY
fi

requested_ref="${1:-HEAD}"
requested_git_sha="$(git rev-parse --verify "${requested_ref}^{commit}")"

stage_tmpdir="${TMPDIR:-/tmp}"
stage_tmpdir="${stage_tmpdir%/}"
lease_file="$(mktemp "${stage_tmpdir}/lb-stage-frontend-lease.XXXXXX")"
recheck_file="$(mktemp "${stage_tmpdir}/lb-stage-frontend-recheck.XXXXXX")"
deployment_file="$(mktemp "${stage_tmpdir}/lb-stage-frontend-deployment.XXXXXX")"
jobspec_file="$(mktemp "${stage_tmpdir}/lb-stage-frontend-jobspec.XXXXXX")"
stage_job_file="$(mktemp "${stage_tmpdir}/lb-stage-frontend-job.XXXXXX")"
stage_allocations_file="$(mktemp "${stage_tmpdir}/lb-stage-frontend-allocations.XXXXXX")"
trap 'rm -f "$lease_file" "$recheck_file" "$deployment_file" "$jobspec_file" "$stage_job_file" "$stage_allocations_file"' EXIT

stage_cli=(python3 "$LB_INFRA_REPOSITORY/scripts/stage.py")
"${stage_cli[@]}" preflight frontend --source-repository "$repo_root" >"$lease_file"
git_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["candidate_sha"])' "$lease_file")"

if [ "$requested_git_sha" != "$git_sha" ]; then
  echo "Requested ref $requested_ref does not match the guarded origin/stage candidate $git_sha." >&2
  exit 2
fi

git show "$git_sha:jobs/lb-frontend-stage.nomad" >"$jobspec_file"
jobspec_blob_sha256="$(shasum -a 256 "$jobspec_file" | awk '{print $1}')"
if [[ ! "$jobspec_blob_sha256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Committed Stage jobspec did not produce a lowercase SHA-256; staging was not deployed." >&2
  exit 1
fi

recheck_lease() {
  local boundary="$1"
  "${stage_cli[@]}" preflight frontend --source-repository "$repo_root" >"$recheck_file"
  if ! cmp -s "$lease_file" "$recheck_file"; then
    echo "Stage lease changed $boundary; staging was not deployed." >&2
    exit 1
  fi
}

wait_for_healthy_stage_allocations() {
  local timeout_seconds poll_seconds deadline allocation_state
  timeout_seconds="${STAGE_HEALTH_TIMEOUT_SECONDS:-600}"
  poll_seconds="${STAGE_HEALTH_POLL_SECONDS:-10}"
  deadline=$((SECONDS + timeout_seconds))

  while [ "$SECONDS" -lt "$deadline" ]; do
    nomad job inspect -json lb-frontend-stage >"$stage_job_file"
    nomad job allocs -json lb-frontend-stage >"$stage_allocations_file"
    allocation_state="$(python3 - "$stage_job_file" "$stage_allocations_file" <<'PY'
import json
import sys

job = json.load(open(sys.argv[1]))
allocations = json.load(open(sys.argv[2]))
version = job.get("Version")
groups = job.get("TaskGroups")
if not isinstance(version, int) or not isinstance(groups, list):
    print("failed")
    raise SystemExit()
expected = sum(
    group.get("Count", 0)
    for group in groups
    if isinstance(group, dict) and group.get("Name") == "frontend"
    and isinstance(group.get("Count"), int)
)
active = [
    allocation for allocation in allocations
    if isinstance(allocation, dict)
    and allocation.get("TaskGroup") == "frontend"
    and allocation.get("JobVersion") == version
    and allocation.get("DesiredStatus") == "run"
]
if any(allocation.get("ClientStatus") == "failed" for allocation in active):
    print("failed")
elif len(active) == expected and expected > 0 and all(
    allocation.get("ClientStatus") == "running"
    and isinstance(allocation.get("DeploymentStatus"), dict)
    and allocation["DeploymentStatus"].get("Healthy") is True
    and allocation["DeploymentStatus"].get("Canary") is False
    for allocation in active
):
    print("healthy")
else:
    print("pending")
PY
)"
    case "$allocation_state" in
      healthy)
        return
        ;;
      failed)
        echo "Current Stage frontend allocations are unhealthy; staging was not recorded." >&2
        exit 1
        ;;
      pending)
        sleep "$poll_seconds"
        ;;
      *)
        echo "Could not determine current Stage frontend allocation health; staging was not recorded." >&2
        exit 1
        ;;
    esac
  done

  echo "Timed out waiting for healthy current Stage frontend allocations; staging was not recorded." >&2
  exit 2
}

git_url="${GIT_URL:-https://github.com/Litteraturbanken/littb-frontend.git}"
registry_host="${REGISTRY_HOST:-registry.service.consul:5000}"
image_name="${IMAGE_NAME:-lb-frontend}"
builder_job="${BUILDER_JOB:-docker-builder-multiarch}"
image_ref="${registry_host}/${image_name}:${git_sha}"

resolve_registry_digest() {
  RESOLVE_IMAGE_REF="$1" \
  RESOLVE_REGISTRY_SCHEME="${REGISTRY_SCHEME:-http}" \
  python3 - <<'PY'
import os
import re
import urllib.error
import urllib.parse
import urllib.request


class RegistryDigestError(Exception):
    pass


def authority(url):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in {"http", "https"}:
        raise RegistryDigestError("registry URL must use HTTP or HTTPS")
    if parts.username is not None or parts.password is not None:
        raise RegistryDigestError("registry credentials are not accepted in the image reference")
    if not parts.hostname:
        raise RegistryDigestError("registry authority is missing")
    try:
        port = parts.port
    except ValueError as error:
        raise RegistryDigestError("registry port is invalid") from error
    return parts.hostname.lower(), port or (443 if parts.scheme == "https" else 80)


class SameAuthorityRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, expected_authority, expected_scheme):
        super().__init__()
        self.expected_authority = expected_authority
        self.expected_scheme = expected_scheme

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        parts = urllib.parse.urlsplit(new_url)
        if authority(new_url) != self.expected_authority:
            raise RegistryDigestError("registry redirect changed authority")
        if parts.scheme != self.expected_scheme:
            raise RegistryDigestError("registry redirect changed scheme")
        redirected = super().redirect_request(
            request, file_pointer, code, message, headers, new_url
        )
        redirected.method = request.get_method()
        return redirected


def resolve():
    image_ref = os.environ["RESOLVE_IMAGE_REF"]
    scheme = os.environ["RESOLVE_REGISTRY_SCHEME"]
    if scheme not in {"http", "https"}:
        raise RegistryDigestError("REGISTRY_SCHEME must be http or https")
    if "@" in image_ref:
        raise RegistryDigestError("registry image reference must use a tag")

    registry, separator, repository_tag = image_ref.partition("/")
    repository, tag_separator, tag = repository_tag.rpartition(":")
    if not separator or not repository or not tag_separator or not tag:
        raise RegistryDigestError("registry image reference must include repository and tag")
    if not re.fullmatch(r"[0-9a-f]{40}", tag):
        raise RegistryDigestError("registry image tag must be a lowercase Git SHA")
    if not re.fullmatch(
        r"[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*",
        repository,
    ):
        raise RegistryDigestError("registry repository is invalid")

    base_url = f"{scheme}://{registry}"
    parts = urllib.parse.urlsplit(base_url)
    expected_authority = authority(base_url)
    if parts.path or parts.query or parts.fragment:
        raise RegistryDigestError("registry authority is invalid")

    manifest_url = (
        f"{base_url}/v2/{urllib.parse.quote(repository, safe='/')}"
        f"/manifests/{urllib.parse.quote(tag, safe='')}"
    )
    request = urllib.request.Request(
        manifest_url,
        headers={
            "Accept": ", ".join((
                "application/vnd.oci.image.manifest.v1+json",
                "application/vnd.oci.image.index.v1+json",
                "application/vnd.docker.distribution.manifest.v2+json",
                "application/vnd.docker.distribution.manifest.list.v2+json",
            )),
        },
        method="HEAD",
    )
    opener = urllib.request.build_opener(
        SameAuthorityRedirectHandler(expected_authority, scheme)
    )
    try:
        with opener.open(request, timeout=30) as response:
            if authority(response.geturl()) != expected_authority:
                raise RegistryDigestError("registry response changed authority")
            digest = response.headers.get("Docker-Content-Digest")
    except RegistryDigestError:
        raise
    except urllib.error.HTTPError as error:
        if error.code in {401, 403}:
            raise RegistryDigestError("registry authentication failed") from None
        raise RegistryDigestError(
            f"registry digest request failed with HTTP {error.code}"
        ) from None
    except (OSError, urllib.error.URLError):
        raise RegistryDigestError("registry digest request failed") from None

    if digest is None:
        raise RegistryDigestError("registry response is missing Docker-Content-Digest")
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise RegistryDigestError("registry returned a malformed Docker-Content-Digest")
    print(digest)


try:
    resolve()
except RegistryDigestError as error:
    raise SystemExit(f"Cannot resolve registry digest: {error}") from None
except Exception:
    raise SystemExit("Cannot resolve registry digest: registry request failed") from None
PY
}

dispatch_output="$(
  DISPATCH_BUILDER_JOB="$builder_job" \
  DISPATCH_GIT_URL="$git_url" \
  DISPATCH_GIT_REF="$git_sha" \
  DISPATCH_IMAGE="$image_name" \
  DISPATCH_TAG="$git_sha" \
  DISPATCH_REGISTRY_HOST="$registry_host" \
  python3 - <<'PY'
import json
import os
import urllib.request

base = os.environ.get("NOMAD_ADDR", "http://127.0.0.1:4646").rstrip("/")
builder_job = os.environ["DISPATCH_BUILDER_JOB"]
git_sha = os.environ["DISPATCH_GIT_REF"]

payload = {
    "Meta": {
        "GIT_URL": os.environ["DISPATCH_GIT_URL"],
        "GIT_REF": git_sha,
        "CONTEXT_DIR": "nuxt",
        "IMAGE": os.environ["DISPATCH_IMAGE"],
        "TAG": git_sha,
        "BUILD_ARGS": f"NUXT_BUILD_ID={git_sha}",
        "REGISTRY_HOST": os.environ["DISPATCH_REGISTRY_HOST"],
        "PUSH_GHCR": "false",
    },
    "IdempotencyToken": f"lb-frontend-stage-{git_sha}",
}

headers = {"Content-Type": "application/json"}
nomad_token = os.environ.get("NOMAD_TOKEN")
if nomad_token:
    headers["X-Nomad-Token"] = nomad_token

request = urllib.request.Request(
    f"{base}/v1/job/{builder_job}/dispatch",
    data=json.dumps(payload).encode("utf-8"),
    headers=headers,
    method="POST",
)

with urllib.request.urlopen(request, timeout=30) as response:
    print(response.read().decode("utf-8"))
PY
)"
printf '%s\n' "$dispatch_output"

dispatch_id="$(
  printf '%s\n' "$dispatch_output" | python3 -c 'import json, sys; print(json.load(sys.stdin)["DispatchedJobID"])'
)"

if [ -z "$dispatch_id" ]; then
  echo "Builder dispatch did not return a job ID; staging was not deployed." >&2
  exit 1
fi

timeout_seconds="${BUILD_TIMEOUT_SECONDS:-1800}"
deadline=$((SECONDS + timeout_seconds))
alloc_state="pending"

while [ "$SECONDS" -lt "$deadline" ]; do
  alloc_state="$(
    nomad job allocs -json "$dispatch_id" | python3 -c '
import json
import sys

allocs = json.load(sys.stdin)
if not allocs:
    print("pending")
elif any(alloc.get("ClientStatus") == "failed" for alloc in allocs):
    print("failed")
elif all(alloc.get("ClientStatus") == "complete" for alloc in allocs):
    print("complete")
else:
    print("running")
'
  )"

  case "$alloc_state" in
    complete)
      break
      ;;
    failed)
      nomad job status "$dispatch_id" || true
      echo "Image build failed for requested staging image" >&2
      exit 1
      ;;
    *)
      sleep 10
      ;;
  esac
done

if [ "$alloc_state" != "complete" ]; then
  nomad job status "$dispatch_id" || true
  echo "Timed out waiting for image build: $dispatch_id" >&2
  exit 1
fi

image_digest="$(resolve_registry_digest "$image_ref")"
immutable_image_ref="${registry_host}/${image_name}@${image_digest}"
nomad_identity_vars=(
  -var "image=$immutable_image_ref"
  -var "image_digest=$image_digest"
  -var "git_sha=$git_sha"
  -var "jobspec_blob_sha256=$jobspec_blob_sha256"
)

recheck_lease "before Nomad planning"
nomad job validate "${nomad_identity_vars[@]}" "$jobspec_file"

set +e
plan_output="$(nomad job plan -no-color "${nomad_identity_vars[@]}" "$jobspec_file")"
plan_status=$?
set -e
printf '%s\n' "$plan_output"

case "$plan_status" in
  0|1)
    ;;
  *)
    echo "Nomad plan failed with exit status $plan_status; staging was not deployed." >&2
    exit 1
    ;;
esac

plan_modify_index_count="$(
  printf '%s\n' "$plan_output" |
    LC_ALL=C awk '
      {
        line = $0
        label = "Job Modify Index:"
        while ((position = index(line, label)) != 0) {
          count += 1
          line = substr(line, position + length(label))
        }
      }
      END { print count + 0 }
    '
)"
if [ "$plan_modify_index_count" -ne 1 ]; then
  echo "Nomad plan did not report exactly one Job Modify Index; staging was not deployed." >&2
  exit 1
fi

plan_modify_index="$(
  printf '%s\n' "$plan_output" |
    LC_ALL=C sed -n 's/^[[:space:]]*Job Modify Index:[[:space:]]*\([0-9][0-9]*\)[[:space:]]*$/\1/p'
)"
case "$plan_modify_index" in
  ""|*[!0-9]*)
    echo "Nomad plan reported an invalid Job Modify Index; staging was not deployed." >&2
    exit 1
    ;;
esac

recheck_lease "before Nomad registration"
nomad run -check-index "$plan_modify_index" -detach "${nomad_identity_vars[@]}" "$jobspec_file"

wait_for_healthy_stage_allocations
read -r stage_job_version stage_job_modify_index <<EOF
$(python3 -c 'import json,sys; job=json.load(open(sys.argv[1])); print(job["Version"], job["JobModifyIndex"])' "$stage_job_file")
EOF

verified_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat >"$deployment_file" <<EOF
source:
  repository: littb
  git_sha: $git_sha
image:
  reference: $immutable_image_ref
  digest: $image_digest
jobspec:
  repository: littb
  git_sha: $git_sha
  path: jobs/lb-frontend-stage.nomad
  blob_sha256: $jobspec_blob_sha256
nomad:
  job_id: lb-frontend-stage
  job_version: $stage_job_version
  job_modify_index: $stage_job_modify_index
verification:
  verified_at: "$verified_at"
  identity_endpoint: https://stage.litteraturbanken.se/_deployment
EOF

(
  cd "$repo_root"
  LITTB_EXPECTED_GIT_SHA="$git_sha" \
  LITTB_EXPECTED_IMAGE_DIGEST="$image_digest" \
  LITTB_NUXT_LIVE_ORIGIN=https://stage.litteraturbanken.se \
    yarn test:e2e:nuxt-live
)

receipt_file="$repo_root/.stage-receipts/frontend-$git_sha.json"
"${stage_cli[@]}" capture frontend \
  --lease "$lease_file" \
  --deployment "$deployment_file" \
  --source-repository "$repo_root" \
  --receipt "$receipt_file"

set +e
record_output="$("${stage_cli[@]}" record frontend --receipt "$receipt_file" --infra-repository "$LB_INFRA_REPOSITORY")"
record_status=$?
set -e
if [ "$record_status" -ne 0 ]; then
  echo "Stage frontend is live but its receipt was not recorded. Retained receipt: $receipt_file" >&2
  exit "$record_status"
fi

echo
echo "Deployed lb-frontend-stage from git_sha=$git_sha"
echo "Image: $immutable_image_ref"
echo "Receipt: $receipt_file"
echo "Manifest commit: $record_output"
echo "Route: https://stage.litteraturbanken.se/"
