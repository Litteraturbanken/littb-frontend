import { parseHTML } from "linkedom"

const maximumEditorHtmlLength = 2 * 1024 * 1024
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u
const activeTags = new Set([
  "APPLET", "BASE", "EMBED", "FORM", "IFRAME", "LINK", "META", "NOSCRIPT",
  "OBJECT", "SCRIPT", "STYLE", "TEMPLATE"
])
const allowedTags = new Set([
  "A", "ABBR", "ADDRESS", "ARTICLE", "ASIDE", "B", "BDI", "BDO", "BLOCKQUOTE",
  "BR", "CAPTION", "CITE", "CODE", "COL", "COLGROUP", "DD", "DEL", "DETAILS",
  "DFN", "DIV", "DL", "DT", "EM", "FIGCAPTION", "FIGURE", "H1", "H2", "H3",
  "H4", "H5", "H6", "HR", "I", "IMG", "INS", "KBD", "LI", "MARK", "OL", "P",
  "PRE", "Q", "S", "SAMP", "SECTION", "SMALL", "SPAN", "STRONG", "SUB", "SUMMARY",
  "SUP", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TIME", "TR", "U", "UL",
  "VAR", "WBR"
])
const globalAttributes = new Set([
  "aria-hidden", "class", "dir", "hidden", "id", "lang", "pname", "role", "title"
])
const tagAttributes: Readonly<Record<string, ReadonlySet<string>>> = {
  A: new Set(["href", "name", "rel", "target"]),
  BLOCKQUOTE: new Set(["cite"]),
  COL: new Set(["span"]),
  COLGROUP: new Set(["span"]),
  DEL: new Set(["cite", "datetime"]),
  IMG: new Set(["alt", "height", "src", "width"]),
  INS: new Set(["cite", "datetime"]),
  Q: new Set(["cite"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan", "scope"]),
  TIME: new Set(["datetime"])
}

interface SanitizedElement {
  attributes: ArrayLike<{ name: string, value: string }>
  childNodes: ArrayLike<unknown>
  getAttribute: (name: string) => string | null
  remove: () => void
  removeAttribute: (name: string) => void
  replaceWith: (...nodes: unknown[]) => void
  setAttribute: (name: string, value: string) => void
  tagName: string
}

function safeIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 500 && !controlCharacters.test(value)
}

function safeUrl(value: string, image: boolean): boolean {
  if (
    value.length === 0 || value.length > 2_000 || controlCharacters.test(value) ||
    value.startsWith("//") || value.includes("\\")
  ) return false
  if (/^(?:https?:)?$/u.test(value)) return false
  if (/^https?:\/\//iu.test(value)) return true
  if (!image && /^mailto:/iu.test(value)) return true
  return /^(?:#|\/|\.\.?\/|[^:/?#]+(?:[/?#]|$))/u.test(value)
}

function sanitizeElement(element: SanitizedElement): void {
  if (activeTags.has(element.tagName)) {
    element.remove()
    return
  }
  if (!allowedTags.has(element.tagName)) {
    element.replaceWith(...Array.from(element.childNodes))
    return
  }
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value
    const allowed = globalAttributes.has(name) || tagAttributes[element.tagName]?.has(name)
    if (!allowed || name.startsWith("on")) {
      element.removeAttribute(name)
      continue
    }
    if (["class", "id", "name", "pname"].includes(name) && !safeIdentifier(value)) {
      element.removeAttribute(name)
      continue
    }
    if (["href", "cite"].includes(name) && !safeUrl(value, false)) {
      element.removeAttribute(name)
      continue
    }
    if (name === "src" && !safeUrl(value, true)) {
      element.removeAttribute(name)
      continue
    }
    if (name === "target") {
      if (value !== "_blank") element.removeAttribute(name)
      else element.setAttribute("rel", "noopener noreferrer")
      continue
    }
    if (value.length > 2_000 || controlCharacters.test(value)) element.removeAttribute(name)
  }
}

export function sanitizeEditorEtextHtml(source: string): string | null {
  if (source.length === 0 || source.length > maximumEditorHtmlLength) return null
  try {
    const { document } = parseHTML(
      `<!doctype html><html><head></head><body>${source}</body></html>`
    ) as unknown as { document: {
      body: { innerHTML: string, querySelectorAll: (selector: string) => ArrayLike<SanitizedElement> }
    } }
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      sanitizeElement(element)
    }
    const html = document.body.innerHTML
    return html.length > 0 && html.length <= maximumEditorHtmlLength ? html : null
  } catch {
    return null
  }
}
