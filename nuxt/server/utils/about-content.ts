import { Parser } from "htmlparser2"

import type { AboutContent } from "#shared/about-pages"
import { issueManagedAboutHtml } from "#shared/utils/renderable-html"

export function extractAboutBody(source: string): AboutContent {
  try {
    let parser: Parser | null = null
    let headDepth = 0
    let openingTagEnd: number | null = null
    let closingTagStart: number | null = null
    parser = new Parser({
      onopentag(name, _attributes, isImplied) {
        if (name === "head") headDepth += 1
        if (name === "body" && !isImplied && headDepth === 0 && openingTagEnd === null) {
          openingTagEnd = parser?.endIndex ?? null
        }
      },
      onclosetag(name) {
        if (name === "body" && openingTagEnd !== null && closingTagStart === null) {
          closingTagStart = parser?.startIndex ?? null
        }
        if (name === "head") headDepth = Math.max(0, headDepth - 1)
      }
    }, {
      decodeEntities: false
    })
    parser.end(source)
    if (openingTagEnd === null || closingTagStart === null
      || closingTagStart <= openingTagEnd) {
      return issueManagedAboutHtml(source)
    }

    return issueManagedAboutHtml(source.slice(openingTagEnd + 1, closingTagStart))
  } catch {
    return issueManagedAboutHtml(source)
  }
}
