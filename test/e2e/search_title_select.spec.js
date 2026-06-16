const { test, expect } = require("@playwright/test")

const waitForAngular = async page => {
    await page.evaluate(() => {
        return new Promise(resolve => {
            const started = Date.now()
            const check = () => {
                if (Date.now() - started > 3000) {
                    resolve()
                    return
                }

                if (!window.angular) {
                    setTimeout(check, 100)
                    return
                }

                const element = document.querySelector("[ng-app], [data-ng-app]") || document.body
                const injector = window.angular.element(element).injector()
                if (!injector) {
                    setTimeout(check, 100)
                    return
                }

                const $http = injector.get("$http")
                if (!$http.pendingRequests || $http.pendingRequests.length === 0) {
                    resolve()
                } else {
                    setTimeout(check, 100)
                }
            }
            check()
        })
    })
}

const makeTitle = (index, overrides = {}) => ({
    lbworkid: `lbtitle${index}`,
    titlepath: `Title${index}`,
    title: `Title ${index}`,
    shorttitle: `Title ${index}`,
    titleid: `Title${index}`,
    work_titleid: `Title${index}`,
    mediatype: "etext",
    startpagename: "1",
    searchable: true,
    authors: [{ authorid: "Author1", surname: "Author", full_name: "Author One" }],
    work_authors: [{ authorid: "Author1", surname: "Author", full_name: "Author One" }],
    main_author: { authorid: "Author1", surname: "Author", full_name: "Author One" },
    export: [],
    ...overrides
})

const mockSearchBackend = async page => {
    let titleSearchRequests = 0
    let showAllTitleRequests = 0
    let unfilteredShowAllTitleRequests = 0
    const authorFilteredTitleRequestSizes = []

    await page.route("**/api/get_authors*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                data: [
                    {
                        authorid: "Author1",
                        surname: "Author",
                        full_name: "Author One",
                        name_for_index: "Author, One",
                        searchable: true
                    },
                    {
                        authorid: "StrindbergA",
                        surname: "Strindberg",
                        full_name: "August Strindberg",
                        name_for_index: "Strindberg, August",
                        searchable: true
                    }
                ]
            })
        })
    })

    await page.route("**/api/get_authorkeywords*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "[]"
        })
    })

    await page.route("**/api/query_string/etext,faksimil*", async route => {
        const requestUrl = new URL(route.request().url())
        const q = requestUrl.searchParams.get("q") || ""
        const requestedSize = Number(requestUrl.searchParams.get("to"))
        const isTitleSearch = q.toLowerCase().includes("adam")
        const isAuthorFilteredTitleSearch = q.includes("authors>(authorid:StrindbergA)")
        if (isTitleSearch) {
            titleSearchRequests += 1
        }
        if (isTitleSearch && requestedSize > 30) {
            showAllTitleRequests += 1
        }
        if (!isTitleSearch && !isAuthorFilteredTitleSearch && requestedSize > 30) {
            unfilteredShowAllTitleRequests += 1
        }
        if (isAuthorFilteredTitleSearch) {
            authorFilteredTitleRequestSizes.push(requestedSize)
        }

        const data = isTitleSearch
            ? [
                  makeTitle(31, {
                      lbworkid: "lbadam",
                      titlepath: "AdamHomo",
                      title: "Adam Homo",
                      shorttitle: "Adam Homo",
                      titleid: "AdamHomo",
                      work_titleid: "AdamHomo"
                  }),
                  ...Array.from({ length: requestedSize > 30 ? 30 : 29 }, (_, index) =>
                      makeTitle(index + 32, {
                          title: `Adam Title ${index + 2}`,
                          shorttitle: `Adam Title ${index + 2}`
                      })
                  )
              ]
            : Array.from({ length: requestedSize > 30 ? 31 : 30 }, (_, index) =>
                  makeTitle(index + 1)
              )
        const hits = isTitleSearch ? 31 : 13235

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits,
                distinct_hits: hits,
                data,
                author_aggregation: [],
                imported_aggregation: [],
                suggest: []
            })
        })
    })

    return {
        getTitleSearchRequests: () => titleSearchRequests,
        getShowAllTitleRequests: () => showAllTitleRequests,
        getUnfilteredShowAllTitleRequests: () => unfilteredShowAllTitleRequests,
        getAuthorFilteredTitleRequestSizes: () => authorFilteredTitleRequestSizes
    }
}

test("shows a Swedish show-all row for the initial limited title dropdown", async ({ page }) => {
    const { getUnfilteredShowAllTitleRequests } = await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    await expect(page.getByRole("treeitem", { name: "Title 1", exact: true })).toBeVisible()
    await expect(page.getByRole("treeitem", { name: "Visa alla 13235 titlar" })).toBeVisible()
    await expect(page.getByRole("treeitem", { name: /show all/i })).toHaveCount(0)

    await page.getByRole("treeitem", { name: "Visa alla 13235 titlar" }).click()

    await expect.poll(() => getUnfilteredShowAllTitleRequests()).toBeGreaterThan(0)
    await expect(page.getByRole("treeitem", { name: "Title 31", exact: true })).toBeVisible()
})

test("filters the title dropdown against all matching titles", async ({ page }) => {
    const { getTitleSearchRequests, getShowAllTitleRequests } = await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    await expect(page.getByRole("treeitem", { name: "Title 1", exact: true })).toBeVisible()

    await page.locator(".select2-container--open .select2-search__field").fill("Adam")

    await expect(page.getByRole("treeitem", { name: "Adam Homo", exact: true })).toBeVisible()
    await expect(
        page.getByRole("treeitem", { name: "Visar de första 30 matchande titlarna", exact: true })
    ).toBeVisible()
    expect(getTitleSearchRequests()).toBeGreaterThan(0)

    await expect(
        page.getByRole("treeitem", { name: "Visa alla 31 matchande titlar", exact: true })
    ).toBeVisible()

    await page.getByRole("treeitem", { name: "Visa alla 31 matchande titlar", exact: true }).click()

    await expect.poll(() => getShowAllTitleRequests()).toBeGreaterThan(0)
    await expect(page.getByRole("treeitem", { name: "Adam Title 31", exact: true })).toBeVisible()
})

test("shows a Swedish show-all row for author-filtered title dropdowns", async ({ page }) => {
    const { getAuthorFilteredTitleRequestSizes } = await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    await expect(page.getByRole("treeitem", { name: "Title 1", exact: true })).toBeVisible()
    await page.keyboard.press("Escape")

    await page.evaluate(() => {
        const searchScope = window.angular
            .element(document.querySelector("search-page"))
            .isolateScope()
        searchScope.$apply(() => {
            searchScope.$ctrl.filters["authors>authorid"] = ["StrindbergA"]
        })
        window.$("select.title_select").select2("close")
    })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()

    await expect.poll(() => getAuthorFilteredTitleRequestSizes()).toContain(30)
    await expect(page.getByRole("treeitem", { name: "Visa alla 13235 titlar" })).toBeVisible()
    await expect(page.getByRole("treeitem", { name: /show all/i })).toHaveCount(0)

    await page.getByRole("treeitem", { name: "Visa alla 13235 titlar" }).click()

    await expect.poll(() => getAuthorFilteredTitleRequestSizes()).toContain(13235)
    await expect(page.getByRole("treeitem", { name: "Title 31", exact: true })).toBeVisible()
})
