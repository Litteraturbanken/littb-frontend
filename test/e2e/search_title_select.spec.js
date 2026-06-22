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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const mockSearchBackend = async page => {
    let titleSearchRequests = 0
    let showAllTitleRequests = 0
    let unfilteredShowAllTitleRequests = 0
    const authorFilteredTitleRequestSizes = []
    const submittedSearchWorkIds = []

    await page.route("**/get_authors*", async route => {
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

    await page.route("**/get_authorkeywords*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "[]"
        })
    })

    await page.route("**/query_string/etext,faksimil*", async route => {
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

    await page.route("**/search_count/*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ total_highlights: 0 })
        })
    })

    await page.route(/^(?!.*\/components\/search\/).*\/(?:api\/)?search\/[^/?]+(?:\?.*)?$/, async route => {
        const requestUrl = new URL(route.request().url())
        submittedSearchWorkIds.push(requestUrl.searchParams.get("work_ids"))

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: 0,
                data: [],
                author_aggregation: []
            })
        })
    })

    return {
        getTitleSearchRequests: () => titleSearchRequests,
        getShowAllTitleRequests: () => showAllTitleRequests,
        getUnfilteredShowAllTitleRequests: () => unfilteredShowAllTitleRequests,
        getAuthorFilteredTitleRequestSizes: () => authorFilteredTitleRequestSizes,
        getSubmittedSearchWorkIds: () => submittedSearchWorkIds
    }
}

const mockDelayedTitleBackend = async page => {
    await page.route("**/get_authors*", async route => {
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
                    }
                ]
            })
        })
    })

    await page.route("**/get_authorkeywords*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "[]"
        })
    })

    await page.route("**/query_string/etext,faksimil*", async route => {
        const requestUrl = new URL(route.request().url())
        const q = requestUrl.searchParams.get("q") || ""
        const isAdamSearch = q.toLowerCase().includes("adam")
        const isStaleSearch = q.toLowerCase().includes("ada") && !isAdamSearch

        if (isStaleSearch) {
            await delay(250)
        }

        const data = isAdamSearch
            ? [
                  makeTitle(1, {
                      lbworkid: "fresh-adam",
                      title: "Adam Fresh Title",
                      shorttitle: "Adam Fresh Title"
                  })
              ]
            : isStaleSearch
              ? [
                    makeTitle(2, {
                        lbworkid: "stale-ada",
                        title: "Ada Stale Title",
                        shorttitle: "Ada Stale Title"
                    })
                ]
              : [makeTitle(3)]

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: data.length,
                distinct_hits: data.length,
                data,
                author_aggregation: [],
                imported_aggregation: [],
                suggest: []
            })
        })
    })
}

const mockTitleBackendWithAuthorAggregation = async page => {
    await page.route("**/get_authors*", async route => {
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

    await page.route("**/get_authorkeywords*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "[]"
        })
    })

    await page.route("**/query_string/etext,faksimil*", async route => {
        const requestUrl = new URL(route.request().url())
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: 1,
                distinct_hits: 1,
                data: [
                    makeTitle(1, {
                        lbworkid: "fresh-adam",
                        title: "Adam Fresh Title",
                        shorttitle: "Adam Fresh Title"
                    })
                ],
                author_aggregation: [{ authorid: "Author1" }],
                imported_aggregation: [],
                suggest: [],
                requested_author_aggregation:
                    requestUrl.searchParams.get("author_aggregation") === "true"
            })
        })
    })
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

test("keeps the title search input responsive while results update", async ({ page }) => {
    await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    const searchField = page.locator(".select2-container--open .select2-search__field")
    await searchField.type("infernononon", { delay: 30 })

    await expect(searchField).toHaveValue("infernononon")
})

test("keeps selected title filters when submitting a new search", async ({ page }) => {
    const { getSubmittedSearchWorkIds } = await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Homo", exact: true }).click()
    await page.keyboard.press("Escape")

    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Homo" })
    ).toBeVisible()

    const queryInput = page.locator(".submit_form input").first()
    await queryInput.fill("inferno")
    await expect.poll(async () => {
        return page.evaluate(() => {
            const searchScope = window.angular
                .element(document.querySelector("search-page"))
                .isolateScope()
            return searchScope.$ctrl.query
        })
    }).toBe("inferno")
    await queryInput.press("Enter")
    await waitForAngular(page)

    await expect.poll(() => getSubmittedSearchWorkIds()).toContain("lbadam")
    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Homo" })
    ).toBeVisible()
})

test("keeps multiple selected title filters when submitting a new search", async ({ page }) => {
    const { getSubmittedSearchWorkIds } = await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    const queryInput = page.locator(".submit_form input").first()
    await queryInput.fill("inferno")
    await expect.poll(async () => {
        return page.evaluate(() => {
            const searchScope = window.angular
                .element(document.querySelector("search-page"))
                .isolateScope()
            return searchScope.$ctrl.query
        })
    }).toBe("inferno")

    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Homo", exact: true }).click()
    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Title 2", exact: true }).click()
    await page.getByRole("button", { name: "Sök", exact: true }).click()
    await waitForAngular(page)

    await expect.poll(() => getSubmittedSearchWorkIds()).toContain("lbadam,lbtitle32")
    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Homo" })
    ).toBeVisible()
    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Title 2" })
    ).toBeVisible()
})

test("uses the current title select value when the title URL state is stale", async ({ page }) => {
    const { getSubmittedSearchWorkIds } = await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Homo", exact: true }).click()
    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Title 2", exact: true }).click()

    await page.evaluate(() => {
        const searchScope = window.angular
            .element(document.querySelector("search-page"))
            .isolateScope()
        const ctrl = searchScope.$ctrl
        ctrl.selectedTitles = ["lbadam", "lbtitle32"]
        window.$("select.title_select").val(["lbadam"])
        searchScope.loc.search("titlar", "lbadam")
        ctrl.onSearchSubmit("inferno")
    })
    await waitForAngular(page)

    await expect.poll(() => getSubmittedSearchWorkIds()).toContain("lbadam,lbtitle32")
    await expect.poll(async () => {
        return page.evaluate(() => {
            const searchScope = window.angular
                .element(document.querySelector("search-page"))
                .isolateScope()
            return searchScope.$ctrl.selectedTitles
        })
    }).toEqual(["lbadam", "lbtitle32"])
})

test("keeps selected title filters while filtering the title dropdown again", async ({ page }) => {
    await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Homo", exact: true }).click()
    await page.keyboard.press("Escape")

    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Homo" })
    ).toBeVisible()

    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Title")
    await expect(page.getByRole("treeitem", { name: "Title 1", exact: true })).toBeVisible()

    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Homo" })
    ).toBeVisible()
    await expect.poll(async () => {
        return page.evaluate(() => {
            const searchScope = window.angular
                .element(document.querySelector("search-page"))
                .isolateScope()
            return searchScope.$ctrl.selectedTitles
        })
    }).toEqual(["lbadam"])
})

test("keeps multiple selected title filters while filtering the title dropdown again", async ({ page }) => {
    await mockSearchBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Homo", exact: true }).click()
    await page.locator(".title_select_container .select2-selection").first().click()
    await page.locator(".select2-container--open .select2-search__field").fill("Adam")
    await page.getByRole("treeitem", { name: "Adam Title 2", exact: true }).click()

    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Homo" })
    ).toBeVisible()
    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Title 2" })
    ).toBeVisible()

    await page.getByPlaceholder("Titlar", { exact: true }).click()
    await page.locator(".select2-container--open .select2-search__field").fill("Title")
    await expect(page.getByRole("treeitem", { name: "Title 1", exact: true })).toBeVisible()

    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Homo" })
    ).toBeVisible()
    await expect(
        page.locator(".title_select_container .select2-selection__choice", { hasText: "Adam Title 2" })
    ).toBeVisible()
    await expect.poll(async () => {
        return page.evaluate(() => {
            const select = document.querySelector("select.title_select")
            return Array.from(select.selectedOptions).map(option => option.value)
        })
    }).toEqual(["lbadam", "lbtitle32"])
    await expect.poll(async () => {
        return page.evaluate(() => {
            const searchScope = window.angular
                .element(document.querySelector("search-page"))
                .isolateScope()
            return searchScope.$ctrl.selectedTitles
        })
    }).toEqual(["lbadam", "lbtitle32"])
})

test("ignores aborted stale title responses", async ({ page }) => {
    await mockDelayedTitleBackend(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    const state = await page.evaluate(() => {
        return new Promise(resolve => {
            const searchScope = window.angular
                .element(document.querySelector("search-page"))
                .isolateScope()
            const ctrl = searchScope.$ctrl
            const ajax = ctrl.titleSelectSetup.ajax
            const first = ajax.transport(
                { data: { q: "Ada" } },
                () => {
                    window.__staleTitleSuccess = true
                },
                () => {}
            )

            first.abort()

            ajax.transport(
                { data: { q: "Adam" } },
                results => {
                    window.__freshTitleResults = results.results.map(result => result.text)
                    window.__freshTitleResolved = true
                },
                error => {
                    window.__freshTitleError = error && (error.statusText || error.message || error)
                    window.__freshTitleResolved = true
                }
            )

            const started = Date.now()
            const check = () => {
                if (window.__freshTitleResolved || Date.now() - started > 2000) {
                    setTimeout(() => {
                        resolve({
                            staleSucceeded: Boolean(window.__staleTitleSuccess),
                            freshError: window.__freshTitleError,
                            freshResults: window.__freshTitleResults || [],
                            controllerTitles: (ctrl.titles || []).map(
                                title => title.shorttitle || title.title
                            )
                        })
                    }, 300)
                    return
                }
                setTimeout(check, 25)
            }
            check()
        })
    })

    expect(state.freshError).toBeFalsy()
    expect(state.staleSucceeded).toBe(false)
    expect(state.freshResults).toContain("Adam Fresh Title")
    expect(state.controllerTitles).toContain("Adam Fresh Title")
    expect(state.controllerTitles).not.toContain("Ada Stale Title")
})

test("does not update the author select while filtering titles", async ({ page }) => {
    await mockTitleBackendWithAuthorAggregation(page)

    await page.goto("/sök?avancerad", { waitUntil: "networkidle" })
    await waitForAngular(page)

    const authorNames = await page.evaluate(() => {
        return new Promise(resolve => {
            const searchScope = window.angular
                .element(document.querySelector("search-page"))
                .isolateScope()
            const ctrl = searchScope.$ctrl
            ctrl.authors = [
                ctrl.authorsById.Author1,
                ctrl.authorsById.StrindbergA
            ]

            ctrl.titleSelectSetup.ajax.transport(
                { data: { q: "Adam" } },
                () => {
                    resolve(ctrl.authors.map(author => author.name_for_index))
                },
                error => {
                    resolve([`error:${error && (error.statusText || error.message || error)}`])
                }
            )
        })
    })

    expect(authorNames).toEqual(["Author, One", "Strindberg, August"])
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
