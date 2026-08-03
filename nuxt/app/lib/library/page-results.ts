import type { LibraryPageData as LibrarySuccessPageData } from "./view-model"

type StatefulResponse<Response> = Omit<Response, "suggest" | "failed"> & {
  suggest: unknown[]
  failed: boolean
}

export type LibraryResponse = StatefulResponse<
  Extract<LibrarySuccessPageData, { mode: "all" }>["response"]
>
export type AuthorBrowseResponse = StatefulResponse<
  Extract<LibrarySuccessPageData, { mode: "authors" }>["response"]
>
export type EpubResponse = StatefulResponse<
  Extract<LibrarySuccessPageData, { mode: "epub" | "pdf" }>["response"]
>
export type PdfResponse = EpubResponse
export type BrowseResponse = StatefulResponse<
  Extract<LibrarySuccessPageData, { mode: "works" | "parts" }>["response"]
>
export type LatestResponse = StatefulResponse<
  Extract<LibrarySuccessPageData, { mode: "latest" }>["response"]
>

export type LibraryPageData =
  | { mode: "all", response: LibraryResponse }
  | { mode: "authors", response: AuthorBrowseResponse }
  | { mode: "works", response: BrowseResponse }
  | { mode: "parts", response: BrowseResponse }
  | { mode: "latest", response: LatestResponse }
  | { mode: "epub", response: EpubResponse }
  | { mode: "pdf", response: PdfResponse }

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
  pageData: LibraryPageData,
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
