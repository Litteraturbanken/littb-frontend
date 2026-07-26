import { describe, expect, it } from "vitest"
import { parseHTML } from "linkedom"

import {
  isProductionShortcutGuarded,
  isPublicShellPasteGuarded,
  pastedLbNavigationDestination,
  publicShellShortcutDestination,
  urnResolverUrl
} from "../../app/lib/production-shortcuts"

describe("production shortcuts", () => {
  it("builds the legacy typed resolver URL", () => {
    expect(urnResolverUrl("urn:nbn:se:lb-lb1234"))
      .toBe("https://urn.kb.se/resolve?urn=urn:nbn:se:lb-lb1234")
    expect(urnResolverUrl(null)).toBeNull()
    expect(urnResolverUrl("bad urn")).toBeNull()
  })

  it("guards modifiers, composition, editable targets, and open dialogs", () => {
    const { document } = parseHTML(`
      <input id="input">
      <div id="editor" contenteditable="true"><span id="editor-child">redigerbar</span></div>
      <div role="dialog" aria-modal="true"><span id="dialog-child">modal</span></div>
      <div id="plain"></div>
    `)
    const input = document.querySelector("#input")!
    const editorChild = document.querySelector("#editor-child")!
    const dialogChild = document.querySelector("#dialog-child")!
    const plain = document.querySelector("#plain")!
    const event = (overrides: Partial<KeyboardEvent> = {}) => ({
      altKey: false,
      ctrlKey: false,
      defaultPrevented: false,
      isComposing: false,
      metaKey: false,
      shiftKey: false,
      target: plain,
      ...overrides
    } as unknown as KeyboardEvent)
    expect(isProductionShortcutGuarded(event({ ctrlKey: true }), plain)).toBe(true)
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
    expect(isPublicShellPasteGuarded({ defaultPrevented: false, target: plain } as unknown as ClipboardEvent, plain))
      .toBe(false)
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

  it.each([
    "",
    "utan identifierare",
    "blb123",
    "lb-123",
    `lb${"x".repeat(99)}`,
    `prefix ${"x".repeat(65_536)} lb123`
  ])("ignores invalid or unbounded pasted content %j", value => {
    expect(pastedLbNavigationDestination(value)).toBeNull()
  })
})
