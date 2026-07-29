# Litteraturbanken staging Nuxt frontend.
#
# Deploy an image tagged with the exact Git commit SHA via:
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
    git_sha = var.git_sha
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
        "caddy-tls=internal",
      ]

      check {
        name     = "http"
        type     = "http"
        path     = "/robots.txt"
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
        GIT_SHA                     = var.git_sha
        IMAGE_REF                   = var.image
        NUXT_DEPLOYMENT_ENVIRONMENT = "staging"
        NUXT_API_BASE               = "http://lb-backend-stage.service.consul:5003/v2"
        NUXT_LIBRARY_API_BASE       = "http://lb-backend-stage.service.consul:5003"
        NUXT_CONTENT_BASE           = "https://red.litteraturbanken.se"
        NUXT_READER_SOURCE_BASE     = "https://litteraturbanken.se"
      }

      config {
        image        = var.image
        force_pull   = true
        network_mode = "host"
        ports        = ["http"]

        entrypoint = ["/bin/sh", "-ec"]
        args = [<<-EOT
          if [ -z "$${GIT_SHA}" ]; then
            echo "missing GIT_SHA" >&2
            exit 1
          fi
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
