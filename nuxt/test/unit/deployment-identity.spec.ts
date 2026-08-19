import { describe, expect, test } from "vitest"

import { deploymentIdentity } from "../../server/utils/deployment-identity"

const gitSha = "a".repeat(40)
const imageDigest = `sha256:${"b".repeat(64)}`

describe("deployment identity", () => {
  test("exposes only canonical immutable stage identity fields", () => {
    expect(deploymentIdentity({
      deploymentEnvironment: "staging",
      deploymentGitSha: gitSha,
      deploymentImageDigest: imageDigest
    })).toEqual({
      schema_version: "lb.frontend.deployment.v1",
      environment: "stage",
      git_sha: gitSha,
      image_digest: imageDigest
    })
  })

  test.each([
    ["uppercase SHA", "A".repeat(40), imageDigest],
    ["short SHA", "a".repeat(39), imageDigest],
    ["tagged image", gitSha, "lb-frontend:latest"],
    ["full image reference", gitSha, `registry.example/lb-frontend@sha256:${"b".repeat(64)}`],
    ["uppercase image digest", gitSha, `sha256:${"B".repeat(64)}`]
  ])("rejects %s outside development", (_case, invalidGitSha, invalidImageDigest) => {
    expect(() => deploymentIdentity({
      deploymentEnvironment: "stage",
      deploymentGitSha: invalidGitSha,
      deploymentImageDigest: invalidImageDigest
    })).toThrow(expect.objectContaining({ statusCode: 503 }))
  })

  test("rejects invalid identity in production", () => {
    expect(() => deploymentIdentity({
      deploymentEnvironment: "production",
      deploymentGitSha: "",
      deploymentImageDigest: ""
    })).toThrow(expect.objectContaining({ statusCode: 503 }))
  })

  test.each([undefined, "", "prodution"])(
    "rejects unknown deployment environment %s instead of guessing production",
    (deploymentEnvironment) => {
      expect(() => deploymentIdentity({
        deploymentEnvironment,
        deploymentGitSha: gitSha,
        deploymentImageDigest: imageDigest
      })).toThrow(expect.objectContaining({ statusCode: 503 }))
    }
  )

  test.each(["stage", "production"])("rejects zero sentinels in %s", (environment) => {
    expect(() => deploymentIdentity({
      deploymentEnvironment: environment,
      deploymentGitSha: "0".repeat(40),
      deploymentImageDigest: `sha256:${"0".repeat(64)}`
    })).toThrow(expect.objectContaining({ statusCode: 503 }))
  })

  test("uses all-zero sentinels for invalid development identity", () => {
    expect(deploymentIdentity({
      deploymentEnvironment: "development",
      deploymentGitSha: "not-a-sha",
      deploymentImageDigest: "lb-frontend:latest"
    })).toEqual({
      schema_version: "lb.frontend.deployment.v1",
      environment: "development",
      git_sha: "0".repeat(40),
      image_digest: `sha256:${"0".repeat(64)}`
    })
  })
})
