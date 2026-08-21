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
reader_source_base="${READER_SOURCE_BASE:-http://reader-origin.int.lb.se}"

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

case "${WAIT_FOR_BUILD:-1}" in
  0)
    echo
    echo "Dispatched image build as $dispatch_id; staging was not deployed."
    exit 0
    ;;
  1)
    ;;
  *)
    echo "WAIT_FOR_BUILD must be 0 or 1; staging was not deployed." >&2
    exit 2
    ;;
esac

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

nomad job validate -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" -var "reader_source_base=$reader_source_base" jobs/lb-frontend-stage.nomad

set +e
plan_output="$(nomad job plan -no-color -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" -var "reader_source_base=$reader_source_base" jobs/lb-frontend-stage.nomad)"
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

plan_modify_index="$(
  printf '%s\n' "$plan_output" |
    sed -n 's/^[[:space:]]*Job Modify Index:[[:space:]]*\([0-9][0-9]*\)[[:space:]]*$/\1/p'
)"
plan_modify_index_count="$(
  printf '%s\n' "$plan_modify_index" |
    awk 'NF { count += 1 } END { print count + 0 }'
)"
if [ "$plan_modify_index_count" -ne 1 ]; then
  echo "Nomad plan did not report exactly one valid Job Modify Index; staging was not deployed." >&2
  exit 1
fi

case "$plan_modify_index" in
  ""|*[!0-9]*)
    echo "Nomad plan reported an invalid Job Modify Index; staging was not deployed." >&2
    exit 1
    ;;
esac

nomad run -check-index "$plan_modify_index" -detach -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" -var "reader_source_base=$reader_source_base" jobs/lb-frontend-stage.nomad

echo
echo "Deployed lb-frontend-stage from git_sha=$git_sha"
echo "Image: $immutable_image_ref"
echo "Route: https://lb-frontend.pub.lb.se/"
nomad job status lb-frontend-stage
