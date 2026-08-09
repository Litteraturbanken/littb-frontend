import type {
  FacsimileSize,
  WorkManifestContributor,
  WorkManifestPage,
  WorkManifestPart,
  WorkManifestPartAuthor
} from "./work-manifest"
import type { ManagedAssetHtml, ManagedStyleText, SanitizedHtml } from "./renderable-html"

export type ReaderMediaType = "etext" | "faksimil"

export type ReaderFacsimileSize = FacsimileSize["size"]

export type ReaderFacsimileSizeSource = FacsimileSize

export interface ReaderFacsimileSource extends FacsimileSize {
  url: string
}

export interface ReaderOcrOverlay {
  html: SanitizedHtml<"reader-ocr">
  width: number
  height: number
}

export type ReaderPartAuthor = WorkManifestPartAuthor
export type ReaderWorkContributor = WorkManifestContributor
export type ReaderPart = WorkManifestPart

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
  sharedStylesheetCss: ManagedStyleText<"reader-etext"> | null
  sharedStylesheetUrl: string
  workStylesheetCss: ManagedStyleText<"reader-etext"> | null
  workStylesheetUrl: string
}

export interface ReaderFacsimilePage extends ReaderPageBase {
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
