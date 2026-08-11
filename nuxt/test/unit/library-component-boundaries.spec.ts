import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const nuxtRoot = resolve(import.meta.dirname, "../..")
const source = (path: string) => readFile(resolve(nuxtRoot, path), "utf8")

describe("Library component ownership", () => {
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
