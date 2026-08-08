import type { ManagedAssetHtml } from "#shared/types/renderable-html"
import {
  emptyRenderableHtml,
  issueManagedHomeHtml
} from "#shared/utils/renderable-html"

export type HomeContent = {
  bodyHtml: ManagedAssetHtml<"home-editorial">
  stylesheetPath: string | null
  backgroundImagePath: string | null
  backgroundColor: string | null
}

type SourceRange = {
  start: number
  end: number
}

type StartTag = SourceRange & {
  name: string
  source: string
  attributes: Set<string>
}

const maxCanonicalPathLength = 4096
const maxDecodePasses = 16
const rawTextElements = new Set([
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp"
])

export function emptyHomeContent(): HomeContent {
  return {
    bodyHtml: emptyRenderableHtml<ManagedAssetHtml<"home-editorial">>(),
    stylesheetPath: null,
    backgroundImagePath: null,
    backgroundColor: null
  }
}

function attributeValue(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = tag.match(new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i"
  ))
  return match?.[1] ?? match?.[2] ?? null
}

function isHtmlSpace(character: string | undefined): boolean {
  return character !== undefined && /[\t\n\f\r ]/.test(character)
}

function afterHtmlSpace(source: string, start: number): number {
  let cursor = start
  while (isHtmlSpace(source[cursor])) cursor += 1
  return cursor
}

function tagEnd(source: string, start: number): number | null {
  let quote: "\"" | "'" | null = null
  for (let cursor = start + 1; cursor < source.length; cursor += 1) {
    const character = source[cursor]
    if (quote) {
      if (character === quote) quote = null
    } else if (character === "\"" || character === "'") {
      quote = character
    } else if (character === ">") {
      return cursor + 1
    }
  }
  return null
}

function tagNameAt(source: string, start: number): { end: number; name: string } | null {
  let cursor = start
  if (!/[a-z]/i.test(source[cursor] ?? "")) return null
  while (/[a-z\d:-]/i.test(source[cursor] ?? "")) cursor += 1
  return { end: cursor, name: source.slice(start, cursor).toLowerCase() }
}

function attributeNameAt(
  source: string,
  start: number,
  limit: number
): { end: number; name: string } | null {
  let cursor = start
  while (cursor < limit && !isHtmlSpace(source[cursor])
    && !["/", ">", "="].includes(source[cursor] ?? "")) cursor += 1
  return cursor === start
    ? null
    : { end: cursor, name: source.slice(start, cursor).toLowerCase() }
}

function afterAttributeValue(source: string, start: number, limit: number): number {
  let cursor = afterHtmlSpace(source, start)
  const quote = source[cursor]
  if (quote === "\"" || quote === "'") {
    cursor += 1
    while (cursor < limit && source[cursor] !== quote) cursor += 1
    return source[cursor] === quote ? cursor + 1 : cursor
  }
  while (cursor < limit && !isHtmlSpace(source[cursor])
    && !["/", ">"].includes(source[cursor] ?? "")) cursor += 1
  return cursor
}

function startTagAttributes(source: string, start: number, end: number): Set<string> {
  const attributes = new Set<string>()
  let cursor = start
  const limit = end - 1
  while (cursor < limit) {
    cursor = afterHtmlSpace(source, cursor)
    if (source[cursor] === "/") {
      cursor += 1
      continue
    }
    if (cursor >= limit) break
    const attribute = attributeNameAt(source, cursor, limit)
    if (!attribute) {
      cursor += 1
      continue
    }
    attributes.add(attribute.name)
    cursor = afterHtmlSpace(source, attribute.end)
    if (source[cursor] !== "=") continue
    cursor = afterAttributeValue(source, cursor + 1, limit)
  }
  return attributes
}

function startTagAt(source: string, start: number): StartTag | null {
  const tagName = tagNameAt(source, start + 1)
  if (!tagName) return null
  const end = tagEnd(source, start)
  if (end === null) return null
  return {
    start,
    end,
    name: tagName.name,
    source: source.slice(start, end),
    attributes: startTagAttributes(source, tagName.end, end)
  }
}

function rawTextEnd(source: string, lowerSource: string, tag: StartTag): number {
  if (tag.name === "plaintext") return source.length
  const closing = `</${tag.name}`
  let cursor = tag.end
  while ((cursor = lowerSource.indexOf(closing, cursor)) !== -1) {
    const delimiter = source[cursor + closing.length]
    if (delimiter === ">" || isHtmlSpace(delimiter)) {
      return tagEnd(source, cursor) ?? source.length
    }
    cursor += closing.length
  }
  return source.length
}

function imageElementEnd(source: string, lowerSource: string, tag: StartTag): number {
  const cursor = afterHtmlSpace(source, tag.end)
  if (!lowerSource.startsWith("</img", cursor)) return tag.end
  const delimiter = source[cursor + "</img".length]
  if (delimiter !== ">" && !isHtmlSpace(delimiter)) return tag.end
  return tagEnd(source, cursor) ?? tag.end
}

function scannedTagAt(
  source: string,
  lowerSource: string,
  opening: number
): { next: number; tag: StartTag | null } {
  if (source.startsWith("<!--", opening)) {
    const commentEnd = source.indexOf("-->", opening + 4)
    return { next: commentEnd === -1 ? source.length : commentEnd + 3, tag: null }
  }
  if (["!", "?", "/"].includes(source[opening + 1] ?? "")) {
    return { next: tagEnd(source, opening) ?? source.length, tag: null }
  }
  const tag = startTagAt(source, opening)
  if (!tag) return { next: opening + 1, tag: null }
  return {
    next: rawTextElements.has(tag.name) ? rawTextEnd(source, lowerSource, tag) : tag.end,
    tag
  }
}

function appendControlTag(
  tags: StartTag[],
  source: string,
  lowerSource: string,
  tag: StartTag | null
): void {
  if (tag?.name === "link" && tag.attributes.has("data-ng-href")) tags.push(tag)
  if (tag?.name === "img" && tag.attributes.has("bkg-img")) {
    tags.push({ ...tag, end: imageElementEnd(source, lowerSource, tag) })
  }
}

function controlTags(source: string): StartTag[] {
  const tags: StartTag[] = []
  const lowerSource = source.toLowerCase()
  let cursor = 0

  while (cursor < source.length) {
    const opening = source.indexOf("<", cursor)
    if (opening === -1) break
    const scanned = scannedTagAt(source, lowerSource, opening)
    appendControlTag(tags, source, lowerSource, scanned.tag)
    cursor = scanned.next
  }
  return tags
}

function fullyDecodedRedPath(value: string): string | null {
  let decoded = value
  try {
    for (let pass = 0; pass < maxDecodePasses; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next.length > maxCanonicalPathLength) return null
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }
  return null
}

function canonicalRedPath(value: string | null): string | null {
  if (
    !value
    || value.length > maxCanonicalPathLength
    || !value.startsWith("/red/")
    || value.includes("\\")
  ) return null

  try {
    const decoded = fullyDecodedRedPath(value)
    if (decoded === null) return null
    if (decoded.includes("\\") || !decoded.startsWith("/red/")) return null
    if (decoded.split("/").some(segment => segment === "." || segment === "..")) return null

    const base = new URL("https://home-content.invalid")
    const parsed = new URL(value, base)
    if (parsed.origin !== base.origin || parsed.pathname !== value) return null
    return value
  } catch {
    return null
  }
}

function stylesheetPath(tag: string): string | null {
  const expression = attributeValue(tag, "data-ng-href")
  const match = expression?.match(
    /^\s*\{\{\s*(['"])(.*?)\?\1\s*\+\s*cacheKiller\(\)\s*\}\}\s*$/
  )
  return canonicalRedPath(match?.[2] ?? null)
}

function backgroundDeclaration(tag: string): {
  imagePath: string | null
  color: string | null
} {
  const imagePath = canonicalRedPath(attributeValue(tag, "src"))
  const colorValue = attributeValue(tag, "color")
  const color = colorValue && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(colorValue)
    ? colorValue
    : null
  return imagePath && color
    ? { imagePath, color }
    : { imagePath: null, color: null }
}

export function parseHomeContent(source: string): HomeContent {
  const output = emptyHomeContent()
  const ranges: SourceRange[] = []

  for (const tag of controlTags(source)) {
    ranges.push({ start: tag.start, end: tag.end })
    if (tag.name === "link") output.stylesheetPath ??= stylesheetPath(tag.source)
    if (tag.name === "img" && !output.backgroundImagePath && !output.backgroundColor) {
      const background = backgroundDeclaration(tag.source)
      output.backgroundImagePath = background.imagePath
      output.backgroundColor = background.color
    }
  }

  output.bodyHtml = issueManagedHomeHtml(
    ranges
      .sort((left, right) => right.start - left.start)
      .reduce(
        (body, range) => `${body.slice(0, range.start)}${body.slice(range.end)}`,
        source
      )
  )
  return output
}
