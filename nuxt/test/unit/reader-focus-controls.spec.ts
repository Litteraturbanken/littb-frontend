import { describe, expect, onTestFinished, test, vi } from "vitest"

describe("ReaderFocusControls link ownership", () => {
  test("anchors controls to the visual viewport and releases viewport listeners", async () => {
    const [{ createApp, h, nextTick, ref, watch }, { default: ReaderFocusControls }] =
      await Promise.all([
        import("vue"),
        import("../../app/components/reader/ReaderFocusControls.vue")
      ])
    vi.stubGlobal("ref", ref)
    vi.stubGlobal("watch", watch)
    const viewport = Object.assign(new EventTarget(), {
      height: 664,
      offsetLeft: 4,
      offsetTop: 6,
      width: 390
    })
    vi.stubGlobal("visualViewport", viewport)
    vi.stubGlobal("innerHeight", 780)
    vi.stubGlobal("innerWidth", 458)
    const removeViewportListener = vi.spyOn(viewport, "removeEventListener")
    onTestFinished(() => vi.unstubAllGlobals())
    const target = document.createElement("div")
    document.body.append(target)
    const app = createApp({
      setup: () => () => h(ReaderFocusControls, {
        barVisible: true,
        largerSizeEnabled: false,
        mediaType: "faksimil",
        nextHref: null,
        nightMode: false,
        parts: [],
        previousHref: null,
        smallerSizeEnabled: false,
        startHref: null
      })
    })
    app.mount(target)
    await nextTick()

    const layer = document.querySelector<HTMLElement>(".reader-focus-layer")!
    expect(layer.style.getPropertyValue("--reader-focus-bottom")).toBe("110px")
    expect(layer.style.getPropertyValue("--reader-focus-center")).toBe("199px")
    expect(layer.style.getPropertyValue("--reader-focus-left")).toBe("4px")
    expect(layer.style.getPropertyValue("--reader-focus-right")).toBe("64px")
    expect(layer.style.getPropertyValue("--reader-focus-top")).toBe("6px")
    expect(layer.style.getPropertyValue("--reader-focus-width")).toBe("390px")

    viewport.height = 600
    viewport.dispatchEvent(new Event("resize"))
    await nextTick()
    expect(layer.style.getPropertyValue("--reader-focus-bottom")).toBe("174px")

    app.unmount()
    target.remove()
    expect(removeViewportListener).toHaveBeenCalledWith("resize", expect.any(Function))
    expect(removeViewportListener).toHaveBeenCalledWith("scroll", expect.any(Function))
  })

  test("intercepts only unmodified primary page-link clicks", async () => {
    const [{ createApp, h, nextTick, ref, watch }, { default: ReaderFocusControls }] =
      await Promise.all([
        import("vue"),
        import("../../app/components/reader/ReaderFocusControls.vue")
      ])
    vi.stubGlobal("ref", ref)
    vi.stubGlobal("watch", watch)
    onTestFinished(() => vi.unstubAllGlobals())
    const target = document.createElement("div")
    document.body.append(target)
    const navigations: string[] = []
    const app = createApp({
      setup: () => () => h(ReaderFocusControls, {
        barVisible: true,
        largerSizeEnabled: false,
        mediaType: "etext",
        nextHref: "/reader/next?raw=%2f#next",
        nightMode: false,
        parts: [],
        previousHref: "/reader/previous?raw=%2F#previous",
        smallerSizeEnabled: false,
        startHref: null,
        onNavigate: (href: string) => navigations.push(href)
      })
    })
    app.component("NuxtLink", {
      props: { to: { type: String, required: true } },
      setup: (props, { slots }) => () => h("a", { href: props.to }, slots.default?.())
    })
    app.mount(target)
    onTestFinished(() => {
      app.unmount()
      target.remove()
    })
    await nextTick()

    const anchors = [...document.querySelectorAll<HTMLAnchorElement>(
      ".reader-focus-layer > .leftCover, .reader-focus-layer > .rightCover, " +
      ".reader-focus-layer .bottomBar > .nav.left, " +
      ".reader-focus-layer .bottomBar > .nav.right"
    )]
    expect(anchors.map(anchor => anchor.getAttribute("href"))).toEqual([
      "/reader/previous?raw=%2F#previous",
      "/reader/next?raw=%2f#next",
      "/reader/previous?raw=%2F#previous",
      "/reader/next?raw=%2f#next"
    ])
    const clickEvent = (init: Record<string, boolean | number> = {}) => {
      const event = new window.Event("click", { bubbles: true, cancelable: true })
      Object.defineProperties(event, Object.fromEntries(Object.entries({
        altKey: false,
        button: 0,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        ...init
      }).map(([key, value]) => [key, { value }])))
      return event
    }

    for (const anchor of anchors) {
      for (const init of [
        { altKey: true },
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { button: 1 }
      ]) {
        let preventedByComponent: boolean | null = null
        anchor.addEventListener("click", event => {
          preventedByComponent = event.defaultPrevented
          event.preventDefault()
        }, { once: true })
        anchor.dispatchEvent(clickEvent(init))
        expect(preventedByComponent).toBe(false)
        expect(navigations).toEqual([])
      }

      const alreadyPrevented = clickEvent()
      alreadyPrevented.preventDefault()
      anchor.dispatchEvent(alreadyPrevented)
      expect(navigations).toEqual([])

      const normal = clickEvent()
      anchor.dispatchEvent(normal)
      expect(normal.defaultPrevented).toBe(true)
      expect(navigations.at(-1)).toBe(anchor.getAttribute("href"))
      navigations.length = 0
    }
  })

  test("exposes the current night-mode toggle state", async () => {
    const [{ createApp, h, nextTick, ref, watch }, { default: ReaderFocusControls }] =
      await Promise.all([
        import("vue"),
        import("../../app/components/reader/ReaderFocusControls.vue")
      ])
    vi.stubGlobal("ref", ref)
    vi.stubGlobal("watch", watch)
    onTestFinished(() => vi.unstubAllGlobals())
    const target = document.createElement("div")
    document.body.append(target)
    const nightMode = ref(false)
    const app = createApp({
      setup: () => () => h(ReaderFocusControls, {
        barVisible: true,
        largerSizeEnabled: false,
        mediaType: "etext",
        nextHref: null,
        nightMode: nightMode.value,
        parts: [],
        previousHref: null,
        smallerSizeEnabled: false,
        startHref: null
      })
    })
    app.component("NuxtLink", {
      props: { to: { type: String, required: true } },
      setup: (props, { slots }) => () => h("a", { href: props.to }, slots.default?.())
    })
    app.mount(target)
    onTestFinished(() => {
      app.unmount()
      target.remove()
    })
    await nextTick()

    const button = document.querySelector<HTMLButtonElement>(
      ".reader-focus-layer .focus-settings-menu > button"
    )!
    button.click()
    await nextTick()
    const night = document.querySelector<HTMLButtonElement>(".reader-focus-layer .night_switch")!
    expect(night.getAttribute("aria-label")).toBe("Nattläge")
    expect(night.getAttribute("aria-pressed")).toBe("false")
    nightMode.value = true
    await nextTick()
    expect(night.getAttribute("aria-label")).toBe("Nattläge")
    expect(night.getAttribute("aria-pressed")).toBe("true")
  })
})
