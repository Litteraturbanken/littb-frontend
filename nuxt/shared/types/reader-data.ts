import type { components } from "../../app/lib/api/generated/lbapi"
import type { ReaderMediaType, ReaderPage, ReaderPageBase } from "./reader"
import type { ReaderSourceInfo } from "./reader-source-info"

type ReaderWorkDetails = {
  sourceInfo: ReaderSourceInfo | null
  similarWorks: components["schemas"]["SimilarWork"][]
}

export type ReaderPageData = ReaderPage & ReaderWorkDetails

export type ReaderMissingPage = Omit<ReaderPageBase, "pageIndex"> & {
  missingPage: true
  mediaType: ReaderMediaType
  pageIndex: null
}

export type ReaderMissingPageData = ReaderMissingPage & ReaderWorkDetails
