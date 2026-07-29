import { assertMethod, getRequestURL, proxyRequest } from "h3"

export default defineEventHandler((event) => {
  assertMethod(event, ["GET", "HEAD", "POST"])
  const libraryApiBase = useRuntimeConfig(event).libraryApiBase.replace(/\/$/u, "")
  const target = `${libraryApiBase}/${getRequestURL(event).search}`
  return proxyRequest(event, target)
})
