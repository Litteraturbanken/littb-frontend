import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"
import { createMemoryHistory, createRouter, RouterLink } from "vue-router"

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
})
