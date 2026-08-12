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

function normalizedUrl(value: string): string | null {
  const trimmed = value.trim()
  const schemeProbe = removeC0AndSpace(trimmed)
  if (/^(?:javascript|vbscript|data):/i.test(schemeProbe) || trimmed.includes("\\")) {
    return null
  }
  if (!trimmed || /^(?:\/|#|mailto:|tel:|[a-z][a-z\d+.-]*:)/i.test(trimmed)) {
    return trimmed
  }

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
  if (!source.trim()) return []

  try {
    const document = new DOMParser().parseFromString(source, "text/xml") as unknown as ParsedDocument
    if (!document.documentElement) return []

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
