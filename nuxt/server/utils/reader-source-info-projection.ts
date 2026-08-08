import { parseHTML } from "linkedom"

import type {
  ReaderSourceInfo,
  ReaderSourceInfoAttribution,
  ReaderSourceInfoMediaType,
  ReaderSourceInfoProvenance
} from "../../shared/types/reader-source-info"
import type { SanitizedHtml } from "../../shared/types/renderable-html"
import type {
  ProvenanceDefinition,
  ProvenanceTextDefinition,
  ReaderSourceInfoStaticDefinitions
} from "./reader-source-info-definitions"
import { sanitizeReaderSourceInfoHtml } from "./reader-source-info-sanitizer"
import {
  boundedString,
  exactKeys,
  isReaderSourceRecord,
  optionalString,
  sourceInfoHttpError,
  validSegment,
  type WorkSourceInfoResponse
} from "./reader-source-info-validation"

type SanitizableAttribute = { name: string }
type SanitizableParent = { removeChild: (node: SanitizableNode) => unknown }
type SanitizableNode = {
  nodeType: number
  parentNode: SanitizableParent | null
  childNodes: Iterable<SanitizableNode>
}
type SanitizableElement = SanitizableNode & {
  localName: string
  attributes: Iterable<SanitizableAttribute>
  innerHTML: string
  outerHTML: string
  textContent: string | null
  remove: () => void
  replaceWith: (...nodes: SanitizableNode[]) => void
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => string | null
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
}

interface ParsedDocument {
  querySelectorAll: (selector: string) => Iterable<SanitizableElement>
}

function provenanceTextKey(
  mediaType: ReaderSourceInfoMediaType,
  isPrinted: boolean | null
): keyof ProvenanceTextDefinition | null {
  if (mediaType === "faksimil") return isPrinted ? "faksimilprint" : "faksimilnoprint"
  if (mediaType === "etext" || mediaType === "pdf") return mediaType
  return null
}

export function projectReaderSourceInfoProvenance(
  definitions: Record<string, ProvenanceDefinition>,
  requested: WorkSourceInfoResponse["provenance"],
  mediaType: ReaderSourceInfoMediaType,
  isPrinted: boolean | null
): ReaderSourceInfoProvenance[] {
  const key = provenanceTextKey(mediaType, isPrinted)
  const result: ReaderSourceInfoProvenance[] = []
  requested.forEach(item => {
    const definition = definitions[item.library]
    if (!definition) return
    const textDefinition = item.use_alternate_text && definition.text2
      ? definition.text2
      : definition.text
    const template = key === null ? "" : textDefinition[key]
    if (template === undefined) return
    const signum = item.signum ? ` (${item.signum})` : ""
    result.push({
      fullName: definition.fullname,
      imageUrl: definition.image === null
        ? null
        : `/red/bilder/gemensamt/${encodeURIComponent(definition.image)}`,
      link: definition.link,
      text: template.replaceAll("{{signum}}", signum)
    })
  })
  return result
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function unwrapLicenseText(source: string): string {
  let document: ParsedDocument
  try {
    ({ document } = parseHTML(
      `<!doctype html><html><body>${source}</body></html>`
    ) as unknown as { document: ParsedDocument })
  } catch {
    return sourceInfoHttpError(502)
  }
  const texts = [...document.querySelectorAll("text")]
  if (texts.length !== 1) return sourceInfoHttpError(502)
  return texts[0]!.innerHTML
}

export function projectReaderSourceInfoLicense(
  definitions: Record<string, string>,
  licenseKey: string | null,
  provenance: ReaderSourceInfoProvenance[]
): SanitizedHtml<"reader-source-info"> | null {
  if (licenseKey === null) return null
  const source = definitions[licenseKey]
  if (source === undefined) return null
  const provenanceHtml = provenance.map(item => item.link === null
    ? escapeHtml(item.fullName)
    : `<a href="${escapeHtml(item.link)}">${escapeHtml(item.fullName)}</a>`
  ).join(" – ")
  const interpolated = unwrapLicenseText(source).replaceAll(
    "{{provenance}}",
    provenanceHtml
  )
  return sanitizeReaderSourceInfoHtml(interpolated, "license")
}

function attributionFromAuthor(
  author: WorkSourceInfoResponse["authors"][number]
): ReaderSourceInfoAttribution {
  return {
    authorId: author.author_id,
    fullName: author.full_name,
    surname: author.surname
  }
}

function validateResolvedAttributions(
  value: unknown,
  requestedIds: readonly string[]
): ReaderSourceInfoAttribution[] {
  if (!Array.isArray(value) || value.length > requestedIds.length) {
    return sourceInfoHttpError(502)
  }
  const requested = new Set(requestedIds)
  const seen = new Set<string>()
  return value.map(item => {
    if (!isReaderSourceRecord(item)
      || !exactKeys(item, new Set(["author_id", "full_name", "surname"]))) {
      return sourceInfoHttpError(502)
    }
    if (
      !validSegment(item.author_id, 100)
      || !requested.has(item.author_id)
      || seen.has(item.author_id)
      || !boundedString(item.full_name, 2_000)
      || item.full_name !== item.full_name.trim()
      || !optionalString(item.surname, 2_000)
      || (item.surname !== null && item.surname !== item.surname.trim())
    ) return sourceInfoHttpError(502)
    seen.add(item.author_id)
    return {
      authorId: item.author_id,
      fullName: item.full_name,
      surname: item.surname
    }
  })
}

export async function resolveReaderSourceInfoAttributions(
  source: WorkSourceInfoResponse,
  resolver: (ids: string[]) => Promise<unknown>
): Promise<{
  sourceDescriptionAuthor: ReaderSourceInfoAttribution | null
  workIntroductionAuthor: ReaderSourceInfoAttribution | null
}> {
  const existing = new Map(source.authors.map(author => [
    author.author_id,
    attributionFromAuthor(author)
  ]))
  const requestedIds = [
    source.source_description_author_id,
    source.work_introduction_author_id
  ].filter((id): id is string => id !== null)
  const unresolved = [...new Set(requestedIds.filter(id => !existing.has(id)))]
  let resolved: ReaderSourceInfoAttribution[] = []
  if (unresolved.length > 0) {
    try {
      resolved = validateResolvedAttributions(await resolver(unresolved), unresolved)
    } catch (error) {
      if (typeof error === "object" && error !== null && "statusCode" in error) throw error
      resolved = []
    }
  }
  const byId = new Map([...existing, ...resolved.map(item => [item.authorId, item] as const)])
  const lookup = (id: string | null): ReaderSourceInfoAttribution | null => {
    if (id === null) return null
    return byId.get(id) ?? { authorId: id, fullName: id, surname: null }
  }
  return {
    sourceDescriptionAuthor: lookup(source.source_description_author_id),
    workIntroductionAuthor: lookup(source.work_introduction_author_id)
  }
}

function projectDramawebben(
  source: WorkSourceInfoResponse
): ReaderSourceInfo["dramawebben"] {
  if (source.dramawebben === null) return null
  return {
    hasIntroduction: source.dramawebben.has_introduction,
    facts: source.dramawebben.facts.map(fact => ({ ...fact })),
    rolesHtml: source.dramawebben.roles.map(
      role => sanitizeReaderSourceInfoHtml(role, "inline")
    ),
    historyHtml: source.dramawebben.history_html === null
      ? null
      : sanitizeReaderSourceInfoHtml(source.dramawebben.history_html)
  }
}

export async function buildReaderSourceInfo(
  source: WorkSourceInfoResponse,
  definitions: ReaderSourceInfoStaticDefinitions,
  resolver: (ids: string[]) => Promise<unknown>
): Promise<ReaderSourceInfo> {
  const provenance = projectReaderSourceInfoProvenance(
    definitions.provenance,
    source.provenance,
    source.media_type,
    source.is_printed
  )
  const attribution = await resolveReaderSourceInfoAttributions(source, resolver)
  return {
    workId: source.work_id,
    authorId: source.author_id,
    titlePath: source.title_path,
    mediaType: source.media_type,
    startPage: source.start_page,
    title: source.title,
    shortTitle: source.short_title,
    textType: source.text_type,
    authors: source.authors.map(author => ({
      authorId: author.author_id,
      fullName: author.full_name,
      surname: author.surname,
      role: author.role,
      authorType: author.author_type,
      url: author.url
    })),
    sourceDescriptionHtml: source.source_description_html === null
      ? null
      : sanitizeReaderSourceInfoHtml(source.source_description_html),
    sourceDescriptionAuthor: attribution.sourceDescriptionAuthor,
    workIntroductionHtml: source.work_introduction_html === null
      ? null
      : sanitizeReaderSourceInfoHtml(source.work_introduction_html),
    workIntroductionAuthor: attribution.workIntroductionAuthor,
    imprint: source.imprint,
    urn: source.urn,
    librisId: source.libris_id,
    licenseKey: source.license_key,
    isPrinted: source.is_printed,
    provenance,
    licenseHtml: projectReaderSourceInfoLicense(
      definitions.licenses,
      source.license_key,
      provenance
    ),
    cover: {
      smallUrl: source.cover.small_url,
      largeUrl: source.cover.large_url
    },
    readActions: source.read_actions.map(action => ({
      mediaType: action.media_type,
      label: action.label,
      url: action.url
    })),
    downloadActions: source.download_actions.map(action => ({
      mediaType: action.media_type,
      label: action.label,
      url: action.url,
      filename: action.filename,
      sizeBytes: action.size_bytes
    })),
    errata: source.errata.map(row => ({
      cellsHtml: row.cells_html.map(cell => sanitizeReaderSourceInfoHtml(cell, "inline"))
    })),
    dramawebben: projectDramawebben(source)
  }
}
