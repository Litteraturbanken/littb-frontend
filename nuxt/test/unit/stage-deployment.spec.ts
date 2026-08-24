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

type EvaluatedNomadTask = {
  Env?: Record<string, string>
  Name?: string
}

type EvaluatedNomadGroup = {
  Name?: string
  Tasks?: EvaluatedNomadTask[]
}

function evaluatedFrontendEnvironment(path: string, variables: Record<string, string> = {}) {
  const variableArguments = Object.entries(variables)
    .flatMap(([name, value]) => ["-var", `${name}=${value}`])
  const result = spawnSync(
    "nomad",
    ["job", "run", "-output", ...variableArguments, path],
    { encoding: "utf8" }
  )
  if (result.status !== 0) throw new Error("Nomad jobspec evaluation failed")
  const output = JSON.parse(result.stdout) as {
    Job?: { TaskGroups?: EvaluatedNomadGroup[] }
  }
  const groups = (output.Job?.TaskGroups ?? [])
    .filter(group => group.Name === "frontend")
  if (groups.length !== 1) throw new Error("expected exactly one frontend group")
  const tasks = (groups[0]?.Tasks ?? [])
    .filter(task => task.Name === "frontend")
  if (tasks.length !== 1) throw new Error("expected exactly one frontend task")
  return tasks[0]?.Env ?? {}
}

function declaredJobspecVariables(source: string) {
  const declarationsOnly = source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/<<-?(?<delimiter>[A-Z][A-Z0-9_]*)\n[\s\S]*?^\s*\k<delimiter>\s*$/gmu, "")
    .replace(/^\s*(?:#|\/\/).*$/gmu, "")
  return Array.from(
    declarationsOnly.matchAll(/^variable "(?<name>[^"]+)"\s*\{/gmu),
    match => match.groups?.name
  )
}

function assertReaderEnvironmentInvariant(
  path: string,
  baselineVariables: Record<string, string>,
  alternateVariables: Record<string, string>
) {
  for (const [name, value] of Object.entries(alternateVariables)) {
    const environment = evaluatedFrontendEnvironment(path, {
      ...baselineVariables,
      [name]: value
    })
    if (
      environment.NUXT_PUBLIC_READER_DICTIONARY_MODE !== "embed"
      || environment.NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN !== "https://svenska.se"
    ) {
      throw new Error(`Reader dictionary environment changed for ${name}`)
    }
  }
}

const gitSha = "a".repeat(40)
const imageDigest = `sha256:${"b".repeat(64)}`

function writeExecutable(directory: string, name: string, source: string) {
  const path = resolve(directory, name)
  writeFileSync(path, source)
  chmodSync(path, 0o755)
}

function runDeployStage(
  waitForBuild: string,
  plan = {
    status: 0,
    output: "Job Modify Index: 41",
    expectedIndex: "41"
  }
) {
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
    [ "$*" = "job validate -var image=registry.test:5000/lb-frontend@${imageDigest} -var image_digest=${imageDigest} -var git_sha=${gitSha} jobs/lb-frontend-stage.nomad" ] || exit 65
    printf '%s\\n' 'nomad validate' >> "$TRACE_FILE"
    ;;
  "job plan")
    [ "$*" = "job plan -no-color -var image=registry.test:5000/lb-frontend@${imageDigest} -var image_digest=${imageDigest} -var git_sha=${gitSha} jobs/lb-frontend-stage.nomad" ] || exit 65
    printf '%s\\n' 'nomad plan' >> "$TRACE_FILE"
    printf '%s\\n' "$PLAN_OUTPUT"
    exit "$PLAN_STATUS"
    ;;
  "job status") printf '%s\\n' 'nomad status' >> "$TRACE_FILE" ;;
  "run -check-index")
    [ "$*" = "run -check-index $EXPECTED_PLAN_INDEX -detach -var image=registry.test:5000/lb-frontend@${imageDigest} -var image_digest=${imageDigest} -var git_sha=${gitSha} jobs/lb-frontend-stage.nomad" ] || exit 65
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
        PLAN_STATUS: String(plan.status),
        PLAN_OUTPUT: plan.output,
        EXPECTED_PLAN_INDEX: plan.expectedIndex,
        BUILD_TIMEOUT_SECONDS: "5",
        REGISTRY_HOST: "registry.test:5000",
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

function serviceTags(jobspec: string, serviceName: string) {
  const service = jobspec.match(
    new RegExp(
      `service\\s*\\{\\s*name\\s*=\\s*"${serviceName}"(?<body>[\\s\\S]*?)\\n\\s{4}\\}`,
      "u"
    )
  )
  if (!service?.groups?.body) throw new Error(`service ${serviceName} not found`)

  const tags = service.groups.body.match(/tags\s*=\s*\[(?<body>[\s\S]*?)\]/u)
  if (!tags?.groups?.body) throw new Error(`service ${serviceName} tags not found`)

  return Array.from(tags.groups.body.matchAll(/"(?<tag>[^"]+)"/gu), ({ groups }) => groups?.tag ?? "")
}

const stageIngressRetryTags = [
  "caddy-lb-try-duration=5s",
  "caddy-lb-try-interval=250ms"
]

function assertExactStageIngressRetryTags(tags: readonly string[]) {
  expect(tags.filter((tag) => tag.startsWith("caddy-lb-try-"))).toEqual(stageIngressRetryTags)
}

function runStageEntrypoint(
  gitShaValue: string,
  imageDigestValue: string,
  imageRefValue = `registry.test:5000/lb-frontend@${imageDigest}`,
  environmentOverrides: Record<string, string> = {}
) {
  const directory = mkdtempSync(resolve(tmpdir(), "littb-stage-entrypoint-"))
  const tracePath = resolve(directory, "trace")
  writeExecutable(directory, "node", `#!/bin/sh
case "$1" in
  scripts/verify-public-resource.mjs)
    if [ "$PROBE_SHOULD_FAIL" = "1" ]; then
      printf '%s\\n' 'public resource failed' >> "$TRACE_FILE"
      exit 70
    fi
    printf '%s\\n' 'public resource verified' >> "$TRACE_FILE"
    ;;
  .output/server/index.mjs) printf '%s\\n' 'started' >> "$TRACE_FILE" ;;
  *) exit 64 ;;
esac
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
        IMAGE_REF: imageRefValue,
        NUXT_CONTENT_BASE: "https://red.litteraturbanken.se",
        PUBLIC_RESOURCE_ORIGIN: "https://stage.litteraturbanken.se",
        PROBE_SHOULD_FAIL: "0",
        ...environmentOverrides,
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
    "COPY --from=build --chown=node:node /app/.output ./.output",
    "COPY --from=build --chown=node:node /app/scripts/verify-public-resource.mjs ./scripts/verify-public-resource.mjs"
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

test("Nomad evaluation ignores fake frontend blocks in comments and heredocs", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "littb-nomad-evaluation-"))
  const path = resolve(directory, "fixture.nomad")
  writeFileSync(path, `/*
task "frontend" {
  env {
    NUXT_PUBLIC_READER_DICTIONARY_MODE = "embed"
    NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN = "https://svenska.se"
  }
}
*/
variable "caddy_host" {
  type = string
  default = "operator-controlled.invalid"
}
job "fixture" {
  datacenters = ["local"]
  meta {
    fake_frontend = <<-EOT
      task "frontend" {
        env {
          NUXT_PUBLIC_READER_DICTIONARY_MODE = "embed"
          NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN = "https://svenska.se"
        }
      }
    EOT
  }
  group "frontend" {
    task "frontend" {
      driver = "raw_exec"
      env {
        NUXT_PUBLIC_READER_DICTIONARY_MODE = var.caddy_host
        NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN = "https://\${var.caddy_host}"
      }
      config {
        command = "/bin/true"
      }
    }
    task "sidecar" {
      driver = "raw_exec"
      env {
        NUXT_PUBLIC_READER_DICTIONARY_MODE = "embed"
        NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN = "https://svenska.se"
      }
      config {
        command = "/bin/true"
      }
    }
  }
}`)

  try {
    const environment = evaluatedFrontendEnvironment(path)
    expect(environment.NUXT_PUBLIC_READER_DICTIONARY_MODE)
      .toBe("operator-controlled.invalid")
    expect(environment.NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN)
      .toBe("https://operator-controlled.invalid")
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test("declared variable inventory ignores decoys and preserves duplicates", () => {
  expect(declaredJobspecVariables(`/* variable "commented" { type = string } */
value = <<-EOT
  variable "heredoc" { type = string }
EOT
variable "real" { type = string }
variable "real" { type = string }
`)).toEqual(["real", "real"])
})

test("Reader environment invariance rejects defaulted operator controls", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "littb-reader-invariance-"))
  const path = resolve(directory, "fixture.nomad")
  writeFileSync(path, `variable "reader_mode" {
  type = string
  default = "embed"
}
variable "reader_origin" {
  type = string
  default = "https://svenska.se"
}
job "fixture" {
  datacenters = ["local"]
  group "frontend" {
    task "frontend" {
      driver = "raw_exec"
      env {
        NUXT_PUBLIC_READER_DICTIONARY_MODE = var.reader_mode
        NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN = var.reader_origin
      }
      config {
        command = "/bin/true"
      }
    }
  }
}`)

  try {
    expect(() => assertReaderEnvironmentInvariant(path, {}, {
      reader_mode: "legacy"
    })).toThrow("Reader dictionary environment changed")
    expect(() => assertReaderEnvironmentInvariant(path, {}, {
      reader_origin: "https://operator-controlled.invalid"
    })).toThrow("Reader dictionary environment changed")
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test("staging Nomad service exposes the digest-pinned Nuxt runtime through public ingress", () => {
  const jobspec = readRepositoryFile("jobs/lb-frontend-stage.nomad")
  const normalizedJobspec = jobspec.replace(/[ \t]+/gu, " ")
  const variableNames = Array.from(
    declaredJobspecVariables(jobspec)
  )
  const path = resolve(repositoryRoot, "jobs/lb-frontend-stage.nomad")
  const baselineVariables = {
    git_sha: gitSha,
    image: `registry.test:5000/lb-frontend@${imageDigest}`,
    image_digest: imageDigest
  }
  const environment = evaluatedFrontendEnvironment(path, baselineVariables)
  const envNames = Object.keys(environment).sort()

  expect(jobspec).toMatch(/job\s+"lb-frontend-stage"/u)
  expect(variableNames).toEqual([
    "datacenters",
    "image",
    "git_sha",
    "image_digest",
    "caddy_host",
    "http_port"
  ])
  expect(jobspec).not.toContain("variable \"observability_hmac_secret_path\"")
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
  expect(environment.NUXT_PUBLIC_READER_DICTIONARY_MODE).toBe("embed")
  expect(environment.NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN)
    .toBe("https://svenska.se")
  const alternateVariables = {
    caddy_host: "operator-controlled.invalid",
    datacenters: '["operator-controlled"]',
    git_sha: "c".repeat(40),
    http_port: "43210",
    image: `registry.invalid/lb-frontend@sha256:${"d".repeat(64)}`,
    image_digest: `sha256:${"d".repeat(64)}`
  }
  expect(Object.keys(alternateVariables).sort())
    .toEqual([...variableNames].sort())
  assertReaderEnvironmentInvariant(path, baselineVariables, alternateVariables)
  expect(normalizedJobspec).toContain(
    'NUXT_OBSERVABILITY_ALLOWED_ORIGINS = "https://stage.litteraturbanken.se,https://lb-frontend.pub.lb.se"'
  )
  expect(environment).not.toHaveProperty(
    "NUXT_OBSERVABILITY_TRUSTED_PROXY_CIDRS"
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
  expect(normalizedJobspec).toContain(
    'PUBLIC_RESOURCE_ORIGIN = "https://stage.litteraturbanken.se"'
  )
  expect(envNames).toEqual([
    "GIT_SHA",
    "IMAGE_DIGEST",
    "IMAGE_REF",
    "NUXT_API_BASE",
    "NUXT_CONTENT_BASE",
    "NUXT_DEPLOYMENT_ENVIRONMENT",
    "NUXT_DEPLOYMENT_GIT_SHA",
    "NUXT_DEPLOYMENT_IMAGE_DIGEST",
    "NUXT_LIBRARY_API_BASE",
    "NUXT_OBSERVABILITY_ALLOWED_ORIGINS",
    "NUXT_OBSERVABILITY_HMAC_SECRET",
    "NUXT_PUBLIC_OBSERVABILITY_ENVIRONMENT",
    "NUXT_PUBLIC_OBSERVABILITY_GIT_SHA",
    "NUXT_PUBLIC_READER_DICTIONARY_MODE",
    "NUXT_PUBLIC_SVENSKA_READER_EMBED_ORIGIN",
    "PUBLIC_RESOURCE_ORIGIN"
  ])
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

test("staging rehearses the production two-host rolling topology", () => {
  const jobspec = readRepositoryFile("jobs/lb-frontend-stage.nomad")
  const group = jobspec.match(/group\s+"frontend"\s*\{([\s\S]*?)\n\s+network\s*\{/u)?.[1] ?? ""

  expect(group).toMatch(/count\s*=\s*2/u)
  expect(group).toMatch(/shutdown_delay\s*=\s*"15s"/u)
  expect(group).toMatch(/constraint\s*\{[^}]*distinct_hosts\s*=\s*true[^}]*\}/su)
  expect(group).toMatch(/update\s*\{[^}]*max_parallel\s*=\s*1[^}]*\}/su)
  expect(group).toMatch(/health_check\s*=\s*"checks"/u)
  expect(group).toMatch(/min_healthy_time\s*=\s*"30s"/u)
  expect(group).toMatch(/healthy_deadline\s*=\s*"5m"/u)
  expect(group).toMatch(/progress_deadline\s*=\s*"10m"/u)
  expect(group).toMatch(/auto_revert\s*=\s*true/u)
})

test("Stage frontend has exactly the approved paired ingress retry tags", () => {
  const stageJobspec = readRepositoryFile("jobs/lb-frontend-stage.nomad")

  assertExactStageIngressRetryTags(serviceTags(stageJobspec, "lb-frontend-stage"))
})

test.each([
  ["duplicates the retry duration", (tags: string[]) => [...tags, "caddy-lb-try-duration=5s"]],
  ["duplicates the retry interval", (tags: string[]) => [...tags, "caddy-lb-try-interval=250ms"]],
  ["changes the retry duration", (tags: string[]) => tags.map((tag) => tag.replace("=5s", "=4s"))],
  ["changes the retry interval", (tags: string[]) => tags.map((tag) => tag.replace("=250ms", "=500ms"))],
  ["adds another retry key", (tags: string[]) => [...tags, "caddy-lb-try-attempts=2"]]
])("Stage ingress retry contract rejects a tag list that %s", (_caseName, mutate) => {
  const stageJobspec = readRepositoryFile("jobs/lb-frontend-stage.nomad")
  const tags = serviceTags(stageJobspec, "lb-frontend-stage")

  expect(() => assertExactStageIngressRetryTags(mutate(tags))).toThrow()
})

test("staging deploy resolves the built manifest digest before planned detached deployment", () => {
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
  const planCommand = 'nomad job plan -no-color -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" jobs/lb-frontend-stage.nomad'
  const runCommand = 'nomad run -check-index "$plan_modify_index" -detach -var "image=$immutable_image_ref" -var "image_digest=$image_digest" -var "git_sha=$git_sha" jobs/lb-frontend-stage.nomad'
  expect(script).toContain(validateCommand)
  expect(script).toContain(planCommand)
  expect(script).toContain(runCommand)
  expect(script.indexOf('re.fullmatch(r"sha256:[0-9a-f]{64}", digest)'))
    .toBeLessThan(script.indexOf(runCommand))
  expect(script.indexOf(validateCommand)).toBeLessThan(script.indexOf(runCommand))
  expect(script.indexOf(planCommand)).toBeLessThan(script.indexOf(runCommand))
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
    "nomad plan",
    "nomad run",
    "nomad status"
  ])
})

test.each([
  { status: 0, output: "Job Modify Index: 0", expectedIndex: "0" },
  { status: 1, output: "Job Modify Index: 52", expectedIndex: "52" }
])("staging deploy accepts documented plan exit $status and uses its modify index", plan => {
  const { result, trace } = runDeployStage("1", plan)

  expect(result.status, result.stderr).toBe(0)
  expect(result.stdout).toContain(plan.output)
  expect(trace).toContain("nomad plan")
  expect(trace).toContain("nomad run")
})

test.each([
  { name: "unexpected exit", status: 255, output: "Job Modify Index: 52", expectedIndex: "52" },
  { name: "missing modify index", status: 0, output: "No alloc changes", expectedIndex: "52" },
  { name: "duplicate modify index", status: 0, output: "Job Modify Index: 52\nJob Modify Index: 53", expectedIndex: "52" },
  { name: "malformed modify index", status: 0, output: "Job Modify Index: -1", expectedIndex: "52" },
  { name: "valid plus negative modify index", status: 0, output: "Job Modify Index: 52\nJob Modify Index: -1", expectedIndex: "52" },
  { name: "valid plus whitespace-only modify index", status: 0, output: "Job Modify Index: 52\nJob Modify Index:   ", expectedIndex: "52" },
  { name: "valid plus trailing-junk modify index", status: 0, output: "Job Modify Index: 52\nJob Modify Index: 53 unexpected", expectedIndex: "52" }
])("staging deploy blocks run after $name", plan => {
  const { result, trace } = runDeployStage("1", plan)

  expect(result.status).not.toBe(0)
  expect(result.stdout).toContain(plan.output)
  expect(trace).toContain("nomad plan")
  expect(trace).not.toContain("nomad run")
})

test("staging entrypoint starts only with exact immutable identity values", () => {
  const { result, trace } = runStageEntrypoint(gitSha, imageDigest)

  expect(result.status, result.stderr).toBe(0)
  expect(trace).toEqual(["public resource verified", "started"])
})

test("staging entrypoint fails closed when the public resource preflight fails", () => {
  const { result, trace } = runStageEntrypoint(gitSha, imageDigest, undefined, {
    PROBE_SHOULD_FAIL: "1"
  })

  expect(result.status).not.toBe(0)
  expect(trace).toEqual(["public resource failed"])
})

test("staging runbook binds the live suite to the deployed Git and image identity", () => {
  const runbook = readBuildFile("README.md")

  expect(runbook).toContain(': "${DEPLOYED_GIT_SHA:?set from the deploy summary}"')
  expect(runbook).toContain(': "${DEPLOYED_IMAGE_DIGEST:?set from the deploy summary}"')
  expect(runbook).toContain("LITTB_EXPECTED_GIT_SHA=\"$DEPLOYED_GIT_SHA\"")
  expect(runbook).toContain("LITTB_EXPECTED_IMAGE_DIGEST=\"$DEPLOYED_IMAGE_DIGEST\"")
  expect(runbook).toContain("LITTB_NUXT_LIVE_ORIGIN=https://stage.litteraturbanken.se")
})

test.each([
  ["content source", { NUXT_CONTENT_BASE: "https://stage.litteraturbanken.se" }],
  ["public resource origin", { PUBLIC_RESOURCE_ORIGIN: "https://red.litteraturbanken.se" }]
])("staging entrypoint rejects a changed %s before the preflight", (_name, overrides) => {
  const { result, trace } = runStageEntrypoint(gitSha, imageDigest, undefined, overrides)

  expect(result.status).not.toBe(0)
  expect(trace).toEqual([])
})

const invalidImageRefs = {
  tagOnly: "registry.test:5000/lb-frontend:stage",
  mismatchedDigest: `registry.test:5000/lb-frontend@sha256:${"c".repeat(64)}`
}

test.each(Object.entries(invalidImageRefs))(
  "staging entrypoint rejects %s image references before starting Nuxt",
  (_case, invalidImageRef) => {
    const { result, trace } = runStageEntrypoint(gitSha, imageDigest, invalidImageRef)

    expect(result.status).not.toBe(0)
    expect(trace).toEqual([])
  }
)

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
