import { deploymentRobotsPolicy } from "#server/utils/robots-policy"

export default defineEventHandler((event) => {
  const policy = deploymentRobotsPolicy(useRuntimeConfig(event).deploymentEnvironment)
  if (policy.responseHeader) {
    setResponseHeader(event, "x-robots-tag", policy.responseHeader)
  }
})
