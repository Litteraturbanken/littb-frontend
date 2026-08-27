import { hasC0OrC1Control, hasEcmaWhitespace } from "#shared/utils/text-safety"

export type ReaderDictionaryMode = "embed" | "legacy"
type ReaderDictionary = "so" | "saob"
type ReaderLookupEvent = "ready" | "result" | "empty" | "error" | "close"

export type ReaderLookupMessage = {
  type: "svenska-reader-lookup"
  version: 1
  requestId: string
  event: ReaderLookupEvent
  dictionaries?: ReaderDictionary[]
  selectedDictionary?: ReaderDictionary
}

type OriginOptions = {
  allowLocalHttp?: boolean
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"])
const readerLookupEvents = new Set<ReaderLookupEvent>([
  "ready",
  "result",
  "empty",
  "error",
  "close"
])
const messageKeys = new Set(["type", "version", "requestId", "event"])
const resultMessageKeys = new Set([...messageKeys, "dictionaries", "selectedDictionary"])

export function readerDictionaryMode(value: unknown): ReaderDictionaryMode {
  return value === "embed" ? "embed" : "legacy"
}

export function svenskaReaderEmbedOrigin(
  value: unknown,
  options: OriginOptions = {}
): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    const isHttps = url.protocol === "https:"
    const isLocalHttp = options.allowLocalHttp === true
      && url.protocol === "http:"
      && localHosts.has(url.hostname)
    const isExactOrigin = value === url.origin || value === `${url.origin}/`
    return (isHttps || isLocalHttp) && isExactOrigin ? url.origin : null
  } catch {
    return null
  }
}

function readerLookupWord(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed
    && trimmed.length <= 100
    && !hasEcmaWhitespace(trimmed)
    && !hasC0OrC1Control(trimmed)
    ? trimmed
    : null
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value)
}

function isReaderLookupEvent(value: unknown): value is ReaderLookupEvent {
  return typeof value === "string"
    && readerLookupEvents.has(value as ReaderLookupEvent)
}

export function buildReaderDictionaryEmbedUrl(options: {
  origin: string
  requestId: string
  word: string
  allowLocalHttp?: boolean
}): string | null {
  const origin = svenskaReaderEmbedOrigin(options.origin, {
    allowLocalHttp: options.allowLocalHttp
  })
  const word = readerLookupWord(options.word)
  if (!origin || !validRequestId(options.requestId) || !word) return null

  const url = new URL("/embed/reader", origin)
  url.searchParams.set("word", word)
  url.searchParams.set("requestId", options.requestId)
  return url.toString()
}

export function buildSvenskaDictionaryUrl(
  configuredOrigin: string,
  wordValue: string,
  options: OriginOptions = {}
): string | null {
  const origin = svenskaReaderEmbedOrigin(configuredOrigin, options)
  const word = readerLookupWord(wordValue)
  if (!origin || !word) return null

  const url = new URL("/", origin)
  url.searchParams.set("q", word)
  url.searchParams.set("activeTab", "alla")
  url.searchParams.set("exactMatch", "true")
  return url.toString()
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => allowed.has(key))
    && Object.keys(value).length === allowed.size
}

function parseDictionaries(value: unknown): ReaderDictionary[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null
  if (!value.every(item => item === "so" || item === "saob")) return null
  if (new Set(value).size !== value.length) return null
  return [...value]
}

function parseMessageBase(value: unknown): {
  event: ReaderLookupEvent
  item: Record<string, unknown>
  requestId: string
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item: Record<string, unknown> = value as Record<string, unknown>
  if (
    item.type !== "svenska-reader-lookup"
    || item.version !== 1
    || !validRequestId(item.requestId)
    || !isReaderLookupEvent(item.event)
  ) return null
  return { event: item.event, item, requestId: item.requestId }
}

function parseResultMessage(
  item: Record<string, unknown>,
  requestId: string
): ReaderLookupMessage | null {
  const dictionaries = parseDictionaries(item.dictionaries)
  const selectedDictionary = item.selectedDictionary
  if (
    !hasOnlyKeys(item, resultMessageKeys)
    || !dictionaries
    || (selectedDictionary !== "so" && selectedDictionary !== "saob")
    || !dictionaries.includes(selectedDictionary)
  ) return null

  return {
    type: "svenska-reader-lookup",
    version: 1,
    requestId,
    event: "result",
    dictionaries,
    selectedDictionary
  }
}

export function parseReaderLookupMessage(value: unknown): ReaderLookupMessage | null {
  const parsed = parseMessageBase(value)
  if (!parsed) return null
  if (parsed.event === "result") {
    return parseResultMessage(parsed.item, parsed.requestId)
  }
  if (!hasOnlyKeys(parsed.item, messageKeys)) return null
  return {
    type: "svenska-reader-lookup",
    version: 1,
    requestId: parsed.requestId,
    event: parsed.event
  }
}
