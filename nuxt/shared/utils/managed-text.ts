export type ManagedTextRules = Readonly<{
  authorityOrigin: string
  allowedPathPrefixes: readonly string[]
  allowedContentTypes: readonly string[]
  maximumBytes: number
}>

function responseMediaType(response: Response): string {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

function declaredByteLength(response: Response): number | null {
  const value = response.headers.get("content-length")
  if (value === null) return null
  if (!/^\d+$/.test(value)) throw new Error("Managed text has an invalid declared length")
  const bytes = Number(value)
  if (!Number.isSafeInteger(bytes)) {
    throw new Error("Managed text has an invalid declared length")
  }
  return bytes
}

function rawAbsolutePathname(value: string): string | null {
  const schemeSeparator = value.indexOf("://")
  if (schemeSeparator <= 0) return null
  const authorityStart = schemeSeparator + 3
  const delimiters = ["/", "?", "#"]
    .map(delimiter => value.indexOf(delimiter, authorityStart))
    .filter(index => index >= 0)
  const authorityEnd = delimiters.length === 0 ? value.length : Math.min(...delimiters)
  if (value[authorityEnd] !== "/") return "/"
  const queryIndex = value.indexOf("?", authorityEnd)
  const fragmentIndex = value.indexOf("#", authorityEnd)
  const pathEnds = [queryIndex, fragmentIndex].filter(index => index >= 0)
  const pathEnd = pathEnds.length === 0 ? value.length : Math.min(...pathEnds)
  return value.slice(authorityEnd, pathEnd)
}

function hasUnsafeEncodedPath(rawPathname: string): boolean {
  if (/%(?:2f|5c)/i.test(rawPathname)) return true
  return rawPathname.split("/").some(segment => (
    /%2e/i.test(segment) && /^(?:\.|%2e){1,2}$/i.test(segment)
  ))
}

function pathMatchesPrefix(pathname: string, rawPrefix: string): boolean {
  if (!rawPrefix.startsWith("/")) return false
  const prefix = rawPrefix === "/" ? "/" : rawPrefix.replace(/\/+$/, "")
  if (!prefix) return false
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`)
}

async function rejectUnreadBody(response: Response, error: unknown): Promise<never> {
  try {
    await response.body?.cancel(error)
  } catch {
    // Cancellation is best effort and must not replace the validation failure.
  }
  throw error
}

async function boundedResponseBytes(response: Response, maximumBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maximumBytes) {
      await reader.cancel().catch(() => undefined)
      throw new Error("Managed text exceeds byte limit")
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function fetchManagedText(
  url: string,
  rules: ManagedTextRules,
  fetcher: typeof fetch = fetch
): Promise<string> {
  const response = await fetcher(url, { redirect: "follow" })
  let finalUrl: URL
  try {
    finalUrl = new URL(response.url)
  } catch (error) {
    return rejectUnreadBody(response, error)
  }
  const rawPathname = rawAbsolutePathname(response.url)
  if (rawPathname === null || hasUnsafeEncodedPath(rawPathname)) {
    return rejectUnreadBody(response, new Error("Managed text final path is not allowed"))
  }
  if (finalUrl.username || finalUrl.password) {
    return rejectUnreadBody(
      response,
      new Error("Managed text final URL credentials are not allowed")
    )
  }
  if (finalUrl.origin !== new URL(rules.authorityOrigin).origin) {
    return rejectUnreadBody(response, new Error("Managed text final authority is not allowed"))
  }
  if (!rules.allowedPathPrefixes.some(prefix => pathMatchesPrefix(finalUrl.pathname, prefix))) {
    return rejectUnreadBody(response, new Error("Managed text final path is not allowed"))
  }
  if (!response.ok) {
    return rejectUnreadBody(response, new Error("Managed text request failed"))
  }

  const mediaType = responseMediaType(response)
  if (!rules.allowedContentTypes.some(value => value.toLowerCase() === mediaType)) {
    return rejectUnreadBody(response, new Error("Managed text content type is not allowed"))
  }

  let declaredBytes: number | null
  try {
    declaredBytes = declaredByteLength(response)
  } catch (error) {
    return rejectUnreadBody(response, error)
  }
  if (declaredBytes !== null && declaredBytes > rules.maximumBytes) {
    return rejectUnreadBody(response, new Error("Managed text exceeds byte limit"))
  }
  const bytes = await boundedResponseBytes(response, rules.maximumBytes)
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
}
