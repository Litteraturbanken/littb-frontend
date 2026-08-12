import { isSafeHandoffSuffix, rawHandoffTarget } from "../utils/external-handoff"

const EXTERNAL_BASES = new Map([
  [
    "översättarlexikon",
    "https://litteraturbanken.se/%C3%B6vers%C3%A4ttarlexikon/"
  ],
  ["bibliotekariesidor", "https://litteraturbanken.se/bibliotekariesidor/"],
  ["diktensmuseum", "https://litteraturbanken.se/diktensmuseum/"]
])

export default defineEventHandler(event => {
  if (event.method !== "GET" && event.method !== "HEAD") return

  const target = rawHandoffTarget(event.node.req.url ?? "/")
  if (!target) return
  const { pathname, search } = target

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
  if (!isSafeHandoffSuffix(suffix)) {
    throw createError({ statusCode: 404, statusMessage: "Page Not Found" })
  }

  return sendRedirect(event, `${externalBase}${suffix}${search}`, 302)
})
