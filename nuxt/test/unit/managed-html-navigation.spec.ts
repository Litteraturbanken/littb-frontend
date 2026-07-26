import { describe, expect, test } from "vitest"

import { managedHtmlNavigationTarget } from "../../app/lib/managed-html-navigation"

const currentUrl = "https://litteraturbanken.se/om/ide"

function target(
  href: string,
  overrides: Partial<Parameters<typeof managedHtmlNavigationTarget>[0]> = {}
) {
  return managedHtmlNavigationTarget({
    href,
    currentUrl,
    button: 0,
    defaultPrevented: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    download: false,
    target: null,
    ...overrides
  })
}

describe("managed HTML navigation", () => {
  test.each([
    ["/presentationer?ankare=kulturarvet", "/presentationer?ankare=kulturarvet"],
    [
      "/författare/Lagerl%C3%B6fS?om-boken",
      "/f%C3%B6rfattare/Lagerl%C3%B6fS?om-boken"
    ],
    ["/sök?fras=röd%20sol&prefix", "/s%C3%B6k?fras=röd%20sol&prefix"],
    ["/editor/lb123/ix/4/e", "/editor/lb123/ix/4/e"],
    ["/om/ide/", "/om/ide/"],
    [
      "https://litteraturbanken.se/om/rattigheter?from=managed",
      "/om/rattigheter?from=managed"
    ]
  ])("enhances the Nuxt-owned link %s", (href, expected) => {
    expect(target(href)).toBe(expected)
  })

  test.each([
    ["modified click", "/om/ide", { metaKey: true }],
    ["non-primary click", "/om/ide", { button: 1 }],
    ["prevented click", "/om/ide", { defaultPrevented: true }],
    ["download", "/om/ide", { download: true }],
    ["explicit target", "/om/ide", { target: "_self" }],
    ["hash anchor", "#organisation", {}],
    ["fragment-bearing route", "/om/ide#organisation", {}],
    ["external origin", "https://example.test/om/ide", {}],
    ["mailto", "mailto:info@litteraturbanken.se", {}],
    ["deployment handoff", "/skolan/lararsida/", {}],
    ["external project", "/diktensmuseum/utstallning/", {}],
    ["managed download", "/red/om/ide/Litteraturbanken.pdf", {}],
    ["text download", "/txt/epub/book.epub", {}],
    ["unknown local path", "/inte-en-nuxt-route", {}],
    ["server alias", "/hjalp", {}],
    ["legacy presentation alias", "/p/s/Censur.html", {}],
    ["legacy latest alias", "/om/aktuellt", {}],
    ["normalized author alias", "/forfattare/LagerlofS?om-boken", {}],
    ["unsupported author document", "/författare/Test/legacy", {}],
    ["unsupported reader media", "/författare/Test/titlar/Book/pdf", {}],
    ["invalid Nuxt depth", "/id/lb123/extra", {}]
  ])("leaves %s to native browser behavior", (_label, href, overrides) => {
    expect(target(href, overrides)).toBeNull()
  })
})
