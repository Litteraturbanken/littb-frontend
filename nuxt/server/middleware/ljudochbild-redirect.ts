const LOCAL_PREFIX = "/ljudochbild"
const EXTERNAL_BASE = "https://litteraturbanken.se/ljudochbild/"

function isSafeSuffix(suffix: string) {
  return suffix.split("/").every(segment => {
    try {
      const decoded = decodeURIComponent(segment)
      return (
        decoded !== "." &&
        decoded !== ".." &&
        !decoded.includes("/") &&
        !decoded.includes("\\")
      )
    } catch {
      return false
    }
  })
}

export default defineEventHandler(event => {
  if (event.method !== "GET" && event.method !== "HEAD") return

  const requestUrl = getRequestURL(event)
  const pathname = requestUrl.pathname

  if (pathname !== LOCAL_PREFIX && !pathname.startsWith(`${LOCAL_PREFIX}/`)) return

  const suffix = pathname === LOCAL_PREFIX
    ? ""
    : pathname.slice(`${LOCAL_PREFIX}/`.length)

  if (!isSafeSuffix(suffix)) return

  return sendRedirect(event, `${EXTERNAL_BASE}${suffix}${requestUrl.search}`, 302)
})
