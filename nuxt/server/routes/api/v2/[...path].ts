import { getRouterParam } from "h3"

import { proxyBackendRequest } from "../../../utils/backend-proxy"

export default defineEventHandler((event) => {
  const path = getRouterParam(event, "path", { decode: true })
  const apiBase = useRuntimeConfig(event).apiBase
  return proxyBackendRequest(event, apiBase, path)
})
