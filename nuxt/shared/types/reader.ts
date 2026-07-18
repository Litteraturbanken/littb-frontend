export type ReaderMediaType = "etext" | "faksimil"

export type ReaderFacsimileSize = 1 | 2 | 3 | 4 | 5

export interface ReaderFacsimileSizeSource {
  size: ReaderFacsimileSize
  width: number
}

export interface ReaderFacsimileSource extends ReaderFacsimileSizeSource {
  url: string
}

export interface ReaderPageBase {
  author: {
    id: string
    name: string
  }
  description: string
  fullTitle: string
  imprintYear: string | null
  nextPageName: string | null
  pageCount: number
  pageIndex: number
  pageName: string
  previousPageName: string | null
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
