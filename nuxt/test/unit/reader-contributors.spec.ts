import { describe, expect, onTestFinished, test } from "vitest"

describe("ReaderContributors author links", () => {
  test("uses the canonical Author Profile route for contributor identities", async () => {
    const [{ createApp, defineComponent, h, nextTick }, { default: ReaderContributors }] =
      await Promise.all([
        import("vue"),
        import("../../app/components/reader/ReaderContributors.vue")
      ])
    let destination: string | null = null
    const NuxtLink = defineComponent({
      props: { to: { type: String, required: true } },
      setup: (props, { slots }) => () => {
        destination = props.to
        return h("a", { href: props.to }, slots.default?.())
      }
    })
    const target = document.createElement("div")
    document.body.append(target)
    const app = createApp({
      setup: () => () => h(ReaderContributors, {
        contributors: [{
          author_id: "O'Neil!()*A",
          author_type: null,
          full_name: "O'Neil",
          role: null,
          surname: "O'Neil"
        }]
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    onTestFinished(() => {
      app.unmount()
      target.remove()
    })
    await nextTick()

    const expected = "/f%C3%B6rfattare/O%27Neil%21%28%29%2AA"
    expect(destination).toBe(expected)
    expect(target.querySelector("a")?.textContent).toBe("O'Neil")
  })
})
