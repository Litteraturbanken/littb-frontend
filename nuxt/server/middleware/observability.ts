import { defineEventHandler } from "h3"

import { initializeRequestObservability } from "../utils/observability"

export default defineEventHandler(event => {
  const config = useRuntimeConfig(event)
  initializeRequestObservability(event, {
    environment: String(config.deploymentEnvironment),
    deploymentGitSha: String(config.deploymentGitSha || process.env.GIT_SHA || "")
  })
})
