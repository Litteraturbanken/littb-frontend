import { describe, expect, it } from "vitest"
import { parseHTML } from "linkedom"

import {
  isProductionShortcutGuarded,
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
    const { document } = parseHTML('<input id="input"><div id="plain"></div>')
    const input = document.querySelector("#input")!
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
    expect(isProductionShortcutGuarded(event(), plain))
      .toBe(false)
  })
})
