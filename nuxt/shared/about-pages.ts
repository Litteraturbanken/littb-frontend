import type { ManagedAssetHtml } from "./types/renderable-html"

export const aboutPages = {
  ide: {
    activePage: "ide",
    contentPath: "/red/om/ide/omlitteraturbanken.html"
  },
  organisation: {
    activePage: null,
    contentPath: "/red/om/ide/organisation.html"
  },
  rattigheter: {
    activePage: "rattigheter",
    contentPath: "/red/om/rattigheter/rattigheter.html"
  },
  tack: {
    activePage: "tack",
    contentPath: "/red/om/tack.html"
  },
  hjalp: {
    activePage: "hjalp",
    contentPath: "/red/om/hjalp/hjalp.html"
  },
  "mål": {
    activePage: null,
    contentPath: "/red/om/visioner/visioner.html"
  },
  "english.html": {
    activePage: null,
    contentPath: "/red/om/ide/english.html"
  },
  "deutsch.html": {
    activePage: null,
    contentPath: "/red/om/ide/deutsch.html"
  },
  "francais.html": {
    activePage: null,
    contentPath: "/red/om/ide/francais.html"
  }
} as const

export const aboutContentPaths = Object.values(aboutPages).map(page => page.contentPath)

export type AboutPageKey = keyof typeof aboutPages
export type AboutContent = ManagedAssetHtml<"about-editorial">

export function isAboutPageKey(value: unknown): value is AboutPageKey {
  return typeof value === "string" && Object.hasOwn(aboutPages, value)
}
