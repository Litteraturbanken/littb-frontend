import type {
  ManagedAssetHtml,
  ManagedStyleText,
  ManagedStylesheetHref,
  RenderableCapability,
  RenderableHtml,
  RenderableHtmlProps,
  SanitizedHtml
} from "../../shared/types/renderable-html"
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
const managedHome: ManagedAssetHtml<"home-editorial"> = issueManagedHomeHtml("<p>Home</p>")
const managedAbout: ManagedAssetHtml<"about-editorial"> = issueManagedAboutHtml("<p>About</p>")
const managedPresentation: ManagedAssetHtml<"presentation-editorial">
  = issueManagedPresentationHtml("<p>Presentation</p>")
const managedPresentationStyle: ManagedStyleText<"presentation-editorial">
  = issueManagedPresentationStyle("body { color: red; }")
const managedPresentationStylesheetHref: ManagedStylesheetHref<"presentation-editorial">
  = issueManagedPresentationStylesheetHref("/presentation.css")

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

void capabilities
void props
void plainStringProps
void styleAsHtmlProps
void unsupportedTagProps
void wrongPolicy
