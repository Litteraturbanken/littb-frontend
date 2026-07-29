import { defineEventHandler } from "h3"

import { handleObservabilityIntake } from "../../utils/observability-intake"

export default defineEventHandler(event => {
  const config = useRuntimeConfig(event)
  return handleObservabilityIntake(event, {
    apiBase: String(config.apiBase),
    allowedOrigins: String(config.observabilityAllowedOrigins || ""),
    hmacSecret: String(config.observabilityHmacSecret || ""),
    hmacSecretFile: String(config.observabilityHmacSecretFile || "")
  })
})
