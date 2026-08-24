import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, test } from "vitest"

const require = createRequire(import.meta.url)
const repositoryRoot = resolve(import.meta.dirname, "../../..")
const configPath = resolve(repositoryRoot, "playwright.nuxt-live.config.js")
const preflightPath = resolve(repositoryRoot, "test/e2e/nuxt_live_preflight.cjs")
const config = require(configPath)
const expectedGitSha = "a".repeat(40)
const expectedImageDigest = `sha256:${"b".repeat(64)}`

function identityEnvironment(
  gitSha: string | undefined,
  imageDigest: string | undefined
) {
  const env = { ...process.env }
  delete env.LITTB_EXPECTED_GIT_SHA
  delete env.LITTB_EXPECTED_IMAGE_DIGEST
  if (gitSha !== undefined) env.LITTB_EXPECTED_GIT_SHA = gitSha
  if (imageDigest !== undefined) env.LITTB_EXPECTED_IMAGE_DIGEST = imageDigest
  return env
}

function loadLiveConfig(gitSha?: string, imageDigest?: string) {
  return spawnSync(process.execPath, ["-e", `require(${JSON.stringify(configPath)})`], {
    encoding: "utf8",
    env: identityEnvironment(gitSha, imageDigest)
  })
}

function runPreflight(
  deploymentDigest: string,
  expectedGitShaValue: string | undefined = expectedGitSha,
  expectedImageDigestValue: string | undefined = expectedImageDigest
) {
  const runner = `
const calls = []
global.fetch = async url => {
  calls.push(url)
  if (url.endsWith("/_deployment")) return {
    ok: true,
    status: 200,
    json: async () => ({
      schema_version: "lb.frontend.deployment.v1",
      environment: "stage",
      git_sha: process.env.LITTB_EXPECTED_GIT_SHA,
      image_digest: ${JSON.stringify(deploymentDigest)}
    })
  }
  if (url.endsWith("/api/v2/openapi.json")) return {
    ok: true,
    status: 200,
    json: async () => ({ openapi: "3.1.0", paths: { "/dictionary/articles": {} } })
  }
  return {
    ok: true,
    status: 200,
    headers: { get: name => name === "content-type" ? "text/html" : null },
    text: async () => '<div id="__nuxt"></div>'
  }
}
require(${JSON.stringify(preflightPath)})()
  .then(() => process.stdout.write(JSON.stringify(calls)))
  .catch(error => { console.error(error.message); process.exitCode = 1 })
`
  return spawnSync(process.execPath, ["-e", runner], {
    encoding: "utf8",
    env: {
      ...identityEnvironment(expectedGitShaValue, expectedImageDigestValue),
      LITTB_NUXT_LIVE_ORIGIN: "https://stage.example"
    }
  })
}

describe("Nuxt live-stage runner", () => {
  test("uses bounded parallel workers with the existing preflight and no retries", () => {
    expect(config.fullyParallel).toBe(true)
    expect(config.workers).toBeGreaterThan(1)
    expect(config.workers).toBeLessThanOrEqual(4)
    expect(config.retries).toBe(0)
    expect(config.globalSetup).toContain("nuxt_live_preflight.cjs")
  })

  test("requires both expected deployment identity variables or neither", () => {
    expect(loadLiveConfig().status).toBe(0)
    expect(loadLiveConfig(expectedGitSha, expectedImageDigest).status).toBe(0)

    const missingDigest = loadLiveConfig(expectedGitSha)
    expect(missingDigest.status).not.toBe(0)
    expect(missingDigest.stderr).toContain(
      "LITTB_EXPECTED_GIT_SHA and LITTB_EXPECTED_IMAGE_DIGEST must be set together"
    )

    const missingGitSha = loadLiveConfig(undefined, expectedImageDigest)
    expect(missingGitSha.status).not.toBe(0)
    expect(missingGitSha.stderr).toContain(
      "LITTB_EXPECTED_GIT_SHA and LITTB_EXPECTED_IMAGE_DIGEST must be set together"
    )

    const directPreflight = runPreflight(expectedImageDigest, expectedGitSha, "")
    expect(directPreflight.status).not.toBe(0)
    expect(directPreflight.stderr).toContain(
      "LITTB_EXPECTED_GIT_SHA and LITTB_EXPECTED_IMAGE_DIGEST must be set together"
    )
  })

  test("checks exact deployment identity before the live application preflights", () => {
    const matched = runPreflight(expectedImageDigest)
    expect(matched.status, matched.stderr).toBe(0)
    expect(JSON.parse(matched.stdout)).toEqual([
      "https://stage.example/_deployment",
      "https://stage.example/api/v2/openapi.json",
      "https://stage.example/"
    ])

    const mismatched = runPreflight(`sha256:${"c".repeat(64)}`)
    expect(mismatched.status).not.toBe(0)
    expect(mismatched.stderr).toContain("deployment identity mismatch")
  })

  test("keeps the parallel live smoke free of fixture control and direct mutations", () => {
    const source = readFileSync(
      resolve(repositoryRoot, "test/e2e/playwright_e2e.spec.js"),
      "utf8"
    )

    const sourceWithoutDeploymentRead = source.replace('request.get("/_deployment")', "")
    expect(sourceWithoutDeploymentRead).not.toMatch(/\/_[a-z_]+/u)
    expect(source).not.toMatch(/\b(?:page|request)\.(?:delete|patch|put)\s*\(/u)
    expect([...source.matchAll(/\brequest\.post\(\s*"([^"]+)"/gu)].map(
      match => match[1]
    )).toEqual(["/api/v2/library/search"])
    expect(source).toContain("LITTB_EXPECTED_GIT_SHA")
    expect(source).toContain("LITTB_EXPECTED_IMAGE_DIGEST")
    expect(source).toContain('request.get("/_deployment")')
  })
})
