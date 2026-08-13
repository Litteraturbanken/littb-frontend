import { proxyBackendRequest } from "../../../../utils/backend-proxy"

export default defineEventHandler(event => {
  const apiBase = useRuntimeConfig(event).apiBase
  return proxyBackendRequest(event, apiBase, "dictionary/articles")
})
