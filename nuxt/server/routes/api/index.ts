import { getRequestURL, proxyRequest } from "h3"

import { assertProxyMethod } from "../../utils/backend-proxy"

export default defineEventHandler((event) => {
  assertProxyMethod(event, ["GET", "HEAD", "POST"])
  const libraryApiBase = useRuntimeConfig(event).libraryApiBase.replace(/\/$/u, "")
  const target = `${libraryApiBase}/${getRequestURL(event).search}`
  return proxyRequest(event, target)
})
