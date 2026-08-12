import type {
  ManagedAssetHtml,
  ManagedStyleText,
  ManagedStylesheetHref
} from "#shared/types/renderable-html"
import {
  emptyRenderableHtml,
  issueManagedPresentationHtml,
  issueManagedPresentationStyle,
  issueManagedPresentationStylesheetHref
} from "#shared/utils/renderable-html"
import { hasC0OrC1Control, hasLoneSurrogate, removeC0AndSpace } from "#shared/utils/text-safety"

export { validatePresentationSegments } from "../../lib/presentation-routes"

type ParsedElement = {
  localName: string
  textContent: string | null
  innerHTML: string
  attributes: ArrayLike<{ name: string }>
  querySelector: (selectors: string) => ParsedElement | null
  querySelectorAll: (selectors: string) => ArrayLike<ParsedElement>
  getAttribute: (name: string) => string | null
  hasAttribute: (name: string) => boolean
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
  remove: () => void
}

const maxDecodePasses = 16
const blockedPresentationBodyElements = new Set([
  "applet",
  "audio",
  "base",
  "button",
  "embed",
  "form",
  "frame",
  "frameset",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "noscript",
  "object",
  "option",
  "script",
  "select",
  "source",
  "style",
  "svg",
  "template",
  "textarea",
  "video"
])
const removedPresentationBodyAttributes = new Set([
  "action",
  "archive",
  "attributionsrc",
  "background",
  "cite",
  "codebase",
  "data",
  "dynsrc",
  "formaction",
  "imagesrcset",
  "longdesc",
  "lowsrc",
  "manifest",
  "ping",
  "poster",
  "profile",
  "srcset",
  "style",
  "usemap",
  "xlink:href"
])
const allowedPresentationHrefProtocols = new Set(["http:", "https:", "mailto:", "tel:"])
const xmlNameStart = /[A-Za-z_:]/u
const xmlNamePart = /[A-Za-z0-9_.:-]/u

function isExecutablePresentationAttribute(name: string): boolean {
  return /^(?:on|srcdoc$|v-|data-v-|ng-|data-ng-|x-|data-x-|[@:]|data-bind$)/iu.test(name)
}

type ParsedDocument = {
  documentElement: ParsedElement | null
  querySelector: (selectors: string) => ParsedElement | null
  querySelectorAll: (selectors: string) => ArrayLike<ParsedElement>
}

type PresentationStyleNode =
  | {
    kind: "stylesheet"
    href: ManagedStylesheetHref<"presentation-editorial">
  }
  | {
    kind: "inline"
    textContent: ManagedStyleText<"presentation-editorial">
  }

export type PresentationDocument = {
  bodyHtml: ManagedAssetHtml<"presentation-editorial">
  title: string
  description: string
  styleNodes: PresentationStyleNode[]
}

export type BackgroundRule = {
  target: string
  imagePath: string | null
  className: string | null
  styleText: ManagedStyleText<"presentation-editorial"> | null
}

export function emptyPresentationDocument(): PresentationDocument {
  return {
    bodyHtml: emptyRenderableHtml<ManagedAssetHtml<"presentation-editorial">>(),
    title: "",
    description: "",
    styleNodes: []
  }
}

function hasOnlySafeDecodedHref(value: string): boolean {
  let decoded = value
  try {
    for (let pass = 0; pass < maxDecodePasses; pass += 1) {
      if (hasC0OrC1Control(decoded) || hasLoneSurrogate(decoded) || decoded.includes("\\")) {
        return false
      }
      const next = decodeURIComponent(decoded)
      if (next === decoded) return true
      decoded = next
    }
  } catch {
    return false
  }
  return false
}

function hasUnsafePresentationHrefInput(value: string): boolean {
  return [
    !value,
    hasC0OrC1Control(value),
    hasLoneSurrogate(value),
    value.includes("\\"),
    !hasOnlySafeDecodedHref(value),
    removeC0AndSpace(value) !== value,
    value.startsWith("//")
  ].some(Boolean)
}

function normalizedAbsolutePresentationHref(value: string): string | null {
  try {
    const parsed = new URL(value)
    const isCredentialedWebUrl = ["http:", "https:"].includes(parsed.protocol)
      && Boolean(parsed.username || parsed.password)
    return allowedPresentationHrefProtocols.has(parsed.protocol.toLowerCase())
      && !isCredentialedWebUrl
      ? value
      : null
  } catch {
    return null
  }
}

function normalizedUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed !== value || hasUnsafePresentationHrefInput(trimmed)) return null
  if (/^[a-z][a-z\d+.-]*:/iu.test(trimmed)) return normalizedAbsolutePresentationHref(trimmed)
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed

  try {
    const resolved = new URL(trimmed, "https://presentation.invalid/")
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return null
  }
}

function isXmlName(value: string): boolean {
  return xmlNameStart.test(value[0] ?? "") && [...value.slice(1)].every(character =>
    xmlNamePart.test(character)
  )
}

function isValidXmlEntity(value: string): boolean {
  if (["amp", "apos", "gt", "lt", "quot"].includes(value)) return true
  const numeric = /^#(?:(x)([\da-f]+)|(\d+))$/iu.exec(value)
  if (!numeric) return false
  const codePoint = Number.parseInt(numeric[2] ?? numeric[3] ?? "", numeric[1] ? 16 : 10)
  return Number.isInteger(codePoint)
    && codePoint > 0
    && codePoint <= 0x10ffff
    && (codePoint < 0xd800 || codePoint > 0xdfff)
}

function hasOnlyWellFormedXmlText(value: string): boolean {
  if (hasLoneSurrogate(value)) return false
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (
      (codePoint <= 0x1f && ![0x09, 0x0a, 0x0d].includes(codePoint))
      || (codePoint >= 0x7f && codePoint <= 0x9f)
    ) return false
  }
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "&") continue
    const end = value.indexOf(";", index + 1)
    if (end < 0 || !isValidXmlEntity(value.slice(index + 1, end))) return false
    index = end
  }
  return true
}

function readXmlName(source: string, index: number): { name: string, index: number } | null {
  let end = index
  while (xmlNamePart.test(source[end] ?? "")) end += 1
  const name = source.slice(index, end)
  return isXmlName(name) ? { name, index: end } : null
}

function skipXmlWhitespace(source: string, index: number): number {
  while (/\s/u.test(source[index] ?? "")) index += 1
  return index
}

function readXmlStartTag(
  source: string,
  index: number
): { name: string, index: number, selfClosing: boolean } | null {
  const tag = readXmlName(source, index)
  if (!tag) return null
  const attributes = new Set<string>()
  index = tag.index
  while (index < source.length) {
    index = skipXmlWhitespace(source, index)
    if (source.startsWith("/>", index)) return { name: tag.name, index: index + 2, selfClosing: true }
    if (source[index] === ">") return { name: tag.name, index: index + 1, selfClosing: false }
    const attributeEnd = readXmlAttribute(source, index, attributes)
    if (attributeEnd === null) return null
    index = attributeEnd
  }
  return null
}

function readXmlAttribute(source: string, index: number, attributes: Set<string>): number | null {
  const attribute = readXmlName(source, index)
  if (!attribute || attributes.has(attribute.name)) return null
  attributes.add(attribute.name)
  index = skipXmlWhitespace(source, attribute.index)
  if (source[index] !== "=") return null
  index = skipXmlWhitespace(source, index + 1)
  const quote = source[index]
  if (quote !== '"' && quote !== "'") return null
  const end = source.indexOf(quote, index + 1)
  return end >= 0 && hasOnlyWellFormedXmlText(source.slice(index + 1, end))
    ? end + 1
    : null
}

type XmlValidationState = {
  elements: string[]
  rootName: string | null
}

function readXmlComment(source: string, index: number): number | null {
  const end = source.indexOf("-->", index + 4)
  return end < 0 || source.slice(index + 4, end).includes("--") ? null : end + 3
}

function readXmlCdata(source: string, index: number, hasElement: boolean): number | null {
  const end = source.indexOf("]]>", index + 9)
  return end < 0 || !hasElement ? null : end + 3
}

function readXmlProcessingInstruction(source: string, index: number): number | null {
  const end = source.indexOf("?>", index + 2)
  return end < 0 ? null : end + 2
}

function consumeXmlClosingTag(
  source: string,
  index: number,
  elements: string[]
): number | null {
  const closing = readXmlName(source, index + 2)
  if (!closing) return null
  const end = skipXmlWhitespace(source, closing.index)
  return source[end] === ">" && elements.pop() === closing.name ? end + 1 : null
}

function consumeXmlOpeningTag(
  source: string,
  index: number,
  state: XmlValidationState
): number | null {
  const opening = readXmlStartTag(source, index + 1)
  if (!opening || (!state.elements.length && state.rootName !== null)) return null
  if (!state.elements.length) state.rootName = opening.name
  if (!opening.selfClosing) state.elements.push(opening.name)
  return opening.index
}

function consumeXmlMarkup(source: string, index: number, state: XmlValidationState): number | null {
  if (source.startsWith("<!--", index)) return readXmlComment(source, index)
  if (source.startsWith("<![CDATA[", index)) return readXmlCdata(source, index, Boolean(state.elements.length))
  if (source.startsWith("<?", index)) return readXmlProcessingInstruction(source, index)
  if (source.startsWith("<!", index)) return null
  if (source.startsWith("</", index)) return consumeXmlClosingTag(source, index, state.elements)
  return consumeXmlOpeningTag(source, index, state)
}

/**
 * This validates the XML grammar required by managed background files before
 * Linkedom reads it. DTDs are deliberately unsupported, so only XML's five
 * predefined entities and numeric references are accepted; reviewed files do
 * not use a DTD. The narrow scanner avoids shipping a second XML parser while
 * preventing Linkedom's recovery parser from inventing missing close tags.
 */
function isStrictBackgroundXml(source: string): boolean {
  const state: XmlValidationState = { elements: [], rootName: null }
  let index = source.startsWith("\uFEFF") ? 1 : 0

  while (index < source.length) {
    const markup = source.indexOf("<", index)
    const text = source.slice(index, markup < 0 ? source.length : markup)
    if (!hasOnlyWellFormedXmlText(text) || (!state.elements.length && text.trim())) return false
    if (markup < 0) break
    const next = consumeXmlMarkup(source, markup, state)
    if (next === null) return false
    index = next
  }
  return state.rootName === "backgrounds" && state.elements.length === 0
}

function hasUnsafeAssetCharacters(value: string): boolean {
  return value.includes("'")
    || value.includes("\\")
    || value.includes("\uFFFD")
    || hasC0OrC1Control(value)
    || hasLoneSurrogate(value)
}

function hasTraversalSegment(pathname: string): boolean {
  return pathname.split("/").some(segment => segment === "." || segment === "..")
}

function safelyDecodedAssetPath(pathname: string): boolean {
  let decodedPath = pathname
  for (let pass = 0; pass < maxDecodePasses; pass += 1) {
    if (hasUnsafeAssetCharacters(decodedPath) || hasTraversalSegment(decodedPath)) return false
    const next = decodeURIComponent(decodedPath)
    if (next === decodedPath) return true
    decodedPath = next
  }
  return false
}

function ownedAssetPath(
  value: string,
  allowedPathPrefix: string
): { normalized: string, pathname: string } | null {
  const base = new URL("https://presentation.invalid")
  const parsed = new URL(value, base)
  const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`
  if (
    parsed.origin !== base.origin
    || normalized !== value
    || !parsed.pathname.startsWith(allowedPathPrefix)
  ) return null
  return { normalized, pathname: parsed.pathname }
}

function normalizedOwnedAssetPath(value: string, allowedPathPrefix: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || hasUnsafeAssetCharacters(value)) return null
  try {
    const ownedPath = ownedAssetPath(value, allowedPathPrefix)
    return ownedPath && safelyDecodedAssetPath(ownedPath.pathname)
      ? ownedPath.normalized
      : null
  } catch {
    return null
  }
}

function normalizedBackgroundImagePath(value: string): string | null {
  return normalizedOwnedAssetPath(value, "/red/bilder/")
}

function normalizedPresentationImageSrc(value: string): string | null {
  return normalizedOwnedAssetPath(value, "/red/presentationer/")
}

function managedStylesheetHref(
  value: string
): ManagedStylesheetHref<"presentation-editorial"> | null {
  const normalized = normalizedUrl(value)
  if (!normalized?.startsWith("/") || normalized.startsWith("//")) return null

  try {
    const base = new URL("https://presentation.invalid")
    const parsed = new URL(normalized, base)
    if (
      parsed.origin !== base.origin
      || `${parsed.pathname}${parsed.search}${parsed.hash}` !== normalized
    ) return null
    return issueManagedPresentationStylesheetHref(normalized)
  } catch {
    return null
  }
}

function firstHeadingMetadata(body: ParsedElement): Pick<PresentationDocument, "title" | "description"> {
  const heading = body.querySelector("h1")?.textContent ?? ""
  if (!heading) return { title: "", description: "" }
  const description = heading.split(" ").slice(0, 5).join(" ")
  return {
    title: `${description} | Litteraturbanken`,
    description
  }
}

function inertPresentationBody(body: ParsedElement): void {
  Array.from(body.querySelectorAll("*")).forEach(element => {
    if (blockedPresentationBodyElements.has(element.localName.toLowerCase())) element.remove()
  })

  Array.from(body.querySelectorAll("*")).forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (
        isExecutablePresentationAttribute(name)
        || removedPresentationBodyAttributes.has(name)
      ) {
        element.removeAttribute(attribute.name)
      }
    }
    if (element.hasAttribute("href")) {
      const normalized = normalizedUrl(element.getAttribute("href") ?? "")
      if (normalized === null) element.removeAttribute("href")
      else element.setAttribute("href", normalized)
    }
    if (!element.hasAttribute("src")) return
    const normalized = element.localName.toLowerCase() === "img"
      ? normalizedPresentationImageSrc(element.getAttribute("src") ?? "")
      : null
    if (normalized === null) element.removeAttribute("src")
    else element.setAttribute("src", normalized)
  })
}

export function parsePresentationDocument(source: string): PresentationDocument {
  if (!source.trim()) return emptyPresentationDocument()

  try {
    const document = new DOMParser().parseFromString(source, "text/html") as unknown as ParsedDocument
    const body = document.querySelector("body")
    if (!body) return emptyPresentationDocument()

    Array.from(document.querySelectorAll("script")).forEach(script => script.remove())
    inertPresentationBody(body)

    const head = document.querySelector("head")
    const styleNodes: PresentationStyleNode[] = head
      ? Array.from(head.querySelectorAll('link[rel~="stylesheet"], style')).flatMap<PresentationStyleNode>(node => {
          if (node.localName === "style") {
            return [{
              kind: "inline",
              textContent: issueManagedPresentationStyle(node.textContent ?? "")
            }]
          }
          const href = managedStylesheetHref(node.getAttribute("href") ?? "")
          return href ? [{ kind: "stylesheet", href }] : []
        })
      : []

    return {
      bodyHtml: issueManagedPresentationHtml(body.innerHTML),
      ...firstHeadingMetadata(body),
      styleNodes
    }
  } catch {
    return emptyPresentationDocument()
  }
}

export function parseBackgroundRules(source: string): BackgroundRule[] {
  if (!source.trim() || !isStrictBackgroundXml(source)) return []

  try {
    const document = new DOMParser().parseFromString(source, "text/xml") as unknown as ParsedDocument
    if (document.documentElement?.localName !== "backgrounds") return []

    return Array.from(document.querySelectorAll("background"), node => {
      const target = node.getAttribute("target") ?? ""
      const rawImagePath = node.getAttribute("url")
      const rawStyleText = node.querySelector("style")?.textContent?.trim() || null
      return {
        target,
        imagePath: rawImagePath === null ? null : normalizedBackgroundImagePath(rawImagePath),
        className: node.getAttribute("class"),
        styleText: rawStyleText === null
          ? null
          : issueManagedPresentationStyle(rawStyleText)
      }
    }).filter(rule => rule.target.startsWith("/presentationer/"))
  } catch {
    return []
  }
}

function wildcardMatches(pattern: string, path: string): boolean {
  if (!pattern.includes("*")) return false
  const expression = pattern
    .split("*")
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return new RegExp(`^${expression}$`).test(path)
}

export function selectBackgroundRule(
  rules: BackgroundRule[],
  path: string
): BackgroundRule | null {
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    if (rules[index]?.target === path) return rules[index] ?? null
  }
  return rules.find(rule => wildcardMatches(rule.target, path)) ?? null
}
