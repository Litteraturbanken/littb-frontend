import type { components } from "../../app/lib/api/generated/lbapi"

export type AuthorDocumentKind =
  components["schemas"]["AuthorDocumentDescriptor"]["document_kind"]

export type AuthorDocumentErrorCode =
  | "author_document_author_not_found"
  | "author_document_not_found"
  | "author_document_unavailable"

export interface AuthorSupplementalAuthor {
  authorId: string
  fullName: string
  lifespan: string
  hasIntroduction: boolean
  hasDramawebben: boolean
  searchUrl: string | null
  audioUrl: string | null
}

export interface AuthorSupplementalPage {
  author: AuthorSupplementalAuthor
  documentKind: AuthorDocumentKind
  bodyHtml: string
}
