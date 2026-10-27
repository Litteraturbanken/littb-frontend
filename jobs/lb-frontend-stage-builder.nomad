# Stage-only native AMD64 builder. No ARM allocation or manifest assembly.
# Registered by the guarded deploy-stage.sh from the exact source commit.
job "lb-frontend-stage-builder" {
  datacenters = ["local"]
  type        = "batch"

  parameterized {
    payload       = "optional"
    meta_required = ["GIT_URL", "GIT_REF", "CONTEXT_DIR", "IMAGE", "TAG"]
    meta_optional = ["BUILD_ARGS", "REGISTRY_HOST", "PUSH_GHCR"]
  }

  group "build-amd64" {
    count = 1
    constraint {
      attribute = "${attr.cpu.arch}"
      value     = "amd64"
    }
    constraint {
      attribute = "${meta.node_type}"
      value     = "bare-metal"
    }
    network { mode = "host" }
    restart {
      attempts = 0
      mode     = "fail"
    }
    reschedule {
      attempts  = 1
      interval  = "30m"
      delay     = "10s"
      unlimited = false
    }
    ephemeral_disk { size = 8000 }

    task "build-and-push" {
      driver = "raw_exec"
      user   = "root"
      template {
        destination = "${NOMAD_TASK_DIR}/run.sh"
        perms       = "0755"
        data        = <<EOT
#!/bin/sh
set -eu
sha="$${NOMAD_META_GIT_REF}"
case "$sha" in
  *[!0-9a-f]*|'') echo "Invalid source SHA" >&2; exit 1 ;;
esac
[ "$${#sha}" -eq 40 ]
[ "$NOMAD_META_TAG" = "$sha" ]
[ "$NOMAD_META_GIT_URL" = "https://github.com/Litteraturbanken/littb-frontend.git" ]
[ "$NOMAD_META_CONTEXT_DIR" = "nuxt" ]
[ "$NOMAD_META_IMAGE" = "lb-frontend" ]
[ "$${NOMAD_META_PUSH_GHCR:-false}" = "false" ]
[ "$${NOMAD_META_BUILD_ARGS:-}" = "NUXT_BUILD_ID=$sha" ]
registry="$${NOMAD_META_REGISTRY_HOST:-registry.service.consul:5000}"
[ "$registry" = "registry.service.consul:5000" ]
image="$registry/lb-frontend:$sha"

# Public repository: fetch only the immutable commit, without credentials or
# repository history. Reuse the node's existing Docker layer cache.
work="$NOMAD_TASK_DIR/src"
mkdir -p "$work"
cd "$work"
git init -q
git fetch --depth=1 "$NOMAD_META_GIT_URL" "$sha"
git checkout -q --detach FETCH_HEAD
[ "$(git rev-parse HEAD)" = "$sha" ]
cd nuxt

docker_cmd() {
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo -n docker "$@"
  else
    docker "$@"
  fi
}
docker_cmd buildx build --platform linux/amd64 --load \
  --label "org.opencontainers.image.revision=$sha" \
  --label "org.opencontainers.image.version=$sha" \
  --build-arg "NUXT_BUILD_ID=$sha" -t "$image" .
docker_cmd push "$image"
EOT
      }
      config { command = "${NOMAD_TASK_DIR}/run.sh" }
      resources {
        cpu    = 3000
        memory = 4096
      }
    }
  }
}
