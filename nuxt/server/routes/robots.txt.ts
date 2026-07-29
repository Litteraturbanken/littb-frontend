import { deploymentRobotsPolicy } from "#server/utils/robots-policy"

export default defineEventHandler((event) => {
  const policy = deploymentRobotsPolicy(useRuntimeConfig(event).deploymentEnvironment)
  setResponseHeader(event, "cache-control", "no-store")
  setResponseHeader(event, "content-type", "text/plain; charset=utf-8")
  return policy.body
})
