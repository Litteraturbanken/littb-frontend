import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, onTestFinished, test, vi } from "vitest"
import { createMemoryHistory, createRouter, RouterLink } from "vue-router"
import type { BrowseResponse } from "../../app/lib/library/page-results"

vi.mock("../../app/lib/internal-navigation", () => ({
  canonicalNuxtHref(value: string) {
    return value
      .replace(/^\/författare(?=\/|$|[?#])/, "/f%C3%B6rfattare")
      .replace(/^\/forfattare(?=\/|$|[?#])/, "/f%C3%B6rfattare")
  },
  isNuxtInternalHref(value: string) {
    return /^\/(?:f%C3%B6rfattare|författare|forfattare)(?:\/|$|[?#])/.test(value)
  }
}))

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
            "data-range-endpoint": "from",
            value: props.from,
            onInput: (event: Event) => emit("draft", "from", value(event)),
            onChange: (event: Event) => emit("commit", "from", value(event))
          }),
          h("input", {
            type: "range",
            "data-range-endpoint": "to",
            value: props.to,
            onInput: (event: Event) => emit("draft", "to", value(event)),
            onChange: (event: Event) => emit("commit", "to", value(event))
          })
        ])
      }
    })
  }
})

const nuxtRoot = resolve(import.meta.dirname, "../..")
const source = (path: string) => readFile(resolve(nuxtRoot, path), "utf8")

function sourceResponse(
  items: readonly { key: string; title: string; sourceExports?: BrowseResponse["data"][number]["sourceExports"] }[]
): BrowseResponse {
  return {
    data: items.map(item => ({
      key: item.key,
      titlePath: item.key,
      title: item.title,
      titleTooltip: item.title,
      year: "1879",
      surname: "Strindberg",
      authorTooltip: "Strindberg, August",
      roleSuffix: "",
      titleHref: `/författare/august-strindberg/titlar/${item.key}`,
      authorHref: "/författare/august-strindberg",
      actions: [],
      sourceExports: item.sourceExports ?? [{
        lbworkid: `lb-${item.key}`,
        mediatype: "etext",
        type: "txt",
        size: 1_024
      }]
    })),
    hits: items.length,
    distinctHits: items.length,
    authorIds: [],
    suggest: [],
    failed: false
  }
}

describe("Library component ownership", () => {
  test("keeps component ownership bounded and capability-free", async () => {
    const componentPaths = [
      "app/components/library/LibrarySearchControls.vue",
      "app/components/library/LibraryAdvancedFilters.vue",
      "app/components/library/LibraryModeTabs.vue",
      "app/components/library/LibraryPagination.vue",
      "app/components/library/LibraryAllResults.vue",
      "app/components/library/LibraryLatestResults.vue",
      "app/components/library/LibraryAuthorResults.vue",
      "app/components/library/LibraryBrowseResults.vue",
      "app/components/library/LibraryDownloadResults.vue",
      "app/components/library/LibrarySourceDownloadWorkspace.vue"
    ] as const
    const [page, ...componentSources] = await Promise.all([
      source("app/pages/bibliotek.vue"),
      ...componentPaths.map(source)
    ])
    const pageTemplate = page.slice(page.indexOf("<template>"))

    expect(page.split("\n").length).toBeLessThanOrEqual(2100)
    for (const component of componentSources) {
      expect(component.split("\n").length).toBeLessThanOrEqual(600)
      expect(component).not.toMatch(
        /\b(useRoute|useRouter|useAsyncData|useFetch|\$fetch|createLbApiClient|useLbApiClient)\s*\(/
      )
    }

    for (const component of [
      "LibrarySearchControls",
      "LibraryAdvancedFilters",
      "LibraryModeTabs",
      "LibrarySourceDownloadWorkspace",
      "LibraryAllResults",
      "LibraryLatestResults",
      "LibraryAuthorResults",
      "LibraryBrowseResults",
      "LibraryDownloadResults"
    ]) {
      expect(pageTemplate.match(new RegExp(`<${component}\\b`, "g"))).toHaveLength(1)
    }
    for (const ownedDataHook of [
      "data-library-filter",
      "data-library-advanced-panel",
      "data-library-tab",
      "data-library-pagination-previous",
      "data-library-pagination-next",
      "data-library-result",
      "data-library-latest-row",
      "data-library-author-row",
      "data-library-part-row",
      "data-library-epub-row",
      "data-library-pdf-row",
      "data-library-source-checkbox",
      "data-library-format-popover",
      "data-library-download-submit"
    ]) {
      expect(pageTemplate).not.toContain(ownedDataHook)
    }
  })

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
    expect(searchInput.value).toBe("Berg")
    expect(searchInput.getAttribute("placeholder")).toBe("Skriv författarnamn eller titel")
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
    expect(advancedTarget.querySelector("[data-library-chronology-unavailable]")).not.toBeNull()
    const gender = advancedTarget.querySelector<HTMLSelectElement>("[data-library-gender]")!
    gender.value = "female"
    gender.dispatchEvent(new window.Event("change"))
    expect(changes).toContainEqual({ field: "gender", value: "female" })

    model.value = {
      ...model.value,
      aboutAuthorOptions: [{ id: "lagerlof", label: "Selma Lagerlöf" }],
      chronology: { min: 1800, max: 2020, from: "not-a-year", to: "2001" },
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
      root.dispatchEvent(new window.Event("focus"))
      await nextTick()
      const option = [...advancedTarget.querySelectorAll<HTMLElement>(`${marker} .multiselect__option`)]
        .find(candidate => candidate.textContent?.trim() === label)
      option!.click()
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

  test("the page delegates mode tabs to one shared component", async () => {
    const page = await source("app/pages/bibliotek.vue")
    expect(page).toContain("<LibraryModeTabs")
    expect(page).not.toContain("data-library-tab")
  })

  test("renders ordinary mode tabs from page-owned targets and presentation", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick }, { default: LibraryModeTabs }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryModeTabs.vue")
    ])
    const tabs = [
      { mode: "all", label: "Alla träffar", count: null, to: "/bibliotek?filter=berg", active: false, disabledLook: false, disabled: false, separatorBefore: false },
      { mode: "latest", label: "Nytt", count: null, to: "/bibliotek?visa=latest&filter=berg", active: false, disabledLook: false, disabled: false, separatorBefore: true },
      { mode: "authors", label: "Författare", count: 12, to: "/bibliotek?visa=authors&filter=berg", active: true, disabledLook: true, disabled: false, separatorBefore: true },
      { mode: "works", label: "Verk", count: 34, to: "/bibliotek?visa=works&filter=berg", active: false, disabledLook: false, disabled: false, separatorBefore: true },
      { mode: "parts", label: "Dikt, novell, etc.", count: 0, to: "/bibliotek?visa=parts&filter=berg", active: false, disabledLook: true, disabled: false, separatorBefore: true },
      { mode: "epub", label: "Epub", count: 56, to: "/bibliotek?visa=epub&filter=berg", active: false, disabledLook: false, disabled: false, separatorBefore: true },
      { mode: "pdf", label: "PDF", count: null, to: "/bibliotek?visa=pdf&filter=berg", active: false, disabledLook: true, disabled: false, separatorBefore: true }
    ] as const
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean, replace: Boolean },
      setup(props: { to: string; custom: boolean }, { slots }: { slots: { default?: (slotProps?: { href: string; navigate: () => void }) => unknown[] } }) {
        return () => props.custom
          ? slots.default?.({ href: props.to, navigate: () => undefined })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({ setup: () => () => h(LibraryModeTabs, { tabs }) })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    const links = [...target.querySelectorAll<HTMLAnchorElement>("a")]
    expect(links.map(link => link.textContent)).toEqual([
      "Alla träffar", "Nytt", "Författare: 12", "Verk: 34", "Dikt, novell, etc.: 0", "Epub: 56", "PDF"
    ])
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/bibliotek?filter=berg",
      "/bibliotek?visa=latest&filter=berg",
      "/bibliotek?visa=authors&filter=berg",
      "/bibliotek?visa=works&filter=berg",
      "/bibliotek?visa=parts&filter=berg",
      "/bibliotek?visa=epub&filter=berg",
      "/bibliotek?visa=pdf&filter=berg"
    ])
    expect(links[2]?.classList.contains("active")).toBe(true)
    expect(links[2]?.classList.contains("library-tab-disabled-look")).toBe(true)
    expect(links[4]?.classList.contains("library-tab-disabled-look")).toBe(true)
    expect(links[6]?.classList.contains("relevance-unavailable")).toBe(true)
    expect(links[2]?.getAttribute("aria-current")).toBe("page")
    expect(links[0]?.hasAttribute("aria-current")).toBe(false)
    app.unmount()
    target.remove()
  })

  test("renders standalone EPUB and PDF tabs from page-owned targets", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick }, { default: LibraryModeTabs }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryModeTabs.vue")
    ])
    const tabs = [
      { mode: "epub", label: "Epub", count: 9, to: "/epub", active: true, disabledLook: false, disabled: false, separatorBefore: false },
      { mode: "pdf", label: "PDF", count: null, to: "/epub?visa=pdf", active: false, disabledLook: true, disabled: false, separatorBefore: true }
    ] as const
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean, replace: Boolean },
      setup(props: { to: string; custom: boolean }, { slots }: { slots: { default?: (slotProps?: { href: string; navigate: () => void }) => unknown[] } }) {
        return () => props.custom
          ? slots.default?.({ href: props.to, navigate: () => undefined })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({ setup: () => () => h(LibraryModeTabs, { tabs }) })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    const links = [...target.querySelectorAll<HTMLAnchorElement>("a")]
    expect(links.map(link => link.textContent)).toEqual(["Epub: 9", "PDF"])
    expect(links.map(link => link.getAttribute("href"))).toEqual(["/epub", "/epub?visa=pdf"])
    expect(links[0]?.classList.contains("active")).toBe(true)
    expect(links[1]?.classList.contains("relevance-unavailable")).toBe(true)
    expect(links[0]?.getAttribute("aria-current")).toBe("page")
    expect(links[1]?.hasAttribute("aria-current")).toBe(false)
    app.unmount()
    target.remove()
  })

  test("uses custom replacing links while preserving disabled tab semantics", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibraryModeTabs }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryModeTabs.vue")
    ])
    const historyDescriptor = Object.getOwnPropertyDescriptor(globalThis, "history")
    try {
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: {
          state: null,
          pushState(state: unknown) { this.state = state },
          replaceState(state: unknown) { this.state = state }
        }
      })
      const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: { render: () => h("div") } },
        { path: "/bibliotek", component: { render: () => h("div") } }
      ]
      })
      await router.push("/")
      await router.push("/bibliotek?filter=berg")
      await router.isReady()
      const tabs = ref([
      { mode: "all", label: "Alla träffar", count: null, to: "/bibliotek?filter=berg", active: true, disabledLook: false, separatorBefore: false, disabled: false },
      { mode: "authors", label: "Författare", count: 0, to: "/bibliotek?visa=authors&filter=berg", active: false, disabledLook: true, separatorBefore: true, disabled: false },
      { mode: "parts", label: "Dikt, novell, etc.", count: 0, to: "/bibliotek?visa=parts&filter=berg", active: false, disabledLook: true, separatorBefore: true, disabled: false },
      { mode: "epub", label: "Epub", count: null, to: "/bibliotek?visa=epub&filter=berg", active: false, disabledLook: true, separatorBefore: true, disabled: false },
      { mode: "pdf", label: "PDF", count: null, to: "/bibliotek?visa=pdf&filter=berg", active: false, disabledLook: true, separatorBefore: true, disabled: false }
      ])
      const app = createApp({ setup: () => () => h(LibraryModeTabs, { tabs: tabs.value }) })
      app.use(router)
      app.component("NuxtLink", RouterLink)
      app.mount(target)
      await nextTick()

      const ordinaryLinks = [...target.querySelectorAll<HTMLAnchorElement>("a")]
      const author = ordinaryLinks[1]
      expect(author?.classList.contains("router-link-active")).toBe(false)
      expect(author?.classList.contains("router-link-exact-active")).toBe(false)
      expect(ordinaryLinks.slice(1).map(link => link.getAttribute("aria-disabled"))).toEqual([
        null, null, null, null
      ])

      const navigated = new Promise<void>(resolve => {
        const remove = router.afterEach(() => {
          remove()
          resolve()
        })
      })
      author?.click()
      await navigated
      expect(router.currentRoute.value.fullPath).toBe("/bibliotek?visa=authors&filter=berg")

      const backed = new Promise<void>(resolve => {
        const remove = router.afterEach(() => {
          remove()
          resolve()
        })
      })
      router.back()
      await backed
      expect(router.currentRoute.value.fullPath).toBe("/")

      tabs.value = [
        { mode: "authors", label: "Författare", count: 12, to: "/bibliotek?visa=authors&filter=berg", active: false, disabledLook: true, separatorBefore: false, disabled: true }
      ]
      await nextTick()
      const disabledAuthor = target.querySelector<HTMLAnchorElement>("a")
      expect(disabledAuthor?.getAttribute("aria-disabled")).toBe("true")
      disabledAuthor?.click()
      await nextTick()
      expect(router.currentRoute.value.fullPath).toBe("/")
      app.unmount()
      target.remove()
    } finally {
      if (historyDescriptor) Object.defineProperty(globalThis, "history", historyDescriptor)
      else Reflect.deleteProperty(globalThis, "history")
    }
  })

  test("the page delegates pagination markup to one shared component", async () => {
    const [page, sourceWorkspace] = await Promise.all([
      source("app/pages/bibliotek.vue"),
      source("app/components/library/LibrarySourceDownloadWorkspace.vue")
    ])
    expect(page).not.toContain("<LibraryPagination")
    expect(sourceWorkspace).toContain("<LibraryPagination")
    expect(page).not.toContain("data-library-pagination-previous")
    expect(page).not.toContain("data-library-pagination-next")
  })

  test("renders the pagination contract and emits selected pages", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibraryPagination }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryPagination.vue")
    ])
    const selectedPages: number[] = []
    let routerNavigations = 0
    const model = ref({
      currentPage: 2,
      pageCount: 8,
      previous: "/bibliotek?page=1",
      next: "/bibliotek?page=3",
      entries: [
        { key: "page-1", page: 1, label: "1", to: "/bibliotek?page=1", ellipsis: false },
        { key: "page-2", page: 2, label: "2", to: "/bibliotek?page=2", ellipsis: false },
        { key: "ellipsis-next-6", page: 6, label: "...", to: "/bibliotek?page=6", ellipsis: true },
        { key: "page-3", page: 3, label: "3", to: "/bibliotek?page=3", ellipsis: false }
      ]
    })
    const NuxtLink = {
      props: {
        to: { type: [String, Object], required: true },
        custom: Boolean
      },
      setup(
        props: { to: string; custom: boolean },
        { slots }: { slots: { default?: (slotProps?: { href: string }) => unknown[] } }
      ) {
        return () => props.custom
          ? slots.default?.({ href: props.to })
          : h("a", {
              href: props.to,
              onClick: () => { routerNavigations += 1 }
            }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibraryPagination, {
        model: model.value,
        onSelectPage: (page: number) => selectedPages.push(page)
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    const links = [...target.querySelectorAll<HTMLAnchorElement>("a")]
    expect(links.map(link => link.textContent)).toEqual([
      "Föregående", "1", "2", "...", "3", "Nästa"
    ])
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/bibliotek?page=1",
      "/bibliotek?page=1",
      "/bibliotek?page=2",
      "/bibliotek?page=6",
      "/bibliotek?page=3",
      "/bibliotek?page=3"
    ])
    expect(links[2]?.getAttribute("aria-current")).toBe("page")
    expect(links[1]?.getAttribute("data-library-page")).toBe("1")
    expect(links[3]?.hasAttribute("data-library-page")).toBe(false)
    expect(links[3]?.hasAttribute("data-library-pagination-ellipsis")).toBe(true)
    expect(links[0]?.hasAttribute("data-library-pagination-previous")).toBe(true)
    expect(links[5]?.hasAttribute("data-library-pagination-next")).toBe(true)

    links[0]?.click()
    links[3]?.click()
    links[4]?.click()
    links[5]?.click()
    await nextTick()
    expect(selectedPages).toEqual([1, 6, 3, 3])
    expect(routerNavigations).toBe(0)

    model.value = {
      ...model.value,
      currentPage: 1,
      previous: null,
      next: "/bibliotek?page=2"
    }
    await nextTick()

    const disabledPrevious = target.querySelector<HTMLElement>("[data-library-pagination-previous]")
    expect(disabledPrevious?.localName).toBe("span")
    expect(disabledPrevious?.getAttribute("aria-disabled")).toBe("true")
    expect(disabledPrevious?.parentElement?.classList.contains("disabled")).toBe(true)
    app.unmount()
    target.remove()
  })

  test("the page delegates All and Latest result markup to dedicated components", async () => {
    const page = await source("app/pages/bibliotek.vue")
    expect(page).toContain("<LibraryAllResults")
    expect(page).toContain("<LibraryLatestResults")
    expect(page).not.toContain("data-library-result")
    expect(page).not.toContain("data-library-latest-row")
  })

  test("renders All failure, empty, and highlighted mixed-result states", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibraryAllResults }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryAllResults.vue")
    ])
    const response = ref({ data: [], hits: 0, suggest: [], failed: true })
    const loading = ref(false)
    const selectedSorts: string[] = []
    const selectedPages: number[] = []
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean },
      setup(
        props: { to: string; custom: boolean },
        { slots }: { slots: { default?: (slotProps?: { href: string }) => unknown[] } }
      ) {
        return () => props.custom
          ? slots.default?.({ href: props.to })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibraryAllResults, {
        response: response.value,
        sortOptions: [
          { key: "relevans", label: "Relevans", to: "/bibliotek", active: true },
          { key: "titlar", label: "Titel", to: "/bibliotek?sort=titlar", active: false }
        ],
        sortReversed: false,
        imprintYearTargets: [{ year: "1888", to: "/bibliotek?intervall=1888%2C1888" }],
        loading: loading.value,
        pagination: {
          currentPage: 1,
          pageCount: 1,
          previous: null,
          next: null,
          entries: [{ key: "page-1", page: 1, label: "1", to: "/bibliotek", ellipsis: false }]
        },
        onSelectSort: (sort: string) => selectedSorts.push(sort),
        onSelectPage: (page: number) => selectedPages.push(page)
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(target.querySelector("[data-library-error]")?.textContent).toBe("Ett fel uppstod.")

    response.value = { data: [], hits: 0, suggest: [], failed: false }
    await nextTick()
    expect(target.querySelector("[data-library-empty]")?.textContent?.trim()).toBe("Inga träffar.")

    response.value = {
      data: [{
        index: "etext",
        sourceLabel: "Etext",
        primaryLabel: "Ett drömspel",
        primaryHref: "/författare/august-strindberg/titlar/ett-drömspel",
        download: false,
        yearLabel: "1888",
        secondaryAuthor: "August Strindberg",
        authorHref: "/författare/august-strindberg",
        authorSurname: "",
        authorGivenNames: "",
        mobileYearLabel: "",
        authorId: "",
        authorPopularity: 0,
        authorBirth: 0,
        fullTitle: "Ett drömspel: skådespel",
        authorContribution: "(red.)",
        highlights: [{
          segments: [
            { text: "före ", hit: false },
            { text: "dröm", hit: true },
            { text: " efter", hit: false }
          ]
        }]
      }],
      hits: 1,
      suggest: [],
      failed: false
    }
    await nextTick()

    expect(target.querySelectorAll("[data-library-result]")).toHaveLength(1)
    expect(target.querySelector("[data-library-result-title]")?.getAttribute("href"))
      .toBe("/författare/august-strindberg/titlar/ett-drömspel")
    expect(target.querySelector("[data-library-highlight]")?.textContent)
      .toContain("före dröm efter")
    const highlightHit = target.querySelector("[data-library-highlight-hit]")
    expect(highlightHit?.localName).toBe("em")
    expect(highlightHit?.classList.contains("hit")).toBe(true)
    expect(highlightHit?.textContent).toBe("dröm")
    expect(target.querySelector("[data-library-imprint-year]")?.getAttribute("href"))
      .toBe("/bibliotek?intervall=1888%2C1888")
    expect(target.querySelector("[data-library-author-contribution]")?.textContent)
      .toBe("(red.)")

    target.querySelector<HTMLAnchorElement>('[data-library-sort="titlar"]')?.click()
    await nextTick()
    expect(selectedSorts).toEqual(["titlar"])

    loading.value = true
    await nextTick()
    expect(target.querySelector("[data-library-result]")).toBeNull()
    expect(target.querySelector(".spinner.fa-spinner")).not.toBeNull()
    expect(selectedPages).toEqual([])
    app.unmount()
    target.remove()
  })

  test("renders Latest loading with a committed date group and emits controls", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick }, { default: LibraryLatestResults }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryLatestResults.vue")
    ])
    const selectedSorts: string[] = []
    const selectedPages: number[] = []
    let hideToggles = 0
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean },
      setup(
        props: { to: string; custom: boolean },
        { slots }: { slots: { default?: (slotProps?: { href: string }) => unknown[] } }
      ) {
        return () => props.custom
          ? slots.default?.({ href: props.to })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibraryLatestResults, {
        response: {
          groups: [{
            imported: "2026-08-11",
            label: "11 augusti 2026 (1 verk)",
            results: [{
              title: "Röda rummet",
              titleTooltip: "Röda rummet: skildringar ur artist- och författarlivet",
              titleId: "roda-rummet",
              year: "1879",
              surname: "Strindberg",
              authorTooltip: "Strindberg, August",
              roleSuffix: " (ill.)",
              titleHref: "/författare/august-strindberg/titlar/roda-rummet",
              authorHref: "/författare/august-strindberg",
              imported: "2026-08-11"
            }]
          }],
          hits: 1,
          distinctHits: 1,
          suggest: [],
          failed: false
        },
        sortOptions: [{
          key: "nytillkommet",
          label: "Nytt",
          to: "/bibliotek?visa=latest&sort=nytillkommet",
          active: true
        }],
        sortReversed: true,
        hide1800: false,
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }],
        loading: true,
        pagination: {
          currentPage: 1,
          pageCount: 2,
          previous: null,
          next: "/bibliotek?visa=latest&sida=2",
          entries: [
            { key: "page-1", page: 1, label: "1", to: "/bibliotek?visa=latest", ellipsis: false },
            { key: "page-2", page: 2, label: "2", to: "/bibliotek?visa=latest&sida=2", ellipsis: false }
          ]
        },
        onSelectSort: (sort: string) => selectedSorts.push(sort),
        onToggleHide1800: () => { hideToggles += 1 },
        onSelectPage: (page: number) => selectedPages.push(page)
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(target.querySelector("[data-library-loading]")).not.toBeNull()
    expect(target.querySelector("[data-library-latest-header]")?.textContent?.trim())
      .toBe("11 augusti 2026 (1 verk)")
    expect(target.querySelectorAll("[data-library-latest-row]")).toHaveLength(1)
    expect(target.querySelector("[data-library-latest-title]")?.getAttribute("href"))
      .toBe("/författare/august-strindberg/titlar/roda-rummet")
    expect(target.querySelector("[data-library-imprint-year]")?.getAttribute("href"))
      .toBe("/bibliotek?intervall=1879%2C1879")
    expect(target.querySelector('[data-library-tooltip-kind="author"]')?.textContent)
      .toBe("Strindberg")
    expect(target.querySelector(".fa")?.classList.contains("fa-caret-up")).toBe(true)

    target.querySelector<HTMLAnchorElement>('[data-library-sort="nytillkommet"]')?.click()
    target.querySelector<HTMLButtonElement>("[data-library-hide-1800]")?.click()
    target.querySelector<HTMLAnchorElement>('[data-library-page="2"]')?.click()
    await nextTick()
    expect(selectedSorts).toEqual(["nytillkommet"])
    expect(hideToggles).toBe(1)
    expect(selectedPages).toEqual([2])
    app.unmount()
    target.remove()
  })

  test("the page delegates author and download rows to dedicated components", async () => {
    const page = await source("app/pages/bibliotek.vue")
    expect(page).toContain("<LibraryAuthorResults")
    expect(page).toContain("<LibraryDownloadResults")
    expect(page).not.toContain("data-library-author-row")
    expect(page).not.toContain("data-library-epub-row")
    expect(page).not.toContain("data-library-pdf-row")
  })

  test("keeps source selection controls in the search form's advanced child", async () => {
    const [page, sourceWorkspace, searchControls, advancedFilters] = await Promise.all([
      source("app/pages/bibliotek.vue"),
      source("app/components/library/LibrarySourceDownloadWorkspace.vue"),
      source("app/components/library/LibrarySearchControls.vue"),
      source("app/components/library/LibraryAdvancedFilters.vue")
    ])
    expect(page).toContain("<LibraryBrowseResults")
    expect(page.match(/<LibrarySourceDownloadWorkspace\s/g)).toHaveLength(1)
    expect(page).toContain("<LibrarySearchControls")
    expect(page).toContain("<LibraryAdvancedFilters")
    expect(page).not.toContain("data-library-part-row")
    expect(page).not.toContain("data-library-source-checkbox")
    expect(page).not.toContain("data-library-format-popover")
    expect(page).not.toContain("data-library-download-submit")
    expect(searchControls).toContain("<form")
    expect(advancedFilters).toContain("data-library-select-visible")
    expect(advancedFilters).toContain("data-library-deselect-visible")
    expect(advancedFilters.indexOf("data-library-download-mode"))
      .toBeLessThan(advancedFilters.indexOf("data-library-select-visible"))
    expect(advancedFilters.indexOf("data-library-deselect-visible"))
      .toBeLessThan(advancedFilters.indexOf('class="chronology primarycolor ml-px pl-px"'))
    expect(page).toContain('ref="sourceDownloadWorkspace"')
    expect(sourceWorkspace).not.toContain("data-library-select-visible")
    expect(sourceWorkspace).not.toContain("data-library-deselect-visible")
    expect(sourceWorkspace).not.toContain('class="mt-12"')
  })

  test("keeps source selections local to each mounted download workspace", async () => {
    const firstTarget = document.createElement("div")
    const secondTarget = document.createElement("div")
    document.body.append(firstTarget, secondTarget)
    const [{ createApp, h, nextTick }, { default: LibrarySourceDownloadWorkspace }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibrarySourceDownloadWorkspace.vue")
    ])
    const response = sourceResponse([{ key: "roda-rummet", title: "Röda rummet" }])
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true } },
      setup(props: { to: string }, { slots }: { slots: { default?: () => unknown[] } }) {
        return () => h("a", { href: props.to }, slots.default?.())
      }
    }
    const mount = (target: HTMLElement) => {
      const app = createApp({
        setup: () => () => h(LibrarySourceDownloadWorkspace, {
          response,
          loading: false,
          sortOptions: [{ key: "popularitet", label: "Popularitet", to: "/bibliotek?visa=works", active: true }],
          sortReversed: false,
          pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] },
          imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }]
        })
      })
      app.component("NuxtLink", NuxtLink)
      app.mount(target)
      return app
    }
    const first = mount(firstTarget)
    const second = mount(secondTarget)
    await nextTick()

    firstTarget.querySelector<HTMLButtonElement>("[data-library-work-toggle]")?.click()
    await nextTick()
    expect(firstTarget.querySelectorAll("[data-library-selected-work]")).toHaveLength(1)
    expect(secondTarget.querySelectorAll("[data-library-selected-work]")).toHaveLength(0)

    first.unmount()
    second.unmount()
    firstTarget.remove()
    secondTarget.remove()
  })

  test("retains off-page source selections and refreshes identities that reappear", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibrarySourceDownloadWorkspace }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibrarySourceDownloadWorkspace.vue")
    ])
    const response = ref(sourceResponse([
      { key: "keep", title: "Behåll mig" },
      { key: "remove", title: "Ta bort mig" }
    ]))
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true } },
      setup(props: { to: string }, { slots }: { slots: { default?: () => unknown[] } }) {
        return () => h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibrarySourceDownloadWorkspace, {
        response: response.value,
        loading: false,
        sortOptions: [{ key: "popularitet", label: "Popularitet", to: "/bibliotek?visa=works", active: true }],
        sortReversed: false,
        pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] },
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }]
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    for (const button of target.querySelectorAll<HTMLButtonElement>("[data-library-work-toggle]")) {
      button.click()
    }
    await nextTick()
    target.querySelector<HTMLButtonElement>("[data-library-format-button]")?.click()
    await nextTick()
    await nextTick()
    const format = document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] [data-library-source-format='etext:txt']"
    )
    format?.dispatchEvent(new document.defaultView!.Event("change"))
    await nextTick()
    expect(document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] input[name='files']"
    )?.value).toBe("lb-keep-etext-txt,lb-remove-etext-txt")

    response.value = sourceResponse([{
      key: "keep",
      title: "Behåll mig uppdaterad",
      sourceExports: [{
        lbworkid: "lb-keep",
        mediatype: "faksimil",
        type: "pdf",
        size: 2_048
      }]
    }])
    await nextTick()

    expect(target.querySelectorAll("[data-library-selected-work]")).toHaveLength(2)
    expect(target.querySelectorAll("[data-library-selected-work]")[0]?.textContent)
      .toContain("Behåll mig uppdaterad")
    expect(target.querySelectorAll("[data-library-selected-work]")[1]?.textContent)
      .toContain("Ta bort mig")
    expect(document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] input[name='files']"
    )?.value).toBe("lb-remove-etext-txt")
    expect(document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] [data-library-source-format='etext:txt']"
    )?.getAttribute("checked")).toBe("true")

    response.value = {
      ...sourceResponse([]),
      failed: true
    }
    await nextTick()

    expect(target.querySelectorAll("[data-library-selected-work]")).toHaveLength(2)
    expect(document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] input[name='files']"
    )?.value).toBe("lb-remove-etext-txt")

    app.unmount()
    target.remove()
  })

  test("removes a selected work after refresh leaves it with zero exports", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibrarySourceDownloadWorkspace }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibrarySourceDownloadWorkspace.vue")
    ])
    const response = ref(sourceResponse([{ key: "keep", title: "Behåll mig" }]))
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true } },
      setup(props: { to: string }, { slots }: { slots: { default?: () => unknown[] } }) {
        return () => h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibrarySourceDownloadWorkspace, {
        response: response.value,
        loading: false,
        sortOptions: [{ key: "popularitet", label: "Popularitet", to: "/bibliotek?visa=works", active: true }],
        sortReversed: false,
        pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] },
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }]
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    target.querySelector<HTMLButtonElement>("[data-library-work-toggle]")?.click()
    await nextTick()
    target.querySelector<HTMLButtonElement>("[data-library-format-button]")?.click()
    await nextTick()
    await nextTick()
    document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] [data-library-source-format='etext:txt']"
    )?.dispatchEvent(new document.defaultView!.Event("change"))
    await nextTick()
    expect(document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] input[name='files']"
    )?.value).toBe("lb-keep-etext-txt")

    response.value = sourceResponse([
      { key: "keep", title: "Behåll mig utan export", sourceExports: [] },
      { key: "never-add", title: "Kan inte läggas till", sourceExports: [] }
    ])
    await nextTick()
    await nextTick()

    const refreshedCheckbox = target.querySelector("[data-library-source-checkbox]")
    expect(refreshedCheckbox?.getAttribute("checked")).toBe("true")
    expect(refreshedCheckbox?.hasAttribute("disabled")).toBe(true)
    expect(target.querySelectorAll("[data-library-selected-work]")).toHaveLength(1)
    expect(document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] input[name='files']"
    )?.value).toBe("")

    target.querySelector<HTMLButtonElement>("[data-library-selected-work]")?.click()
    await nextTick()
    expect(target.querySelectorAll("[data-library-selected-work]")).toHaveLength(0)
    expect(refreshedCheckbox?.getAttribute("checked")).toBe("false")
    expect(document.body.querySelector<HTMLInputElement>(
      ":scope > [data-library-format-popover] input[name='files']"
    )?.value).toBe("")

    target.querySelectorAll<HTMLTableRowElement>("[data-library-work-row]")[1]?.click()
    await nextTick()
    expect(target.querySelectorAll("[data-library-selected-work]")).toHaveLength(0)

    app.unmount()
    target.remove()
  })

  test("drops unavailable selected formats without resurrecting them on later refreshes", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibrarySourceDownloadWorkspace }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibrarySourceDownloadWorkspace.vue")
    ])
    const etextExport = {
      lbworkid: "lb-keep",
      mediatype: "etext" as const,
      type: "txt" as const,
      size: 1_024
    }
    const response = ref(sourceResponse([
      { key: "keep", title: "Behåll mig", sourceExports: [etextExport] }
    ]))
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true } },
      setup(props: { to: string }, { slots }: { slots: { default?: () => unknown[] } }) {
        return () => h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibrarySourceDownloadWorkspace, {
        response: response.value,
        loading: false,
        sortOptions: [{ key: "popularitet", label: "Popularitet", to: "/bibliotek?visa=works", active: true }],
        sortReversed: false,
        pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] },
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }]
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    target.querySelector<HTMLButtonElement>("[data-library-work-toggle]")?.click()
    await nextTick()
    expect(target.querySelectorAll("[data-library-selected-work]")).toHaveLength(1)
    const formatButton = target.querySelector<HTMLButtonElement>("[data-library-format-button]")
    expect(formatButton?.disabled).toBe(false)
    formatButton?.click()
    await nextTick()
    await nextTick()
    await nextTick()
    await nextTick()
    const popover = document.body.querySelector<HTMLElement>("[data-library-format-popover]")
    expect(popover).not.toBeNull()
    const etextFormat = () => popover?.querySelector<HTMLInputElement>("[data-library-source-format]")
    const files = () => popover?.querySelector<HTMLInputElement>("input[name='files']")
    etextFormat()?.dispatchEvent(new document.defaultView!.Event("change"))
    await nextTick()
    expect(etextFormat()?.getAttribute("checked")).toBe("true")
    expect(files()?.value).toBe("lb-keep-etext-txt")

    response.value = sourceResponse([{
      key: "keep",
      title: "Behåll mig",
      sourceExports: [{
        lbworkid: "lb-keep",
        mediatype: "faksimil",
        type: "pdf",
        size: 2_048
      }]
    }])
    await nextTick()
    expect(etextFormat()?.hasAttribute("disabled")).toBe(true)
    expect(etextFormat()?.getAttribute("checked")).toBe("false")
    expect(files()?.value).toBe("")

    response.value = sourceResponse([{
      key: "keep",
      title: "Behåll mig",
      sourceExports: [etextExport]
    }])
    await nextTick()
    expect(etextFormat()?.hasAttribute("disabled")).toBe(false)
    expect(etextFormat()?.getAttribute("checked")).toBe("false")
    expect(files()?.value).toBe("")

    app.unmount()
    target.remove()
  })

  test("rejects malformed source media without aliasing it to a selectable format", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick }, { default: LibrarySourceDownloadWorkspace }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibrarySourceDownloadWorkspace.vue")
    ])
    const hostileExport = {
      lbworkid: "lb-hostile",
      mediatype: "faksimil,lb-injected",
      type: "txt",
      size: 1_024
    } as unknown as BrowseResponse["data"][number]["sourceExports"][number]
    const response = sourceResponse([{
      key: "hostile",
      title: "Felaktigt källformat",
      sourceExports: [hostileExport]
    }])
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true } },
      setup(props: { to: string }, { slots }: { slots: { default?: () => unknown[] } }) {
        return () => h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibrarySourceDownloadWorkspace, {
        response,
        loading: false,
        sortOptions: [{ key: "popularitet", label: "Popularitet", to: "/bibliotek?visa=works", active: true }],
        sortReversed: false,
        pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] },
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }]
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    target.querySelector<HTMLButtonElement>("[data-library-work-toggle]")?.click()
    await nextTick()
    target.querySelector<HTMLButtonElement>("[data-library-format-button]")?.click()
    await nextTick()
    await nextTick()
    const popover = document.body.querySelector<HTMLElement>("[data-library-format-popover]")
    expect(popover).not.toBeNull()
    const facsimileText = popover?.querySelector<HTMLInputElement>(
      '[data-library-source-format="faksimil:txt"]'
    )
    expect(facsimileText?.hasAttribute("disabled")).toBe(true)
    facsimileText?.dispatchEvent(new document.defaultView!.Event("change"))
    await nextTick()
    expect(facsimileText?.getAttribute("checked")).toBe("false")
    expect(popover?.querySelector<HTMLInputElement>('input[name="files"]')?.value).toBe("")
    expect(popover?.querySelector<HTMLButtonElement>("[data-library-download-submit]")?.disabled)
      .toBe(true)

    app.unmount()
    target.remove()
  })

  test("closes the body-level format popover and removes global listeners on unmount", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const documentAdd = vi.spyOn(document, "addEventListener")
    const documentRemove = vi.spyOn(document, "removeEventListener")
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window")
    const windowAdd = vi.fn()
    const windowRemove = vi.fn()
    try {
      const [{ createApp, h, nextTick }, { default: LibrarySourceDownloadWorkspace }] = await Promise.all([
        import("vue"),
        import("../../app/components/library/LibrarySourceDownloadWorkspace.vue")
      ])
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          innerHeight: 768,
          innerWidth: 1_024,
          scrollX: 0,
          scrollY: 0,
          addEventListener: windowAdd,
          removeEventListener: windowRemove
        }
      })
      const NuxtLink = {
        props: { to: { type: [String, Object], required: true } },
        setup(props: { to: string }, { slots }: { slots: { default?: () => unknown[] } }) {
          return () => h("a", { href: props.to }, slots.default?.())
        }
      }
      const app = createApp({
        setup: () => () => h(LibrarySourceDownloadWorkspace, {
          response: sourceResponse([{ key: "roda-rummet", title: "Röda rummet" }]),
          loading: false,
          sortOptions: [{ key: "popularitet", label: "Popularitet", to: "/bibliotek?visa=works", active: true }],
          sortReversed: false,
          pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] },
          imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }]
        })
      })
      app.component("NuxtLink", NuxtLink)
      app.mount(target)
      await nextTick()
      target.querySelector<HTMLButtonElement>("[data-library-work-toggle]")?.click()
      target.querySelector<HTMLButtonElement>("[data-library-format-button]")?.click()
      await nextTick()
      await nextTick()

      const keydownListener = documentAdd.mock.calls.find(([event]) => event === "keydown")?.[1]
      const resizeListener = windowAdd.mock.calls.find(([event]) => event === "resize")?.[1]
      const scrollListener = windowAdd.mock.calls.find(([event]) => event === "scroll")?.[1]
      expect(keydownListener).toBeTypeOf("function")
      expect(resizeListener).toBeTypeOf("function")
      expect(scrollListener).toBeTypeOf("function")
      expect(document.body.querySelector(":scope > [data-library-format-popover]")).not.toBeNull()

      app.unmount()
      await nextTick()

      expect(document.body.querySelector(":scope > [data-library-format-popover]")).toBeNull()
      expect(documentRemove.mock.calls).toContainEqual(["keydown", keydownListener])
      expect(windowRemove.mock.calls).toContainEqual(["resize", resizeListener])
      expect(windowRemove.mock.calls).toContainEqual(["scroll", scrollListener, true])
    } finally {
      documentAdd.mockRestore()
      documentRemove.mockRestore()
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor)
      else Reflect.deleteProperty(globalThis, "window")
      target.remove()
    }
  })

  test("renders ordinary Work rows and emits their disclosure key", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick }, { default: LibraryBrowseResults }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryBrowseResults.vue")
    ])
    const toggled: string[] = []
    const selectedSorts: string[] = []
    const selectedPages: number[] = []
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean },
      setup(props: { to: string; custom: boolean }, { slots }: { slots: { default?: (slotProps?: { href: string }) => unknown[] } }) {
        return () => props.custom
          ? slots.default?.({ href: props.to })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibraryBrowseResults, {
        mode: "works",
        response: {
          data: [{
            key: "roda-rummet",
            titlePath: "roda-rummet",
            title: "Röda rummet",
            titleTooltip: "Röda rummet: skildringar ur artist- och författarlivet",
            year: "1879",
            surname: "Strindberg",
            authorTooltip: "Strindberg, August",
            roleSuffix: " (red.)",
            titleHref: "/författare/august-strindberg/titlar/roda-rummet",
            authorHref: "/författare/august-strindberg",
            actions: [{ kind: "download", label: "Hämta EPUB", href: "/download/roda-rummet.epub", downloadFilename: "roda-rummet.epub" }],
            sourceExports: []
          }],
          hits: 1,
          distinctHits: 1,
          authorIds: [],
          suggest: [],
          failed: false
        },
        expandedKey: "roda-rummet",
        loading: false,
        sortOptions: [{ key: "titlar", label: "Titel", to: "/bibliotek?visa=works&sort=titlar", active: true }],
        sortReversed: false,
        pagination: {
          currentPage: 1,
          pageCount: 2,
          previous: null,
          next: "/bibliotek?visa=works&sida=2",
          entries: [
            { key: "page-1", page: 1, label: "1", to: "/bibliotek?visa=works", ellipsis: false },
            { key: "page-2", page: 2, label: "2", to: "/bibliotek?visa=works&sida=2", ellipsis: false }
          ]
        },
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }],
        onToggleWork: (key: string) => toggled.push(key),
        onSelectSort: (sort: string) => selectedSorts.push(sort),
        onSelectPage: (page: number) => selectedPages.push(page)
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(target.querySelectorAll("[data-library-work-row]")).toHaveLength(1)
    expect(target.querySelector("[data-library-work-toggle]")?.textContent?.trim()).toBe("Röda rummet")
    expect(target.querySelector('[data-library-tooltip-kind="title"]')?.getAttribute("data-library-tooltip-kind")).toBe("title")
    expect(target.querySelector("[data-library-imprint-year]")?.getAttribute("href")).toBe("/bibliotek?intervall=1879%2C1879")
    expect(target.querySelector('[data-library-tooltip-kind="author"]')?.getAttribute("href")).toBe("/författare/august-strindberg")
    expect(target.querySelector("[data-library-work-actions]")?.id).toBe("library-work-actions-roda-rummet")
    expect(target.querySelector("[data-library-work-actions] a")?.getAttribute("download")).toBe("roda-rummet.epub")
    const toggle = target.querySelector<HTMLButtonElement>("[data-library-work-toggle]")
    toggle?.click()
    target.querySelector<HTMLAnchorElement>('[data-library-sort="titlar"]')?.click()
    target.querySelector<HTMLAnchorElement>('[data-library-page="2"]')?.click()
    await nextTick()
    expect(toggled).toEqual(["roda-rummet"])
    expect(selectedSorts).toEqual(["titlar"])
    expect(selectedPages).toEqual([2])
    app.unmount()
    target.remove()
  })

  test("renders ordinary Part rows with their navigation targets", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick }, { default: LibraryBrowseResults }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryBrowseResults.vue")
    ])
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean },
      setup(props: { to: string; custom: boolean }, { slots }: { slots: { default?: (slotProps?: { href: string }) => unknown[] } }) {
        return () => props.custom
          ? slots.default?.({ href: props.to })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibraryBrowseResults, {
        mode: "parts",
        response: {
          data: [{
            key: "roda-rummet-del-1",
            titlePath: "roda-rummet",
            title: "Första kapitlet",
            titleTooltip: "Röda rummet, första kapitlet",
            year: "1879",
            surname: "Strindberg",
            authorTooltip: "Strindberg, August",
            roleSuffix: " (ill.)",
            titleHref: "/författare/august-strindberg/titlar/roda-rummet/forsta-kapitlet",
            authorHref: "/författare/august-strindberg",
            actions: [],
            sourceExports: []
          }],
          hits: 1,
          distinctHits: 1,
          authorIds: [],
          suggest: [],
          failed: false
        },
        expandedKey: "",
        loading: false,
        sortOptions: [{ key: "titlar", label: "Titel", to: "/bibliotek?visa=parts&sort=titlar", active: true }],
        sortReversed: false,
        pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] },
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }]
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(target.querySelectorAll("[data-library-part-row]")).toHaveLength(1)
    expect(target.querySelector('[data-library-tooltip-kind="title"]')?.getAttribute("href"))
      .toBe("/författare/august-strindberg/titlar/roda-rummet/forsta-kapitlet")
    expect(target.querySelector("[data-library-imprint-year]")?.getAttribute("href")).toBe("/bibliotek?intervall=1879%2C1879")
    expect(target.querySelector('[data-library-tooltip-kind="author"]')?.getAttribute("href"))
      .toBe("/författare/august-strindberg")
    app.unmount()
    target.remove()
  })

  test("renders author rows, disclosure, and result states", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibraryAuthorResults }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryAuthorResults.vue")
    ])
    const response = ref({
      data: [{
        index: "author",
        sourceLabel: "Författare",
        primaryLabel: "",
        primaryHref: "/författare/august-strindberg",
        download: false,
        yearLabel: "1849–1912",
        secondaryAuthor: "",
        authorHref: "",
        authorSurname: "Strindberg",
        authorGivenNames: "August",
        mobileYearLabel: "",
        authorId: "august-strindberg",
        authorPopularity: 1,
        authorBirth: 1849,
        fullTitle: "",
        authorContribution: "",
        highlights: []
      }],
      hits: 4,
      workCount: 0,
      partCount: 0,
      workAuthorIds: {},
      partAuthorIds: {},
      suggest: [],
      failed: false
    })
    const loading = ref(false)
    const selectedSorts: string[] = []
    let showAllCount = 0
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean },
      setup(props: { to: string; custom: boolean }, { slots }: { slots: { default?: (slotProps?: { href: string }) => unknown[] } }) {
        return () => props.custom
          ? slots.default?.({ href: props.to })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibraryAuthorResults, {
        response: response.value,
        sortOptions: [
          { key: "popularitet", label: "Popularitet", to: "/bibliotek?visa=authors", active: true },
          { key: "namn", label: "Namn", to: "/bibliotek?visa=authors&sort=namn", active: false }
        ],
        sortReversed: false,
        loading: loading.value,
        showAll: true,
        onSelectSort: (sort: string) => selectedSorts.push(sort),
        onShowAll: () => { showAllCount += 1 }
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(target.querySelectorAll("[data-library-author-row]")).toHaveLength(1)
    expect(target.querySelector("[data-library-author-name]")?.getAttribute("href"))
      .toBe("/författare/august-strindberg")
    expect(target.querySelector("[data-library-author-name]")?.textContent?.trim())
      .toBe("Strindberg, August")
    expect(target.querySelector("[data-library-authors-show-all]")?.textContent?.trim())
      .toBe("Visa alla 4 träffar")
    target.querySelector<HTMLAnchorElement>('[data-library-sort="namn"]')?.click()
    target.querySelector<HTMLButtonElement>("[data-library-authors-show-all]")?.click()
    await nextTick()
    expect(selectedSorts).toEqual(["namn"])
    expect(showAllCount).toBe(1)

    loading.value = true
    await nextTick()
    expect(target.querySelector("[data-library-loading]")).not.toBeNull()
    response.value = { ...response.value, data: [], hits: 0 }
    await nextTick()
    expect(target.querySelector("[data-library-empty]")?.textContent?.trim()).toBe("Inga träffar.")
    response.value = { ...response.value, failed: true }
    await nextTick()
    expect(target.querySelector("[data-library-error]")?.textContent).toBe("Ett fel uppstod.")
    app.unmount()
    target.remove()
  })

  test("keeps author and download sort controls native to avoid prefetch work", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, onMounted }, { default: LibraryAuthorResults }, { default: LibraryDownloadResults }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryAuthorResults.vue"),
      import("../../app/components/library/LibraryDownloadResults.vue")
    ])
    let scheduledPrefetches = 0
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean },
      setup(props: { to: string }, { slots }: { slots: { default?: (slotProps?: { href: string, navigate: () => void }) => unknown[] } }) {
        onMounted(() => { scheduledPrefetches += 1 })
        return () => slots.default?.({ href: props.to, navigate: () => undefined })
      }
    }
    const app = createApp({
      setup: () => () => h("div", [
        h(LibraryAuthorResults, {
          response: { data: [], hits: 0, workCount: 0, partCount: 0, workAuthorIds: {}, partAuthorIds: {}, suggest: [], failed: false },
          sortOptions: [{ key: "namn", label: "Namn", to: "/bibliotek?visa=authors&sort=namn", active: true }],
          sortReversed: false,
          loading: false,
          showAll: false
        }),
        h(LibraryDownloadResults, {
          mode: "pdf",
          response: { data: [], hits: 0, distinctHits: 0, suggest: [], failed: false },
          sortOptions: [{ key: "titlar", label: "Titel", to: "/bibliotek?visa=pdf&sort=titlar", active: true }],
          sortReversed: false,
          imprintYearTargets: [],
          loading: false,
          pagination: { currentPage: 1, pageCount: 1, previous: null, next: null, entries: [] }
        })
      ])
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(target.querySelector<HTMLAnchorElement>('[data-library-sort="namn"]')?.getAttribute("href"))
      .toBe("/bibliotek?visa=authors&sort=namn")
    expect(target.querySelector<HTMLAnchorElement>('[data-library-sort="titlar"]')?.getAttribute("href"))
      .toBe("/bibliotek?visa=pdf&sort=titlar")
    expect(scheduledPrefetches).toBe(0)
    app.unmount()
    target.remove()
  })

  test("disables prefetch only for extracted anchor controls", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [
      { createApp, defineComponent, h, nextTick, onMounted },
      { default: LibraryPagination },
      { default: LibraryModeTabs },
      { default: LibraryAllResults },
      { default: LibraryLatestResults }
    ] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryPagination.vue"),
      import("../../app/components/library/LibraryModeTabs.vue"),
      import("../../app/components/library/LibraryAllResults.vue"),
      import("../../app/components/library/LibraryLatestResults.vue")
    ])
    const registeredLinks: string[] = []
    const scheduledPrefetches: string[] = []
    const NuxtLink = defineComponent({
      inheritAttrs: false,
      props: {
        to: { type: [String, Object], required: true },
        custom: Boolean,
        replace: Boolean,
        noPrefetch: Boolean
      },
      setup(props, { attrs, slots }) {
        const href = String(props.to)
        registeredLinks.push(href)
        onMounted(() => {
          if (!props.noPrefetch) scheduledPrefetches.push(href)
        })
        return () => props.custom
          ? slots.default?.({ href, navigate: () => undefined })
          : h("a", { ...attrs, href }, slots.default?.())
      }
    })
    const pagination = {
      currentPage: 1,
      pageCount: 2,
      previous: "/pagination-previous",
      next: "/pagination-next",
      entries: [
        { key: "page-1", page: 1, label: "1", to: "/pagination-current", ellipsis: false },
        { key: "page-2", page: 2, label: "2", to: "/pagination-numeric", ellipsis: false }
      ]
    }
    const app = createApp({
      setup: () => () => h("div", [
        h(LibraryPagination, { model: pagination }),
        h(LibraryModeTabs, {
          tabs: [
            { mode: "works", label: "Verk", count: 1, to: "/tab-active", active: true, disabledLook: false, disabled: false, separatorBefore: false },
            { mode: "authors", label: "Författare", count: 0, to: "/tab-disabled", active: false, disabledLook: true, disabled: true, separatorBefore: true }
          ]
        }),
        h(LibraryAllResults, {
          response: {
            data: [{
              index: "etext",
              sourceLabel: "Etext",
              primaryLabel: "Ett drömspel",
              primaryHref: "/författare/all-work",
              download: false,
              yearLabel: "1888",
              secondaryAuthor: "August Strindberg",
              authorHref: "/författare/all-author",
              authorSurname: "",
              authorGivenNames: "",
              mobileYearLabel: "",
              authorId: "",
              authorPopularity: 0,
              authorBirth: 0,
              fullTitle: "",
              authorContribution: "",
              highlights: []
            }],
            hits: 1,
            suggest: [],
            failed: false
          },
          sortOptions: [{ key: "relevans", label: "Relevans", to: "/all-sort", active: true }],
          sortReversed: false,
          imprintYearTargets: [{ year: "1888", to: "/all-year" }],
          loading: false,
          pagination: { ...pagination, pageCount: 1 }
        }),
        h(LibraryLatestResults, {
          response: {
            groups: [{
              imported: "2026-08-11",
              label: "11 augusti 2026 (1 verk)",
              results: [{
                title: "Röda rummet",
                titleTooltip: "Röda rummet",
                titleId: "roda-rummet",
                year: "1879",
                surname: "Strindberg",
                authorTooltip: "Strindberg, August",
                roleSuffix: "",
                titleHref: "/författare/latest-work",
                authorHref: "/författare/latest-author",
                imported: "2026-08-11"
              }]
            }],
            hits: 1,
            distinctHits: 1,
            suggest: [],
            failed: false
          },
          sortOptions: [{ key: "nytillkommet", label: "Nytt", to: "/latest-sort", active: true }],
          sortReversed: false,
          hide1800: false,
          imprintYearTargets: [{ year: "1879", to: "/latest-year" }],
          loading: false,
          pagination: { ...pagination, pageCount: 1 }
        })
      ])
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(registeredLinks).toEqual([
      "/pagination-previous",
      "/pagination-current",
      "/pagination-numeric",
      "/pagination-next",
      "/tab-active",
      "/tab-disabled",
      "/all-sort",
      "/f%C3%B6rfattare/all-work",
      "/all-year",
      "/f%C3%B6rfattare/all-author",
      "/latest-sort",
      "/f%C3%B6rfattare/latest-work",
      "/latest-year",
      "/f%C3%B6rfattare/latest-author"
    ])
    expect(scheduledPrefetches).toEqual([
      "/f%C3%B6rfattare/all-work",
      "/all-year",
      "/f%C3%B6rfattare/all-author",
      "/f%C3%B6rfattare/latest-work",
      "/latest-year",
      "/f%C3%B6rfattare/latest-author"
    ])
    app.unmount()
    target.remove()
  })

  test("renders EPUB and PDF download rows, navigation targets, and result states", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const [{ createApp, h, nextTick, ref }, { default: LibraryDownloadResults }] = await Promise.all([
      import("vue"),
      import("../../app/components/library/LibraryDownloadResults.vue")
    ])
    const response = ref({
      data: [{
        title: "Röda rummet",
        titleTooltip: "Röda rummet: skildringar ur artist- och författarlivet",
        year: "1879",
        surname: "Strindberg",
        authorTooltip: "Strindberg, August",
        roleSuffix: " (red.)",
        titleHref: "/författare/august-strindberg/titlar/roda-rummet",
        titleTo: "/författare/august-strindberg/titlar/roda-rummet",
        authorHref: "/författare/august-strindberg",
        downloadHref: "/download/roda-rummet.epub",
        downloadFilename: "roda-rummet.epub"
      }],
      hits: 101,
      distinctHits: 101,
      suggest: [],
      failed: false
    })
    const mode = ref<"epub" | "pdf">("epub")
    const loading = ref(false)
    const selectedSorts: string[] = []
    const selectedPages: number[] = []
    const NuxtLink = {
      props: { to: { type: [String, Object], required: true }, custom: Boolean },
      setup(props: { to: string; custom: boolean }, { slots }: { slots: { default?: (slotProps?: { href: string; navigate: () => void }) => unknown[] } }) {
        return () => props.custom
          ? slots.default?.({ href: props.to, navigate: () => undefined })
          : h("a", { href: props.to }, slots.default?.())
      }
    }
    const app = createApp({
      setup: () => () => h(LibraryDownloadResults, {
        mode: mode.value,
        response: response.value,
        sortOptions: [
          { key: "titlar", label: "Titel", to: "/bibliotek?visa=epub", active: true },
          { key: "år", label: "År", to: "/bibliotek?visa=epub&sort=år", active: false }
        ],
        sortReversed: true,
        imprintYearTargets: [{ year: "1879", to: "/bibliotek?intervall=1879%2C1879" }],
        loading: loading.value,
        pagination: {
          currentPage: 1,
          pageCount: 2,
          previous: null,
          next: "/bibliotek?visa=epub&sida=2",
          entries: [
            { key: "page-1", page: 1, label: "1", to: "/bibliotek?visa=epub", ellipsis: false },
            { key: "page-2", page: 2, label: "2", to: "/bibliotek?visa=epub&sida=2", ellipsis: false }
          ]
        },
        onSelectSort: (sort: string) => selectedSorts.push(sort),
        onSelectPage: (page: number) => selectedPages.push(page)
      })
    })
    app.component("NuxtLink", NuxtLink)
    app.mount(target)
    await nextTick()

    expect(target.querySelectorAll("[data-library-epub-row]")).toHaveLength(1)
    expect(target.querySelector("[data-library-epub-title]")?.getAttribute("href"))
      .toBe("/författare/august-strindberg/titlar/roda-rummet")
    expect(target.querySelector("[data-library-epub-year]")?.textContent).toBe("1879")
    expect(target.querySelector("[data-library-imprint-year]")?.getAttribute("href"))
      .toBe("/bibliotek?intervall=1879%2C1879")
    expect(target.querySelector("[data-library-epub-author]")?.getAttribute("href"))
      .toBe("/författare/august-strindberg")
    expect(target.querySelector('[data-library-tooltip-kind="title"]')?.textContent).toBe("Röda rummet")
    expect(target.querySelector('[data-library-tooltip-kind="author"]')?.textContent).toBe("Strindberg")
    expect(target.querySelector(".text-gray-700.sc")?.textContent).toBe("(red.)")
    expect(target.querySelector("[data-library-epub-download]")?.getAttribute("href"))
      .toBe("/download/roda-rummet.epub")
    expect(target.querySelector("[data-library-epub-download]")?.getAttribute("download"))
      .toBe("roda-rummet.epub")
    expect(target.querySelector(".fa")?.classList.contains("fa-caret-up")).toBe(true)
    target.querySelector<HTMLAnchorElement>('[data-library-sort="år"]')?.click()
    target.querySelector<HTMLAnchorElement>('[data-library-page="2"]')?.click()
    await nextTick()
    expect(selectedSorts).toEqual(["år"])
    expect(selectedPages).toEqual([2])

    mode.value = "pdf"
    response.value = {
      data: [{
        title: "Ett drömspel",
        titleTooltip: "Ett drömspel: skådespel",
        year: "1902",
        surname: "Strindberg",
        authorTooltip: "Strindberg, August",
        roleSuffix: " (ill.)",
        titleHref: "/författare/august-strindberg/titlar/ett-dromspel",
        titleTo: "/författare/august-strindberg/titlar/ett-dromspel",
        authorHref: "/författare/august-strindberg",
        downloadHref: "/download/ett-dromspel.pdf",
        downloadFilename: "ett-dromspel.pdf"
      }],
      hits: 1,
      distinctHits: 1,
      suggest: [],
      failed: false
    }
    await nextTick()
    expect(target.querySelectorAll("[data-library-pdf-row]")).toHaveLength(1)
    expect(target.querySelector("[data-library-pdf-title]")?.getAttribute("href"))
      .toBe("/författare/august-strindberg/titlar/ett-dromspel")
    expect(target.querySelector("[data-library-pdf-year]")?.textContent).toBe("1902")
    expect(target.querySelector("[data-library-pdf-author]")?.getAttribute("href"))
      .toBe("/författare/august-strindberg")
    expect(target.querySelector(".text-gray-700.sc")?.textContent).toBe("(ill.)")
    expect(target.querySelector("[data-library-pdf-download]")?.getAttribute("href"))
      .toBe("/download/ett-dromspel.pdf")
    expect(target.querySelector("[data-library-pdf-download]")?.getAttribute("download"))
      .toBe("ett-dromspel.pdf")
    loading.value = true
    await nextTick()
    expect(target.querySelector("[data-library-loading]")).not.toBeNull()
    response.value = { ...response.value, data: [], hits: 0, distinctHits: 0 }
    await nextTick()
    expect(target.querySelector("[data-library-empty]")?.textContent?.trim()).toBe("Inga träffar.")
    response.value = { ...response.value, failed: true }
    await nextTick()
    expect(target.querySelector("[data-library-error]")?.textContent).toBe("Ett fel uppstod.")
    app.unmount()
    target.remove()
  })
})
