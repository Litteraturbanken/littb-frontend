declare const sanitizedHtmlPolicy: unique symbol
declare const managedAssetHtmlAuthority: unique symbol
declare const managedStyleTextAuthority: unique symbol
declare const managedStylesheetHrefAuthority: unique symbol

export type SanitizedHtmlPolicy =
  | "author-profile"
  | "author-document"
  | "dramawebben-document"
  | "sla-article"
  | "dictionary-article"
  | "reader-ocr"
  | "reader-source-info"
  | "editor-etext"

export type ManagedHtmlAuthority =
  | "reader-etext"
  | "home-editorial"
  | "about-editorial"
  | "presentation-editorial"

export type SanitizedHtml<Policy extends SanitizedHtmlPolicy> = string & {
  readonly [sanitizedHtmlPolicy]: Policy
}

export type ManagedAssetHtml<Authority extends ManagedHtmlAuthority> = string & {
  readonly [managedAssetHtmlAuthority]: Authority
}

export type ManagedStyleText<Authority extends ManagedHtmlAuthority> = string & {
  readonly [managedStyleTextAuthority]: Authority
}

export type ManagedStylesheetHref<Authority extends ManagedHtmlAuthority> = string & {
  readonly [managedStylesheetHrefAuthority]: Authority
}

export type RenderableHtml =
  | SanitizedHtml<SanitizedHtmlPolicy>
  | ManagedAssetHtml<ManagedHtmlAuthority>

export type RenderableCapability =
  | RenderableHtml
  | ManagedStyleText<"presentation-editorial" | "reader-etext">
  | ManagedStylesheetHref<"presentation-editorial">

export const RENDERABLE_HTML_TAGS = ["div", "section", "figcaption", "td"] as const

export type RenderableHtmlTag = typeof RENDERABLE_HTML_TAGS[number]

export type RenderableHtmlProps = {
  as: RenderableHtmlTag
  html: RenderableHtml
}
