import { parseHTML } from "linkedom"
import type { Environment } from "vitest/environments"

export default <Environment>{
  name: "linkedom",
  viteEnvironment: "client",
  setup(global) {
    const originalGlobals = {
      document: global.document,
      Element: global.Element,
      HTMLElement: global.HTMLElement,
      Node: global.Node,
      cancelAnimationFrame: global.cancelAnimationFrame,
      requestAnimationFrame: global.requestAnimationFrame,
      SVGElement: global.SVGElement,
      window: global.window
    }
    const { document, window } = parseHTML("<html><body></body></html>")
    window.getComputedStyle = () => ({
      animationDelay: "0s",
      animationDuration: "0s",
      transitionDelay: "0s",
      transitionDuration: "0s"
    }) as CSSStyleDeclaration
    Object.assign(global, {
      document,
      Element: window.Element,
      HTMLElement: window.HTMLElement,
      Node: window.Node,
      cancelAnimationFrame: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
      requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
      SVGElement: window.SVGElement,
      window
    })
    return {
      teardown: () => Object.assign(global, originalGlobals)
    }
  }
}
