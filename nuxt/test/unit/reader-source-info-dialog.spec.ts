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

describe("ReaderSourceInfoDialog provenance projection", () => {
  test("keeps nullable faksimil identities without print-state prose", async () => {
    const [
      { computed, createApp, defineComponent, h, nextTick, onMounted, ref, watch },
      { default: ReaderSourceInfoDialog },
      { default: RenderableHtmlContent },
      { buildReaderSourceInfo },
      { dramaSourceInfo, sourceInfoLicenses, sourceInfoProvenance }
    ] = await Promise.all([
      import("vue"),
      import("../../app/components/reader/ReaderSourceInfoDialog.vue"),
      import("../../app/components/global/RenderableHtmlContent.vue"),
      import("../../server/utils/reader-source-info-projection"),
      import("../fixtures/reader-source-info-data.mjs")
    ])
    vi.stubGlobal("computed", computed)
    vi.stubGlobal("onMounted", onMounted)
    vi.stubGlobal("ref", ref)
    vi.stubGlobal("watch", watch)
    onTestFinished(() => vi.unstubAllGlobals())
    const sourceInfo = await buildReaderSourceInfo(
      { ...dramaSourceInfo, is_printed: null },
      { provenance: sourceInfoProvenance, licenses: sourceInfoLicenses },
      async () => []
    )
    const delimiterUrn = `urn:nbn:se:lb-${"x".repeat(110)}&part=1#fragment`
    const sourceInfoWithDelimiterUrn = {
      ...sourceInfo,
      urn: delimiterUrn
    }
    const target = document.createElement("div")
    document.body.append(target)
    const NuxtLink = defineComponent({
      props: { to: { type: String, required: true } },
      setup: (props, { slots }) => () => h("a", { href: props.to }, slots.default?.())
    })
    const app = createApp({
      setup: () => () => h(ReaderSourceInfoDialog, {
        open: true,
        loading: false,
        failed: false,
        sourceInfo: sourceInfoWithDelimiterUrn
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.component("RenderableHtmlContent", RenderableHtmlContent)
    app.mount(target)
    onTestFinished(() => {
      app.unmount()
      target.remove()
    })
    await nextTick()

    const provenance = [...target.querySelectorAll(".provenance")]
    expect(provenance).toHaveLength(2)
    expect(provenance.map(item => item.querySelector("img")?.getAttribute("alt")))
      .toEqual(["Kungl. biblioteket", "Dramawebben"])
    expect(provenance.every(item => item.querySelector("p") === null)).toBe(true)
    expect(target.textContent).not.toContain("Det avbildade exemplaret")
    expect(target.textContent).not.toContain("Det avbildade manuskriptet")
    expect(target.querySelector(".license")?.textContent).toContain(
      "Kungl. biblioteket – Dramawebben"
    )
    expect(target.querySelector(".urn code")?.textContent).toBe(
      `https://urn.kb.se/resolve?urn=urn:nbn:se:lb-${"x".repeat(110)}%26part%3D1%23fragment`
    )
  })
})
