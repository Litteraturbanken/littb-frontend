export type ReaderMediaType = "etext" | "faksimil"

export type ReaderFacsimileSize = 1 | 2 | 3 | 4 | 5

export interface ReaderFacsimileSizeSource {
  size: ReaderFacsimileSize
  width: number
}

export interface ReaderFacsimileSource extends ReaderFacsimileSizeSource {
  url: string
}

export interface ReaderPartAuthor {
  id: string
  name: string | null
  surname: string | null
}

export interface ReaderPart {
  sourceIndex: number
  startPageName: string
  startPageIndex: number
  endPageName: string
  endPageIndex: number
  title: string
  navTitle: string | null
  shortTitle: string | null
  titleId: string | null
  authors: ReaderPartAuthor[]
}

export interface ReaderPageBase {
  author: {
    id: string
    name: string
  }
  description: string
  fullTitle: string
  imprintYear: string | null
  endPageName: string | null
  currentPartIndex: number | null
  nextPageName: string | null
  nextPartPageName: string | null
  pageCount: number
  pageIndex: number
  pageName: string
  pageNames: string[]
  parts: ReaderPart[]
  previousPageName: string | null
  previousPartPageName: string | null
  startPageName: string | null
  title: string
  workId: string
}

export interface ReaderEtextPage extends ReaderPageBase {
  html: string
  mediaType: "etext"
  sharedStylesheetUrl: string
  workStylesheetUrl: string
}

export interface ReaderFacsimilePage extends ReaderPageBase {
  imageNumber: number
  mediaType: "faksimil"
  preferredSize: ReaderFacsimileSize
  sources: ReaderFacsimileSource[]
}

export type ReaderPage = ReaderEtextPage | ReaderFacsimilePage

export interface ReaderRouteResolution {
  authorId: string
  canonicalPath: string
  mediaType: ReaderMediaType
  startPageName: string
  titlePath: string
}
