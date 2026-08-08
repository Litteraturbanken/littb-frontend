import type { LibraryPageData as LibrarySuccessPageData } from "./view-model"

type StatefulResponse<Response> = Omit<Response, "suggest" | "failed"> & {
  suggest: unknown[]
  failed: boolean
}

type StatefulPage<Page> = Page extends { mode: infer Mode, response: infer Response }
  ? { mode: Mode, response: StatefulResponse<Response> }
  : never

export type LibraryPageState = StatefulPage<LibrarySuccessPageData>

export type LibraryResponse = Extract<LibraryPageState, { mode: "all" }>["response"]
export type AuthorBrowseResponse = Extract<LibraryPageState, { mode: "authors" }>["response"]
export type EpubResponse = Extract<LibraryPageState, { mode: "epub" | "pdf" }>["response"]
export type PdfResponse = EpubResponse
export type BrowseResponse = Extract<LibraryPageState, { mode: "works" | "parts" }>["response"]
export type LatestResponse = Extract<LibraryPageState, { mode: "latest" }>["response"]

export type LibraryPageResultHandlers = {
  all: (response: LibraryResponse) => void
  authors: (response: AuthorBrowseResponse) => void
  works: (response: BrowseResponse) => void
  parts: (response: BrowseResponse) => void
  latest: (response: LatestResponse) => void
  epub: (response: EpubResponse) => void
  pdf: (response: PdfResponse) => void
}

export function assignLibraryPageResult(
  pageData: LibraryPageState,
  handlers: LibraryPageResultHandlers
): void {
  switch (pageData.mode) {
    case "all": handlers.all(pageData.response); break
    case "authors": handlers.authors(pageData.response); break
    case "works": handlers.works(pageData.response); break
    case "parts": handlers.parts(pageData.response); break
    case "latest": handlers.latest(pageData.response); break
    case "epub": handlers.epub(pageData.response); break
    case "pdf": handlers.pdf(pageData.response); break
  }
}
