import { describe, expect, onTestFinished, test } from "vitest"

describe("LegacyNotice", () => {
  test("keeps one polite live region mounted while visual messages change", async () => {
    const [{ createApp, h, nextTick, ref }, { default: LegacyNotice }] = await Promise.all([
      import("vue"),
      import("../../app/components/global/LegacyNotice.vue")
    ])
    const message = ref("")
    const target = document.createElement("div")
    document.body.append(target)
    const app = createApp({
      setup: () => () => h(LegacyNotice, { message: message.value })
    })
    app.mount(target)
    onTestFinished(() => {
      app.unmount()
      target.remove()
    })
    await nextTick()

    const liveRegion = target.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion?.textContent).toBe("")
    expect(liveRegion?.classList.contains("alert_popup")).toBe(false)

    message.value = "Första meddelandet"
    await nextTick()
    expect(target.querySelector('[role="status"]')).toBe(liveRegion)
    expect(liveRegion?.textContent).toBe("Första meddelandet")
    expect(liveRegion?.classList.contains("alert_popup")).toBe(true)

    message.value = "Andra meddelandet"
    await nextTick()
    expect(target.querySelector('[role="status"]')).toBe(liveRegion)
    expect(liveRegion?.textContent).toBe("Andra meddelandet")

    message.value = ""
    await nextTick()
    expect(target.querySelector('[role="status"]')).toBe(liveRegion)
    expect(liveRegion?.textContent).toBe("")
    expect(liveRegion?.classList.contains("alert_popup")).toBe(false)
  })
})
