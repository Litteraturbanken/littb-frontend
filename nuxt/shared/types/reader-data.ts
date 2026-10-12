import type { components } from "../../app/lib/api/generated/lbapi"
import type { ReaderPage } from "./reader"
import type { ReaderSourceInfo } from "./reader-source-info"

export type ReaderPageData = ReaderPage & {
  sourceInfo: ReaderSourceInfo | null
  similarWorks: components["schemas"]["SimilarWork"][]
}
