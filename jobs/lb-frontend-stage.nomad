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

variable "reader_source_base" {
  type    = string
  default = "https://litteraturbanken.se"
}

variable "caddy_host" {
  type    = string
  default = "lb-frontend.pub.lb.se"
}

variable "http_port" {
  type    = number
  default = 3020
}

variable "observability_hmac_secret_path" {
  type    = string
  default = "/etc/nomad/secrets/lb_observability_hmac_secret"
}

job "lb-frontend-stage" {
  type        = "service"
  datacenters = var.datacenters

  meta {
    git_sha      = var.git_sha
    image_digest = var.image_digest
  }

  group "frontend" {
    count = 1

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

      env {
        GIT_SHA                               = var.git_sha
        IMAGE_DIGEST                          = var.image_digest
        IMAGE_REF                             = var.image
        NUXT_DEPLOYMENT_GIT_SHA               = var.git_sha
        NUXT_DEPLOYMENT_IMAGE_DIGEST          = var.image_digest
        NUXT_DEPLOYMENT_ENVIRONMENT           = "staging"
        NUXT_PUBLIC_OBSERVABILITY_ENVIRONMENT = "stage"
        NUXT_PUBLIC_OBSERVABILITY_GIT_SHA     = var.git_sha
        NUXT_OBSERVABILITY_ALLOWED_ORIGINS    = "https://stage.litteraturbanken.se,https://lb-frontend.pub.lb.se"
        NUXT_OBSERVABILITY_HMAC_SECRET_FILE   = "/secrets/lb_observability_hmac_secret"
        NUXT_API_BASE                         = "http://lb-backend-stage.service.consul:5003/v2"
        NUXT_LIBRARY_API_BASE                 = "http://lb-backend-stage.service.consul:5003"
        NUXT_CONTENT_BASE                     = "https://red.litteraturbanken.se"
        NUXT_READER_SOURCE_BASE               = var.reader_source_base
      }

      config {
        image        = var.image
        force_pull   = true
        network_mode = "host"
        ports        = ["http"]
        volumes = [
          format("%s:/secrets/lb_observability_hmac_secret:ro", var.observability_hmac_secret_path),
        ]

        entrypoint = ["/bin/sh", "-ec"]
        args = [<<-EOT
          git_sha_value="$${GIT_SHA:-}"
          if [ "$${#git_sha_value}" -ne 40 ]; then
            echo "invalid GIT_SHA" >&2
            exit 1
          fi
          case "$${git_sha_value}" in
            *[!0-9a-f]*)
              echo "invalid GIT_SHA" >&2
              exit 1
              ;;
          esac
          image_digest_value="$${IMAGE_DIGEST:-}"
          if [ "$${#image_digest_value}" -ne 71 ]; then
            echo "invalid IMAGE_DIGEST" >&2
            exit 1
          fi
          case "$${image_digest_value}" in
            sha256:*) image_digest_hex="$${image_digest_value#sha256:}" ;;
            *)
              echo "invalid IMAGE_DIGEST" >&2
              exit 1
              ;;
          esac
          case "$${image_digest_hex}" in
            *[!0-9a-f]*)
              echo "invalid IMAGE_DIGEST" >&2
              exit 1
              ;;
          esac
          if [ -z "$${IMAGE_REF}" ]; then
            echo "missing IMAGE_REF" >&2
            exit 1
          fi
          export HOST=0.0.0.0 PORT="$${NOMAD_PORT_http}"
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
