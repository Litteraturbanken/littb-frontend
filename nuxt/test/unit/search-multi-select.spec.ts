import { describe, expect, test } from "vitest"

describe("SearchMultiSelect grouped normalization", () => {
  test("emits each grouped value once while preserving an unknown selection", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref, ssrContextKey }, { default: SearchMultiSelect }] = await Promise.all([
      import("vue"),
      import("../../app/components/search/SearchMultiSelect.vue")
    ])
    const selected = ref(["alpha", "unknown"])
    const updates: string[][] = []
    const app = createApp({
      setup: () => () => h(SearchMultiSelect, {
        modelValue: selected.value,
        options: [],
        optionGroups: [{
          label: "Grupp",
          options: [
            { value: "alpha", label: "Alfa" },
            { value: "beta", label: "Beta" }
          ]
        }],
        placeholder: "Grupperat val",
        "onUpdate:modelValue": (value: string[]) => {
          updates.push(value)
          selected.value = value
        }
      })
    })
    app.provide(ssrContextKey, { modules: new Set<string>() })
    app.mount(target)
    await nextTick()

    const root = target.querySelector(".multiselect") as HTMLElement
    root.dispatchEvent(new window.Event("focus"))
    await nextTick()
    const beta = [...target.querySelectorAll<HTMLElement>(".multiselect__option")]
      .find(option => option.textContent?.trim() === "Beta")
    expect(beta).toBeDefined()
    beta!.click()
    await nextTick()

    expect(updates).toEqual([["alpha", "beta", "unknown"]])
    app.unmount()
  })
})
