import { parseHTML } from "linkedom"

const maximumArticleLength = 200_000
const maximumWordLength = 100
const blockedTags = new Set([
  "audio", "embed", "form", "iframe", "img", "input", "link", "meta",
  "object", "script", "style", "svg", "template", "textarea", "video"
])
const safeHtmlTags = new Set(["b", "br", "em", "i", "span", "strong", "sub", "sup"])
const customSoTag = /^[a-z][a-z0-9_]{0,63}$/u

function isAllowedTag(tag: string): boolean {
  return safeHtmlTags.has(tag) || (customSoTag.test(tag) && !blockedTags.has(tag) && tag !== "a")
}

export function sanitizeDictionaryArticle(markup: string): string {
  if (!markup || markup.length > maximumArticleLength) return ""
  const { document } = parseHTML(`<div data-dictionary-root>${markup}</div>`)
  const root = document.querySelector("[data-dictionary-root]")
  if (!root) return ""

  for (const element of Array.from(root.querySelectorAll("*")).reverse()) {
    const tag = element.tagName.toLowerCase()
    if (blockedTags.has(tag)) {
      element.remove()
      continue
    }
    if (!isAllowedTag(tag)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }
    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name)
    }
  }
  const html = root.innerHTML
  return html.length <= maximumArticleLength ? html : ""
}

function containingElement(node: Node | null): Element | null {
  if (!node) return null
  return node.nodeType === 1 ? node as Element : node.parentElement
}

export function selectedReaderWord(
  selection: Selection | null,
  root: Element
): { element: HTMLElement, word: string } | null {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null
  const word = selection.toString().trim()
  if (
    !word
    || word.length > maximumWordLength
    || /\s/u.test(word)
    || /[\u0000-\u001f\u007f-\u009f]/u.test(word)
  ) return null

  const range = selection.getRangeAt(0)
  const startWord = containingElement(range.startContainer)?.closest<HTMLElement>(".w")
  const endWord = containingElement(range.endContainer)?.closest<HTMLElement>(".w")
  if (!startWord || startWord !== endWord || !root.contains(startWord)) return null
  return { element: startWord, word }
}
