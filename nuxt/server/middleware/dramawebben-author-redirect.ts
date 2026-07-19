const CANONICAL_PATH = "/dramawebben/pj%C3%A4ser"
const LEGACY_DOCUMENT = "författare"

export default defineEventHandler(event => {
  if (event.method !== "GET" && event.method !== "HEAD") return

  const rawUrl = event.node.req.url ?? ""
  const queryAt = rawUrl.indexOf("?")
  const pathname = queryAt < 0 ? rawUrl : rawUrl.slice(0, queryAt)
  const segments = pathname.split("/")
  if (segments.length !== 3 || segments[0] !== "" || segments[1] !== "dramawebben") return

  let document: string
  try {
    document = decodeURIComponent(segments[2]!)
  } catch {
    return
  }
  if (document !== LEGACY_DOCUMENT) return

  const query = new URLSearchParams()
  query.append("visa", LEGACY_DOCUMENT)
  if (queryAt >= 0) {
    const incoming = new URLSearchParams(rawUrl.slice(queryAt + 1))
    for (const [key, value] of incoming) {
      if (key !== "visa") query.append(key, value)
    }
  }

  return sendRedirect(event, `${CANONICAL_PATH}?${query}`, 308)
})
