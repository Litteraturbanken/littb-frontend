import type {
  WorkManifestContributor,
  WorkManifestPage,
  WorkManifestPart
} from "./work-manifest"
import type { ReaderAuthorContribution } from "../utils/reader-author"
import type { ManagedAssetHtml, SanitizedHtml } from "./renderable-html"

export type ReaderMediaType = "etext" | "faksimil"

export type ReaderFacsimileSize = 1 | 2 | 3 | 4 | 5

export interface ReaderFacsimileSizeSource {
  size: ReaderFacsimileSize
  width: number
}

export interface ReaderFacsimileSource extends ReaderFacsimileSizeSource {
  url: string
}

export interface ReaderOcrOverlay {
  html: SanitizedHtml<"reader-ocr">
  width: number
  height: number
}

export interface ReaderPartAuthor {
  id: string
  name: string | null
  surname: string | null
}

export interface ReaderWorkContributor {
  authorType: ReaderAuthorContribution | null
  id: string
  name: string
  role: ReaderAuthorContribution | null
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

export interface ReaderAlternateMedia {
  mediaType: ReaderMediaType
  pageName: string
}

export interface ReaderPageBase {
  alternateMedia: ReaderAlternateMedia | null
  author: WorkManifestContributor
  contributors: WorkManifestContributor[]
  description: string
  editorWorkId: string | null
  fullTitle: string
  hasDramawebben: boolean
  hasNyaVagar: boolean
  imprintYear: string | null
  isDrama: boolean
  endPageName: string | null
  currentPartIndex: number | null
  nextPageName: string | null
  nextPartPageName: string | null
  pageCount: number
  pageIndex: number
  pageMap: WorkManifestPage[]
  pageName: string
  pageNames: string[]
  parts: WorkManifestPart[]
  previousPageName: string | null
  previousPartPageName: string | null
  searchable: boolean
  sliderMaximum: number | null
  startPageName: string | null
  sliderPercent: number
  title: string
  urn: string | null
  workId: string
}

export interface ReaderEtextPage extends ReaderPageBase {
  html: ManagedAssetHtml<"reader-etext">
  mediaType: "etext"
  sharedStylesheetUrl: string
  workStylesheetUrl: string
}

export interface ReaderFacsimilePage extends ReaderPageBase {
  author: WorkManifestContributor & { name?: string }
  imageNumber: number
  mediaType: "faksimil"
  ocrOverlay: ReaderOcrOverlay | null
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
