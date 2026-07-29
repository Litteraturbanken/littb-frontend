import {
  assertMethod,
  createError,
  getRequestURL,
  getRouterParam,
  proxyRequest
} from "h3"

function safeProxyPath(value: string | undefined): string {
  if (
    !value
    || value.includes("\\")
    || value.split("/").some(segment => !segment || segment === "." || segment === "..")
    || [...value].some(character => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127
    })
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid red asset path" })
  }
  return value.split("/").map(encodeURIComponent).join("/")
}

export default defineEventHandler((event) => {
  assertMethod(event, ["GET", "HEAD"])
  const path = safeProxyPath(getRouterParam(event, "path"))
  const contentBase = useRuntimeConfig(event).contentBase.replace(/\/$/u, "")
  const target = `${contentBase}/red/${path}${getRequestURL(event).search}`
  return proxyRequest(event, target)
})
