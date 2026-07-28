import type { SanitizedHtml } from "./renderable-html"
import type { WorkManifestContributor, WorkManifestPart } from "./work-manifest"

export interface EditorFacsimileSource {
  size: number
  url: string
  width: number | null
}

export interface EditorReaderPage {
  authorId: string | null
  authorName: string | null
  closeHref: string | null
  contributors: WorkManifestContributor[]
  currentPart: WorkManifestPart | null
  endPageName: string | null
  facsimileSources: EditorFacsimileSource[]
  firstReadableIndex: number
  html: SanitizedHtml<"editor-etext"> | null
  imageWidth: number | null
  imageUrl: string | null
  imprintYear: string | null
  lastReadableIndex: number
  mediaType: "etext" | "faksimil"
  metadataAvailable: boolean
  nextIndex: number | null
  nextPartIndex: number | null
  overlayHeight: number | null
  overlayHtml: SanitizedHtml<"reader-ocr"> | null
  overlayWidth: number | null
  pageIndexes: number[] | null
  pageCount: number | null
  pageIndex: number
  pageName: string | null
  parts: WorkManifestPart[]
  previousIndex: number | null
  previousPartIndex: number | null
  searchable: boolean
  title: string | null
  titlePath: string | null
  workId: string
}
