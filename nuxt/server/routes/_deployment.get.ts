import { deploymentIdentity } from "#server/utils/deployment-identity"

export default defineEventHandler(event => {
  const config = useRuntimeConfig(event)
  setResponseHeader(event, "cache-control", "no-store")
  return deploymentIdentity({
    deploymentEnvironment: String(config.deploymentEnvironment || ""),
    deploymentGitSha: String(config.deploymentGitSha || ""),
    deploymentImageDigest: String(config.deploymentImageDigest || "")
  })
})
