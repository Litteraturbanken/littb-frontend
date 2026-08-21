import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
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

const gitSha = "a".repeat(40)
const imageDigest = `sha256:${"b".repeat(64)}`

function writeExecutable(directory: string, name: string, source: string) {
  const path = resolve(directory, name)
  writeFileSync(path, source)
  chmodSync(path, 0o755)
}

function runDeployStage(waitForBuild: string) {
  const directory = mkdtempSync(resolve(tmpdir(), "littb-stage-deploy-"))
  const tracePath = resolve(directory, "trace")
  writeExecutable(directory, "git", `#!/bin/sh
case "$1" in
  rev-parse) printf '%s\\n' '${gitSha}' ;;
  branch) printf '%s\\n' 'test-stage-branch' ;;
  status|merge-base) ;;
  push) printf '%s\\n' 'git push' >> "$TRACE_FILE" ;;
  *) exit 64 ;;
esac
`)
  writeExecutable(directory, "nomad", `#!/bin/sh
case "$1 $2" in
  "job allocs")
    printf '%s\\n' 'nomad allocs' >> "$TRACE_FILE"
    printf '%s\\n' '[]'
    ;;
  "job validate")
    case " $* " in
      *" -var reader_source_base=https://reader-stage.test "*) ;;
      *) exit 65 ;;
    esac
    printf '%s\\n' 'nomad validate' >> "$TRACE_FILE"
    ;;
  "job status") printf '%s\\n' 'nomad status' >> "$TRACE_FILE" ;;
  "run -detach")
    case " $* " in
      *" -var reader_source_base=https://reader-stage.test "*) ;;
      *) exit 65 ;;
    esac
    printf '%s\\n' 'nomad run' >> "$TRACE_FILE"
    ;;
  *) exit 64 ;;
esac
`)
  writeExecutable(directory, "python3", `#!/bin/sh
if [ -n "\${DISPATCH_BUILDER_JOB:-}" ]; then
  printf '%s\\n' 'dispatch' >> "$TRACE_FILE"
  printf '%s\\n' '{"DispatchedJobID":"builder/test"}'
elif [ -n "\${RESOLVE_IMAGE_REF:-}" ]; then
  printf '%s\\n' 'resolve' >> "$TRACE_FILE"
  printf '%s\\n' '${imageDigest}'
elif printf '%s' "\${2:-}" | grep -q 'DispatchedJobID'; then
  printf '%s\\n' 'builder/test'
elif printf '%s' "\${2:-}" | grep -q 'allocs = json.load'; then
  cat >/dev/null
  printf '%s\\n' 'build complete' >> "$TRACE_FILE"
  printf '%s\\n' 'complete'
else
  exit 64
fi
`)

  try {
    const result = spawnSync(resolve(repositoryRoot, "scripts/deploy-stage.sh"), [], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH || ""}`,
        TRACE_FILE: tracePath,
        WAIT_FOR_BUILD: waitForBuild,
        BUILD_TIMEOUT_SECONDS: "5",
        REGISTRY_HOST: "registry.test:5000",
        READER_SOURCE_BASE: "https://reader-stage.test"
      }
    })
    const trace = existsSync(tracePath)
      ? readFileSync(tracePath, "utf8").trim().split("\n")
      : []
    return { result, trace }
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

function stageEntrypointTemplate() {
  const jobspec = readRepositoryFile("jobs/lb-frontend-stage.nomad")
  const match = jobspec.match(/args = \[<<-EOT\n([\s\S]*?)\n\s*EOT\n/u)
  if (!match) throw new Error("Stage entrypoint heredoc not found")
  return match[1]
}

function stageEntrypoint() {
  return stageEntrypointTemplate().replace(/\$\$\{/gu, "${")
}

function runStageEntrypoint(gitShaValue: string, imageDigestValue: string) {
  const directory = mkdtempSync(resolve(tmpdir(), "littb-stage-entrypoint-"))
  const tracePath = resolve(directory, "trace")
  writeExecutable(directory, "node", `#!/bin/sh
printf '%s\\n' 'started' >> "$TRACE_FILE"
`)

  try {
    const result = spawnSync("/bin/sh", ["-ec", stageEntrypoint()], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH || ""}`,
        TRACE_FILE: tracePath,
        GIT_SHA: gitShaValue,
        IMAGE_DIGEST: imageDigestValue,
        IMAGE_REF: `registry.test:5000/lb-frontend@${imageDigest}`,
        NOMAD_PORT_http: "3020"
      }
    })
    const trace = existsSync(tracePath)
      ? readFileSync(tracePath, "utf8").trim().split("\n")
      : []
    return { result, trace }
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
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

test("staging Nomad service exposes the digest-pinned Nuxt runtime through public ingress", () => {
  const jobspec = readRepositoryFile("jobs/lb-frontend-stage.nomad")
  const normalizedJobspec = jobspec.replace(/[ \t]+/gu, " ")

  expect(jobspec).toMatch(/job\s+"lb-frontend-stage"/u)
  expect(jobspec).toContain("variable \"image\"")
  expect(jobspec).toContain("variable \"git_sha\"")
  expect(jobspec).toContain("variable \"image_digest\"")
  expect(jobspec).toContain("variable \"reader_source_base\"")
  expect(jobspec).toContain("variable \"caddy_host\"")
  expect(jobspec).toContain("variable \"http_port\"")
  expect(jobspec).not.toContain("variable \"observability_hmac_secret_path\"")
  expect(jobspec).toMatch(/variable\s+"http_port"\s*\{[^}]*default\s*=\s*3020/su)
  expect(jobspec).toMatch(
    /variable\s+"reader_source_base"\s*\{[^}]*default\s*=\s*"https:\/\/litteraturbanken\.se"/su
  )
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
  expect(normalizedJobspec).toContain('secret "runtime"')
  expect(normalizedJobspec).toContain('provider = "nomad"')
  expect(normalizedJobspec).toContain(
    'path = "nomad/jobs/lb-frontend-stage/frontend/frontend"'
  )
  expect(normalizedJobspec).toContain('namespace = "default"')
  expect(normalizedJobspec).toContain(
    'NUXT_OBSERVABILITY_HMAC_SECRET = "${secret.runtime.observability_hmac_secret}"'
  )
  expect(jobspec).not.toContain("NUXT_OBSERVABILITY_HMAC_SECRET_FILE")
  expect(jobspec).not.toContain("/secrets/lb_observability_hmac_secret")
  expect(normalizedJobspec).toContain('NUXT_API_BASE = "http://lb-backend-stage.service.consul:5003/v2"')
  expect(normalizedJobspec).toContain('NUXT_LIBRARY_API_BASE = "http://lb-backend-stage.service.consul:5003"')
  expect(normalizedJobspec).toContain('NUXT_CONTENT_BASE = "https://red.litteraturbanken.se"')
  expect(normalizedJobspec).toContain('NUXT_READER_SOURCE_BASE = var.reader_source_base')
  expect(jobspec).toContain('"caddy-host=${var.caddy_host}"')
  expect(jobspec).toContain('"caddy-ingress=public"')
  expect(jobspec).toContain('"caddy-https=on"')
  expect(jobspec).not.toContain('"caddy-tls=internal"')
  expect(normalizedJobspec).toContain('path = "/_deployment"')
  expect(normalizedJobspec).not.toContain('path = "/robots.txt"')
  expect(normalizedJobspec).toContain('interval = "10s"')
  expect(normalizedJobspec).toContain('timeout = "3s"')
  expect(jobspec).toMatch(/check_restart\s*\{[^}]*limit\s*=\s*3[^}]*grace\s*=\s*"2m"/su)
  expect(jobspec).toContain('if [ -z "$IMAGE_REF" ]; then')
  expect(jobspec).toContain('echo "missing IMAGE_REF" >&2')
  expect(normalizedJobspec).toContain('git_sha = var.git_sha')
  expect(normalizedJobspec).toContain('image_digest = var.image_digest')
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
  expect(script).toContain(
    'reader_source_base="${READER_SOURCE_BASE:-https://litteraturbanken.se}"'
  )
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
  const validateCommand = 'nomad job validate -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" -var "reader_source_base=$reader_source_base" jobs/lb-frontend-stage.nomad'
  const runCommand = 'nomad run -detach -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" -var "reader_source_base=$reader_source_base" jobs/lb-frontend-stage.nomad'
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

test("staging no-wait mode dispatches the build without resolving or deploying", () => {
  const { result, trace } = runDeployStage("0")

  expect(result.status, result.stderr).toBe(0)
  expect(trace).toEqual(["git push", "dispatch"])
})

test("staging rejects unsupported wait modes without resolving or deploying", () => {
  const { result, trace } = runDeployStage("sometimes")

  expect(result.status).toBe(2)
  expect(trace).toEqual(["git push", "dispatch"])
})

test("staging wait mode resolves and deploys only after builder completion", () => {
  const { result, trace } = runDeployStage("1")

  expect(result.status, result.stderr).toBe(0)
  expect(trace).toEqual([
    "git push",
    "dispatch",
    "nomad allocs",
    "build complete",
    "resolve",
    "nomad validate",
    "nomad run",
    "nomad status"
  ])
})

test("staging entrypoint starts only with exact immutable identity values", () => {
  const { result, trace } = runStageEntrypoint(gitSha, imageDigest)

  expect(result.status, result.stderr).toBe(0)
  expect(trace).toEqual(["started"])
})

test("staging entrypoint avoids Nomad client interpolation syntax", () => {
  expect(stageEntrypointTemplate()).not.toContain("${")
})

const invalidGitShas = {
  empty: "",
  uppercase: "A".repeat(40),
  short: "a".repeat(39),
  multiline: `${gitSha}\nignored`,
  trailing: `${gitSha}x`
}

test.each(Object.entries(invalidGitShas))(
  "staging entrypoint rejects %s Git SHA values before starting Nuxt",
  (_case, invalidGitSha) => {
    const { result, trace } = runStageEntrypoint(invalidGitSha, imageDigest)

    expect(result.status).not.toBe(0)
    expect(trace).toEqual([])
  }
)

const invalidImageDigests = {
  empty: "",
  uppercase: `sha256:${"B".repeat(64)}`,
  short: `sha256:${"b".repeat(63)}`,
  multiline: `${imageDigest}\nignored`,
  trailing: `${imageDigest}x`
}

test.each(Object.entries(invalidImageDigests))(
  "staging entrypoint rejects %s image digest values before starting Nuxt",
  (_case, invalidImageDigest) => {
    const { result, trace } = runStageEntrypoint(gitSha, invalidImageDigest)

    expect(result.status).not.toBe(0)
    expect(trace).toEqual([])
  }
)
