import { describe, expect, test } from "vitest"

describe("RenderableHtmlContent", () => {
  test("renders every allowed native tag without a wrapper and forwards native attrs once", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [
      { createApp, h, nextTick },
      { default: RenderableHtmlContent },
      { issueAuthorProfileHtml }
    ] = await Promise.all([
      import("vue"),
      import("../../app/components/global/RenderableHtmlContent.vue"),
      import("../../shared/utils/renderable-html")
    ])
    let clicks = 0
    const app = createApp({
      render: () => h("main", [
        h(RenderableHtmlContent, {
          as: "div",
          html: issueAuthorProfileHtml("<strong>Division</strong>"),
          class: "rich-content",
          style: { color: "red" },
          "aria-label": "Profile content",
          "data-renderable": "div",
          onClick: () => clicks++
        }),
        h(RenderableHtmlContent, {
          as: "section",
          html: issueAuthorProfileHtml("<em>Section</em>"),
          "data-renderable": "section"
        }),
        h(RenderableHtmlContent, {
          as: "figcaption",
          html: issueAuthorProfileHtml("<span>Caption</span>"),
          "data-renderable": "figcaption"
        }),
        h("table", [
          h("tbody", [
            h("tr", [
              h(RenderableHtmlContent, {
                as: "td",
                html: issueAuthorProfileHtml("<b>Cell</b>"),
                "data-renderable": "td"
              })
            ])
          ])
        ])
      ])
    })
    app.mount(target)
    await nextTick()

    const rendered = [...target.querySelectorAll<HTMLElement>("[data-renderable]")]
    expect(rendered.map(element => element.localName)).toEqual([
      "div",
      "section",
      "figcaption",
      "td"
    ])
    expect(rendered[0]?.parentElement?.localName).toBe("main")
    expect(rendered[0]?.className).toBe("rich-content")
    expect(rendered[0]?.style.color).toBe("red")
    expect(rendered[0]?.getAttribute("aria-label")).toBe("Profile content")
    expect(rendered[0]?.innerHTML).toBe("<strong>Division</strong>")

    rendered[0]?.dispatchEvent(new window.Event("click"))
    expect(clicks).toBe(1)
    app.unmount()
    target.remove()
  })

  test("does not allow innerHTML or textContent attrs to override the reviewed capability", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [
      { createApp, h, nextTick },
      { default: RenderableHtmlContent },
      { issueAuthorProfileHtml }
    ] = await Promise.all([
      import("vue"),
      import("../../app/components/global/RenderableHtmlContent.vue"),
      import("../../shared/utils/renderable-html")
    ])
    const app = createApp({
      render: () => h(RenderableHtmlContent, {
        as: "section",
        html: issueAuthorProfileHtml("<strong>Reviewed</strong>"),
        innerHTML: "<em>Caller override</em>",
        textContent: "Caller text"
      })
    })
    app.mount(target)
    await nextTick()

    expect(target.innerHTML).toBe("<section><strong>Reviewed</strong></section>")
    app.unmount()
    target.remove()
  })

  test("adds no element when its conditional owner omits it", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [
      { createApp, h, nextTick, ref },
      { default: RenderableHtmlContent },
      { issueAuthorProfileHtml }
    ] = await Promise.all([
      import("vue"),
      import("../../app/components/global/RenderableHtmlContent.vue"),
      import("../../shared/utils/renderable-html")
    ])
    const visible = ref(false)
    const app = createApp({
      render: () => visible.value
        ? h(RenderableHtmlContent, {
            as: "div",
            html: issueAuthorProfileHtml("<p>Hidden</p>")
          })
        : null
    })
    app.mount(target)
    await nextTick()

    expect(target.children).toHaveLength(0)
    app.unmount()
    target.remove()
  })

  test("serializes each native tag to exact wrapperless SSR markup", async () => {
    const [
      { h },
      { renderToString },
      { default: RenderableHtmlContent },
      { issueAuthorProfileHtml }
    ] = await Promise.all([
      import("vue"),
      import("@vue/server-renderer"),
      import("../../app/components/global/RenderableHtmlContent.vue"),
      import("../../shared/utils/renderable-html")
    ])

    await expect(renderToString(h(RenderableHtmlContent, {
      as: "div",
      html: issueAuthorProfileHtml("<b>Division</b>"),
      class: "rich"
    }))).resolves.toBe("<div class=\"rich\"><b>Division</b></div>")
    await expect(renderToString(h(RenderableHtmlContent, {
      as: "section",
      html: issueAuthorProfileHtml("<i>Section</i>"),
      "aria-label": "Section"
    }))).resolves.toBe("<section aria-label=\"Section\"><i>Section</i></section>")
    await expect(renderToString(h(RenderableHtmlContent, {
      as: "figcaption",
      html: issueAuthorProfileHtml("<span>Caption</span>")
    }))).resolves.toBe("<figcaption><span>Caption</span></figcaption>")
    await expect(renderToString(h(RenderableHtmlContent, {
      as: "td",
      html: issueAuthorProfileHtml("<em>Cell</em>"),
      "data-cell": "source"
    }))).resolves.toBe("<td data-cell=\"source\"><em>Cell</em></td>")
  })

  test("hydrates server markup byte-for-byte without a hydration warning", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [
      { createSSRApp, h, nextTick },
      { renderToString },
      { default: RenderableHtmlContent },
      { issueAuthorProfileHtml }
    ] = await Promise.all([
      import("vue"),
      import("@vue/server-renderer"),
      import("../../app/components/global/RenderableHtmlContent.vue"),
      import("../../shared/utils/renderable-html")
    ])
    const html = issueAuthorProfileHtml("<strong>Hydrated</strong><br><em>Content</em>")
    const render = () => h(RenderableHtmlContent, {
      as: "section",
      html,
      class: "hydrated",
      "aria-label": "Hydrated content"
    })
    const serverMarkup = await renderToString(createSSRApp({ render }))
    target.innerHTML = serverMarkup
    const beforeHydration = target.innerHTML
    const warnings: unknown[][] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => warnings.push(args)
    const app = createSSRApp({ render })

    try {
      app.mount(target)
      await nextTick()
      expect(target.innerHTML).toBe(beforeHydration)
      expect(warnings.filter(args => args.join(" ").toLowerCase().includes("hydration"))).toEqual([])
    } finally {
      app.unmount()
      console.warn = originalWarn
      target.remove()
    }
  })
})
