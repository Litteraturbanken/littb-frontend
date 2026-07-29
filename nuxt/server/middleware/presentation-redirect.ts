import { validatePresentationSegments } from "../../app/lib/presentation-routes"

const folders = {
  s: "specialomraden",
  v: "vandringar"
} as const

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const match = /^\/p\/(s|v)\/([^/]+)$/.exec(url.pathname)
  if (!match) return

  const alias = match[1] as keyof typeof folders
  const document = match[2]
  const folder = folders[alias]
  if (!validatePresentationSegments([folder, document])) return

  return sendRedirect(
    event,
    `/presentationer/${folder}/${document}${url.search}`,
    308
  )
})
