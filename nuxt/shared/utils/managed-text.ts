export type ManagedTextRules = Readonly<{
  authorityOrigin: string
  allowedPaths?: readonly string[]
  allowedPathPrefixes: readonly string[]
  allowedContentTypes: readonly string[]
  maximumBytes: number
}>

export const maximumHomeEditorialBytes = 8_192
export const maximumAboutEditorialBytes = 32_768
export const maximumPresentationEditorialBytes = 65_536
export const maximumPresentationBackgroundBytes = 2_048

const homeEditorialPath = "/red/om/start/startsida-ny.html"
const aboutEditorialPaths = [
  "/red/om/ide/omlitteraturbanken.html",
  "/red/om/ide/organisation.html",
  "/red/om/rattigheter/rattigheter.html",
  "/red/om/tack.html",
  "/red/om/hjalp/hjalp.html",
  "/red/om/visioner/visioner.html",
  "/red/om/ide/english.html",
  "/red/om/ide/deutsch.html",
  "/red/om/ide/francais.html"
] as const
const presentationIndexPath = "/red/presentationer/presentationerForfattare.html"
const presentationBackgroundPath = "/red/bilder/bakgrundsbilder/backgrounds.xml"

export function managedHomeTextRules(authorityOrigin: string): ManagedTextRules {
  return {
    authorityOrigin,
    allowedPaths: [homeEditorialPath],
    allowedPathPrefixes: [],
    allowedContentTypes: ["text/html"],
    maximumBytes: maximumHomeEditorialBytes
  }
}

export function managedAboutTextRules(authorityOrigin: string): ManagedTextRules {
  return {
    authorityOrigin,
    allowedPaths: aboutEditorialPaths,
    allowedPathPrefixes: [],
    allowedContentTypes: ["text/html"],
    maximumBytes: maximumAboutEditorialBytes
  }
}

export function managedPresentationDocumentTextRules(
  authorityOrigin: string
): ManagedTextRules {
  return {
    authorityOrigin,
    allowedPaths: [presentationIndexPath],
    allowedPathPrefixes: [
      "/red/presentationer/specialomraden/",
      "/red/presentationer/vandringar/"
    ],
    allowedContentTypes: ["text/html"],
    maximumBytes: maximumPresentationEditorialBytes
  }
}

export function managedPresentationBackgroundTextRules(
  authorityOrigin: string
): ManagedTextRules {
  return {
    authorityOrigin,
    allowedPaths: [presentationBackgroundPath],
    allowedPathPrefixes: [],
    allowedContentTypes: ["application/xml"],
    maximumBytes: maximumPresentationBackgroundBytes
  }
}

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

type RawUrlAuthority = Readonly<{
  protocol: string
  suffix: string
}>

function hasUnsafeRawAuthorityCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 0x20 || codePoint === 0x7f || character === "@") return true
  }
  return false
}

function inspectRawUrlAuthority(value: string, errorMessage: string): RawUrlAuthority {
  const error = new Error(errorMessage)
  const scheme = /^([a-z][\d+.a-z-]*):\/\//i.exec(value)
  if (!scheme) throw error

  const authorityStart = scheme[0].length
  const delimiters = ["/", "\\", "?", "#"]
    .map(delimiter => value.indexOf(delimiter, authorityStart))
    .filter(index => index >= 0)
  const authorityEnd = delimiters.length === 0 ? value.length : Math.min(...delimiters)
  const authority = value.slice(authorityStart, authorityEnd)
  if (
    !authority
    || hasUnsafeRawAuthorityCharacter(authority)
    || authority.endsWith(":")
  ) {
    throw error
  }
  return {
    protocol: `${scheme[1]?.toLowerCase()}:`,
    suffix: value.slice(authorityEnd)
  }
}

function rawPathname(suffix: string): string {
  if (suffix[0] !== "/" && suffix[0] !== "\\") return "/"
  const queryIndex = suffix.indexOf("?")
  const fragmentIndex = suffix.indexOf("#")
  const pathEnds = [queryIndex, fragmentIndex].filter(index => index >= 0)
  const pathEnd = pathEnds.length === 0 ? suffix.length : Math.min(...pathEnds)
  return suffix.slice(0, pathEnd)
}

const maximumPathDecodeLayers = 5

function hasMalformedPercentEncoding(value: string): boolean {
  for (let index = value.indexOf("%"); index >= 0; index = value.indexOf("%", index + 1)) {
    if (!/^[\da-f]{2}$/i.test(value.slice(index + 1, index + 3))) return true
  }
  return false
}

function hasUnsafePathSegment(rawSegment: string): boolean {
  let segment = rawSegment
  for (let layer = 0; layer < maximumPathDecodeLayers; layer += 1) {
    if (segment === "." || segment === ".." || /[\\/]/.test(segment)) return true
    if (layer === 0 && hasMalformedPercentEncoding(segment)) return true
    if (!/%[\da-f]{2}/i.test(segment)) return false

    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return true
    }
    if (decoded === segment) return false
    segment = decoded
  }
  if (segment === "." || segment === ".." || /[\\/]/.test(segment)) return true
  return /%[\da-f]{2}/i.test(segment)
}

function hasUnsafeEncodedPath(rawPathname: string): boolean {
  if (rawPathname.startsWith("\\")) return true
  return rawPathname.split("/").some(hasUnsafePathSegment)
}

type ConfiguredAuthority = Readonly<{
  origin: string
  protocol: "http:" | "https:"
}>

function configuredAuthority(value: string): ConfiguredAuthority {
  const error = new Error("Managed text configured authority is not allowed")
  if (value !== value.trim()) throw error
  const rawAuthority = inspectRawUrlAuthority(value, error.message)

  let authority: URL
  try {
    authority = new URL(value)
  } catch {
    throw error
  }
  if (
    !["http:", "https:"].includes(authority.protocol)
    || authority.protocol !== rawAuthority.protocol
    || authority.origin === "null"
    || authority.username
    || authority.password
  ) {
    throw error
  }

  if (rawAuthority.suffix !== "" && rawAuthority.suffix !== "/") throw error
  return {
    origin: authority.origin,
    protocol: authority.protocol as "http:" | "https:"
  }
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
  const authority = configuredAuthority(rules.authorityOrigin)
  const response = await fetcher(url, { redirect: "follow" })
  let rawFinalUrl: RawUrlAuthority | undefined
  let rawFinalError: unknown
  try {
    rawFinalUrl = inspectRawUrlAuthority(response.url, "Managed text final URL is not allowed")
  } catch (error) {
    rawFinalError = error
  }
  let finalUrl: URL
  try {
    finalUrl = new URL(response.url)
  } catch (error) {
    return rejectUnreadBody(response, error)
  }
  if (finalUrl.username || finalUrl.password) {
    return rejectUnreadBody(
      response,
      new Error("Managed text final URL credentials are not allowed")
    )
  }
  if (!rawFinalUrl) {
    return rejectUnreadBody(
      response,
      rawFinalError ?? new Error("Managed text final URL is not allowed")
    )
  }
  if (
    !["http:", "https:"].includes(finalUrl.protocol)
    || finalUrl.protocol !== rawFinalUrl.protocol
  ) {
    return rejectUnreadBody(response, new Error("Managed text final URL is not allowed"))
  }
  if (finalUrl.protocol !== authority.protocol) {
    return rejectUnreadBody(response, new Error("Managed text final protocol is not allowed"))
  }
  if (finalUrl.origin !== authority.origin) {
    return rejectUnreadBody(response, new Error("Managed text final authority is not allowed"))
  }
  const finalRawPathname = rawPathname(rawFinalUrl.suffix)
  if (hasUnsafeEncodedPath(finalRawPathname)) {
    return rejectUnreadBody(response, new Error("Managed text final path is not allowed"))
  }
  if (
    !rules.allowedPaths?.includes(finalUrl.pathname)
    && !rules.allowedPathPrefixes.some(prefix => pathMatchesPrefix(finalUrl.pathname, prefix))
  ) {
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
