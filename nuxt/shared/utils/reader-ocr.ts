import type { ReaderOcrOverlay } from "../types/reader"
import { issueReaderOcrHtml } from "./renderable-html"
import { hasC0OrC1Control } from "./text-safety"

export const maximumReaderOcrBytes = 512 * 1024

const allowedOverlayTags = new Set(["BR", "DIV", "SPAN"])
const allowedOverlayClasses = new Set(["parent", "w"])
const allowedStyleProperties = new Set([
  "bottom",
  "display",
  "font-size",
  "height",
  "left",
  "letter-spacing",
  "line-height",
  "position",
  "right",
  "top",
  "white-space",
  "width"
])
const styleKeywords: Readonly<Record<string, ReadonlySet<string>>> = {
  display: new Set(["block", "inline", "inline-block"]),
  position: new Set(["absolute", "relative"]),
  "white-space": new Set(["normal", "nowrap"])
}
const nonnegativeStyleProperties = new Set(["font-size", "height", "line-height", "width"])

interface OverlayAttribute {
  name: string
  value: string
}

interface OverlayElement {
  attributes: ArrayLike<OverlayAttribute>
  getAttribute: (name: string) => string | null
  outerHTML: string
  querySelectorAll: (selector: string) => ArrayLike<OverlayElement>
  remove: () => void
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
  tagName: string
}

type OverlayDomParser = new () => {
  parseFromString: (source: string, type: string) => {
    querySelector: (selector: string) => OverlayElement | null
  }
}

function canonicalStyleDeclaration(property: string, candidate: string): string | null {
  if (!allowedStyleProperties.has(property)) return null
  if (styleKeywords[property]?.has(candidate)) return `${property}: ${candidate}`
  const numeric = candidate.match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/u)
  if (!numeric) return null
  const amount = Number(numeric[1])
  if (!Number.isFinite(amount) || Math.abs(amount) > 10_000) return null
  if (nonnegativeStyleProperties.has(property) && amount < 0) return null
  return `${property}: ${candidate}`
}

function sanitizeStyle(value: string): string {
  const declarations: string[] = []
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":")
    if (separator < 1) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const candidate = declaration.slice(separator + 1).trim().toLowerCase()
    const sanitized = canonicalStyleDeclaration(property, candidate)
    if (sanitized) declarations.push(sanitized)
  }
  return declarations.join("; ")
}

function sanitizeClassAttribute(element: OverlayElement, value: string): void {
  const classes = value.split(/\s+/u).filter(token => allowedOverlayClasses.has(token))
  if (classes.length > 0) element.setAttribute("class", [...new Set(classes)].join(" "))
  else element.removeAttribute("class")
}

function sanitizeTitleAttribute(element: OverlayElement, value: string): void {
  if (value.length > 2_000 || hasC0OrC1Control(value)) element.removeAttribute("title")
}

function sanitizeStyleAttribute(element: OverlayElement, value: string): void {
  const style = sanitizeStyle(value)
  if (style) element.setAttribute("style", style)
  else element.removeAttribute("style")
}

const overlayAttributeSanitizers: Readonly<Record<
  string,
  (element: OverlayElement, value: string) => void
>> = {
  class: sanitizeClassAttribute,
  style: sanitizeStyleAttribute,
  title: sanitizeTitleAttribute
}

function isPreservedScopedAttribute(root: boolean, name: string, value: string): boolean {
  if (root) return name === "data-size"
  return name === "id" && /^[A-Za-z0-9_-]{1,100}$/u.test(value)
}

function sanitizeOverlayAttribute(
  element: OverlayElement,
  root: boolean,
  attribute: OverlayAttribute
): void {
  const name = attribute.name.toLowerCase()
  const value = attribute.value
  const sanitizer = overlayAttributeSanitizers[name]
  if (sanitizer) {
    sanitizer(element, value)
    return
  }
  if (isPreservedScopedAttribute(root, name, value)) return
  element.removeAttribute(name)
}

function sanitizeOverlayElement(element: OverlayElement, root: boolean): void {
  if (!allowedOverlayTags.has(element.tagName)) {
    element.remove()
    return
  }
  for (const attribute of Array.from(element.attributes)) {
    sanitizeOverlayAttribute(element, root, attribute)
  }
}

export function parseReaderOcrOverlay(source: string): ReaderOcrOverlay | null {
  if (source.length === 0 || source.length > maximumReaderOcrBytes) return null

  try {
    const Parser = (globalThis as { DOMParser?: OverlayDomParser }).DOMParser
    if (!Parser) return null
    const document = new Parser().parseFromString(
      `<html><body>${source}</body></html>`,
      "text/html"
    )
    const root = document.querySelector("body > div")
    const size = root?.getAttribute("data-size")?.match(
      /^(\d{1,5}(?:\.\d{1,10})?)x(\d{1,5}(?:\.\d{1,10})?)$/u
    )
    if (!root || !size) return null

    const width = Number(size[1])
    const height = Number(size[2])
    if (width < 1 || height < 1 || width > 10_000 || height > 10_000) return null

    sanitizeOverlayElement(root, true)
    for (const element of Array.from(root.querySelectorAll("*"))) {
      sanitizeOverlayElement(element, false)
    }
    return { html: issueReaderOcrHtml(root.outerHTML), width, height }
  } catch {
    return null
  }
}
