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
  const finalUrl = new URL(response.url)
  if (finalUrl.origin !== new URL(rules.authorityOrigin).origin) {
    throw new Error("Managed text final authority is not allowed")
  }
  if (!rules.allowedPathPrefixes.some(prefix => finalUrl.pathname.startsWith(prefix))) {
    throw new Error("Managed text final path is not allowed")
  }
  if (!response.ok) throw new Error("Managed text request failed")

  const mediaType = responseMediaType(response)
  if (!rules.allowedContentTypes.some(value => value.toLowerCase() === mediaType)) {
    throw new Error("Managed text content type is not allowed")
  }

  const declaredBytes = declaredByteLength(response)
  if (declaredBytes !== null && declaredBytes > rules.maximumBytes) {
    throw new Error("Managed text exceeds byte limit")
  }
  const bytes = await boundedResponseBytes(response, rules.maximumBytes)
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
}
