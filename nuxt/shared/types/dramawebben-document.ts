export type DramawebbenDocumentKind = "om" | "kringtexter"

export type DramawebbenManagedDocument = {
  documentKind: DramawebbenDocumentKind
  bodyHtml: string
}

export type DramawebbenDocumentErrorCode =
  | "dramawebben_document_not_found"
  | "dramawebben_document_unavailable"
