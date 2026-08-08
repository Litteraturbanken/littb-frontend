import { parseHTML } from "linkedom"

import type { SanitizedHtml } from "../../shared/types/renderable-html"
import { issueReaderSourceInfoHtml } from "../../shared/utils/renderable-html"
import {
  boundedHtmlString,
  encodeReaderSourceSegment,
  invalidSourceInfo,
  safeHttpUrl,
  safeRootUrl,
  safeStaticFilename,
  validPublicHref
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

const allowedClassesByContext = {
  editorial: new Set(["role", "sc"]),
  inline: new Set(["role", "sc"]),
  license: new Set<string>()
} as const

const allowedElements = new Set([
  "a", "abbr", "b", "blockquote", "br", "cite", "code", "div", "em",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li",
  "ol", "p", "pre", "q", "s", "small", "span", "strong", "sub",
  "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u",
  "ul"
])
const inlineAllowedElements = new Set([
  "a", "abbr", "b", "br", "cite", "code", "em", "i", "q", "s",
  "small", "span", "strong", "sub", "sup", "u"
])
const removedSubtrees = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form", "frame",
  "frameset", "iframe", "input", "link", "math", "meta", "noscript",
  "object", "option", "picture", "script", "select", "source", "style",
  "svg", "template", "textarea", "video"
])
const globalAttributes = new Set(["class", "lang", "title"])
const elementAttributes: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "rel", "target"]),
  img: new Set(["alt", "height", "src", "width"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  ol: new Set(["start", "type"]),
  li: new Set(["value"])
}

function sanitizeClasses(
  value: string,
  context: "editorial" | "inline" | "license"
): string | null {
  const classes = value.split(/\s+/u)
    .filter(className => allowedClassesByContext[context].has(className))
  return classes.length === 0 ? null : [...new Set(classes)].join(" ")
}

function sanitizeIntegerAttribute(value: string, minimum: number, maximum: number): string | null {
  if (!/^\d+$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? String(parsed)
    : null
}

function sanitizeClassAttribute(
  element: SanitizableElement,
  context: "editorial" | "inline" | "license"
): void {
  if (!element.hasAttribute("class")) return
  const value = sanitizeClasses(element.getAttribute("class") ?? "", context)
  if (value === null) element.removeAttribute("class")
  else element.setAttribute("class", value)
}

function sanitizeSpanAttributes(element: SanitizableElement): void {
  for (const attributeName of ["colspan", "rowspan"]) {
    if (!element.hasAttribute(attributeName)) continue
    const value = sanitizeIntegerAttribute(element.getAttribute(attributeName) ?? "", 1, 100)
    if (value === null) element.removeAttribute(attributeName)
    else element.setAttribute(attributeName, value)
  }
}

function sanitizeAllowedAttributes(
  element: SanitizableElement,
  name: string,
  context: "editorial" | "inline" | "license"
): void {
  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.name.toLowerCase()
    if (!globalAttributes.has(attributeName)
      && !elementAttributes[name]?.has(attributeName)) {
      element.removeAttribute(attribute.name)
    }
  }
  sanitizeClassAttribute(element, context)
  sanitizeSpanAttributes(element)
}

function sanitizeLink(element: SanitizableElement): void {
  const legacyHref = element.getAttribute("href")
  if (legacyHref?.startsWith("/forfattare/")) {
    element.setAttribute(
      "href",
      `/författare/${legacyHref.slice("/forfattare/".length)}`
    )
  }
  const href = element.getAttribute("href")
  if (href !== null && !validPublicHref(href)) element.removeAttribute("href")
  if (!element.hasAttribute("href")) {
    element.removeAttribute("target")
    element.removeAttribute("rel")
    return
  }
  const sanitizedHref = element.getAttribute("href") ?? ""
  if (safeHttpUrl(sanitizedHref)) {
    element.setAttribute("target", "_blank")
    element.setAttribute("rel", "noopener noreferrer")
  } else {
    element.removeAttribute("target")
    element.removeAttribute("rel")
  }
}

function sanitizeImage(
  element: SanitizableElement,
  context: "editorial" | "inline" | "license"
): void {
  let src = element.getAttribute("src")
  if (src !== null && context === "license" && safeStaticFilename(src)) {
    src = `/red/bilder/gemensamt/${encodeReaderSourceSegment(src)}`
    element.setAttribute("src", src)
  }
  const imageIsSafe = src !== null && safeRootUrl(src)
    && src.startsWith("/red/bilder/gemensamt/")
  if (!imageIsSafe) element.remove()
}

function sanitizeElement(
  element: SanitizableElement,
  context: "editorial" | "inline" | "license"
): void {
  const name = element.localName.toLowerCase()
  if (removedSubtrees.has(name)) {
    element.remove()
    return
  }
  for (const child of [...element.childNodes]) sanitizeNode(child, context)
  const contextElements = context === "inline" ? inlineAllowedElements : allowedElements
  if (!contextElements.has(name)) {
    element.replaceWith(...element.childNodes)
    return
  }

  sanitizeAllowedAttributes(element, name, context)
  if (name === "a") sanitizeLink(element)
  if (name === "img") sanitizeImage(element, context)
}

function sanitizeNode(
  node: SanitizableNode,
  context: "editorial" | "inline" | "license"
): void {
  if (node.nodeType === 7 || node.nodeType === 8) {
    node.parentNode?.removeChild(node)
    return
  }
  if (node.nodeType === 1) sanitizeElement(node as SanitizableElement, context)
}

export function sanitizeReaderSourceInfoHtml(
  source: string,
  context: "editorial" | "inline" | "license" = "editorial"
): SanitizedHtml<"reader-source-info"> {
  if (!boundedHtmlString(source, 200_000, true)) invalidSourceInfo()
  let document: ParsedDocument
  try {
    ({ document } = parseHTML(
      `<!doctype html><html><body>${source}</body></html>`
    ) as unknown as { document: ParsedDocument })
  } catch {
    invalidSourceInfo()
  }
  const bodies = [...document.querySelectorAll("body")]
  if (bodies.length !== 1) invalidSourceInfo()
  const body = bodies[0]!
  for (const child of [...body.childNodes]) sanitizeNode(child, context)
  return issueReaderSourceInfoHtml(body.innerHTML)
}
