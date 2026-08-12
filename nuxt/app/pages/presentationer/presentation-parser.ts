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
import parseCss from "postcss/lib/parse"
import { SaxesParser, type SaxesTagNS } from "saxes"

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

type PresentationStyleScope = "background" | "document"

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

function hasAllowedPresentationCssDeclaration(
  scope: PresentationStyleScope,
  property: string,
  value: string
): boolean {
  if (scope === "document") {
    return property === "text-align" && value.trim().toLowerCase() === "center"
  }
  return property === "background-color" && /^#[\da-f]{6}$/iu.test(value.trim())
}

function managedPresentationStyle(
  value: string,
  scope: PresentationStyleScope
): ManagedStyleText<"presentation-editorial"> | null {
  if (value.includes("\\")) return null
  try {
    const stylesheet = parseCss(value)
    let safe = true
    let rules = 0
    stylesheet.walkAtRules(() => { safe = false })
    stylesheet.each(node => {
      if (node.type !== "comment" && node.type !== "rule") safe = false
    })
    stylesheet.walkRules(rule => {
      rules += 1
      const selector = scope === "document" ? "p.image" : "html"
      let declarations = 0
      if (rule.selector.trim() !== selector) safe = false
      rule.each(node => {
        if (
          node.type !== "decl"
          || !hasAllowedPresentationCssDeclaration(scope, node.prop.toLowerCase(), node.value)
        ) safe = false
        else declarations += 1
      })
      if (declarations !== 1) safe = false
    })
    return safe && rules === 1 ? issueManagedPresentationStyle(value) : null
  } catch {
    return null
  }
}

type ParsedBackgroundRule = {
  target: string
  rawImagePath: string | null
  className: string | null
  styleText: string | null
}

function saxAttribute(tag: SaxesTagNS, name: string): string | null {
  return tag.attributes[name]?.value ?? null
}

/**
 * Parses managed background XML with an XML 1.0-conformant event parser on
 * both SSR and the client. DTDs and processing instructions are not part of
 * the reviewed data contract, so they fail closed rather than expanding custom
 * entities or permitting parser-specific document structure.
 */
function parseStrictBackgroundXml(source: string): ParsedBackgroundRule[] | null {
  const parser = new SaxesParser({ xmlns: true, defaultXMLVersion: "1.0" })
  const elementNames: string[] = []
  const parsedRules: ParsedBackgroundRule[] = []
  let activeRule: Omit<ParsedBackgroundRule, "styleText"> & { styleParts: string[] } | null = null
  let styleDepth: number | null = null
  let rootClosed = false
  let valid = true

  parser.on("error", () => { valid = false })
  parser.on("doctype", () => { valid = false })
  parser.on("processinginstruction", () => { valid = false })
  parser.on("opentag", tag => {
    if (!elementNames.length) {
      if (rootClosed || tag.name !== "backgrounds") valid = false
    } else if (elementNames.length === 1 && tag.name === "background") {
      activeRule = {
        target: saxAttribute(tag, "target") ?? "",
        rawImagePath: saxAttribute(tag, "url"),
        className: saxAttribute(tag, "class"),
        styleParts: []
      }
    } else if (activeRule && tag.name === "style") {
      styleDepth = elementNames.length + 1
    }
    elementNames.push(tag.name)
  })
  parser.on("text", text => {
    if (activeRule && styleDepth === elementNames.length) activeRule.styleParts.push(text)
  })
  parser.on("cdata", text => {
    if (activeRule && styleDepth === elementNames.length) activeRule.styleParts.push(text)
  })
  parser.on("closetag", tag => {
    if (elementNames.at(-1) !== tag.name) valid = false
    if (activeRule && tag.name === "style" && styleDepth === elementNames.length) styleDepth = null
    if (activeRule && tag.name === "background" && elementNames.length === 2) {
      parsedRules.push({
        target: activeRule.target,
        rawImagePath: activeRule.rawImagePath,
        className: activeRule.className,
        styleText: activeRule.styleParts.join("").trim() || null
      })
      activeRule = null
    }
    elementNames.pop()
    if (!elementNames.length && tag.name === "backgrounds") rootClosed = true
  })

  try {
    parser.write(source).close()
  } catch {
    return null
  }
  return valid && rootClosed && !elementNames.length ? parsedRules : null
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
            const textContent = managedPresentationStyle(node.textContent ?? "", "document")
            return textContent === null ? [] : [{
              kind: "inline",
              textContent
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
  if (!source.trim()) return []
  const parsedRules = parseStrictBackgroundXml(source)
  if (!parsedRules) return []
  return parsedRules.map(rule => ({
    target: rule.target,
    imagePath: rule.rawImagePath === null ? null : normalizedBackgroundImagePath(rule.rawImagePath),
    className: rule.className,
    styleText: rule.styleText === null
      ? null
      : managedPresentationStyle(rule.styleText, "background")
  })).filter(rule => rule.target.startsWith("/presentationer/"))
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
