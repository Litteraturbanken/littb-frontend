import { DOMParser } from "linkedom"

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
import { removeC0AndSpace } from "#shared/utils/text-safety"

export { validatePresentationSegments } from "../../lib/presentation-routes"

type ParsedElement = {
  localName: string
  textContent: string | null
  innerHTML: string
  querySelector: (selectors: string) => ParsedElement | null
  querySelectorAll: (selectors: string) => ArrayLike<ParsedElement>
  getAttribute: (name: string) => string | null
  hasAttribute: (name: string) => boolean
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
  remove: () => void
}

type ParsedDocument = {
  documentElement: ParsedElement | null
  querySelector: (selectors: string) => ParsedElement | null
  querySelectorAll: (selectors: string) => ArrayLike<ParsedElement>
}

export type PresentationStyleNode =
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

export function parsePresentationDocument(source: string): PresentationDocument {
  if (!source.trim()) return emptyPresentationDocument()

  try {
    const document = new DOMParser().parseFromString(source, "text/html") as unknown as ParsedDocument
    const body = document.querySelector("body")
    if (!body) return emptyPresentationDocument()

    Array.from(document.querySelectorAll("script")).forEach(script => script.remove())
    Array.from(body.querySelectorAll("[href], [src]")).forEach(element => {
      for (const name of ["href", "src"] as const) {
        if (!element.hasAttribute(name)) continue
        const normalized = normalizedUrl(element.getAttribute(name) ?? "")
        if (normalized === null) element.removeAttribute(name)
        else element.setAttribute(name, normalized)
      }
    })

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
        imagePath: rawImagePath === null ? null : normalizedUrl(rawImagePath),
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
