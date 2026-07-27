import type { SanitizedHtml } from "./renderable-html"

export type ReaderSourceInfoMediaType = "etext" | "faksimil" | "pdf" | "infopost"

export interface ReaderSourceInfoAuthor {
  authorId: string
  fullName: string
  surname: string | null
  role: string | null
  authorType: string | null
  url: string
}

export interface ReaderSourceInfoAttribution {
  authorId: string
  fullName: string
  surname: string | null
}

export interface ReaderSourceInfoCover {
  smallUrl: string
  largeUrl: string
}

export interface ReaderSourceInfoReadAction {
  mediaType: "etext" | "faksimil"
  label: "etext" | "faksimil"
  url: string
}

export interface ReaderSourceInfoDownloadAction {
  mediaType: "epub" | "pdf"
  label: "epub" | "pdf"
  url: string
  filename: string
  sizeBytes: number | null
}

export interface ReaderSourceInfoErrataRow {
  cellsHtml: SanitizedHtml<"reader-source-info">[]
}

export interface ReaderSourceInfoProvenance {
  fullName: string
  imageUrl: string | null
  link: string | null
  text: string
}

export interface ReaderSourceInfoDramaFact {
  key:
    | "first_staged"
    | "first_staged_in_sweden"
    | "number_of_pages"
    | "number_of_acts"
    | "number_of_roles"
    | "male_roles"
    | "female_roles"
    | "other_roles"
  value: string
}

export interface ReaderSourceInfoDramawebben {
  hasIntroduction: boolean
  facts: ReaderSourceInfoDramaFact[]
  rolesHtml: SanitizedHtml<"reader-source-info">[]
  historyHtml: SanitizedHtml<"reader-source-info"> | null
}

export interface ReaderSourceInfo {
  workId: string
  authorId: string
  titlePath: string
  mediaType: ReaderSourceInfoMediaType
  startPage: string | null
  title: string
  shortTitle: string | null
  textType: string | null
  authors: ReaderSourceInfoAuthor[]
  sourceDescriptionHtml: SanitizedHtml<"reader-source-info"> | null
  sourceDescriptionAuthor: ReaderSourceInfoAttribution | null
  workIntroductionHtml: SanitizedHtml<"reader-source-info"> | null
  workIntroductionAuthor: ReaderSourceInfoAttribution | null
  imprint: string | null
  urn: string | null
  librisId: string | null
  licenseKey: string | null
  isPrinted: boolean | null
  provenance: ReaderSourceInfoProvenance[]
  licenseHtml: SanitizedHtml<"reader-source-info"> | null
  cover: ReaderSourceInfoCover
  readActions: ReaderSourceInfoReadAction[]
  downloadActions: ReaderSourceInfoDownloadAction[]
  errata: ReaderSourceInfoErrataRow[]
  dramawebben: ReaderSourceInfoDramawebben | null
}
