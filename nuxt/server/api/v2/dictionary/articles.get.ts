import { getRequestURL, proxyRequest } from "h3"

export default defineEventHandler(event => {
  const apiBase = useRuntimeConfig(event).apiBase.replace(/\/$/u, "")
  const target = `${apiBase}/dictionary/articles${getRequestURL(event).search}`
  return proxyRequest(event, target)
})
