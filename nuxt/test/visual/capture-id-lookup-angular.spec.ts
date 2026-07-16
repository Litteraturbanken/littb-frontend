import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page, type Route } from "@playwright/test"

import { workLookupResponse } from "../fixtures/work-lookup-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const rawTextarea = "Författare – Titel\nTitel två"
const description = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
const lookupPath = "/api/query_string/etext,faksimil"
const expectedQuery = {
  exclude: "text,parts,sourcedesc,pages,errata",
  from: "0",
  q: "*",
  sort_field: "sortkey|asc",
  to: "10000"
}
const typedResponse = workLookupResponse({
  work_id: null,
  titles: ["Titel", "Titel två"]
})

const authors = {
  strindberg: { authorid: "StrindbergA", surname: "Strindberg" },
  lagerlof: { authorid: "LagerlofS", surname: "Lagerlöf" }
}

const rawLegacyFixture = {
  data: [
    {
      lbworkid: "lb238704",
      authors: [authors.strindberg],
      work_authors: [authors.strindberg],
      title: "Författare – Titel",
      shorttitle: "Röda rummet",
      titleid: "RodaRummet",
      work_titleid: "RodaRummet",
      titlepath: "RodaRummet",
      mediatype: "etext",
      startpagename: "1",
      export: []
    },
    {
      lbworkid: "lb238704",
      authors: [authors.strindberg],
      work_authors: [authors.strindberg],
      title: "Författare – Titel",
      shorttitle: "Röda rummet",
      titleid: "RodaRummet",
      work_titleid: "RodaRummet",
      titlepath: "RodaRummet",
      mediatype: "faksimil",
      startpagename: "1",
      export: []
    },
    {
      lbworkid: "lb278171",
      authors: [authors.lagerlof],
      work_authors: [authors.lagerlof],
      title: "Titel två",
      shorttitle: "Gösta Berlings saga",
      titleid: "GostaBerlingsSaga",
      work_titleid: "GostaBerlingsSaga",
      titlepath: "GostaBerlingsSaga",
      mediatype: "etext",
      startpagename: "1",
      export: []
    }
  ],
  author_aggregation: [],
  imported_aggregation: [],
  hits: 3,
  distinct_hits: 2,
  suggest: []
}

type Ledger = {
  intercepted: string[]
  unexpected: string[]
  productionEscapes: string[]
}

function sortedQuery(url: URL) {
  return Object.fromEntries([...url.searchParams.entries()].sort(([left], [right]) => (
    left.localeCompare(right)
  )))
}

function isSearchOrApiRequest(url: URL) {
  return url.pathname.startsWith("/api/")
    || url.pathname.includes("/query_string/")
    || url.pathname.includes("/quick-search")
    || url.pathname.includes("/works/lookup")
}

async function routeAuthorityRequest(route: Route, ledger: Ledger) {
  const request = route.request()
  const url = new URL(request.url())
  if (url.pathname === lookupPath) {
    const requestLabel = `${request.method()} ${url.pathname}${url.search}`
    if (request.method() !== "GET" || JSON.stringify(sortedQuery(url)) !== JSON.stringify(expectedQuery)) {
      ledger.unexpected.push(requestLabel)
      return route.abort("blockedbyclient")
    }
    ledger.intercepted.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(rawLegacyFixture)
    })
  }
  if (isSearchOrApiRequest(url)) {
    const requestLabel = `${request.method()} ${request.url()}`
    ledger.unexpected.push(requestLabel)
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      ledger.productionEscapes.push(requestLabel)
    }
    return route.abort("blockedbyclient")
  }
  return route.continue()
}

async function installEnvelopeSeam(page: Page) {
  await page.evaluate(() => {
    type AngularWindow = Window & {
      angular: {
        element: (element: Element) => {
          injector: () => { get: (name: string) => unknown }
        }
      }
    }
    type Backend = {
      getTitles: (...args: unknown[]) => Promise<{ titles: unknown[] }>
    }
    const angularWindow = window as unknown as AngularWindow
    const injector = angularWindow.angular.element(document.body).injector()
    const backend = injector.get("backend") as Backend
    const originalGetTitles = backend.getTitles.bind(backend)
    backend.getTitles = (...args) => originalGetTitles(...args).then(result => result.titles) as never
  })
}

async function navigateWithinAngular(page: Page, path: string) {
  await page.evaluate(target => {
    type AngularWindow = Window & {
      angular: {
        element: (element: Element) => {
          injector: () => { get: (name: string) => unknown }
        }
      }
    }
    type Location = { path: (value: string) => void }
    type RootScope = { $apply: (action: () => void) => void }
    const angularWindow = window as unknown as AngularWindow
    const injector = angularWindow.angular.element(document.body).injector()
    const location = injector.get("$location") as Location
    const rootScope = injector.get("$rootScope") as RootScope
    rootScope.$apply(() => location.path(target))
  }, path)
}

async function installControllerBindingSeam(page: Page) {
  const component = page.locator("id-page")
  await expect(component).toHaveCount(1)
  await expect.poll(() => component.evaluate(element => {
    type AngularWindow = Window & {
      angular: {
        element: (target: Element) => { isolateScope: () => unknown }
      }
    }
    const angularWindow = window as unknown as AngularWindow
    return Boolean(angularWindow.angular.element(element).isolateScope())
  })).toBe(true)
  await component.evaluate(element => {
    type Controller = {
      idFilter: (row: unknown) => boolean
      rowFilter: (row: unknown) => boolean
    }
    type AngularWindow = Window & {
      angular: {
        element: (target: Element) => {
          isolateScope: () => {
            $apply: (action: () => void) => void
            $ctrl: Controller
          }
        }
      }
    }
    const angularWindow = window as unknown as AngularWindow
    const scope = angularWindow.angular.element(element).isolateScope()
    scope.$apply(() => {
      scope.$ctrl.idFilter = scope.$ctrl.idFilter.bind(scope.$ctrl)
      scope.$ctrl.rowFilter = scope.$ctrl.rowFilter.bind(scope.$ctrl)
    })
  })
}

async function expectShellAndControls(page: Page, populated: boolean) {
  await expect.poll(async () => (await page.locator("body").getAttribute("class"))
    ?.split(/\s+/)
    .filter(Boolean)
    .sort()).toEqual(["focus", "ng-scope", "page-id", "ready"])
  await expect(page).toHaveTitle("Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description)

  const idInput = page.getByPlaceholder("lbid")
  const titleInput = page.getByPlaceholder("titel")
  const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")
  await expect(idInput).toHaveValue("")
  await expect(titleInput).toHaveValue(populated ? "Titel" : "")
  await expect(textarea).toHaveValue(populated ? rawTextarea : "")
  await expect(page.locator("id-page > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".preloader")).toBeHidden()
  if (!populated) await expect(idInput).toBeFocused()
}

async function expectRowsMatchTypedFixture(page: Page) {
  const rows = page.locator(".table-striped tr")
  await expect(rows).toHaveCount(typedResponse.items.length)

  for (const [rowIndex, item] of typedResponse.items.entries()) {
    const cells = rows.nth(rowIndex).locator("td")
    await expect(cells).toHaveCount(4)
    await expect(cells.nth(0)).toHaveText(item.work_id)
    await expect(cells.nth(1).locator("a")).toHaveText(item.author.label)
    await expect(cells.nth(1).locator("a")).toHaveAttribute("href", item.author.url)
    await expect(cells.nth(2).locator("a")).toHaveText(item.title.label)
    await expect(cells.nth(2).locator("a")).toHaveAttribute("href", item.title.url)
    await expect(cells.nth(3).locator("a")).toHaveText(item.media.map(media => media.label))
    for (const [mediaIndex, media] of item.media.entries()) {
      await expect(cells.nth(3).locator("a").nth(mediaIndex)).toHaveAttribute("href", media.url)
    }
  }
}

for (const populated of [false, true]) {
  test(`captures the corrected Angular ID lookup ${populated ? "populated" : "empty"} authority`, async ({
    page
  }, testInfo) => {
    const angularSource = await readFile(
      resolve(import.meta.dirname, "../../../app/scripts/components/id-page/index.js"),
      "utf8"
    )
    expect(angularSource).toContain(
      "this.backend.getTitles(\"etext,faksimil\", { to: 10000 }).then(titleArray => (this.data = titleArray))"
    )
    expect(angularSource).not.toContain("then(result => result.titles)")

    const ledger: Ledger = { intercepted: [], unexpected: [], productionEscapes: [] }
    await page.route("**/*", route => routeAuthorityRequest(route, ledger))

    if (populated) {
      await page.goto("/", { waitUntil: "domcontentloaded" })
      await expect(page.locator("body")).toHaveClass(/\bready\b/)
      await installEnvelopeSeam(page)
      await navigateWithinAngular(page, "/id")
      await installControllerBindingSeam(page)
      await page.locator('meta[name="description"]').evaluate((element, value) => {
        element.setAttribute("content", value)
      }, description)
    } else {
      await page.goto("/id", { waitUntil: "domcontentloaded" })
    }

    await expect.poll(() => ledger.intercepted).toHaveLength(1)
    if (populated) {
      const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")
      await textarea.fill(rawTextarea)
      await expect(textarea).toHaveValue(rawTextarea)
      await expect(page.getByPlaceholder("titel")).toHaveValue("Titel")
      await expect.poll(() => page.locator("id-page").evaluate(element => {
        type AngularWindow = Window & {
          angular: {
            element: (target: Element) => {
              isolateScope: () => {
                $ctrl: {
                  data: Array<{ title: string, titlepath: string }>
                  titles: string[]
                  rowFilter: (row: { title: string, titlepath: string }) => boolean
                }
              }
            }
          }
        }
        const angularWindow = window as unknown as AngularWindow
        const ctrl = angularWindow.angular.element(element).isolateScope().$ctrl
        return {
          dataLength: ctrl.data?.length,
          titles: ctrl.titles,
          rows: ctrl.data?.map(row => ({
            title: row.title,
            titlepath: row.titlepath,
            visible: ctrl.rowFilter(row)
          }))
        }
      })).toEqual({
        dataLength: 2,
        titles: ["Titel", "Titel två"],
        rows: [
          { title: "Författare – Titel", titlepath: "RodaRummet", visible: true },
          { title: "Titel två", titlepath: "GostaBerlingsSaga", visible: true }
        ]
      })
      await expectRowsMatchTypedFixture(page)
    } else {
      await expect(page.locator(".table-striped tr")).toHaveCount(0)
    }

    await expectShellAndControls(page, populated)
    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(ledger.unexpected).toEqual([])
    expect(ledger.productionEscapes).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `id-lookup-${populated ? "populated" : "empty"}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(ledger.intercepted).toHaveLength(1)
    expect(ledger.unexpected).toEqual([])
    expect(ledger.productionEscapes).toEqual([])
  })
}
