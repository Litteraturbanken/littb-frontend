/**
 * Parse managed markup without shipping the server DOM implementation to browsers.
 * Nitro installs the same standard DOMParser interface for SSR.
 */
export function parseHtmlDocument(markup: string): Document {
  return new DOMParser().parseFromString(markup, "text/html")
}
