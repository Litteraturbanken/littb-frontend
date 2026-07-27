import type { SanitizedHtml } from "./renderable-html"

export type DramawebbenDocumentKind = "om" | "kringtexter"

export type DramawebbenManagedDocument = {
  documentKind: DramawebbenDocumentKind
  bodyHtml: SanitizedHtml<"dramawebben-document">
}

export type DramawebbenDocumentErrorCode =
  | "dramawebben_document_not_found"
  | "dramawebben_document_unavailable"
