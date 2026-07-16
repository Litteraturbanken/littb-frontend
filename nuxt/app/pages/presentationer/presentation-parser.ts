import { DOMParser } from "linkedom"

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
  | { kind: "stylesheet"; href: string }
  | { kind: "inline"; textContent: string }

export type PresentationDocument = {
  bodyHtml: string
  title: string
  description: string
  styleNodes: PresentationStyleNode[]
}

export type BackgroundRule = {
  target: string
  imagePath: string | null
  className: string | null
  styleText: string | null
}

const maxPresentationFilenameLength = 512
const maxDecodePasses = 16

export function validatePresentationSegments(value: unknown): boolean {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return true
  if (!Array.isArray(value) || value.length !== 2) return false

  const [folder, filename] = value
  if (folder !== "specialomraden" && folder !== "vandringar") return false
  if (
    typeof filename !== "string" ||
    filename.length > maxPresentationFilenameLength
  ) return false

  let decoded = filename
  let stabilized = false
  try {
    for (let pass = 0; pass < maxDecodePasses; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next.length > maxPresentationFilenameLength) return false
      if (next === decoded) {
        stabilized = true
        break
      }
      decoded = next
    }
  } catch {
    return false
  }

  return stabilized && /^[\p{L}\p{N}_-]+\.html$/u.test(decoded)
}

export function emptyPresentationDocument(): PresentationDocument {
  return {
    bodyHtml: "",
    title: "",
    description: "",
    styleNodes: []
  }
}

function normalizedUrl(value: string): string | null {
  const trimmed = value.trim()
  const schemeProbe = trimmed.replace(/[\u0000-\u0020]+/g, "")
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
            return [{ kind: "inline", textContent: node.textContent ?? "" }]
          }
          const href = normalizedUrl(node.getAttribute("href") ?? "")
          return href ? [{ kind: "stylesheet", href }] : []
        })
      : []

    return {
      bodyHtml: body.innerHTML,
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
      return {
        target,
        imagePath: rawImagePath === null ? null : normalizedUrl(rawImagePath),
        className: node.getAttribute("class"),
        styleText: node.querySelector("style")?.textContent?.trim() || null
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
