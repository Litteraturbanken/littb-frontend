import { describe, expect, it } from "vitest"
import { parseHTML } from "linkedom"

import {
  encodedUrnResolverUrl,
  isProductionShortcutGuarded,
  isPublicShellPasteGuarded,
  legacyEnvironmentShortcutDestination,
  legacyQuickSearchInfoShortcut,
  pastedLbNavigationDestination,
  publicShellShortcutDestination,
  urnResolverUrl
} from "../../app/lib/production-shortcuts"

describe("production shortcuts", () => {
  it("applies source-info URN safety without imposing the copy shortcut length", () => {
    const longUrn = `urn:nbn:se:lb-${"x".repeat(120)}`
    expect(encodedUrnResolverUrl(longUrn)).not.toBeNull()
    expect(urnResolverUrl(longUrn)).toBeNull()
    for (const invalid of ["", "bad urn", " urn:nbn:se:lb-1", "urn:nbn:se:lb-1\u0080"]) {
      expect(encodedUrnResolverUrl(invalid)).toBeNull()
    }
  })

  it("builds the legacy typed resolver URL", () => {
    expect(urnResolverUrl("urn:nbn:se:lb-lb1234"))
      .toBe("https://urn.kb.se/resolve?urn=urn:nbn:se:lb-lb1234")
    expect(urnResolverUrl(null)).toBeNull()
    expect(urnResolverUrl("bad urn")).toBeNull()
    expect(urnResolverUrl("urn:nbn:se:lb-\u0080")).toBeNull()
    expect(urnResolverUrl("urn:nbn:se:lb-\ud800")).toBeNull()
    expect(urnResolverUrl("urn:nbn:se:lb-\udc00")).toBeNull()
  })

  it.each([
    "urn:nbn:se:lb-work&extra=1",
    "urn:nbn:se:lb-work#fragment",
    "urn:nbn:se:lb-work=edition",
    "urn:nbn:se:lb-work+supplement",
    "urn:nbn:se:lb-work%",
    "urn:nbn:se:lb-Röda-😀"
  ])("encodes %j as exactly one resolver query value", urn => {
    const result = urnResolverUrl(urn)
    expect(result).not.toBeNull()

    const parsed = new URL(result!)
    expect(parsed.origin + parsed.pathname).toBe("https://urn.kb.se/resolve")
    expect(parsed.searchParams.getAll("urn")).toEqual([urn])
    expect([...parsed.searchParams.keys()]).toEqual(["urn"])
    expect(parsed.hash).toBe("")
  })

  it("guards modifiers, composition, editable targets, and open dialogs", () => {
    const { document } = parseHTML(`<html><body>
      <input id="input">
      <div id="editor" contenteditable="true"><span id="editor-child">redigerbar</span></div>
      <div role="dialog"><span id="dialog-child">dialog</span></div>
      <a id="link" href="/bibliotek">länk</a>
      <button id="button" type="button">knapp</button>
      <div id="plain"></div>
    </body></html>`)
    const input = document.querySelector("#input")!
    const editorChild = document.querySelector("#editor-child")!
    const dialogChild = document.querySelector("#dialog-child")!
    const link = document.querySelector("#link")!
    const button = document.querySelector("#button")!
    const plain = document.querySelector("#plain")!
    const event = (overrides: Partial<KeyboardEvent> = {}) => ({
      altKey: false,
      ctrlKey: false,
      defaultPrevented: false,
      isComposing: false,
      key: "",
      metaKey: false,
      shiftKey: false,
      target: plain,
      ...overrides
    } as unknown as KeyboardEvent)
    expect(isProductionShortcutGuarded(event({ ctrlKey: true }), plain)).toBe(true)
    expect(isProductionShortcutGuarded(event({ altKey: true, key: "®" }), plain)).toBe(false)
    expect(isProductionShortcutGuarded(event({ altKey: true, key: "ı" }), plain)).toBe(false)
    expect(isProductionShortcutGuarded(event({ altKey: true, key: "b" }), plain)).toBe(true)
    expect(isProductionShortcutGuarded(event({ isComposing: true }), plain)).toBe(true)
    expect(isProductionShortcutGuarded(event({ target: input }), input))
      .toBe(true)
    expect(isProductionShortcutGuarded(event({ target: editorChild }), editorChild))
      .toBe(true)
    expect(isProductionShortcutGuarded(event({ target: dialogChild }), dialogChild))
      .toBe(true)
    expect(isPublicShellPasteGuarded({ defaultPrevented: false, target: input } as unknown as ClipboardEvent, input))
      .toBe(true)
    expect(isPublicShellPasteGuarded({ defaultPrevented: false, target: dialogChild } as unknown as ClipboardEvent, dialogChild))
      .toBe(true)
    expect(isPublicShellPasteGuarded({ defaultPrevented: false, target: document.body } as unknown as ClipboardEvent, document.body))
      .toBe(false)
    expect(isPublicShellPasteGuarded({ defaultPrevented: false, target: document.documentElement } as unknown as ClipboardEvent, document.documentElement))
      .toBe(false)
    expect(isPublicShellPasteGuarded({ defaultPrevented: false, target: document.body } as unknown as ClipboardEvent, null))
      .toBe(false)
    for (const focused of [plain, link, button]) {
      expect(isPublicShellPasteGuarded({ defaultPrevented: false, target: focused } as unknown as ClipboardEvent, focused))
        .toBe(true)
    }
    expect(isProductionShortcutGuarded(event(), plain))
      .toBe(false)
  })

  it("maps only the public unmodified shell keys to Nuxt destinations", () => {
    expect(publicShellShortcutDestination("h", "/bibliotek?keep=1&keep=2"))
      .toBe("/historik")
    expect(publicShellShortcutDestination("b", "/bibliotek?keep=1&keep=2"))
      .toBe("/bibliotek?keep=1&keep=2")
    expect(publicShellShortcutDestination("H", "/bibliotek")).toBeNull()
    expect(publicShellShortcutDestination("F19", "/bibliotek")).toBeNull()
    expect(publicShellShortcutDestination("F20", "/bibliotek")).toBeNull()
  })

  it.each(["F20", "ı", "ī"])("recognizes the legacy info shortcut %s", key => {
    expect(legacyQuickSearchInfoShortcut(key)).toBe(true)
  })

  it("ignores unrelated keys for the legacy info shortcut", () => {
    expect(legacyQuickSearchInfoShortcut("s")).toBe(false)
    expect(legacyQuickSearchInfoShortcut("I")).toBe(false)
  })

  it.each(["F19", "®", "ŗ"])("toggles the legacy site origin for %s", key => {
    expect(legacyEnvironmentShortcutDestination(
      key,
      "https://litteraturbanken.se/författare/StrindbergA?tab=verk#top"
    )).toBe("https://stage.litteraturbanken.se/f%C3%B6rfattare/StrindbergA?tab=verk#top")
    expect(legacyEnvironmentShortcutDestination(
      key,
      "https://stage.litteraturbanken.se/bibliotek?visa=works"
    )).toBe("https://litteraturbanken.se/bibliotek?visa=works")
    expect(legacyEnvironmentShortcutDestination(
      key,
      "https://stage.litteraturbanken.se/epub?visa=epub"
    )).toBe("https://litteraturbanken.se/epub?visa=epub")
    expect(legacyEnvironmentShortcutDestination(
      key,
      "http://127.0.0.1:3000/sök?fras=ord"
    )).toBe("https://litteraturbanken.se/s%C3%B6k?fras=ord")
  })

  it("does not build an environment destination for unrelated keys or invalid URLs", () => {
    expect(legacyEnvironmentShortcutDestination("F18", "https://litteraturbanken.se"))
      .toBeNull()
    expect(legacyEnvironmentShortcutDestination("F19", "not a URL")).toBeNull()
    for (const href of ["javascript:alert(1)", "data:text/html,x", "mailto:a@example.se"]) {
      expect(legacyEnvironmentShortcutDestination("F19", href)).toBeNull()
    }
  })

  it("maps one pasted lb-id to Editor and normalizes its prefix", () => {
    expect(pastedLbNavigationDestination("Öppna LB8345227, tack"))
      .toBe("/editor/lb8345227/ix/0/f")
    expect(pastedLbNavigationDestination("öppna lbAbC_12."))
      .toBe("/editor/lbAbC_12/ix/0/f")
  })

  it("maps multiple pasted lb-ids to the canonical legacy Library filter", () => {
    expect(pastedLbNavigationDestination("LB12 och lbAbC_34"))
      .toBe("/bibliotek?filter=lbworkid:lb12%20OR%20lbworkid:lbAbC_34&visa=works&sort=popularitet")
  })

  it("applies one shared identifier boundary to single and multiple paste", () => {
    const maximum = `lb${"x".repeat(97)}`
    const tooLong = `lb${"x".repeat(98)}`

    expect(pastedLbNavigationDestination(maximum))
      .toBe(`/editor/${maximum}/ix/0/f`)
    expect(pastedLbNavigationDestination(tooLong)).toBeNull()
    expect(pastedLbNavigationDestination(`${maximum} lb2`))
      .toBe(`/bibliotek?filter=lbworkid:${maximum}%20OR%20lbworkid:lb2&visa=works&sort=popularitet`)
    expect(pastedLbNavigationDestination(`${tooLong} lb2`)).toBeNull()
  })

  it.each([
    "",
    "utan identifierare",
    "blb123",
    "ölburk",
    "ålb123ö",
    "élbTest",
    "lb-123",
    `lb${"x".repeat(99)}`,
    `prefix ${"x".repeat(65_536)} lb123`
  ])("ignores invalid or unbounded pasted content %j", value => {
    expect(pastedLbNavigationDestination(value)).toBeNull()
  })
})
