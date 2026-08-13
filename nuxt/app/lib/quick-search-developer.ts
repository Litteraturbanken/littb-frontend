import { isEditorRouteIdentity } from "#shared/utils/editor-route-identity"
import { hasC0OrC1Control, hasLoneSurrogate } from "#shared/utils/text-safety"

export type DeveloperJsonValue =
  | null
  | boolean
  | number
  | string
  | DeveloperJsonValue[]
  | { [key: string]: DeveloperJsonValue }

type QuickSearchReaderContext = Readonly<{
  kind: "reader"
  owner: string
  workId: string
  editorWorkId: string | null
  pageIndex: number
  mediaType: "etext" | "faksimil"
  info: DeveloperJsonValue
}>

type QuickSearchAuthorContext = Readonly<{
  kind: "author"
  owner: string
  info: DeveloperJsonValue
}>

export type QuickSearchContext = QuickSearchReaderContext | QuickSearchAuthorContext

export type QuickSearchContextState = { value: QuickSearchContext | null }

export type QuickSearchDeveloperAction = "id" | "info" | "ftp"

export type QuickSearchDeveloperCommand = Readonly<{
  id: string
  label: string
  typeLabel: string
  url: string | null
  action: QuickSearchDeveloperAction | null
}>

type RedFtpBreadcrumb = Readonly<{ label: string, url: string }>
export type RedFtpEntry = Readonly<{
  url: string
  breadcrumbs: RedFtpBreadcrumb[]
}>

const maximumInfoStringLength = 2_000
const maximumInfoArrayLength = 100
const maximumInfoObjectKeys = 100
const maximumInfoDepth = 8
const maximumInfoJsonLength = 65_536
const maximumFtpResponseLength = 65_536
const maximumFtpEntries = 50
const maximumFtpPathLength = 2_048
const safeWorkId = /^lb[A-Za-z0-9._-]{0,97}$/u

function boundedArray(
  value: unknown[],
  depth: number,
  ancestors: ReadonlySet<object>
): DeveloperJsonValue[] {
  const output = value.slice(0, maximumInfoArrayLength)
    .map(item => boundedValue(item, depth + 1, ancestors))
  if (value.length > maximumInfoArrayLength) output.push("[truncated]")
  return output
}

function boundedObject(
  value: object,
  depth: number,
  ancestors: ReadonlySet<object>
): Record<string, DeveloperJsonValue> {
  const record = value as Record<string, unknown>
  const output: Record<string, DeveloperJsonValue> = {}
  const keys = Object.keys(record).sort().slice(0, maximumInfoObjectKeys)
  for (const key of keys) {
    output[key] = boundedValue(record[key], depth + 1, ancestors)
  }
  if (Object.keys(record).length > maximumInfoObjectKeys) output["[truncated]"] = true
  return output
}

function boundedValue(
  value: unknown,
  depth: number,
  ancestors: ReadonlySet<object>
): DeveloperJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value !== "string" || value.length <= maximumInfoStringLength) return value
    return `${value.slice(0, maximumInfoStringLength)}…[truncated]`
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : "[unsupported]"
  if (typeof value !== "object") return "[unsupported]"
  if (ancestors.has(value)) return "[circular]"
  if (depth >= maximumInfoDepth) return "[truncated]"

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)
  return Array.isArray(value)
    ? boundedArray(value, depth, nextAncestors)
    : boundedObject(value, depth, nextAncestors)
}

export function toBoundedDeveloperValue(value: unknown): DeveloperJsonValue {
  const bounded = boundedValue(value, 0, new Set())
  const serialized = JSON.stringify(bounded)
  return serialized.length <= maximumInfoJsonLength
    ? bounded
    : "[truncated: information exceeds 65536 bytes]"
}

export function stableDeveloperJson(value: unknown): string {
  return JSON.stringify(toBoundedDeveloperValue(value), null, 2)
}

export function publishQuickSearchContext(
  state: QuickSearchContextState,
  context: QuickSearchContext
): () => void {
  state.value = context
  return () => {
    if (state.value?.owner === context.owner) state.value = null
  }
}

export function editorDestination(
  workId: string,
  pageIndex: number,
  mediaType: "etext" | "faksimil"
): string | null {
  if (!isEditorRouteIdentity(workId, String(pageIndex), mediaType[0])) return null
  return `/editor/${encodeURIComponent(workId)}/ix/${pageIndex}/${mediaType[0]}`
}

function contextualCommands(context: QuickSearchContext | null): QuickSearchDeveloperCommand[] {
  if (!context) return []
  const output: QuickSearchDeveloperCommand[] = []
  if (context.kind === "reader") {
    output.push({
      id: "developer-id",
      label: "/id",
      typeLabel: "[Red.]",
      url: null,
      action: "id"
    })
    const url = editorDestination(
      context.editorWorkId ?? context.workId,
      context.pageIndex,
      context.mediaType
    )
    if (url) output.push({
      id: "developer-editor",
      label: "/editor",
      typeLabel: "[Red.]",
      url,
      action: null
    })
  }
  output.push({
    id: "developer-info",
    label: "/info",
    typeLabel: "[Red.]",
    url: null,
    action: "info"
  })
  return output
}

export function developerQuickSearchCommands(
  query: string,
  context: QuickSearchContext | null,
  enabled: boolean
): QuickSearchDeveloperCommand[] {
  if (!enabled) return []
  const normalized = query.trim().toLocaleLowerCase("sv-SE")
  const output = contextualCommands(context).filter(command =>
    command.label.toLocaleLowerCase("sv-SE").startsWith(normalized)
  )
  if (safeWorkId.test(query.trim())) {
    const workId = query.trim()
    const editorUrl = editorDestination(workId, 0, "faksimil")
    if (editorUrl) output.push({
      id: `developer-editor-${workId}`,
      label: workId,
      typeLabel: "[Red.] Gå till faksimileditorn",
      url: editorUrl,
      action: null
    })
    output.push({
      id: `developer-ftp-${workId}`,
      label: workId,
      typeLabel: "[Red.] Sök i ftp",
      url: null,
      action: "ftp"
    })
  }
  return output
}

function decodedFtpSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value)
    if (decoded === "."
      || decoded === ".."
      || decoded.includes("/")
      || decoded.includes("\\")
      || hasC0OrC1Control(decoded)
      || hasLoneSurrogate(decoded)) return null
    return decoded
  } catch {
    return null
  }
}

function encodedFtpPath(segments: readonly string[]): string {
  return `//${segments.map(encodeURIComponent).join("/")}`
}

export function isRedFtpQuery(value: unknown): value is string {
  return typeof value === "string" && safeWorkId.test(value)
}

export function parseRedFtpResponse(source: string): RedFtpEntry[] | null {
  if (source.length > maximumFtpResponseLength) return null
  const sourceWithoutLineBreaks = source.replaceAll("\n", "").replaceAll("\r", "")
  if (hasC0OrC1Control(sourceWithoutLineBreaks)) return null
  const lines = source.split(/\r?\n/u).filter(Boolean)
  if (lines.length > maximumFtpEntries) return null

  const entries: RedFtpEntry[] = []
  for (const line of lines) {
    if (line.length > maximumFtpPathLength || !line.startsWith("/mnt/")) return null
    const rawSegments = line.slice(1).split("/")
    const segments = rawSegments.map(decodedFtpSegment)
    if (segments.some(segment => segment === null)) return null
    const safeSegments = segments as string[]
    const url = encodedFtpPath(safeSegments)
    const breadcrumbs = safeSegments.slice(3).map((label, index) => ({
      label,
      url: encodedFtpPath(safeSegments.slice(0, index + 4))
    })).slice(0, -1)
    entries.push({ url, breadcrumbs })
  }
  return entries
}
