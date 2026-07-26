import type { ReaderPart, ReaderWorkContributor } from "./reader"

export interface EditorFacsimileSource {
  size: number
  url: string
  width: number | null
}

export interface EditorReaderPage {
  authorId: string | null
  authorName: string | null
  closeHref: string | null
  contributors: ReaderWorkContributor[]
  currentPart: ReaderPart | null
  endPageName: string | null
  facsimileSources: EditorFacsimileSource[]
  firstReadableIndex: number
  html: string | null
  imageWidth: number | null
  imageUrl: string | null
  imprintYear: string | null
  lastReadableIndex: number
  mediaType: "etext" | "faksimil"
  metadataAvailable: boolean
  nextIndex: number | null
  nextPartIndex: number | null
  overlayHeight: number | null
  overlayHtml: string | null
  overlayWidth: number | null
  pageIndexes: number[] | null
  pageCount: number | null
  pageIndex: number
  pageName: string | null
  parts: ReaderPart[]
  previousIndex: number | null
  previousPartIndex: number | null
  searchable: boolean
  title: string | null
  titlePath: string | null
  workId: string
}
