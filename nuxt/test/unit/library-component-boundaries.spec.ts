import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { createMemoryHistory, createRouter, RouterLink } from "vue-router"

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

const nuxtRoot = resolve(import.meta.dirname, "../..")
const source = (path: string) => readFile(resolve(nuxtRoot, path), "utf8")

describe("Library component ownership", () => {
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
    const page = await source("app/pages/bibliotek.vue")
    expect(page).toContain("<LibraryPagination")
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
    await nextTick()
    expect(target.querySelectorAll("[data-library-pdf-row]")).toHaveLength(1)
    expect(target.querySelector("[data-library-pdf-download]")?.getAttribute("href"))
      .toBe("/download/roda-rummet.epub")
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
