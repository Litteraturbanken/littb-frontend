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

  test("keeps selected chips above a persistent labeled control row", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ssrContextKey }, { default: SearchMultiSelect }] = await Promise.all([
      import("vue"),
      import("../../app/components/search/SearchMultiSelect.vue")
    ])
    const options = [{ value: "alpha", label: "Alfa" }]
    const app = createApp({
      setup: () => () => h("div", [
        h(SearchMultiSelect, {
          modelValue: ["alpha"],
          options,
          placeholder: "Författarskap"
        }),
        h(SearchMultiSelect, {
          modelValue: ["alpha"],
          options,
          placeholder: "Titlar",
          searchable: true
        })
      ])
    })
    app.provide(ssrContextKey, { modules: new Set<string>() })
    app.mount(target)
    await nextTick()

    const [fixed, searchable] = [...target.querySelectorAll<HTMLElement>(".filter_select")]
    const fixedTags = fixed!.querySelector(".multiselect__tags-wrap")
    const fixedRow = fixed!.querySelector(".search-multiselect__input-row")
    expect(fixedTags?.textContent).toContain("Alfa")
    expect(fixedRow?.textContent?.trim()).toBe("Författarskap")
    expect([...fixedTags!.parentElement!.children].indexOf(fixedTags!))
      .toBeLessThan([...fixedRow!.parentElement!.children].indexOf(fixedRow!))

    const searchableTags = searchable!.querySelector(".multiselect__tags-wrap")
    const searchableInput = searchable!.querySelector<HTMLInputElement>("input.multiselect__input")
    expect(searchableTags?.textContent).toContain("Alfa")
    expect(searchableInput?.placeholder).toBe("Titlar")
    expect([...searchableTags!.parentElement!.children].indexOf(searchableTags!))
      .toBeLessThan([...searchableInput!.parentElement!.children].indexOf(searchableInput!))
    app.unmount()
  })
})
