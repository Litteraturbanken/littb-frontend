import { proxyBackendRootRequest } from "../../utils/backend-proxy"

export default defineEventHandler((event) => {
  const libraryApiBase = useRuntimeConfig(event).libraryApiBase
  return proxyBackendRootRequest(event, libraryApiBase)
})
