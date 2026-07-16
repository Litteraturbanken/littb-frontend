export interface ReaderPage {
  author: {
    id: string
    name: string
  }
  description: string
  fullTitle: string
  html: string
  imprintYear: string | null
  mediaType: "etext"
  nextPageName: string | null
  pageCount: number
  pageIndex: number
  pageName: string
  previousPageName: string | null
  sharedStylesheetUrl: string
  title: string
  workId: string
  workStylesheetUrl: string
}
