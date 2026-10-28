// @vitest-environment happy-dom
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, onTestFinished, test, vi } from "vitest"

vi.mock("../../app/components/global/ChronologyRangeSlider.vue", async () => {
  const { defineComponent, h } = await import("vue")
  return {
    default: defineComponent({
      props: {
        from: { type: [Number, String], required: true },
        to: { type: [Number, String], required: true }
      },
      emits: ["draft", "commit", "cancel"],
      setup(props, { emit }) {
        const value = (event: Event) => (event.target as HTMLInputElement).value
        return () => h("div", { class: "rzslider" }, [
          h("input", {
            type: "range",
            min: 0,
            max: 3000,
            "data-range-endpoint": "from",
            value: props.from,
            onInput: (event: Event) => emit("draft", "from", value(event)),
            onChange: (event: Event) => emit("commit", "from", value(event))
          }),
          h("input", {
            type: "range",
            min: 0,
            max: 3000,
            "data-range-endpoint": "to",
            value: props.to,
            onInput: (event: Event) => emit("draft", "to", value(event)),
            onChange: (event: Event) => emit("commit", "to", value(event))
          }),
          ...(["from", "to"] as const).map(endpoint => h("input", {
            type: "text",
            "aria-label": endpoint === "from" ? "Från tryckår" : "Till tryckår",
            value: props[endpoint],
            onInput: (event: Event) => emit("draft", endpoint, value(event)),
            onChange: (event: Event) => emit("commit", endpoint, value(event))
          }))
        ])
      }
    })
  }
})

const source = (path: string) => readFile(resolve(import.meta.dirname, "../..", path), "utf8")

describe("Library advanced filter integration", () => {
  test("delegates controlled search and advanced filter intents without routing dependencies", async () => {
    const page = await source("app/pages/bibliotek.vue")
    expect(page).toContain("<LibrarySearchControls")
    expect(page).toContain("<LibraryAdvancedFilters")
    expect(page).not.toContain("data-library-filter")
    expect(page).not.toContain("data-library-advanced-panel")

    const [
      { createApp, h, nextTick, ref, ssrContextKey },
      { default: LibrarySearchControls },
      { default: LibraryAdvancedFilters }
    ] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibrarySearchControls.vue"),
      import("../../app/components/library/LibraryAdvancedFilters.vue")
    ])

    const searchTarget = document.createElement("div")
    document.body.append(searchTarget)
    const searchEvents: readonly (readonly [string, string?])[] = []
    const searchApp = createApp({
      setup: () => () => h(LibrarySearchControls, {
        filter: "Berg",
        hasActiveFilters: true,
        advancedOpen: false,
        onUpdateFilter: (value: string) => { (searchEvents as (readonly [string, string?])[]).push(["filter", value]) },
        onSubmit: () => { (searchEvents as (readonly [string, string?])[]).push(["submit"]) },
        onReset: () => { (searchEvents as (readonly [string, string?])[]).push(["reset"]) },
        onToggleAdvanced: () => { (searchEvents as (readonly [string, string?])[]).push(["toggle-advanced"]) }
      }, {
        default: () => [h("div", { "data-library-search-slot": "" })]
      })
    })
    searchApp.mount(searchTarget)
    await nextTick()

    const searchInput = searchTarget.querySelector<HTMLInputElement>("[data-library-filter]")!
    const searchLabel = searchTarget.querySelector<HTMLLabelElement>("label.sr-only")!
    expect(searchInput.value).toBe("Berg")
    expect(searchInput.getAttribute("placeholder")).toBe("Skriv författarnamn eller titel")
    expect(searchLabel.textContent?.trim()).toBe("Sök i biblioteket")
    expect(searchLabel.getAttribute("for")).toBe(searchInput.id)
    searchInput.value = "Söderberg"
    searchInput.dispatchEvent(new window.Event("input"))
    const submit = new window.Event("submit", { bubbles: true, cancelable: true })
    searchTarget.querySelector("form")!.dispatchEvent(submit)
    searchTarget.querySelector<HTMLButtonElement>("[data-library-reset]")!.click()
    const advancedButton = searchTarget.querySelector<HTMLButtonElement>("[data-library-advanced]")!
    expect(advancedButton.getAttribute("aria-expanded")).toBe("false")
    expect(advancedButton.getAttribute("aria-controls")).toBe("library-advanced-panel")
    advancedButton.click()
    expect(searchEvents).toEqual([
      ["filter", "Söderberg"],
      ["submit"],
      ["reset"],
      ["toggle-advanced"]
    ])
    expect(submit.defaultPrevented).toBe(true)
    searchApp.unmount()
    searchTarget.remove()

    const advancedTarget = document.createElement("div")
    document.body.append(advancedTarget)
    const selectPrototype = Object.getPrototypeOf(document.createElement("select"))
    const selectValue = Object.getOwnPropertyDescriptor(selectPrototype, "value")!
    onTestFinished(() => {
      Object.defineProperty(selectPrototype, "value", selectValue)
    })
    Object.defineProperty(selectPrototype, "value", {
      configurable: true,
      get: selectValue.get,
      set(value: string) {
        const option = [...(this as HTMLSelectElement).options]
          .find(candidate => candidate.value === value)
        if (option) option.selected = true
      }
    })
    const changes: unknown[] = []
    const intents: string[] = []
    const model = ref({
      advancedOpen: true,
      gender: "" as const,
      keywords: ["texttype:roman"] as const,
      narrowingKeywords: [] as const,
      aboutAuthorIds: [] as const,
      media: [] as const,
      languages: [] as const,
      collectionSelectOptions: [
        { value: "texttype:roman", label: "Romaner" },
        { value: "texttype:diktsamling;dikt", label: "Poesi" }
      ],
      collectionSelectGroups: [{
        label: "Kategorier",
        options: [
          { value: "texttype:roman", label: "Romaner" },
          { value: "texttype:diktsamling;dikt", label: "Poesi" }
        ]
      }],
      aboutAuthorOptions: [] as readonly { id: string, label: string }[],
      mediaSelectOptions: [{ value: "mediatype:etext", label: "Etext" }],
      languageSelectOptions: [{ value: "language:swe", label: "Svenska" }],
      chronology: null as null | { min: number, max: number, from: string, to: string },
      chronologyUnavailable: false,
      standalone: false,
      downloadMode: false,
      allVisibleSourceWorksSelected: false
    })
    const advancedApp = createApp({
      setup: () => () => h(LibraryAdvancedFilters, {
        model: model.value,
        onChange: (change: unknown) => { changes.push(change) },
        onToggleDownloadMode: () => { intents.push("toggle-download-mode") },
        onSelectVisibleSourceWorks: () => { intents.push("select-visible-source-works") },
        onDeselectVisibleSourceWorks: () => { intents.push("deselect-visible-source-works") },
        onResetChronology: () => { intents.push("reset-chronology") }
      })
    })
    advancedApp.provide(ssrContextKey, { modules: new Set<string>() })
    advancedApp.mount(advancedTarget)
    await nextTick()

    expect(advancedTarget.querySelector("[data-library-advanced-panel]")).not.toBeNull()
    expect(advancedTarget.querySelector("[data-library-about-authors]")).toBeNull()
    expect(advancedTarget.querySelector("[data-library-chronology-unavailable]")).toBeNull()
    expect(advancedTarget.querySelector("[data-library-chronology-range]")).toBeNull()
    model.value.chronologyUnavailable = true
    await nextTick()
    expect(advancedTarget.querySelector("[data-library-chronology-unavailable]")?.textContent)
      .toContain("Tidslinjen kunde inte hämtas.")
    const gender = advancedTarget.querySelector<HTMLButtonElement>("[data-library-gender]")!
    gender.click()
    await nextTick()
    const female = [...advancedTarget.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent === "Kvinnliga författare")!
    female.click()
    await nextTick()
    expect(changes).toContainEqual({ field: "gender", value: "female" })

    model.value = {
      ...model.value,
      aboutAuthorOptions: [{ id: "lagerlof", label: "Selma Lagerlöf" }],
      chronology: { min: 1800, max: 2020, from: "not-a-year", to: "2001" },
      chronologyUnavailable: false,
      downloadMode: true
    }
    await nextTick()
    expect(advancedTarget.querySelector<HTMLInputElement>('[aria-label="Från tryckår"]')?.value)
      .toBe("not-a-year")
    expect(advancedTarget.querySelector("[data-library-about-authors]")).not.toBeNull()
    expect(advancedTarget.querySelector("[data-library-download-mode]")).not.toBeNull()
    expect(advancedTarget.querySelector("[data-library-select-visible]")).not.toBeNull()

    const choose = async (marker: string, label: string) => {
      const root = advancedTarget.querySelector<HTMLElement>(`${marker} .multiselect`)!
      root.querySelector<HTMLButtonElement>(".multiselect__select")!.click()
      await nextTick()
      const option = [...advancedTarget.querySelectorAll<HTMLElement>(`${marker} .multiselect__option`)]
        .find(candidate => candidate.textContent?.trim() === label)
      option!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }))
      await nextTick()
    }
    await choose("[data-library-keywords]", "Poesi")
    await choose("[data-library-narrowing]", "Poesi")
    await choose("[data-library-about-authors]", "Selma Lagerlöf")
    await choose("[data-library-media]", "Etext")
    await choose("[data-library-languages]", "Svenska")
    expect(changes).toContainEqual({
      field: "keywords",
      value: ["texttype:roman", "texttype:diktsamling;dikt"]
    })
    expect(changes).toContainEqual({ field: "narrowingKeywords", value: ["texttype:diktsamling;dikt"] })
    expect(changes).toContainEqual({ field: "aboutAuthorIds", value: ["lagerlof"] })
    expect(changes).toContainEqual({ field: "media", value: ["mediatype:etext"] })
    expect(changes).toContainEqual({ field: "languages", value: ["language:swe"] })

    const chronologyFrom = advancedTarget.querySelector<HTMLInputElement>(
      '[aria-label="Från tryckår"]'
    )!
    for (const value of ["", "19", "inte ett år"]) {
      chronologyFrom.value = value
      chronologyFrom.dispatchEvent(new window.Event("input"))
      await nextTick()
      expect(changes.at(-1)).toEqual({
        field: "chronologyDraft",
        from: value,
        to: "2001"
      })
    }
    const chronologyTo = advancedTarget.querySelector<HTMLInputElement>(
      '[aria-label="Till tryckår"]'
    )!
    for (const value of ["", "20", "okänt år"]) {
      chronologyTo.value = value
      chronologyTo.dispatchEvent(new window.Event("input"))
      await nextTick()
      expect(changes.at(-1)).toEqual({
        field: "chronologyDraft",
        from: "not-a-year",
        to: value
      })
    }

    const disabledNarrowing = [...advancedTarget.querySelectorAll<HTMLElement>(
      "[data-library-narrowing] .multiselect__option"
    )].find(option => option.textContent?.trim() === "Romaner")
    expect(disabledNarrowing?.outerHTML).toContain('aria-disabled="true"')

    const sliderFrom = advancedTarget.querySelector<HTMLInputElement>(
      '[data-library-chronology-range] [data-range-endpoint="from"]'
    )!
    sliderFrom.value = "1900"
    sliderFrom.dispatchEvent(new window.Event("input"))
    await nextTick()
    sliderFrom.dispatchEvent(new window.Event("change"))
    await nextTick()
    expect(changes).toContainEqual({ field: "chronologyDraft", from: "1900", to: "2001" })
    expect(changes).toContainEqual({ field: "chronologyRange", value: [1900, 2001] })

    advancedTarget.querySelector<HTMLElement>("[data-library-download-mode]")!.click()
    advancedTarget.querySelector<HTMLButtonElement>("[data-library-select-visible]")!.click()
    model.value = { ...model.value, allVisibleSourceWorksSelected: true }
    await nextTick()
    advancedTarget.querySelector<HTMLButtonElement>("[data-library-deselect-visible]")!.click()
    expect(intents).toEqual([
      "toggle-download-mode",
      "select-visible-source-works",
      "deselect-visible-source-works"
    ])

    model.value = { ...model.value, standalone: true }
    await nextTick()
    expect(advancedTarget.querySelector("[data-library-about-authors]")).toBeNull()
    expect(advancedTarget.querySelector("[data-library-narrowing]")).toBeNull()
    expect(advancedTarget.querySelector("[data-library-download-mode]")).toBeNull()
    expect(advancedTarget.querySelector("[data-library-select-visible]")).toBeNull()
    advancedApp.unmount()
    advancedTarget.remove()
  })

})
