import { describe, expect, onTestFinished, test, vi } from "vitest"

vi.mock("@headlessui/vue", async () => {
  const { defineComponent, h } = await import("vue")
  const passthrough = (name: string) => defineComponent({
    name,
    inheritAttrs: false,
    setup(_props, { slots }) {
      return () => h("div", slots.default?.())
    }
  })
  return {
    Dialog: passthrough("Dialog"),
    DialogPanel: passthrough("DialogPanel"),
    DialogTitle: passthrough("DialogTitle")
  }
})

describe("ReaderContentsDialog link ownership", () => {
  test("intercepts only an unmodified primary contents selection", async () => {
    const [{ createApp, defineComponent, h, nextTick, onMounted, ref }, {
      default: ReaderContentsDialog
    }] = await Promise.all([
      import("vue"),
      import("../../app/components/reader/ReaderContentsDialog.vue")
    ])
    vi.stubGlobal("ref", ref)
    vi.stubGlobal("onMounted", onMounted)
    onTestFinished(() => vi.unstubAllGlobals())

    const target = document.createElement("div")
    document.body.append(target)
    onTestFinished(() => target.remove())
    const selections: string[] = []
    const NuxtLink = defineComponent({
      props: { to: { type: String, required: true }, custom: Boolean },
      setup(props, { slots }) {
        return () => slots.default?.({ href: props.to })
      }
    })
    const app = createApp({
      setup: () => () => h(ReaderContentsDialog, {
        open: true,
        contributors: [],
        title: "Delat verk",
        imprintYear: "1905",
        parts: [{
          authors: [],
          end_page_index: 2,
          end_page_name: "-2",
          nav_title: "Mellandelen",
          short_title: null,
          source_index: 0,
          start_page_index: 1,
          start_page_name: "-3",
          title: "Den fullständiga titeln",
          title_id: "Mellandelen"
        }],
        partHrefs: ["/reader/page/-3?raw=%2f#del"],
        onSelectPage: (pageName: string) => selections.push(pageName)
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.component("ReaderContributors", defineComponent({
      setup: () => () => null
    }))
    app.mount(target)
    onTestFinished(() => app.unmount())
    await nextTick()

    const link = target.querySelector<HTMLAnchorElement>(".part_menu .title a")!
    expect(link.getAttribute("href")).toBe("/reader/page/-3?raw=%2f#del")
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

    for (const init of [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { button: 1 }
    ]) {
      let bubbled = 0
      const blockNativeNavigation = (event: Event) => {
        bubbled += 1
        event.preventDefault()
      }
      target.addEventListener("click", blockNativeNavigation, { once: true })
      const event = clickEvent(init)
      link.dispatchEvent(event)
      target.removeEventListener("click", blockNativeNavigation)

      expect(bubbled).toBe(1)
      expect(selections).toEqual([])
    }

    let defaultPreventedBubbled = 0
    const observePrevented = () => { defaultPreventedBubbled += 1 }
    target.addEventListener("click", observePrevented, { once: true })
    const alreadyPrevented = clickEvent()
    alreadyPrevented.preventDefault()
    link.dispatchEvent(alreadyPrevented)
    target.removeEventListener("click", observePrevented)
    expect(defaultPreventedBubbled).toBe(1)
    expect(selections).toEqual([])

    let normalBubbled = 0
    target.addEventListener("click", () => { normalBubbled += 1 }, { once: true })
    const normalClick = clickEvent()
    link.dispatchEvent(normalClick)
    expect(normalClick.defaultPrevented).toBe(true)
    expect(normalBubbled).toBe(0)
    expect(selections).toEqual(["-3"])
  })
})
