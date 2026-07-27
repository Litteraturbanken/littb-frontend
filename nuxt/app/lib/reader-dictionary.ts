import { parseHTML } from "linkedom"

import { hasC0OrC1Control, hasEcmaWhitespace } from "#shared/utils/text-safety"
import type { SanitizedHtml } from "#shared/types/renderable-html"
import {
  emptyRenderableHtml,
  issueDictionaryArticleHtml
} from "#shared/utils/renderable-html"

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

export function sanitizeDictionaryArticle(markup: string): SanitizedHtml<"dictionary-article"> {
  if (!markup || markup.length > maximumArticleLength) return emptyRenderableHtml()
  const { document } = parseHTML(`<div data-dictionary-root>${markup}</div>`)
  const root = document.querySelector("[data-dictionary-root]")
  if (!root) return emptyRenderableHtml()

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
  return html.length <= maximumArticleLength
    ? issueDictionaryArticleHtml(html)
    : emptyRenderableHtml()
}

function containingElement(node: Node | null): Element | null {
  if (!node) return null
  return node.nodeType === 1 ? node as Element : node.parentElement
}

function validatedReaderWord(value: string): string | null {
  const word = value.trim()
  if (
    !word
    || word.length > maximumWordLength
    || hasEcmaWhitespace(word)
    || hasC0OrC1Control(word)
  ) return null
  return word
}

export function readerWordFromTarget(
  target: Element | null,
  root: Element
): { element: HTMLElement, word: string } | null {
  if (
    !target
    || !root.contains(target)
    || target.closest("a, button, input, select, textarea, [role='button'], [role='dialog']")
  ) return null

  const element = target.closest<HTMLElement>(".w")
  if (!element || !root.contains(element)) return null
  const word = validatedReaderWord(element.textContent ?? "")
  return word ? { element, word } : null
}

export function selectedReaderWord(
  selection: Selection | null,
  root: Element
): { element: HTMLElement, word: string } | null {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null
  const word = validatedReaderWord(selection.toString())
  if (!word) return null

  const range = selection.getRangeAt(0)
  const startWord = containingElement(range.startContainer)?.closest<HTMLElement>(".w")
  const endWord = containingElement(range.endContainer)?.closest<HTMLElement>(".w")
  if (!startWord || startWord !== endWord || !root.contains(startWord)) return null
  return { element: startWord, word }
}
