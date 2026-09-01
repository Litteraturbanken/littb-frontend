import { describe, expect, test } from "vitest"

import {
  adjacentReaderPageName,
  horizontalScrollEdge,
  keyboardNavigationAction,
  type KeyboardNavigationOptions
} from "../../app/lib/reader-keyboard-navigation"

function options(
  overrides: Partial<KeyboardNavigationOptions> = {}
): KeyboardNavigationOptions {
  return {
    altArrowAction: "part",
    atEdge: () => false,
    letterAction: "part",
    ...overrides
  }
}

describe("reader keyboard navigation", () => {
  test("adjacent navigation honors the manifest page step", () => {
    const pages = ["1", "2", "3", "4"].map(page_name => ({ page_name }))
    expect(adjacentReaderPageName(pages, "1", 2, "next")).toBe("3")
    expect(adjacentReaderPageName(pages, "3", 2, "previous")).toBe("1")
    expect(adjacentReaderPageName(pages, "3", 2, "next")).toBeNull()
  })

  test.each([
    ["previous", { contentWidth: 1000, scrollLeft: 9.75, viewportWidth: 600 }, true],
    ["previous", { contentWidth: 1000, scrollLeft: 10, viewportWidth: 600 }, false],
    ["next", { contentWidth: 1000, scrollLeft: 390.25, viewportWidth: 600 }, true],
    ["next", { contentWidth: 1000, scrollLeft: 300, viewportWidth: 600 }, false],
    ["next", { contentWidth: 600, scrollLeft: 0, viewportWidth: 600 }, true]
  ] as const)("detects the %s horizontal edge with bounded layout tolerance", (
    direction,
    metrics,
    expected
  ) => {
    expect(horizontalScrollEdge(direction, metrics)).toBe(expected)
  })

  test.each([
    ["n", false, false, { direction: "next", kind: "adjacent" }],
    ["f", false, false, { direction: "previous", kind: "adjacent" }],
    ["m", false, false, { direction: "next", kind: "part" }],
    ["F16", false, false, { direction: "next", kind: "part" }],
    ["d", false, false, { direction: "previous", kind: "part" }],
    ["F15", false, false, { direction: "previous", kind: "part" }],
    ["ArrowRight", true, true, { direction: "next", kind: "jump" }],
    ["ArrowLeft", true, true, { direction: "previous", kind: "jump" }],
    ["ArrowRight", true, false, { direction: "next", kind: "part" }],
    ["ArrowLeft", false, true, { direction: "previous", kind: "adjacent" }]
  ] as const)(
    "%s with alt=%s shift=%s resolves to %o",
    (key, altKey, shiftKey, expected) => {
      expect(keyboardNavigationAction({ altKey, key, shiftKey }, options())).toEqual(expected)
    }
  )

  test("plain arrows navigate only at the corresponding scroll edge", () => {
    const atEdge = (direction: "next" | "previous") => direction === "next"
    expect(keyboardNavigationAction(
      { altKey: false, key: "ArrowRight", shiftKey: false },
      options({ atEdge })
    )).toEqual({ direction: "next", kind: "adjacent" })
    expect(keyboardNavigationAction(
      { altKey: false, key: "ArrowLeft", shiftKey: false },
      options({ atEdge })
    )).toBeNull()
  })

  test("an editor-style policy maps letter jumps and ignores alt-only arrows", () => {
    const editorOptions = options({ altArrowAction: null, letterAction: "jump" })
    expect(keyboardNavigationAction(
      { altKey: false, key: "m", shiftKey: false },
      editorOptions
    )).toEqual({ direction: "next", kind: "jump" })
    expect(keyboardNavigationAction(
      { altKey: true, key: "ArrowRight", shiftKey: false },
      editorOptions
    )).toBeNull()
  })

  test("unrelated keys do not navigate", () => {
    expect(keyboardNavigationAction(
      { altKey: false, key: "Escape", shiftKey: false },
      options()
    )).toBeNull()
  })
})
