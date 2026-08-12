import { isSafeHandoffSuffix, rawHandoffTarget } from "../utils/external-handoff"

const LOCAL_PREFIX = "/ljudochbild"
const EXTERNAL_BASE = "https://litteraturbanken.se/ljudochbild/"

export default defineEventHandler(event => {
  if (event.method !== "GET" && event.method !== "HEAD") return

  const target = rawHandoffTarget(event.node.req.url ?? "/")
  if (!target) return
  const { pathname, search } = target

  if (pathname !== LOCAL_PREFIX && !pathname.startsWith(`${LOCAL_PREFIX}/`)) return

  const suffix = pathname === LOCAL_PREFIX
    ? ""
    : pathname.slice(`${LOCAL_PREFIX}/`.length)

  if (!isSafeHandoffSuffix(suffix)) return

  return sendRedirect(event, `${EXTERNAL_BASE}${suffix}${search}`, 302)
})
