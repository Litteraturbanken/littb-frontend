import {
  assertMethod,
  createError,
  getRequestURL,
  proxyRequest,
  type H3Event
} from "h3"

function invalidBackendPath(): never {
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid backend path"
  })
}

export function safeBackendPath(value: string | undefined): string {
  if (!value) invalidBackendPath()

  const segments = value.split("/")
  if (
    segments.some(segment => !segment || segment === "." || segment === "..")
    || value.includes("\\")
    || [...value].some(character => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127
    })
  ) {
    invalidBackendPath()
  }

  return segments.map(encodeURIComponent).join("/")
}

export async function proxyBackendRequest(
  event: H3Event,
  base: string,
  path: string | undefined
): Promise<unknown> {
  assertMethod(event, ["GET", "HEAD", "POST"])
  const safePath = safeBackendPath(path)
  const target = `${base.replace(/\/$/u, "")}/${safePath}${getRequestURL(event).search}`
  return await proxyRequest(event, target)
}
