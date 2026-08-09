import type {
  ManagedAssetHtml,
  ManagedStyleText,
  ManagedStylesheetHref,
  RenderableCapability,
  RenderableHtml,
  RenderableHtmlProps,
  SanitizedHtml
} from "../../shared/types/renderable-html"
import type { AuthorSupplementalPage } from "../../shared/types/author-document"
import type { DramawebbenManagedDocument } from "../../shared/types/dramawebben-document"
import type { EditorReaderPage } from "../../shared/types/editor-reader"
import type {
  ReaderSourceInfo,
  ReaderSourceInfoDramawebben,
  ReaderSourceInfoErrataRow
} from "../../shared/types/reader-source-info"
import type { ReaderEtextPage, ReaderOcrOverlay } from "../../shared/types/reader"
import type { SlaArticlePage } from "../../shared/types/sla-article"
import {
  emptyRenderableHtml,
  issueAuthorDocumentHtml,
  issueAuthorProfileHtml,
  issueDictionaryArticleHtml,
  issueDramawebbenDocumentHtml,
  issueEditorEtextHtml,
  issueManagedAboutHtml,
  issueManagedHomeHtml,
  issueManagedPresentationHtml,
  issueManagedPresentationStyle,
  issueManagedPresentationStylesheetHref,
  issueManagedReaderHtml,
  issueManagedReaderStyle,
  issueReaderOcrHtml,
  issueReaderSourceInfoHtml,
  issueSlaArticleHtml,
  joinReaderSourceRows,
  transformManagedReaderHtml
} from "../../shared/utils/renderable-html"

const authorProfile: SanitizedHtml<"author-profile"> = issueAuthorProfileHtml("<p>Profile</p>")
const authorDocument: SanitizedHtml<"author-document"> = issueAuthorDocumentHtml("<p>Document</p>")
const dramawebbenDocument: SanitizedHtml<"dramawebben-document">
  = issueDramawebbenDocumentHtml("<p>Dramawebben</p>")
const slaArticle: SanitizedHtml<"sla-article"> = issueSlaArticleHtml("<p>SLA</p>")
const dictionaryArticle: SanitizedHtml<"dictionary-article">
  = issueDictionaryArticleHtml("<p>Dictionary</p>")
const readerOcr: SanitizedHtml<"reader-ocr"> = issueReaderOcrHtml("<span>OCR</span>")
const readerSourceInfo: SanitizedHtml<"reader-source-info">
  = issueReaderSourceInfoHtml("<p>Source</p>")
const editorEtext: SanitizedHtml<"editor-etext"> = issueEditorEtextHtml("<span>Editor</span>")

const managedReader: ManagedAssetHtml<"reader-etext"> = issueManagedReaderHtml("<p>Reader</p>")
const managedReaderStyle: ManagedStyleText<"reader-etext">
  = issueManagedReaderStyle(".etext { color: black; }")
const managedHome: ManagedAssetHtml<"home-editorial"> = issueManagedHomeHtml("<p>Home</p>")
const managedAbout: ManagedAssetHtml<"about-editorial"> = issueManagedAboutHtml("<p>About</p>")
const managedPresentation: ManagedAssetHtml<"presentation-editorial">
  = issueManagedPresentationHtml("<p>Presentation</p>")
const managedPresentationStyle: ManagedStyleText<"presentation-editorial">
  = issueManagedPresentationStyle("body { color: red; }")
const managedPresentationStylesheetHref: ManagedStylesheetHref<"presentation-editorial">
  = issueManagedPresentationStylesheetHref("/presentation.css")
// @ts-expect-error Plain strings have not passed the About editorial authority.
const plainAboutBody: ManagedAssetHtml<"about-editorial"> = "<p>Plain About</p>"
// @ts-expect-error Plain strings have not passed the Presentation editorial authority.
const plainPresentationBody: ManagedAssetHtml<"presentation-editorial">
  = "<p>Plain Presentation</p>"
// @ts-expect-error About editorial HTML cannot be widened to the Home authority.
const aboutThroughHome: ManagedAssetHtml<"home-editorial"> = managedAbout
// @ts-expect-error Home editorial HTML cannot be widened to the About authority.
const homeThroughAbout: ManagedAssetHtml<"about-editorial"> = managedHome
// @ts-expect-error Presentation HTML cannot be installed as Presentation style text.
const presentationHtmlAsStyle: ManagedStyleText<"presentation-editorial">
  = managedPresentation
// @ts-expect-error Presentation style text cannot be installed as a stylesheet href.
const presentationStyleAsHref: ManagedStylesheetHref<"presentation-editorial">
  = managedPresentationStyle

const emptySourceInfo: SanitizedHtml<"reader-source-info"> = emptyRenderableHtml()
const joinedSourceRows: SanitizedHtml<"reader-source-info"> = joinReaderSourceRows([
  readerSourceInfo,
  emptySourceInfo
])
const transformedReader: ManagedAssetHtml<"reader-etext"> = transformManagedReaderHtml(
  managedReader,
  value => value.replace("Reader", "Marked reader")
)

const renderableHtml: RenderableHtml[] = [
  authorProfile,
  authorDocument,
  dramawebbenDocument,
  slaArticle,
  dictionaryArticle,
  readerOcr,
  readerSourceInfo,
  editorEtext,
  managedReader,
  managedHome,
  managedAbout,
  managedPresentation,
  joinedSourceRows,
  transformedReader
]
const capabilities: RenderableCapability[] = [
  ...renderableHtml,
  managedReaderStyle,
  managedPresentationStyle,
  managedPresentationStylesheetHref
]
const props = [
  { as: "div", html: authorProfile },
  { as: "section", html: managedAbout },
  { as: "figcaption", html: readerOcr },
  { as: "td", html: readerSourceInfo }
] satisfies RenderableHtmlProps[]

// @ts-expect-error Plain strings have not passed an HTML policy boundary.
const plainStringProps: RenderableHtmlProps = { as: "div", html: "<p>Untrusted</p>" }
// @ts-expect-error Presentation style text is not an HTML rendering capability.
const styleAsHtmlProps: RenderableHtmlProps = { as: "div", html: managedPresentationStyle }
// @ts-expect-error The live-DOM renderer supports only the observed native tags.
const unsupportedTagProps: RenderableHtmlProps = { as: "span", html: authorProfile }
// @ts-expect-error A named issuer cannot be widened to a different sanitization policy.
const wrongPolicy: SanitizedHtml<"reader-ocr"> = authorProfile

const readerOverlay: ReaderOcrOverlay["html"] = readerOcr
const readerPageHtml: ReaderEtextPage["html"] = managedReader
const readerSharedStyle: ReaderEtextPage["sharedStylesheetCss"] = managedReaderStyle
// @ts-expect-error Plain CSS has not passed the managed Reader style authority.
const plainReaderSharedStyle: ReaderEtextPage["sharedStylesheetCss"] = ".etext { color: red; }"
const editorPageHtml: NonNullable<EditorReaderPage["html"]> = editorEtext
const editorOverlayHtml: NonNullable<EditorReaderPage["overlayHtml"]> = readerOcr
const authorDocumentBody: AuthorSupplementalPage["bodyHtml"] = authorDocument
const dramawebbenDocumentBody: DramawebbenManagedDocument["bodyHtml"] = dramawebbenDocument
const slaArticleBody: SlaArticlePage["bodyHtml"] = slaArticle
const sourceDescription: NonNullable<ReaderSourceInfo["sourceDescriptionHtml"]> = readerSourceInfo
const workIntroduction: NonNullable<ReaderSourceInfo["workIntroductionHtml"]> = readerSourceInfo
const sourceLicense: NonNullable<ReaderSourceInfo["licenseHtml"]> = readerSourceInfo
const errataCell: ReaderSourceInfoErrataRow["cellsHtml"][number] = readerSourceInfo
const dramaRole: ReaderSourceInfoDramawebben["rolesHtml"][number] = readerSourceInfo
const dramaHistory: NonNullable<ReaderSourceInfoDramawebben["historyHtml"]> = readerSourceInfo

// @ts-expect-error OCR overlays require the reader-ocr sanitizer policy.
const plainReaderOverlay: ReaderOcrOverlay["html"] = "<span>Plain</span>"
// @ts-expect-error Reader e-text requires the managed reader authority.
const plainReaderPageHtml: ReaderEtextPage["html"] = "<p>Plain</p>"
// @ts-expect-error Home editorial HTML cannot enter the managed Reader DTO.
const homeThroughReaderPage: ReaderEtextPage["html"] = managedHome
// @ts-expect-error Home editorial HTML cannot enter the managed Reader marker.
const homeThroughReaderMarker = transformManagedReaderHtml(managedHome, value => value)
// @ts-expect-error Editor text requires the editor-etext sanitizer policy.
const plainEditorPageHtml: NonNullable<EditorReaderPage["html"]> = "<p>Plain</p>"
// @ts-expect-error Editor overlays require the reader-ocr sanitizer policy.
const plainEditorOverlayHtml: NonNullable<EditorReaderPage["overlayHtml"]> = "<span>Plain</span>"
// @ts-expect-error Author document bodies require the author-document sanitizer policy.
const plainAuthorDocumentBody: AuthorSupplementalPage["bodyHtml"] = "<p>Plain</p>"
// @ts-expect-error Dramawebben bodies require the dramawebben-document sanitizer policy.
const plainDramawebbenDocumentBody: DramawebbenManagedDocument["bodyHtml"] = "<p>Plain</p>"
// @ts-expect-error SLA bodies require the sla-article sanitizer policy.
const plainSlaArticleBody: SlaArticlePage["bodyHtml"] = "<p>Plain</p>"
// @ts-expect-error Source descriptions require the reader-source-info sanitizer policy.
const plainSourceDescription: NonNullable<ReaderSourceInfo["sourceDescriptionHtml"]> = "Plain"
// @ts-expect-error Work introductions require the reader-source-info sanitizer policy.
const plainWorkIntroduction: NonNullable<ReaderSourceInfo["workIntroductionHtml"]> = "Plain"
// @ts-expect-error Licenses require the reader-source-info sanitizer policy.
const plainSourceLicense: NonNullable<ReaderSourceInfo["licenseHtml"]> = "Plain"
// @ts-expect-error Errata cells require the reader-source-info sanitizer policy.
const plainErrataCell: ReaderSourceInfoErrataRow["cellsHtml"][number] = "Plain"
// @ts-expect-error Drama roles require the reader-source-info sanitizer policy.
const plainDramaRole: ReaderSourceInfoDramawebben["rolesHtml"][number] = "Plain"
// @ts-expect-error Drama history requires the reader-source-info sanitizer policy.
const plainDramaHistory: NonNullable<ReaderSourceInfoDramawebben["historyHtml"]> = "Plain"

void capabilities
void props
void plainStringProps
void plainAboutBody
void plainPresentationBody
void aboutThroughHome
void homeThroughAbout
void presentationHtmlAsStyle
void presentationStyleAsHref
void styleAsHtmlProps
void unsupportedTagProps
void wrongPolicy
void readerOverlay
void readerPageHtml
void readerSharedStyle
void plainReaderSharedStyle
void editorPageHtml
void editorOverlayHtml
void authorDocumentBody
void dramawebbenDocumentBody
void slaArticleBody
void sourceDescription
void workIntroduction
void sourceLicense
void errataCell
void dramaRole
void dramaHistory
void plainReaderOverlay
void plainReaderPageHtml
void homeThroughReaderPage
void homeThroughReaderMarker
void plainEditorPageHtml
void plainEditorOverlayHtml
void plainAuthorDocumentBody
void plainDramawebbenDocumentBody
void plainSlaArticleBody
void plainSourceDescription
void plainWorkIntroduction
void plainSourceLicense
void plainErrataCell
void plainDramaRole
void plainDramaHistory
