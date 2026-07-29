import { getRouterParam } from "h3"

import { proxyBackendRequest } from "../../utils/backend-proxy"

export default defineEventHandler((event) => {
  const path = getRouterParam(event, "path", { decode: true })
  const libraryApiBase = useRuntimeConfig(event).libraryApiBase
  return proxyBackendRequest(event, libraryApiBase, path)
})
