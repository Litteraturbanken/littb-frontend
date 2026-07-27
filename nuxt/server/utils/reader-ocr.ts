import { parseHTML } from "linkedom"

import type { ReaderOcrOverlay } from "../../shared/types/reader"
import { issueReaderOcrHtml } from "../../shared/utils/renderable-html"
import { hasC0OrC1Control } from "../../shared/utils/text-safety"

const maximumOverlayLength = 512 * 1024
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

interface OverlayElement {
  attributes: ArrayLike<{ name: string, value: string }>
  getAttribute: (name: string) => string | null
  outerHTML: string
  querySelectorAll: (selector: string) => ArrayLike<OverlayElement>
  remove: () => void
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
  tagName: string
}

function sanitizeStyle(value: string): string {
  const declarations: string[] = []
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":")
    if (separator < 1) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const candidate = declaration.slice(separator + 1).trim().toLowerCase()
    if (!allowedStyleProperties.has(property)) continue

    const keywords: Record<string, ReadonlySet<string>> = {
      display: new Set(["block", "inline", "inline-block"]),
      position: new Set(["absolute", "relative"]),
      "white-space": new Set(["normal", "nowrap"])
    }
    if (keywords[property]?.has(candidate)) {
      declarations.push(`${property}: ${candidate}`)
      continue
    }

    const numeric = candidate.match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/u)
    if (!numeric) continue
    const amount = Number(numeric[1])
    if (!Number.isFinite(amount) || Math.abs(amount) > 10_000) continue
    if (["font-size", "height", "line-height", "width"].includes(property) && amount < 0) {
      continue
    }
    declarations.push(`${property}: ${candidate}`)
  }
  return declarations.join("; ")
}

function sanitizeOverlayElement(element: OverlayElement, root: boolean): void {
  if (!allowedOverlayTags.has(element.tagName)) {
    element.remove()
    return
  }

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value
    if (name === "class") {
      const classes = value.split(/\s+/u).filter(token => allowedOverlayClasses.has(token))
      if (classes.length > 0) element.setAttribute(name, [...new Set(classes)].join(" "))
      else element.removeAttribute(name)
      continue
    }
    if (name === "title") {
      if (value.length > 2_000 || hasC0OrC1Control(value)) {
        element.removeAttribute(name)
      }
      continue
    }
    if (!root && name === "id" && /^[A-Za-z0-9_-]{1,100}$/u.test(value)) {
      continue
    }
    if (name === "style") {
      const style = sanitizeStyle(value)
      if (style) element.setAttribute(name, style)
      else element.removeAttribute(name)
      continue
    }
    if (root && name === "data-size") continue
    element.removeAttribute(name)
  }
}

export function parseReaderOcrOverlay(source: string): ReaderOcrOverlay | null {
  if (source.length === 0 || source.length > maximumOverlayLength) return null

  try {
    const { document } = parseHTML(`<html><body>${source}</body></html>`) as unknown as {
      document: { querySelector: (selector: string) => OverlayElement | null }
    }
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

export async function fetchReaderOcrOverlay(
  base: string,
  workId: string,
  pageIndex: number
): Promise<ReaderOcrOverlay | null> {
  const filename = String(pageIndex).padStart(5, "0")
  try {
    const source = await $fetch<string>(
      `${base}/txt/${encodeURIComponent(workId)}/ocr_${filename}.html`,
      { responseType: "text", retry: 0 }
    )
    return parseReaderOcrOverlay(source)
  } catch {
    return null
  }
}
