import { afterEach, describe, expect, it } from "vitest"

import { libraryTooltipDirective } from "../../app/directives/library-tooltip"

describe("libraryTooltipDirective", () => {
  afterEach(() => {
    document.querySelectorAll(".library-tooltip").forEach(element => element.remove())
  })

  it("exposes tooltip text to SSR without emitting empty metadata", () => {
    expect(libraryTooltipDirective.getSSRProps?.(
      { value: "Full title" } as never,
      { type: "span", props: null } as never
    )).toEqual({ "data-library-tooltip-content": "Full title" })
    expect(libraryTooltipDirective.getSSRProps?.(
      { value: "" } as never,
      { type: "span", props: null } as never
    )).toEqual({})
  })

  it("owns inert-host tabindex only while nonempty tooltip content exists", () => {
    const span = document.createElement("span")
    document.body.append(span)

    libraryTooltipDirective.mounted?.(span, { value: "" } as never, {} as never, null)
    expect(span.hasAttribute("tabindex")).toBe(false)
    libraryTooltipDirective.updated?.(
      span, { value: "Full title", oldValue: "" } as never, {} as never, null
    )
    expect(span.getAttribute("tabindex")).toBe("0")
    libraryTooltipDirective.updated?.(
      span, { value: "", oldValue: "Full title" } as never, {} as never, null
    )
    expect(span.hasAttribute("tabindex")).toBe(false)

    span.setAttribute("tabindex", "-1")
    libraryTooltipDirective.updated?.(
      span, { value: "Restored title", oldValue: "" } as never, {} as never, null
    )
    expect(span.getAttribute("tabindex")).toBe("-1")
    libraryTooltipDirective.updated?.(
      span, { value: "", oldValue: "Restored title" } as never, {} as never, null
    )
    expect(span.getAttribute("tabindex")).toBe("-1")
    span.remove()
  })

  it("does not override native or caller-mutated tabindex and restores owned state on unmount", () => {
    const link = document.createElement("a")
    link.href = "/safe"
    const custom = document.createElement("span")
    custom.setAttribute("tabindex", "7")
    const owned = document.createElement("span")
    document.body.append(link, custom, owned)

    for (const element of [link, custom, owned]) {
      libraryTooltipDirective.mounted?.(
        element, { value: "Full title" } as never, {} as never, null
      )
    }
    expect(link.hasAttribute("tabindex")).toBe(false)
    expect(custom.getAttribute("tabindex")).toBe("7")
    expect(owned.getAttribute("tabindex")).toBe("0")

    const hreflessLink = document.createElement("a")
    document.body.append(hreflessLink)
    libraryTooltipDirective.mounted?.(
      hreflessLink, { value: "Linked title" } as never, {} as never, null
    )
    expect(hreflessLink.getAttribute("tabindex")).toBe("0")
    hreflessLink.setAttribute("href", "/safe")
    libraryTooltipDirective.updated?.(
      hreflessLink,
      { value: "Linked title", oldValue: "Linked title" } as never,
      {} as never,
      null
    )
    expect(hreflessLink.hasAttribute("tabindex")).toBe(false)

    owned.setAttribute("tabindex", "3")
    libraryTooltipDirective.updated?.(
      owned, { value: "Updated title", oldValue: "Full title" } as never, {} as never, null
    )
    libraryTooltipDirective.beforeUnmount?.(owned, {} as never, {} as never, null)
    expect(owned.getAttribute("tabindex")).toBe("3")

    libraryTooltipDirective.beforeUnmount?.(link, {} as never, {} as never, null)
    libraryTooltipDirective.beforeUnmount?.(custom, {} as never, {} as never, null)
    libraryTooltipDirective.beforeUnmount?.(hreflessLink, {} as never, {} as never, null)
    link.remove()
    custom.remove()
    owned.remove()
    hreflessLink.remove()
  })

  it("restores an inert host's described-by and tabindex attributes on unmount", () => {
    const span = document.createElement("span")
    span.setAttribute("aria-describedby", "existing-description")
    document.body.append(span)
    libraryTooltipDirective.mounted?.(
      span, { value: "Full title" } as never, {} as never, null
    )

    libraryTooltipDirective.beforeUnmount?.(span, {} as never, {} as never, null)
    expect(span.getAttribute("aria-describedby")).toBe("existing-description")
    expect(span.hasAttribute("tabindex")).toBe(false)
    span.remove()
  })
})
