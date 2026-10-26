// @vitest-environment happy-dom
import { describe, expect, test } from "vitest"

describe("SearchMultiSelect grouped normalization", () => {
  test.each([false, true])("pages through grouped options (searchable=%s)", async (searchable) => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ssrContextKey }, { default: SearchMultiSelect }] = await Promise.all([
      import("vue"), import("../../app/components/search/SearchMultiSelect.vue")
    ])
    const updates: string[][] = []
    const app = createApp({ setup: () => () => h(SearchMultiSelect, {
      modelValue: [], options: [], searchable, placeholder: "Titles",
      optionGroups: [{ label: "Group", options: Array.from({ length: 12 }, (_, i) => ({
        value: String(i), label: `Title ${i}`, disabled: i === 4
      })) }],
      "onUpdate:modelValue": (value: string[]) => updates.push(value)
    }) })
    app.provide(ssrContextKey, { modules: new Set<string>() })
    app.mount(target)
    const root = target.querySelector<HTMLElement>(".multiselect")!
    expect(root.querySelector(".multiselect__select")?.getAttribute("tabindex")).toBe("-1")
    const press = async (key: string) => {
      const event = new window.Event("keydown", { bubbles: true, cancelable: true })
      Object.defineProperty(event, "key", { value: key })
      const input = target.querySelector<HTMLInputElement>("input.multiselect__input")
      const control = input!
      control.dispatchEvent(event)
      await new Promise(resolve => requestAnimationFrame(resolve))
      await nextTick()
      return event
    }
    try {
      await press("PageDown")
      expect(target.querySelector("input")?.getAttribute("aria-expanded")).toBe("false")
      root.querySelector<HTMLButtonElement>(".multiselect__select")!.click()
      await nextTick()
      const list = target.querySelector<HTMLElement>(".multiselect__content-wrapper")!
      list.scrollTop = 0
      Object.defineProperties(list, { clientHeight: { value: 100 }, clientTop: { value: 0 } })
      const rect = (top: number, height: number) => ({ top, bottom: top + height, height }) as DOMRect
      list.getBoundingClientRect = () => rect(0, 100)
      let top = 0
      for (const [index, row] of [...list.querySelectorAll<HTMLElement>(".multiselect__element")].entries()) {
        const height = index === 3 ? 60 : 20
        const rowTop = top
        row.getBoundingClientRect = () => rect(rowTop - list.scrollTop, height)
        row.querySelector<HTMLElement>(".multiselect__option")!.getBoundingClientRect = row.getBoundingClientRect
        top += height
      }
      const highlighted = () => list.querySelector<HTMLElement>(".multiselect__option--highlight")!
      expect(highlighted().textContent).toBe("Title 0")
      expect((await press("PageDown")).defaultPrevented).toBe(true)
      expect(highlighted().textContent).toBe("Title 3")
      await press("PageDown")
      expect(highlighted().textContent).toBe("Title 8")
      await press("PageUp")
      expect(highlighted().textContent).toBe("Title 3")
      await press("PageUp")
      await press("PageUp")
      expect(highlighted().textContent).toBe("Title 0")
      for (let i = 0; i < 5; i++) await press("PageDown")
      expect(highlighted().textContent).toBe("Title 11")
      expect(updates).toEqual([])
      await press("Enter")
      expect(updates).toEqual([["11"]])
    } finally {
      app.unmount()
      target.remove()
    }
  })

  test.each([false, true])("reopens a closed focused control on repeated clicks (searchable=%s)", async (searchable) => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ssrContextKey }, { default: SearchMultiSelect }] = await Promise.all([
      import("vue"), import("../../app/components/search/SearchMultiSelect.vue")
    ])
    const app = createApp({ setup: () => () => h(SearchMultiSelect, {
      modelValue: [], options: [{ value: "one", label: "One" }],
      searchable, placeholder: "Options"
    }) })
    app.provide(ssrContextKey, { modules: new Set<string>() })
    app.mount(target)
    const surface = target.querySelector<HTMLInputElement>("input.multiselect__input")!
    try {
      for (const expanded of ["true", "false", "true", "false", "true", "false"]) {
        surface.click()
        await nextTick()
        expect(surface.getAttribute("aria-expanded")).toBe(expanded)
      }
    } finally {
      app.unmount()
      target.remove()
    }
  })

  test("renders title options beyond the multiselect default limit", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ssrContextKey }, { default: SearchMultiSelect }] = await Promise.all([
      import("vue"), import("../../app/components/search/SearchMultiSelect.vue")
    ])
    const app = createApp({ setup: () => () => h(SearchMultiSelect, {
      modelValue: [], placeholder: "Titlar",
      options: Array.from({ length: 1501 }, (_, i) => ({ value: `lb${i}`, label: `Title ${i}` }))
    }) })
    app.provide(ssrContextKey, { modules: new Set<string>() })
    app.mount(target)
    target.querySelector<HTMLButtonElement>(".multiselect__select")!.click()
    await nextTick()
    expect(target.querySelectorAll('[role="option"]')).toHaveLength(1501)
    expect(target.textContent).toContain("Title 1500")
    app.unmount()
  })

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

    target.querySelector<HTMLButtonElement>(".multiselect__select")!.click()
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
    root.querySelector<HTMLButtonElement>(".multiselect__select")!.click()
    await nextTick()
    const beta = [...target.querySelectorAll<HTMLElement>(".multiselect__option")]
      .find(option => option.textContent?.trim() === "Beta")
    expect(beta).toBeDefined()
    beta!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }))
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
    expect(fixedRow?.getAttribute("role")).toBe("combobox")
    expect((fixedRow as HTMLInputElement).readOnly).toBe(true)

    const searchableTags = searchable!.querySelector(".multiselect__tags-wrap")
    const searchableInput = searchable!.querySelector<HTMLInputElement>("input.multiselect__input")
    expect(searchableTags?.textContent).toContain("Alfa")
    expect(searchableInput?.placeholder).toBe("Titlar")
    expect([...searchableTags!.parentElement!.children].indexOf(searchableTags!))
      .toBeLessThan([...searchableInput!.parentElement!.children].indexOf(searchableInput!))
    app.unmount()
  })
})
