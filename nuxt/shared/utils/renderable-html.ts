import type {
  ManagedAssetHtml,
  ManagedStyleText,
  ManagedStylesheetHref,
  RenderableCapability,
  RenderableHtml,
  SanitizedHtml
} from "../types/renderable-html"

function capability<T extends RenderableCapability>(value: string): T {
  return value as T
}

export function issueAuthorProfileHtml(value: string): SanitizedHtml<"author-profile"> {
  return capability<SanitizedHtml<"author-profile">>(value)
}

export function issueAuthorDocumentHtml(value: string): SanitizedHtml<"author-document"> {
  return capability<SanitizedHtml<"author-document">>(value)
}

export function issueDramawebbenDocumentHtml(value: string): SanitizedHtml<"dramawebben-document"> {
  return capability<SanitizedHtml<"dramawebben-document">>(value)
}

export function issueSlaArticleHtml(value: string): SanitizedHtml<"sla-article"> {
  return capability<SanitizedHtml<"sla-article">>(value)
}

export function issueDictionaryArticleHtml(value: string): SanitizedHtml<"dictionary-article"> {
  return capability<SanitizedHtml<"dictionary-article">>(value)
}

export function issueReaderOcrHtml(value: string): SanitizedHtml<"reader-ocr"> {
  return capability<SanitizedHtml<"reader-ocr">>(value)
}

export function issueReaderSourceInfoHtml(value: string): SanitizedHtml<"reader-source-info"> {
  return capability<SanitizedHtml<"reader-source-info">>(value)
}

export function issueEditorEtextHtml(value: string): SanitizedHtml<"editor-etext"> {
  return capability<SanitizedHtml<"editor-etext">>(value)
}

export function issueManagedReaderHtml(value: string): ManagedAssetHtml<"reader-etext"> {
  return capability<ManagedAssetHtml<"reader-etext">>(value)
}

export function issueManagedHomeHtml(value: string): ManagedAssetHtml<"home-editorial"> {
  return capability<ManagedAssetHtml<"home-editorial">>(value)
}

export function issueManagedAboutHtml(value: string): ManagedAssetHtml<"about-editorial"> {
  return capability<ManagedAssetHtml<"about-editorial">>(value)
}

export function issueManagedPresentationHtml(value: string): ManagedAssetHtml<"presentation-editorial"> {
  return capability<ManagedAssetHtml<"presentation-editorial">>(value)
}

export function issueManagedPresentationStyle(value: string): ManagedStyleText<"presentation-editorial"> {
  return capability<ManagedStyleText<"presentation-editorial">>(value)
}

export function issueManagedPresentationStylesheetHref(
  value: string
): ManagedStylesheetHref<"presentation-editorial"> {
  return capability<ManagedStylesheetHref<"presentation-editorial">>(value)
}

export function emptyRenderableHtml<Value extends RenderableHtml>(): Value {
  return capability<Value>("")
}

export function joinReaderSourceRows(
  values: readonly SanitizedHtml<"reader-source-info">[]
): SanitizedHtml<"reader-source-info"> {
  return capability<SanitizedHtml<"reader-source-info">>(values.join("<br>"))
}

export function transformManagedReaderHtml(
  value: ManagedAssetHtml<"reader-etext">,
  transform: (value: string) => string
): ManagedAssetHtml<"reader-etext"> {
  return capability<ManagedAssetHtml<"reader-etext">>(transform(value))
}
