import type { components } from "~/lib/api/generated/lbapi"
import { hasC0OrC1Control, hasLoneSurrogate } from "#shared/utils/text-safety"
import {
  authorProfilePath,
  safeAuthorPortraitAssetUrl,
  safeAuthorSearchHref,
  safeHttpUrl
} from "./author-profile"
import {
  canonicalNuxtHref,
  isNuxtInternalHref,
  safeNativeHref,
  validRouteSegment
} from "./internal-navigation"

export type AuthorWorksResponse = components["schemas"]["AuthorWorksResponse"]
export type AuthorWork = components["schemas"]["AuthorWork"]
export type AuthorWorkAction = AuthorWork["actions"][number]

const authoredSections = [
  { kind: "main", label: "Tillgängliga verk", showAuthor: false },
  {
    kind: "part",
    label: "Dikter, noveller, essäer, etc. som ingår i andra verk",
    showAuthor: false
  },
  { kind: "photographer", label: "Som fotograf", showAuthor: true },
  { kind: "illustrator", label: "Som illustratör", showAuthor: true },
  { kind: "editor", label: "Som utgivare", showAuthor: true },
  { kind: "translator", label: "Som översättare", showAuthor: true }
] as const
const aboutSections = [
  { kind: "about", label: (name: string) => `Verk om ${name}` },
  { kind: "about_part", label: (name: string) => `Kortare texter om ${name}` },
  { kind: "about_editor", label: () => "Som utgivare" },
  { kind: "about_translator", label: () => "Som översättare" }
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

type SafeRootHref = {
  decodedPath: string
  decodedQuery: string
  hasFragment: boolean
}

function rawHrefParts(value: string): {
  rawPath: string
  rawQuery: string
  hasQuery: boolean
  rawFragment: string
  hasFragment: boolean
} {
  const fragmentIndex = value.indexOf("#")
  const withoutFragment = fragmentIndex === -1 ? value : value.slice(0, fragmentIndex)
  const queryIndex = withoutFragment.indexOf("?")
  return {
    rawPath: queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex),
    rawQuery: queryIndex === -1 ? "" : withoutFragment.slice(queryIndex + 1),
    hasQuery: queryIndex !== -1,
    rawFragment: fragmentIndex === -1 ? "" : value.slice(fragmentIndex + 1),
    hasFragment: fragmentIndex !== -1
  }
}

function fullyDecodedHref(value: string): string | null {
  let decoded = value
  for (let depth = 0; depth < 16; depth += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      return null
    }
    if (hasC0OrC1Control(next) || hasLoneSurrogate(next) || next.includes("\\")) return null
    if (next === decoded) return decoded
    decoded = next
  }
  return null
}

function safeRootHref(value: string): SafeRootHref | null {
  if (value.length > 2_000 || safeNativeHref(value) !== value || !value.startsWith("/")) return null
  const { rawPath, rawQuery, rawFragment, hasQuery, hasFragment } = rawHrefParts(value)
  const decodedPath = fullyDecodedHref(rawPath)
  const decodedQueryValue = fullyDecodedHref(rawQuery)
  const decodedFragment = fullyDecodedHref(rawFragment)
  if (decodedPath === null || decodedQueryValue === null || decodedFragment === null
    || decodedPath.startsWith("//")) return null
  if (decodedPath.split("/").some(segment => segment === "." || segment === "..")) return null
  return {
    decodedPath,
    decodedQuery: hasQuery ? `?${decodedQueryValue}` : "",
    hasFragment
  }
}

function isSafeNativeLinkUrl(value: string): boolean {
  if (safeNativeHref(value) !== value) return false
  const decoded = fullyDecodedHref(value)
  if (decoded === null || decoded.startsWith("//")) return false
  const decodedPath = decoded.split(/[?#]/u, 1)[0] ?? ""
  return !decodedPath.split("/").some(segment => segment === "." || segment === "..")
    && safeNativeHref(decoded) === decoded
}

function isSafeHttpUrl(value: string | null): boolean {
  return value === null || safeHttpUrl(value) === value
}

function isSafeSearchUrl(value: string | null, authorId: string): boolean {
  if (value === null || safeAuthorSearchHref(value) === "") return value === null
  const safe = safeRootHref(value)
  if (!safe || safe.hasFragment || (safe.decodedPath !== "/sok" && safe.decodedPath !== "/sök")) {
    return false
  }
  try {
    const params = new URL(value, "https://author-works.invalid").searchParams
    return [...params.keys()].length === 2
      && params.getAll("forfattare").length === 1
      && params.get("forfattare") === authorId
      && params.getAll("avancerad").length === 1
      && params.get("avancerad") === ""
  } catch {
    return false
  }
}

function isSafePersonUrl(url: string, authorId: string): boolean {
  const safe = safeRootHref(url)
  return safe !== null && !safe.decodedQuery && !safe.hasFragment
    && canonicalNuxtHref(url) === authorProfilePath(authorId)
    && isNuxtInternalHref(canonicalNuxtHref(url))
}

function safeReaderActionUrl(value: string, mediaType: string, titlePath: string): boolean {
  const safe = safeRootHref(value)
  if (!safe || safe.decodedQuery || safe.hasFragment) return false
  const match = /^\/författare\/([^/]+)\/titlar\/([^/]+)\/sida\/([^/]+)\/(etext|faksimil)$/u
    .exec(safe.decodedPath)
  if (!match || match[4] !== mediaType || match[2] !== titlePath) return false
  const segments: readonly [string, number][] = [
    [match[1] ?? "", 100],
    [match[2] ?? "", 200],
    [match[3] ?? "", 512]
  ]
  return segments.every(([segment, maximum]) => validRouteSegment(segment, maximum))
    && isNuxtInternalHref(canonicalNuxtHref(value))
}

function hasExactInfoPostQuery(params: URLSearchParams): boolean {
  return [...params.keys()].length === 3
    && params.getAll("om-boken").length === 1
    && params.get("om-boken") === ""
    && params.getAll("authorid").length === 1
    && params.getAll("titlepath").length === 1
}

function safeInfoPostActionUrl(value: string, titlePath: string): boolean {
  const safe = safeRootHref(value)
  if (!safe || safe.hasFragment || safe.decodedPath !== "/dramawebben/pjäser") return false
  try {
    const params = new URL(value, "https://author-works.invalid").searchParams
    const authorId = params.get("authorid") ?? ""
    const actionTitlePath = params.get("titlepath") ?? ""
    return hasExactInfoPostQuery(params)
      && validRouteSegment(authorId, 100)
      && validRouteSegment(actionTitlePath, 200)
      && actionTitlePath === titlePath
  } catch {
    return false
  }
}

function safeDownloadActionUrl(value: string, mediaType: string): boolean {
  const safe = safeRootHref(value)
  if (!safe || safe.decodedQuery || safe.hasFragment) return false
  if (mediaType === "epub") return /^\/txt\/epub\/[^/]+\.epub$/u.test(safe.decodedPath)
  return mediaType === "pdf" && (
    /^\/export\/faksimil\/[^/]+\.pdf$/u.test(safe.decodedPath)
    || (!safe.decodedPath.startsWith("/txt/epub/")
      && /^\/txt\/[^/]+\/[^/]+\.pdf$/u.test(safe.decodedPath))
  )
}

function isLink(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["label", "url"])
    && isString(value.label)
    && isString(value.url)
    && isSafeNativeLinkUrl(value.url)
}

function isPortrait(value: unknown): boolean {
  return value === null || (
    isRecord(value)
    && hasExactKeys(value, ["url", "caption_html"])
    && isString(value.url)
    && safeAuthorPortraitAssetUrl(value.url) === value.url
    && isNullableString(value.caption_html)
  )
}

function isPerson(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["author_id", "name_for_index", "surname", "url"])
    && isString(value.author_id)
    && isString(value.name_for_index)
    && isNullableString(value.surname)
    && isString(value.url)
    && validRouteSegment(value.author_id, 100)
    && isSafePersonUrl(value.url, value.author_id)
}

function isContainingWork(value: unknown): boolean {
  return value === null || (
    isRecord(value)
    && hasExactKeys(value, ["title", "author"])
    && isString(value.title)
    && isPerson(value.author)
  )
}

function isAction(value: unknown, titlePath: string): boolean {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["media_type", "kind", "url", "download_filename"])
    || !isString(value.url)
  ) return false

  if (value.kind === "read") {
    return isSafeReadAction(value, titlePath)
  }
  if (value.kind === "download") {
    return isSafeDownloadAction(value)
  }
  return false
}

function isSafeReadAction(value: Record<string, unknown>, titlePath: string): boolean {
  if (!isString(value.media_type) || !isString(value.url) || value.download_filename !== null) {
    return false
  }
  if (value.media_type === "infopost") return safeInfoPostActionUrl(value.url, titlePath)
  return ["etext", "faksimil"].includes(value.media_type)
    && safeReaderActionUrl(value.url, value.media_type, titlePath)
}

function isSafeDownloadAction(value: Record<string, unknown>): boolean {
  return isString(value.media_type)
    && ["epub", "pdf"].includes(value.media_type)
    && isString(value.url)
    && isString(value.download_filename)
    && value.download_filename.trim().length > 0
    && safeDownloadActionUrl(value.url, value.media_type)
}

function hasWorkIdentity(value: Record<string, unknown>): boolean {
  return isString(value.work_id)
    && isString(value.title_id)
    && isString(value.title_path)
    && isString(value.title)
    && isString(value.title_url)
}

function hasWorkLabels(value: Record<string, unknown>): boolean {
  return isNullableString(value.short_title)
    && isNullableString(value.title_tooltip)
    && isNullableString(value.imprint_year)
}

function displayAuthorIsValid(value: unknown, required: boolean): boolean {
  return required ? isPerson(value) : value === null || isPerson(value)
}

function isWork(value: unknown, requireDisplayAuthor: boolean): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    "work_id",
    "title_id",
    "title_path",
    "title",
    "short_title",
    "title_tooltip",
    "title_url",
    "imprint_year",
    "display_author",
    "containing_work",
    "actions"
  ])) return false
  if (!Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 5) {
    return false
  }
  if (!(hasWorkIdentity(value)
    && hasWorkLabels(value)
    && displayAuthorIsValid(value.display_author, requireDisplayAuthor)
    && isContainingWork(value.containing_work)
  )) return false
  if (!value.actions.every(action => isAction(action, value.title_path as string))) return false
  const actions = value.actions as Array<{ kind: string, media_type: string, url: string }>
  return actions.some(action => (
    ((action.kind === "download" || action.media_type === "infopost")
      && action.url === value.title_url)
    || (action.kind === "read" && action.media_type !== "infopost"
      && `${action.url}?om-boken` === value.title_url)
  ))
}

function isSection(
  value: unknown,
  expectedKind: string,
  expectedLabel: string,
  expectedShowAuthor: boolean
): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["kind", "label", "show_author", "items"])
    && value.kind === expectedKind
    && value.label === expectedLabel
    && value.show_author === expectedShowAuthor
    && Array.isArray(value.items)
    && value.items.every(item => isWork(item, expectedShowAuthor))
}

function hasShellIdentity(value: Record<string, unknown>): boolean {
  return isString(value.author_id)
    && isString(value.full_name)
    && isNullableString(value.birth_year)
    && isNullableString(value.death_year)
}

function hasShellLinks(value: Record<string, unknown>): boolean {
  return isNullableString(value.search_url)
    && isSafeSearchUrl(value.search_url, value.author_id as string)
    && isNullableString(value.audio_url)
    && isSafeHttpUrl(value.audio_url)
    && isNullableString(value.map_url)
    && isSafeHttpUrl(value.map_url)
}

function hasShellCollections(value: Record<string, unknown>): boolean {
  return Array.isArray(value.related_links)
    && value.related_links.every(isLink)
    && Array.isArray(value.encyclopedia_links)
    && value.encyclopedia_links.every(isLink)
}

function isShell(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
      "author_id",
      "full_name",
      "birth_year",
      "death_year",
      "has_introduction",
      "has_dramawebben",
      "search_url",
      "audio_url",
      "map_url",
      "portrait",
      "related_links",
      "encyclopedia_links"
    ])) return false
  return hasShellIdentity(value)
    && typeof value.has_introduction === "boolean"
    && typeof value.has_dramawebben === "boolean"
    && hasShellLinks(value)
    && isPortrait(value.portrait)
    && hasShellCollections(value)
}

export function isAuthorWorksResponse(value: unknown): value is AuthorWorksResponse {
  if (!isRecord(value) || !hasExactKeys(value, [
    "author",
    "authored_sections",
    "about_sections"
  ])) return false
  if (!isShell(value.author)) return false
  const authorName = (value.author as { full_name: string }).full_name
  return Array.isArray(value.authored_sections)
    && value.authored_sections.length === authoredSections.length
    && value.authored_sections.every((section, index) => (
      isSection(
        section,
        authoredSections[index]!.kind,
        authoredSections[index]!.label,
        authoredSections[index]!.showAuthor
      )
    ))
    && Array.isArray(value.about_sections)
    && value.about_sections.length === aboutSections.length
    && value.about_sections.every((section, index) => (
      isSection(
        section,
        aboutSections[index]!.kind,
        aboutSections[index]!.label(authorName),
        true
      )
    ))
}

const actionOrder: Record<AuthorWorkAction["media_type"], number> = {
  etext: 0,
  faksimil: 1,
  infopost: 2,
  epub: 3,
  pdf: 4
}

export function orderedAuthorWorkActions(
  actions: readonly AuthorWorkAction[]
): AuthorWorkAction[] {
  return [...actions].sort((left, right) => (
    actionOrder[left.media_type] - actionOrder[right.media_type]
  ))
}

export function hasAuthorWorksAboutContent(response: AuthorWorksResponse): boolean {
  return response.about_sections.some(section => section.items.length > 0)
}

export function isInfopostTitle(work: AuthorWork): boolean {
  return work.actions.some(action => (
    action.kind === "read"
    && action.media_type === "infopost"
    && action.url === work.title_url
  ))
}
