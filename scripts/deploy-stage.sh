#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

requested_ref="${1:-HEAD}"
git_sha="$(git rev-parse --verify "${requested_ref}^{commit}")"
current_branch="$(git branch --show-current)"

if [ -z "$current_branch" ]; then
  echo "Detached HEAD is not supported; check out a branch before deploying staging." >&2
  exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted changes; commit them before building a pinned staging image." >&2
  exit 2
fi

if ! git merge-base --is-ancestor "$git_sha" HEAD; then
  echo "Requested ref $requested_ref resolves to $git_sha, which is not reachable from HEAD." >&2
  echo "Check out the branch containing that commit before deploying staging." >&2
  exit 2
fi

git push origin "$current_branch"

git_url="${GIT_URL:-https://github.com/Litteraturbanken/littb-frontend.git}"
registry_host="${REGISTRY_HOST:-registry.service.consul:5000}"
image_name="${IMAGE_NAME:-lb-frontend}"
builder_job="${BUILDER_JOB:-docker-builder-multiarch}"
image_ref="${registry_host}/${image_name}:${git_sha}"

nomad job validate -var "image=$image_ref" -var "git_sha=$git_sha" jobs/lb-frontend-stage.nomad

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

if [ "${WAIT_FOR_BUILD:-1}" = "1" ] && [ -n "$dispatch_id" ]; then
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
        echo "Image build failed for $image_ref" >&2
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
fi

nomad run -detach -var "image=$image_ref" -var "git_sha=$git_sha" jobs/lb-frontend-stage.nomad

echo
echo "Deployed lb-frontend-stage from git_sha=$git_sha"
echo "Image: $image_ref"
echo "Route: https://lb-frontend.pub.lb.se/"
nomad job status lb-frontend-stage
