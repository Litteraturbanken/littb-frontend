import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { expect, test } from "vitest"

const projectRoot = resolve(import.meta.dirname, "../..")
const repositoryRoot = resolve(projectRoot, "..")
const buildNodeImage = "node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94"
const runtimeNodeImage = "node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34"
const readBuildFile = (name: string) => {
  const path = resolve(projectRoot, name)
  return existsSync(path) ? readFileSync(path, "utf8") : ""
}
const readRepositoryFile = (name: string) => {
  const path = resolve(repositoryRoot, name)
  return existsSync(path) ? readFileSync(path, "utf8") : ""
}

test("staging image uses the GNU build toolchain and starts its Alpine runtime as the node user", () => {
  const dockerfile = readBuildFile("Dockerfile")
  const packageManifest = JSON.parse(readBuildFile("package.json")) as {
    packageManager: string
    devDependencies: Record<string, string>
  }

  expect(packageManifest.packageManager).toBe("yarn@1.22.22")
  expect(packageManifest.devDependencies["@ast-grep/cli"]).toBe("0.45.1")
  expect(dockerfile).toContain(`FROM ${buildNodeImage} AS build`)
  expect(dockerfile).toContain(`FROM ${runtimeNodeImage} AS runtime`)
  expect(dockerfile).toContain("RUN corepack enable && corepack prepare yarn@1.22.22 --activate")
  expect(dockerfile).toContain("RUN yarn --version && yarn install --frozen-lockfile --non-interactive")
  expect(dockerfile).toContain("RUN yarn build")
  expect(dockerfile).toContain(`FROM ${runtimeNodeImage} AS runtime`)
  expect(dockerfile).toContain("ENV NODE_ENV=production HOST=0.0.0.0 PORT=3020")
  expect(dockerfile).toContain("COPY --from=build --chown=node:node /app/.output ./.output")
  expect(dockerfile).toContain("USER node")
  expect(dockerfile).toContain("CMD [\"node\", \".output/server/index.mjs\"]")

  const runtimeStage = dockerfile.split(`FROM ${runtimeNodeImage} AS runtime\n`)[1]
  expect(runtimeStage.match(/^COPY .+$/gmu)).toEqual([
    "COPY --from=build --chown=node:node /app/.output ./.output"
  ])
})

test("staging Docker build context excludes development and generated files", () => {
  const ignored = new Set(
    readBuildFile(".dockerignore")
      .split(/\r?\n/u)
      .filter(Boolean)
  )

  expect([...ignored]).toEqual(expect.arrayContaining([
    ".git",
    "node_modules",
    ".nuxt",
    ".output",
    "output",
    "coverage",
    "test",
    "test-results",
    ".playwright-cli",
    ".playwright-mcp",
    ".env*",
    ".pytest_cache",
    ".cache",
    ".DS_Store"
  ]))
})

test("staging Nomad service exposes the SHA-pinned Nuxt runtime through public ingress", () => {
  const jobspec = readRepositoryFile("jobs/lb-frontend-stage.nomad")
  const normalizedJobspec = jobspec.replace(/[ \t]+/gu, " ")

  expect(jobspec).toMatch(/job\s+"lb-frontend-stage"/u)
  expect(jobspec).toContain("variable \"image\"")
  expect(jobspec).toContain("variable \"git_sha\"")
  expect(jobspec).toContain("variable \"image_digest\"")
  expect(jobspec).toContain("variable \"caddy_host\"")
  expect(jobspec).toContain("variable \"http_port\"")
  expect(jobspec).toContain("variable \"observability_hmac_secret_path\"")
  expect(jobspec).toMatch(/variable\s+"http_port"\s*\{[^}]*default\s*=\s*3020/su)
  expect(normalizedJobspec).toContain('mode = "host"')
  expect(normalizedJobspec).toContain('network_mode = "host"')
  expect(jobspec).toMatch(/static\s*=\s*var\.http_port/u)
  expect(normalizedJobspec).toContain('address = "${meta.bind_ip}"')
  expect(normalizedJobspec).toContain('image = var.image')
  expect(normalizedJobspec).toContain('force_pull = true')
  expect(normalizedJobspec).toContain('GIT_SHA = var.git_sha')
  expect(normalizedJobspec).toContain('IMAGE_DIGEST = var.image_digest')
  expect(normalizedJobspec).toContain('NUXT_DEPLOYMENT_GIT_SHA = var.git_sha')
  expect(normalizedJobspec).toContain('NUXT_DEPLOYMENT_IMAGE_DIGEST = var.image_digest')
  expect(normalizedJobspec).toContain('IMAGE_REF = var.image')
  expect(normalizedJobspec).toContain('NUXT_DEPLOYMENT_ENVIRONMENT = "staging"')
  expect(normalizedJobspec).toContain('NUXT_PUBLIC_OBSERVABILITY_ENVIRONMENT = "stage"')
  expect(normalizedJobspec).toContain('NUXT_PUBLIC_OBSERVABILITY_GIT_SHA = var.git_sha')
  expect(normalizedJobspec).toContain(
    'NUXT_OBSERVABILITY_ALLOWED_ORIGINS = "https://stage.litteraturbanken.se,https://lb-frontend.pub.lb.se"'
  )
  expect(normalizedJobspec).toContain('NUXT_OBSERVABILITY_HMAC_SECRET_FILE = "/secrets/lb_observability_hmac_secret"')
  expect(jobspec).toContain('format("%s:/secrets/lb_observability_hmac_secret:ro", var.observability_hmac_secret_path)')
  expect(jobspec).not.toContain("NUXT_OBSERVABILITY_HMAC_SECRET =")
  expect(normalizedJobspec).toContain('NUXT_API_BASE = "http://lb-backend-stage.service.consul:5003/v2"')
  expect(normalizedJobspec).toContain('NUXT_LIBRARY_API_BASE = "http://lb-backend-stage.service.consul:5003"')
  expect(normalizedJobspec).toContain('NUXT_CONTENT_BASE = "https://red.litteraturbanken.se"')
  expect(normalizedJobspec).toContain('NUXT_READER_SOURCE_BASE = "https://litteraturbanken.se"')
  expect(jobspec).toContain('"caddy-host=${var.caddy_host}"')
  expect(jobspec).toContain('"caddy-ingress=public"')
  expect(jobspec).toContain('"caddy-https=on"')
  expect(jobspec).not.toContain('"caddy-tls=internal"')
  expect(normalizedJobspec).toContain('path = "/robots.txt"')
  expect(normalizedJobspec).toContain('interval = "10s"')
  expect(normalizedJobspec).toContain('timeout = "3s"')
  expect(jobspec).toMatch(/check_restart\s*\{[^}]*limit\s*=\s*3[^}]*grace\s*=\s*"2m"/su)
  expect(jobspec).toContain('if [ -z "$${GIT_SHA}" ]; then')
  expect(jobspec).toContain('echo "missing GIT_SHA" >&2')
  expect(jobspec).toContain('if [ -z "$${IMAGE_REF}" ]; then')
  expect(jobspec).toContain('echo "missing IMAGE_REF" >&2')
  expect(normalizedJobspec).toContain('git_sha = var.git_sha')
  expect(normalizedJobspec).toContain('image_digest = var.image_digest')
  expect(jobspec).toContain("'^sha256:[0-9a-f]{64}$'")
  expect(jobspec).toContain('echo "invalid IMAGE_DIGEST" >&2')
  expect(jobspec).not.toContain("GIT_SHA:?")
  expect(jobspec).not.toContain("IMAGE_REF:?")
  expect(jobspec).not.toContain("dns_servers")
})

test("staging deploy resolves the built manifest digest before detached deployment", () => {
  const scriptPath = resolve(repositoryRoot, "scripts/deploy-stage.sh")
  const script = readRepositoryFile("scripts/deploy-stage.sh")

  expect(script).toContain('git_sha="$(git rev-parse --verify "${requested_ref}^{commit}")"')
  expect(script).toContain('git_url="${GIT_URL:-https://github.com/Litteraturbanken/littb-frontend.git}"')
  expect(script).toContain('image_name="${IMAGE_NAME:-lb-frontend}"')
  expect(script).toContain('image_ref="${registry_host}/${image_name}:${git_sha}"')
  expect(script).toContain("resolve_registry_digest()")
  expect(script).toContain('method="HEAD"')
  expect(script).toContain('"Accept": ", ".join((')
  expect(script).toContain("application/vnd.oci.image.manifest.v1+json")
  expect(script).toContain("application/vnd.oci.image.index.v1+json")
  expect(script).toContain("application/vnd.docker.distribution.manifest.v2+json")
  expect(script).toContain("application/vnd.docker.distribution.manifest.list.v2+json")
  expect(script).toContain('response.headers.get("Docker-Content-Digest")')
  expect(script).toContain('re.fullmatch(r"sha256:[0-9a-f]{64}", digest)')
  expect(script).toContain("registry redirect changed authority")
  expect(script).toContain('"GIT_REF": git_sha')
  expect(script).toContain('"CONTEXT_DIR": "nuxt"')
  expect(script).toContain('"IMAGE": os.environ["DISPATCH_IMAGE"]')
  expect(script).toContain('"TAG": git_sha')
  expect(script).toContain('"PUSH_GHCR": "false"')
  expect(script).toContain('current_branch="$(git branch --show-current)"')
  expect(script).toContain('if [ -n "$(git status --porcelain)" ]; then')
  expect(script).toContain('git push origin "$current_branch"')
  expect(script).toContain('"IdempotencyToken": f"lb-frontend-stage-{git_sha}"')
  expect(script).toContain('nomad_token = os.environ.get("NOMAD_TOKEN")')
  expect(script).toContain('headers["X-Nomad-Token"] = nomad_token')
  expect(script).toContain("headers=headers")
  expect(script).not.toContain('"NOMAD_TOKEN":')
  expect(script).toContain('image_digest="$(resolve_registry_digest "$image_ref")"')
  expect(script).toContain('immutable_image_ref="${registry_host}/${image_name}@${image_digest}"')
  const validateCommand = 'nomad job validate -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" jobs/lb-frontend-stage.nomad'
  const runCommand = 'nomad run -detach -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" jobs/lb-frontend-stage.nomad'
  expect(script).toContain(validateCommand)
  expect(script).toContain(runCommand)
  expect(script.indexOf('re.fullmatch(r"sha256:[0-9a-f]{64}", digest)'))
    .toBeLessThan(script.indexOf(runCommand))
  expect(script.indexOf(validateCommand)).toBeLessThan(script.indexOf(runCommand))
  expect(script).not.toContain('nomad run -detach -var "image=$image_ref"')
  expect(script).toContain('timeout_seconds="${BUILD_TIMEOUT_SECONDS:-1800}"')
  expect(script).not.toContain(":latest")
  expect(existsSync(scriptPath) ? statSync(scriptPath).mode & 0o111 : 0).not.toBe(0)
})
