import { describe, expect, onTestFinished, test, vi } from "vitest"
import type { ReaderFacsimilePage } from "#shared/types/reader"

function scan(pageName: string, width = 1491): ReaderFacsimilePage {
  return {
    workId: "book", pageName, imageNumber: Number(pageName), title: "Book",
    author: { full_name: "Author" }, ocrOverlay: null,
    sources: [{ size: 5, width, url: `/scan-${pageName}.jpeg` }]
  } as ReaderFacsimilePage
}

async function mountReader() {
  const [vue, { default: ReaderFacsimileImage }] = await Promise.all([
    import("vue"), import("../../app/components/reader/ReaderFacsimileImage.vue")
  ])
  for (const name of ["ref", "shallowRef", "computed", "watch", "onMounted", "onBeforeUnmount"] as const) {
    vi.stubGlobal(name, vue[name])
  }
  const requests: PendingImage[] = []
  class PendingImage {
    src = ""
    srcset = ""
    naturalWidth = 1491
    naturalHeight = 2050
    resolve!: () => void
    reject!: (error: Error) => void
    constructor() { requests.push(this) }
    decode() {
      return new Promise<void>((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    }
  }
  vi.stubGlobal("Image", PendingImage)
  const page = vue.shallowRef(scan("35"))
  const target = document.createElement("div")
  document.body.append(target)
  const app = vue.createApp({
    setup: () => () => vue.h(ReaderFacsimileImage, {
      page: page.value, selectedSize: 5, ocrMode: false
    })
  })
  app.component("ClientOnly", { render: () => null })
  app.component("RenderableHtmlContent", { render: () => null })
  app.mount(target)
  const image = () => target.querySelector("img")!
  Object.defineProperties(image(), {
    naturalWidth: { value: 1491 }, naturalHeight: { value: 2050 }
  })
  image().dispatchEvent(new window.Event("load"))
  await vue.nextTick()
  onTestFinished(() => {
    app.unmount()
    target.remove()
    vi.unstubAllGlobals()
  })
  const flush = async () => { await Promise.resolve(); await vue.nextTick() }
  return { page, requests, image, target, flush, unmount: () => app.unmount() }
}

describe("facsimile decoded page handover", () => {
  test("retains the visible scan and real aspect until the requested scan decodes", async () => {
    const { page, requests, image, flush } = await mountReader()
    const original = image()
    page.value = scan("36")
    await flush()
    expect(requests).toHaveLength(1)
    expect(image()).toBe(original)
    expect(image().getAttribute("src")).toBe("/scan-35.jpeg")
    expect(image().getAttribute("height")).toBe("2050")
    requests[0]!.resolve()
    await flush()
    expect(image().getAttribute("src")).toBe("/scan-36.jpeg")
    expect(image().getAttribute("height")).toBe("2050")
    expect(image().getAttribute("alt")).toContain("sida 36")
  })

  test("late OCR and superseded decodes cannot replace the latest requested scan", async () => {
    const { page, requests, image, flush } = await mountReader()
    page.value = scan("36")
    await flush()
    page.value = scan("37")
    await flush()
    requests[1]!.resolve()
    await flush()
    requests[0]!.resolve()
    await flush()
    expect(image().getAttribute("src")).toBe("/scan-37.jpeg")
    page.value = { ...page.value, ocrOverlay: { width: 625, height: 900, html: "" } } as ReaderFacsimilePage
    await flush()
    expect(requests).toHaveLength(2)
    expect(image().getAttribute("height")).toBe("2050")
  })

  test("uses each decoded image's dimensions, including a different aspect or zoom", async () => {
    const { page, requests, image, flush } = await mountReader()
    const previousImage = image()
    page.value = scan("36", 1000)
    await flush()
    expect(image().getAttribute("width")).toBe("1491")
    requests[0]!.naturalWidth = 2000
    requests[0]!.naturalHeight = 2400
    requests[0]!.resolve()
    await flush()
    expect(image().getAttribute("width")).toBe("1000")
    expect(image().getAttribute("height")).toBe("1200")
    previousImage.dispatchEvent(new window.Event("load"))
    previousImage.dispatchEvent(new window.Event("error"))
    await flush()
    expect(image().getAttribute("height")).toBe("1200")
    expect(image().style.visibility).not.toBe("hidden")
  })

  test("resizes the current page immediately using its known aspect while loading a new resolution", async () => {
    const { page, requests, image, flush } = await mountReader()
    page.value = {
      ...scan("35", 1000),
      sources: [{ size: 5, width: 1000, url: "/scan-35-small.jpeg" }]
    }
    await flush()
    expect(requests).toHaveLength(1)
    expect(image().getAttribute("src")).toBe("/scan-35.jpeg")
    expect(image().getAttribute("width")).toBe("1000")
    expect(image().getAttribute("height")).toBe("1375")
    requests[0]!.resolve()
    await flush()
    expect(image().getAttribute("src")).toBe("/scan-35-small.jpeg")
    expect(image().getAttribute("height")).toBe("1375")
  })

  test("a failed scan keeps frame geometry, reports the error, and recovers on the next turn", async () => {
    const { page, requests, image, target, flush } = await mountReader()
    page.value = scan("36")
    await flush()
    requests[0]!.reject(new Error("image unavailable"))
    await flush()
    expect(target.querySelector('[role="alert"]')?.textContent).toContain("kunde inte hämtas")
    expect(image().getAttribute("height")).toBe("2050")
    expect(image().style.visibility).toBe("hidden")
    page.value = scan("37")
    await flush()
    requests[1]!.resolve()
    await flush()
    expect(target.querySelector('[role="alert"]')).toBeNull()
    expect(image().getAttribute("src")).toBe("/scan-37.jpeg")
    expect(image().style.visibility).not.toBe("hidden")
  })
})
