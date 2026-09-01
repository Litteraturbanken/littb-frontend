# Litteraturbanken staging Nuxt frontend.
#
# Deploy an image resolved from the exact Git commit SHA to its registry digest via:
#
#   scripts/deploy-stage.sh
#
# Public route:
#   https://lb-frontend.pub.lb.se

variable "datacenters" {
  type    = list(string)
  default = ["local"]
}

variable "image" {
  type = string
}

variable "git_sha" {
  type = string
}

variable "image_digest" {
  type = string
}

variable "jobspec_blob_sha256" {
  type = string

  validation {
    condition     = strlen(var.jobspec_blob_sha256) == 64 && replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(var.jobspec_blob_sha256, "0", ""), "1", ""), "2", ""), "3", ""), "4", ""), "5", ""), "6", ""), "7", ""), "8", ""), "9", ""), "a", ""), "b", ""), "c", ""), "d", ""), "e", ""), "f", "") == ""
    error_message = "The jobspec_blob_sha256 value must be a lowercase SHA-256."
  }
}

variable "caddy_host" {
  type    = string
  default = "lb-frontend.pub.lb.se"
}

variable "http_port" {
  type    = number
  default = 3020
}

job "lb-frontend-stage" {
  type        = "service"
  datacenters = var.datacenters

  meta {
    git_sha              = var.git_sha
    image_digest         = var.image_digest
    jobspec_blob_sha256  = var.jobspec_blob_sha256
  }

  group "frontend" {
    count          = 2
    shutdown_delay = "15s"

    constraint {
      distinct_hosts = true
    }

    update {
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "30s"
      healthy_deadline  = "5m"
      progress_deadline = "10m"
      auto_revert       = true
    }

    reschedule {
      attempts       = 3
      interval       = "1h"
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "5m"
      unlimited      = false
    }

    network {
      mode = "host"

      port "http" {
        static = var.http_port
      }
    }

    service {
      name     = "lb-frontend-stage"
      provider = "consul"
      port     = "http"
      address  = "${meta.bind_ip}"

      tags = [
        "lb-frontend",
        "stage",
        "caddy-host=${var.caddy_host}",
        "caddy-ingress=public",
        "caddy-https=on",
        "caddy-lb-try-duration=5s",
        "caddy-lb-try-interval=250ms",
      ]

      check {
        name     = "http"
        type     = "http"
        path     = "/_deployment"
        method   = "GET"
        interval = "10s"
        timeout  = "3s"
      }

      check_restart {
        limit           = 3
        grace           = "2m"
        ignore_warnings = false
      }
    }

    restart {
      attempts = 3
      interval = "30m"
      delay    = "15s"
      mode     = "fail"
    }

    task "frontend" {
      driver = "docker"

      secret "runtime" {
        provider = "nomad"
        path     = "nomad/jobs/lb-frontend-stage/frontend/frontend"

        config {
          namespace = "default"
        }
      }

      env {
        STAGE_COMPONENT                         = "frontend"
        GIT_SHA                                 = var.git_sha
        IMAGE_DIGEST                            = var.image_digest
        IMAGE_REF                               = var.image
        NUXT_DEPLOYMENT_GIT_SHA                 = var.git_sha
        NUXT_DEPLOYMENT_IMAGE_DIGEST            = var.image_digest
        NUXT_DEPLOYMENT_ENVIRONMENT             = "staging"
        NUXT_PUBLIC_OBSERVABILITY_ENVIRONMENT   = "stage"
        NUXT_PUBLIC_OBSERVABILITY_GIT_SHA       = var.git_sha
        NUXT_PUBLIC_READER_DICTIONARY_MODE      = "embed"
        NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN = "https://stage.svenska.se"
        NUXT_OBSERVABILITY_ALLOWED_ORIGINS      = "https://stage.litteraturbanken.se,https://lb-frontend.pub.lb.se"
        NUXT_OBSERVABILITY_HMAC_SECRET          = "${secret.runtime.observability_hmac_secret}"
        NUXT_API_BASE                           = "http://lb-backend-stage.service.consul:5003/v2"
        NUXT_LIBRARY_API_BASE                   = "http://lb-backend-stage.service.consul:5003"
        NUXT_CONTENT_BASE                       = "https://red.litteraturbanken.se"
        PUBLIC_RESOURCE_ORIGIN                  = "https://stage.litteraturbanken.se"
      }

      config {
        image        = var.image
        force_pull   = true
        network_mode = "host"
        ports        = ["http"]
        entrypoint   = ["/bin/sh", "-ec"]
        args = [<<-EOT
          git_sha_value="$GIT_SHA"
          git_sha_length="$(printf '%s' "$git_sha_value" | wc -c | tr -d '[:space:]')"
          if [ "$git_sha_length" -ne 40 ]; then
            echo "invalid GIT_SHA" >&2
            exit 1
          fi
          case "$git_sha_value" in
            *[!0-9a-f]*)
              echo "invalid GIT_SHA" >&2
              exit 1
              ;;
          esac
          image_digest_value="$IMAGE_DIGEST"
          image_digest_length="$(printf '%s' "$image_digest_value" | wc -c | tr -d '[:space:]')"
          if [ "$image_digest_length" -ne 71 ]; then
            echo "invalid IMAGE_DIGEST" >&2
            exit 1
          fi
          case "$image_digest_value" in
            sha256:*) image_digest_hex="$(printf '%s' "$image_digest_value" | cut -c8-)" ;;
            *)
              echo "invalid IMAGE_DIGEST" >&2
              exit 1
              ;;
          esac
          case "$image_digest_hex" in
            *[!0-9a-f]*)
              echo "invalid IMAGE_DIGEST" >&2
              exit 1
              ;;
          esac
          if [ -z "$IMAGE_REF" ]; then
            echo "missing IMAGE_REF" >&2
            exit 1
          fi
          case "$IMAGE_REF" in
            *@"$image_digest_value") ;;
            *)
              echo "IMAGE_REF must be digest-qualified and match IMAGE_DIGEST" >&2
              exit 1
              ;;
          esac
          if [ "$NUXT_CONTENT_BASE" != "https://red.litteraturbanken.se" ]; then
            echo "invalid NUXT_CONTENT_BASE" >&2
            exit 1
          fi
          if [ "$PUBLIC_RESOURCE_ORIGIN" != "https://stage.litteraturbanken.se" ]; then
            echo "invalid PUBLIC_RESOURCE_ORIGIN" >&2
            exit 1
          fi
          export HOST=0.0.0.0 PORT="$NOMAD_PORT_http"
          node scripts/verify-public-resource.mjs
          exec node .output/server/index.mjs
        EOT
        ]
      }

      resources {
        cpu    = 500
        memory = 768
      }
    }
  }
}
