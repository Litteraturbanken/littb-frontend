import {
  boundedHtmlString,
  boundedString,
  isReaderSourceRecord,
  safeHttpUrl,
  safeStaticFilename,
  sourceInfoHttpError
} from "./reader-source-info-validation"

export interface ProvenanceTextDefinition {
  etext?: string
  faksimilprint?: string
  faksimilnoprint?: string
  pdf?: string
}

export interface ProvenanceDefinition {
  fullname: string
  image: string | null
  link: string | null
  text: ProvenanceTextDefinition
  text2?: ProvenanceTextDefinition
}

export interface ReaderSourceInfoStaticDefinitions {
  provenance: Record<string, ProvenanceDefinition>
  licenses: Record<string, string>
}

const MAX_STATIC_BYTES = 1_048_576
const STATIC_MAX_AGE_MS = 300_000

const staticCache = new Map<
  string,
  { expiresAt: number, value: Promise<ReaderSourceInfoStaticDefinitions> }
>()

function validateTextDefinition(value: unknown): ProvenanceTextDefinition {
  const allowed = new Set(["etext", "faksimilnoprint", "faksimilprint", "pdf"])
  if (!isReaderSourceRecord(value)
    || Object.keys(value).length === 0
    || Object.keys(value).some(key => !allowed.has(key))) {
    sourceInfoHttpError(502)
  }
  for (const raw of Object.values(value)) {
    if (!boundedHtmlString(raw, 20_000, true)) sourceInfoHttpError(502)
    validateTemplateTokens(raw, "{{signum}}")
  }
  return value as unknown as ProvenanceTextDefinition
}

function validateTemplateTokens(source: string, allowedToken: string): void {
  const tokens = source.match(/\{\{[^{}]*\}\}/gu) ?? []
  if (tokens.some(token => token !== allowedToken)) sourceInfoHttpError(502)
  const withoutTokens = source.replaceAll(allowedToken, "")
  if (withoutTokens.includes("{{") || withoutTokens.includes("}}")) {
    sourceInfoHttpError(502)
  }
}

function validateProvenanceDefinitions(value: unknown): Record<string, ProvenanceDefinition> {
  if (!isReaderSourceRecord(value) || Object.keys(value).length > 1_000) {
    sourceInfoHttpError(502)
  }
  const output: Record<string, ProvenanceDefinition> = Object.create(null)
  for (const [key, raw] of Object.entries(value)) {
    if (!boundedString(key, 200) || !isReaderSourceRecord(raw)) sourceInfoHttpError(502)
    const allowed = new Set(["fullname", "image", "link", "text", "text2"])
    if (Object.keys(raw).some(field => !allowed.has(field))) sourceInfoHttpError(502)
    if (!Object.hasOwn(raw, "fullname")
      || !Object.hasOwn(raw, "image")
      || !Object.hasOwn(raw, "link")
      || !Object.hasOwn(raw, "text")
      || !boundedString(raw.fullname, 20_000, true)
      || (raw.image !== null
        && !safeStaticFilename(raw.image))
      || (raw.link !== null
        && (typeof raw.link !== "string" || !safeHttpUrl(raw.link)))) {
      sourceInfoHttpError(502)
    }
    output[key] = {
      fullname: raw.fullname,
      image: raw.image as string | null,
      link: raw.link as string | null,
      text: validateTextDefinition(raw.text),
      ...(raw.text2 === undefined
        ? {}
        : { text2: validateTextDefinition(raw.text2) })
    }
  }
  return output
}

function validateLicenseDefinitions(value: unknown): Record<string, string> {
  if (!isReaderSourceRecord(value) || Object.keys(value).length > 1_000) {
    sourceInfoHttpError(502)
  }
  const output: Record<string, string> = Object.create(null)
  for (const [key, raw] of Object.entries(value)) {
    if (!boundedString(key, 200) || !boundedHtmlString(raw, 200_000, true)) {
      sourceInfoHttpError(502)
    }
    validateTemplateTokens(raw, "{{provenance}}")
    output[key] = raw
  }
  return output
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")
  if (
    response.status !== 200
    || contentType === null
    || contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
  ) {
    await response.body?.cancel().catch(() => undefined)
    return sourceInfoHttpError(502)
  }
  const declared = response.headers.get("content-length")
  if (declared !== null && /^\d+$/u.test(declared) && Number(declared) > MAX_STATIC_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    return sourceInfoHttpError(502)
  }
  if (response.body === null) return sourceInfoHttpError(502)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    total += value.byteLength
    if (total > MAX_STATIC_BYTES) {
      await reader.cancel().catch(() => undefined)
      return sourceInfoHttpError(502)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    return sourceInfoHttpError(502)
  }
}

export async function fetchReaderSourceInfoStaticDefinitions(
  contentBase: string,
  fetchImplementation: typeof fetch = fetch
): Promise<ReaderSourceInfoStaticDefinitions> {
  const base = contentBase.replace(/\/$/u, "")
  const paths = [
    "/red/etc/provenance/provenance.json",
    "/red/etc/license/license.json"
  ] as const
  let responses: [Response, Response]
  try {
    responses = await Promise.all(paths.map(path => fetchImplementation(`${base}${path}`, {
      method: "GET",
      redirect: "manual",
      cache: "no-cache",
      headers: { accept: "application/json" }
    }))) as [Response, Response]
  } catch {
    return sourceInfoHttpError(502)
  }
  const [rawProvenance, rawLicenses] = await Promise.all(
    responses.map(response => readBoundedJson(response))
  )
  return {
    provenance: validateProvenanceDefinitions(rawProvenance),
    licenses: validateLicenseDefinitions(rawLicenses)
  }
}

export function clearReaderSourceInfoStaticCache(): void {
  staticCache.clear()
}

export async function loadCachedReaderSourceInfoStaticDefinitions(
  contentBase: string,
  fetchImplementation: typeof fetch = fetch,
  now: number = Date.now()
): Promise<ReaderSourceInfoStaticDefinitions> {
  const key = contentBase.replace(/\/$/u, "")
  const cached = staticCache.get(key)
  if (cached && cached.expiresAt > now) return await cached.value
  const value = fetchReaderSourceInfoStaticDefinitions(key, fetchImplementation)
  staticCache.set(key, { expiresAt: now + STATIC_MAX_AGE_MS, value })
  try {
    return await value
  } catch (error) {
    if (staticCache.get(key)?.value === value) staticCache.delete(key)
    throw error
  }
}
