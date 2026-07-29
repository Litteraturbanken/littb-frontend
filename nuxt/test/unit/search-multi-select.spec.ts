import { describe, expect, test } from "vitest"

describe("SearchMultiSelect grouped normalization", () => {
  test("forwards only the reviewed class and Library marker attributes", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ssrContextKey }, { default: SearchMultiSelect }] = await Promise.all([
      import("vue"),
      import("../../app/components/search/SearchMultiSelect.vue")
    ])
    let hostileClicks = 0
    const markers = [
      "data-library-about-authors",
      "data-library-keywords",
      "data-library-languages",
      "data-library-media",
      "data-library-narrowing"
    ] as const
    const app = createApp({
      setup: () => () => h(SearchMultiSelect, {
        modelValue: [],
        options: [],
        placeholder: "Säkra attribut",
        class: "consumer-class",
        ...Object.fromEntries(markers.map(marker => [marker, ""])),
        innerHTML: "<strong>hostile</strong>",
        textContent: "hostile text",
        onClick: () => { hostileClicks += 1 }
      })
    })
    app.provide(ssrContextKey, { modules: new Set<string>() })
    app.mount(target)
    await nextTick()

    const root = target.querySelector<HTMLElement>(".filter_select")!
    expect(root.classList.contains("consumer-class")).toBe(true)
    for (const marker of markers) expect(root.hasAttribute(marker)).toBe(true)
    expect(root.innerHTML).not.toContain("hostile")
    expect(root.textContent).not.toContain("hostile text")
    root.click()
    expect(hostileClicks).toBe(0)
    app.unmount()
  })

  test("renders flat options when option groups are omitted", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ssrContextKey }, { default: SearchMultiSelect }] = await Promise.all([
      import("vue"),
      import("../../app/components/search/SearchMultiSelect.vue")
    ])
    const app = createApp({
      setup: () => () => h(SearchMultiSelect, {
        modelValue: [],
        options: [
          { value: "alpha", label: "Alfa" },
          { value: "beta", label: "Beta" }
        ],
        placeholder: "Platta val"
      })
    })
    app.provide(ssrContextKey, { modules: new Set<string>() })
    app.mount(target)
    await nextTick()

    target.querySelector<HTMLElement>(".multiselect")!
      .dispatchEvent(new window.Event("focus"))
    await nextTick()

    expect([...target.querySelectorAll<HTMLElement>('[role="option"]')]
      .map(option => option.textContent?.trim()))
      .toEqual(["Alfa", "Beta"])
    app.unmount()
  })

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

  test("keeps persistent controls and selected chips in production order", async () => {
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
          placeholder: "Författarskap",
          persistentInputRow: true
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
    expect((fixedRow as HTMLInputElement | null)?.placeholder).toBe("Författarskap")
    expect([...fixedRow!.parentElement!.children].indexOf(fixedRow!))
      .toBeLessThan([...fixedTags!.parentElement!.children].indexOf(fixedTags!))

    const searchableTags = searchable!.querySelector(".multiselect__tags-wrap")
    const searchableInput = searchable!.querySelector<HTMLInputElement>("input.multiselect__input")
    expect(searchableTags?.textContent).toContain("Alfa")
    expect(searchableInput?.placeholder).toBe("Titlar")
    expect([...searchableTags!.parentElement!.children].indexOf(searchableTags!))
      .toBeLessThan([...searchableInput!.parentElement!.children].indexOf(searchableInput!))
    app.unmount()
  })
})
