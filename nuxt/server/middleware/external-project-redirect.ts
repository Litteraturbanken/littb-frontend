const EXTERNAL_BASES = new Map([
  [
    "översättarlexikon",
    "https://litteraturbanken.se/%C3%B6vers%C3%A4ttarlexikon/"
  ],
  ["bibliotekariesidor", "https://litteraturbanken.se/bibliotekariesidor/"],
  ["diktensmuseum", "https://litteraturbanken.se/diktensmuseum/"]
])

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

  const rawUrl = event.node.req.url ?? "/"
  const queryStart = rawUrl.indexOf("?")
  const pathname = queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart)
  const search = queryStart === -1 ? "" : rawUrl.slice(queryStart)

  if (!pathname.startsWith("/")) return

  const suffixStart = pathname.indexOf("/", 1)
  const rawProject = suffixStart === -1
    ? pathname.slice(1)
    : pathname.slice(1, suffixStart)

  let project: string
  try {
    project = decodeURIComponent(rawProject)
  } catch {
    return
  }

  const externalBase = EXTERNAL_BASES.get(project)
  if (!externalBase) return

  const suffix = suffixStart === -1 ? "" : pathname.slice(suffixStart + 1)
  if (!isSafeSuffix(suffix)) {
    throw createError({ statusCode: 404, statusMessage: "Page Not Found" })
  }

  return sendRedirect(event, `${externalBase}${suffix}${search}`, 302)
})
