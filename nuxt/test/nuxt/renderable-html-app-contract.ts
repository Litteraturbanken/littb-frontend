import type { AuthorProfileView } from "../../app/lib/author-profile"
import type { HomeContent } from "../../app/pages/index.vue"
import type { AboutContent } from "../../app/pages/om/[page].vue"
import type {
  parseBackgroundRules,
  parsePresentationDocument
} from "../../app/pages/presentationer/presentation-parser"
import type {
  markEditorEtextHtml,
  markReaderOcrHtml
} from "../../app/lib/search-hit-highlight"
import type {
  ManagedAssetHtml,
  ManagedStyleText,
  ManagedStylesheetHref,
  SanitizedHtml
} from "../../shared/types/renderable-html"

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? (<Value>() => Value extends Right ? 1 : 2) extends
      (<Value>() => Value extends Left ? 1 : 2)
        ? true
        : false
    : false

type Assert<Value extends true> = Value

type Presentation = ReturnType<typeof parsePresentationDocument>
type PresentationStyle = Presentation["styleNodes"][number]
type PresentationStylesheet = Extract<PresentationStyle, { kind: "stylesheet" }>
type PresentationInlineStyle = Extract<PresentationStyle, { kind: "inline" }>
type Background = ReturnType<typeof parseBackgroundRules>[number]

export type AuthorIntroductionContract = Assert<Equal<
  AuthorProfileView["introductionHtml"],
  SanitizedHtml<"author-profile">
>>
export type AuthorSourcesContract = Assert<Equal<
  AuthorProfileView["sourceHtml"][number],
  SanitizedHtml<"author-profile">
>>
export type AuthorCaptionContract = Assert<Equal<
  NonNullable<AuthorProfileView["portrait"]>["captionHtml"],
  SanitizedHtml<"author-profile">
>>

export type HomeBodyContract = Assert<Equal<
  HomeContent["bodyHtml"],
  ManagedAssetHtml<"home-editorial">
>>
export type AboutBodyContract = Assert<Equal<
  AboutContent,
  ManagedAssetHtml<"about-editorial">
>>
export type PresentationBodyContract = Assert<Equal<
  Presentation["bodyHtml"],
  ManagedAssetHtml<"presentation-editorial">
>>
export type PresentationStylesheetContract = Assert<Equal<
  PresentationStylesheet["href"],
  ManagedStylesheetHref<"presentation-editorial">
>>
export type PresentationInlineStyleContract = Assert<Equal<
  PresentationInlineStyle["textContent"],
  ManagedStyleText<"presentation-editorial">
>>
export type BackgroundStyleContract = Assert<Equal<
  Background["styleText"],
  ManagedStyleText<"presentation-editorial"> | null
>>

export type EditorMarkerParametersContract = Assert<Equal<
  Parameters<typeof markEditorEtextHtml>,
  [SanitizedHtml<"editor-etext">, string, string]
>>
export type EditorMarkerReturnContract = Assert<Equal<
  ReturnType<typeof markEditorEtextHtml>,
  SanitizedHtml<"editor-etext">
>>
export type ReaderOcrMarkerParametersContract = Assert<Equal<
  Parameters<typeof markReaderOcrHtml>,
  [SanitizedHtml<"reader-ocr">, string, string]
>>
export type ReaderOcrMarkerReturnContract = Assert<Equal<
  ReturnType<typeof markReaderOcrHtml>,
  SanitizedHtml<"reader-ocr">
>>
