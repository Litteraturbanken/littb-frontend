export interface EditorFacsimileSource {
  size: number
  url: string
  width: number | null
}

export interface EditorReaderPage {
  authorId: string | null
  authorName: string | null
  closeHref: string | null
  endPageName: string | null
  facsimileSources: EditorFacsimileSource[]
  html: string | null
  imageWidth: number | null
  imageUrl: string | null
  imprintYear: string | null
  mediaType: "etext" | "faksimil"
  metadataAvailable: boolean
  nextIndex: number | null
  overlayHeight: number | null
  overlayHtml: string | null
  overlayWidth: number | null
  pageIndexes: number[] | null
  pageCount: number | null
  pageIndex: number
  pageName: string | null
  previousIndex: number | null
  title: string | null
  workId: string
}
