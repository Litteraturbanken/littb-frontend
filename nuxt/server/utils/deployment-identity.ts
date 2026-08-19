import { createError } from "h3"

const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u
const IMAGE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u
const ZERO_GIT_SHA = "0".repeat(40)
const ZERO_IMAGE_DIGEST = `sha256:${"0".repeat(64)}`

export interface DeploymentIdentity {
  schema_version: "lb.frontend.deployment.v1"
  environment: "stage" | "production" | "development"
  git_sha: string
  image_digest: string
}

interface DeploymentIdentityConfig {
  deploymentEnvironment: string | undefined
  deploymentGitSha: string | undefined
  deploymentImageDigest: string | undefined
}

function deploymentEnvironment(value: string | undefined): DeploymentIdentity["environment"] {
  if (value === "stage" || value === "staging") return "stage"
  if (value === "development") return "development"
  return "production"
}

export function deploymentIdentity(config: DeploymentIdentityConfig): DeploymentIdentity {
  const environment = deploymentEnvironment(config.deploymentEnvironment)
  const gitShaInput = config.deploymentGitSha || ""
  const imageDigestInput = config.deploymentImageDigest || ""
  const gitSha = GIT_SHA_PATTERN.test(gitShaInput)
    ? gitShaInput
    : ZERO_GIT_SHA
  const imageDigest = IMAGE_DIGEST_PATTERN.test(imageDigestInput)
    ? imageDigestInput
    : ZERO_IMAGE_DIGEST

  if (environment !== "development" && (
    gitSha === ZERO_GIT_SHA || imageDigest === ZERO_IMAGE_DIGEST
  )) {
    throw createError({ statusCode: 503, statusMessage: "Deployment identity unavailable" })
  }

  return {
    schema_version: "lb.frontend.deployment.v1",
    environment,
    git_sha: gitSha,
    image_digest: imageDigest
  }
}
