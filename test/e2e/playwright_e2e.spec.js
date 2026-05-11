const { test, expect } = require("@playwright/test")

/**
 * Wait for AngularJS to be loaded and partially stable.
 * This is a pragmatic approach that doesn't wait for complete stability
 * since some AngularJS apps have long-running or polling requests.
 */
const waitForAngular = async (page, maxWaitMs = 3000) => {
    try {
        await page.evaluate(timeout => {
            return new Promise(resolve => {
                const startTime = Date.now()

                // First, ensure Angular is loaded
                const checkAngularLoaded = () => {
                    if (Date.now() - startTime > timeout) {
                        resolve()
                        return
                    }

                    if (!window.angular) {
                        setTimeout(checkAngularLoaded, 100)
                        return
                    }

                    // Angular is loaded, check if injector is ready
                    const element =
                        document.querySelector("[ng-app], [data-ng-app]") || document.body
                    const angularElement = window.angular.element(element)

                    try {
                        const injector = angularElement.injector()
                        if (injector) {
                            // Wait for initial HTTP requests to complete (with short timeout)
                            const waitStart = Date.now()
                            const checkHttp = () => {
                                if (Date.now() - waitStart > 2000) {
                                    // After 2s, give up and continue
                                    resolve()
                                    return
                                }

                                try {
                                    const $http = injector.get("$http")
                                    if (
                                        !$http.pendingRequests ||
                                        $http.pendingRequests.length === 0
                                    ) {
                                        resolve()
                                    } else {
                                        setTimeout(checkHttp, 100)
                                    }
                                } catch (e) {
                                    resolve()
                                }
                            }
                            checkHttp()
                        } else {
                            setTimeout(checkAngularLoaded, 100)
                        }
                    } catch (e) {
                        setTimeout(checkAngularLoaded, 100)
                    }
                }

                checkAngularLoaded()
            })
        }, maxWaitMs)

        // Small additional wait for DOM updates
        await page.waitForTimeout(100)
    } catch (e) {
        // Ignore errors and continue - page might work anyway
        console.warn("waitForAngular warning:", e.message)
    }
}

const mockReaderBackend = async page => {
    await page.route("http://localhost:5001/get_authors*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                data: [
                    {
                        authorid: "LagerlöfS",
                        full_name: "Selma Lagerlöf",
                        surname: "Lagerlöf",
                        searchable: true
                    }
                ]
            })
        })
    })

    await page.route("http://localhost:5001/get_work_info*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: 1,
                data: [
                    {
                        lbworkid: "lbtestreader",
                        title: "Dunungen",
                        shorttitle: "Dunungen",
                        titleid: "Dunungen",
                        work_titleid: "Dunungen",
                        titlepath: "Dunungen",
                        mediatype: "etext",
                        startpagename: "1",
                        endpagename: "2",
                        pagestep: 1,
                        pages: [
                            { pagename: "1", pageindex: 0, imagenumber: 1 },
                            { pagename: "2", pageindex: 1, imagenumber: 2 }
                        ],
                        parts: [
                            {
                                startpagename: "1",
                                endpagename: "2",
                                title: "Dunungen",
                                navtitle: "Dunungen",
                                shorttitle: "Dunungen",
                                authors: [{ authorid: "LagerlöfS" }]
                            }
                        ],
                        authors: [{ authorid: "LagerlöfS", full_name: "Selma Lagerlöf" }],
                        main_author: { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
                        work_authors: [{ authorid: "LagerlöfS", full_name: "Selma Lagerlöf" }],
                        export: [],
                        errata: "<table></table>",
                        sourcedesc: "",
                        mediatypes: ["etext"]
                    }
                ]
            })
        })
    })

    await page.route("http://localhost:5001/log_page/**", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "{}"
        })
    })

    await page.route("http://localhost:9000/txt/lbtestreader/res_*.html", async route => {
        const isSecondPage = route.request().url().includes("res_00001.html")
        await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: `<html><body><p>${isSecondPage ? "Page 2" : "Page 1"}</p></body></html>`
        })
    })
}

const mockEditorBackend = async page => {
    let workInfoRequests = 0

    await page.route("**/get_work_info*", async route => {
        workInfoRequests += 1
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: 1,
                data: [
                    {
                        lbworkid: "lbtesteditor",
                        title: "Editor Test",
                        shorttitle: "Editor Test",
                        titleid: "EditorTest",
                        work_titleid: "EditorTest",
                        titlepath: "EditorTest",
                        mediatype: "faksimil",
                        startpagename: "1",
                        endpagename: "3",
                        page_count: 3,
                        pagestep: 1,
                        faksimil_sizes: [3],
                        width: { size_3: 625 },
                        searchable: true,
                        pages: [
                            { pagename: "1", pageindex: 0, imagenumber: 1 },
                            { pagename: "2", pageindex: 1, imagenumber: 2 },
                            { pagename: "3", pageindex: 2, imagenumber: 3 }
                        ],
                        parts: [],
                        authors: [{ authorid: "LagerlöfS", full_name: "Selma Lagerlöf" }],
                        main_author: { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
                        work_authors: [{ authorid: "LagerlöfS", full_name: "Selma Lagerlöf" }],
                        export: [],
                        errata: "<table></table>",
                        sourcedesc: ""
                    }
                ]
            })
        })
    })

    await page.route("**/txt/lbtesteditor/ocr_*.html", async route => {
        await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: '<html><body><div data-size="625x900"></div></body></html>'
        })
    })

    return () => workInfoRequests
}

const makeStatsWork = (index, overrides = {}) => ({
    lbworkid: `lbpopular${index}`,
    titlepath: `PopularWork${index}`,
    title: `Popular Work ${index}`,
    shorttitle: `Popular Work ${index}`,
    titleid: `PopularWork${index}`,
    work_titleid: `PopularWork${index}`,
    mediatype: "etext",
    startpagename: "1",
    popularity: 1000 - index,
    authors: [
        {
            authorid: `Author${index}`,
            surname: `Author ${index}`,
            full_name: `Author ${index}`
        }
    ],
    main_author: {
        authorid: `Author${index}`,
        surname: `Author ${index}`,
        full_name: `Author ${index}`
    },
    work_authors: [
        {
            authorid: `Author${index}`,
            surname: `Author ${index}`,
            full_name: `Author ${index}`
        }
    ],
    export: [],
    ...overrides
})

const mockStatsBackend = async page => {
    let popularWorksRequestUrl

    await page.route("**/get_stats", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                works: 1,
                authors: 1,
                pages: { etext: 1, faksimil: 1 },
                words: { etext: 1, faksimil: 1 },
                epubs: 1
            })
        })
    })

    await page.route("**/query/etext*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: [], hits: 0 })
        })
    })

    await page.route("**/query_string/**", async route => {
        const requestUrl = new URL(route.request().url())
        popularWorksRequestUrl = requestUrl
        const requestedSize = Number(requestUrl.searchParams.get("to"))
        const data = Array.from({ length: Math.min(requestedSize, 30) }, (_, i) =>
            makeStatsWork(1, { mediatype: i % 2 ? "faksimil" : "etext" })
        )

        if (requestedSize > 30) {
            data.push(...Array.from({ length: 35 }, (_, i) => makeStatsWork(i + 2)))
        }

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: data.length,
                distinct_hits: data.length,
                data
            })
        })
    })

    return () => popularWorksRequestUrl
}

test.describe("Stats", () => {
    test("shows the same first 30 popular works as the library works ranking", async ({
        page
    }) => {
        const getPopularWorksRequestUrl = await mockStatsBackend(page)

        await page.goto("/om/statistik", { waitUntil: "networkidle" })
        await waitForAngular(page)

        const popularWorks = page
            .locator("h3", { hasText: "De mest lästa verken" })
            .locator("xpath=following-sibling::ul[1]/li")

        await expect(popularWorks).toHaveCount(30)
        await expect(popularWorks.nth(29)).toContainText("Popular Work 30")

        const requestUrl = getPopularWorksRequestUrl()
        expect(requestUrl.pathname).toContain("/query_string/etext,faksimil,pdf")
        expect(Number(requestUrl.searchParams.get("to"))).toBeGreaterThanOrEqual(100)
    })
})

test.describe("Library Authors", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/bibliotek?sort=popularitet&visa=authors", { waitUntil: "networkidle" })
        await waitForAngular(page)
    })

    test("should filter using the input", async ({ page }) => {
        const filter = page.locator('[ng-model="$ctrl.filter"]')
        await filter.fill("adelb")
        await page.keyboard.press("Tab")
        await expect(page.locator(".author_row")).toHaveCount(1)
    })
})

test.describe("Library Works", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/bibliotek?visa=works", { waitUntil: "networkidle" })
        await waitForAngular(page)
    })

    test("should filter works using the input", async ({ page }) => {
        const filter = page.locator('[ng-model="$ctrl.filter"]')
        await filter.fill("constru")
        await page.keyboard.press("Tab")
        await expect(page.locator(".work_link")).toHaveCount(1)
    })

    test("should link correctly to reading mode from popular", async ({ page }) => {
        const link = page.locator("tr.work_link.first li:first-of-type a")
        await expect(link).toHaveAttribute(
            "href",
            "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
        )
    })

    test("should link correctly to reading mode from filtered", async ({ page }) => {
        const filter = page.locator('[ng-model="$ctrl.filter"]')
        await filter.fill("aniara")
        await page.keyboard.press("Enter")
        const aniaraRow = page.locator("tr.work_link", { hasText: "Aniara" }).first()
        await expect(aniaraRow).toBeVisible()
        const link = aniaraRow.locator("li:first-of-type a").first()
        await expect(link).toHaveAttribute("href", "/författare/MartinsonH/titlar/Aniara/sida/5/etext")
    })

    test("should show more than 13800 hits for downloadable works sorted by popularity", async ({
        page
    }) => {
        await page.goto("/bibliotek?avancerat&sort=popularitet&nedladdning&visa=works", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const numHits = page.locator(".parts.num_hits")
        const hitsText = await numHits.textContent()
        const hitCount = parseInt(hitsText.replace(/[^\d]/g, ""), 10)
        expect(hitCount).toBeGreaterThan(13800)
    })
})

test.describe("Library Relevance", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/bibliotek", { waitUntil: "networkidle" })
        await waitForAngular(page)
    })

    test("should give more popular first", async ({ page }) => {
        const filter = page.locator('[ng-model="$ctrl.filter"]')
        await filter.fill("glas")
        const workResults = page.locator('.result.relevance tr[ng-repeat] a[href*="/titlar/"]')
        await expect(workResults.first()).toBeVisible()
        await expect(workResults.first()).toContainText(/glas/i)
    })

    test("should score surname hits above popularity", async ({ page }) => {
        const filter = page.locator('[ng-model="$ctrl.filter"]')
        await filter.fill("öman poetisk")
        const firstResult = page.locator(".result.relevance tr[ng-repeat] a").nth(0)
        await expect(firstResult).toHaveText("Poetisk läsebok för folkskolan")
    })
})

test.describe("Titles", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/bibliotek", { waitUntil: "networkidle" })
        await waitForAngular(page)
    })

    test("should filter titles using the input", async ({ page }) => {
        const filter = page.locator('[ng-model="$ctrl.filter"]')
        await filter.fill("psalm")
        await page.keyboard.press("Enter")
        const numHits = page.locator(".parts.num_hits")
        const hitsText = await numHits.textContent()
        const hitCount = parseInt(hitsText.replace(/[^\d]/g, ""), 10)
        expect(hitCount).toBeGreaterThan(800)
    })
})

test.describe("Reader", () => {
    test.beforeEach(async ({ page }) => {
        await waitForAngular(page)
    })

    test("should change page on click", async ({ page }) => {
        await page.goto("/författare/StrindbergA/titlar/Fadren/sida/3/etext", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const nextLink = page.locator(".pager_ctrls a[rel=next]")
        await expect(nextLink).toHaveAttribute(
            "href",
            "/författare/StrindbergA/titlar/Fadren/sida/4/etext"
        )
    })

    test("should correctly handle pagestep", async ({ page }) => {
        await page.goto("/författare/SilfverstolpeM/titlar/MånneDetGårAn/sida/-7/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        // Wait for the page to actually load the content (not show error message)
        await page.waitForSelector("img.faksimil", { timeout: 10000 })
        const nextLink = page.locator(".pager_ctrls a[rel=next]")
        await expect(nextLink).toHaveAttribute(
            "href",
            "/författare/SilfverstolpeM/titlar/MånneDetGårAn/sida/-5/faksimil"
        )
    })

    test("should load workinfo from the correct mediatype", async ({ page }) => {
        await page.goto("/författare/LagerlöfS/titlar/Dunungen/sida/1/etext", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const nextLink = page.locator(".pager_ctrls a[rel=next]")
        await expect(nextLink).toHaveAttribute(
            "href",
            "/författare/LagerlöfS/titlar/Dunungen/sida/2/etext"
        )
    })

    test("should keep search within work collapsed until opened", async ({ page }) => {
        await page.goto("/författare/SöderbergH/titlar/DoktorGlas/sida/3/etext", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)

        const searchPanel = page.locator(".searchbox .collapse-content")
        await expect(searchPanel).toBeHidden()

        await page.locator('.subnav a[ng-click="$ctrl.openSearchWorks()"]').click()
        await expect(searchPanel).toBeVisible()
    })

    test("should keep Bootstrap-compatible button spacing", async ({ page }) => {
        await page.goto("/författare/SöderbergH/titlar/DoktorGlas/sida/3/etext", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)

        await page.locator('.subnav a[ng-click="$ctrl.openSearchWorks()"]').click()

        const searchButton = page.locator(".searchbox button.submit.btn")
        await expect(searchButton).toBeVisible()
        const padding = await searchButton.evaluate(button => {
            const style = getComputedStyle(button)
            return {
                left: parseFloat(style.paddingLeft),
                right: parseFloat(style.paddingRight)
            }
        })

        expect(padding.left).toBeGreaterThanOrEqual(10)
        expect(padding.right).toBeGreaterThanOrEqual(10)
    })

    test("should keep Bootstrap-compatible sidebar size picker button spacing", async ({
        page
    }) => {
        await page.goto("/författare/ReenstiernaMH/titlar/Årstadagboken1/sida/5/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)

        const sizeButton = page.locator("#leftCorridor .size_picker button").first()
        await expect(sizeButton).toBeVisible()
        const padding = await sizeButton.evaluate(button => {
            const style = getComputedStyle(button)
            return {
                top: parseFloat(style.paddingTop),
                left: parseFloat(style.paddingLeft),
                right: parseFloat(style.paddingRight)
            }
        })

        expect(padding.top).toBeGreaterThanOrEqual(5)
        expect(padding.left).toBeGreaterThanOrEqual(10)
        expect(padding.right).toBeGreaterThanOrEqual(10)
    })

    test("should keep Bootstrap-compatible about modal chrome", async ({ page }) => {
        const sourceInfoErrors = []
        page.on("console", msg => {
            if (
                msg.type() === "error" &&
                msg.text().includes("Cannot read properties of undefined")
            ) {
                sourceInfoErrors.push(msg.text())
            }
        })

        await page.goto("/författare/ReenstiernaMH/titlar/Årstadagboken1/sida/5/faksimil?om-boken", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)

        const dialog = page.locator(".about .modal-dialog")
        const content = page.locator(".about .modal-content")
        await expect(dialog).toBeVisible()

        const modalChrome = await dialog.evaluate(dialogElement => {
            const contentElement = dialogElement.querySelector(".modal-content")
            const contentStyle = getComputedStyle(contentElement)
            const rect = dialogElement.getBoundingClientRect()

            return {
                width: rect.width,
                shadow: contentStyle.boxShadow
            }
        })

        await expect(content).toBeVisible()
        expect(modalChrome.width).toBeGreaterThanOrEqual(590)
        expect(modalChrome.width).toBeLessThanOrEqual(610)
        expect(modalChrome.shadow).not.toBe("none")
        expect(sourceInfoErrors).toEqual([])
    })

    test("should normalize short reader URL and allow forward navigation", async ({ page }) => {
        await mockReaderBackend(page)
        await page.goto("/författare/LagerlöfS/titlar/Dunungen/etext", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)

        await expect(page).toHaveURL("/författare/LagerlöfS/titlar/Dunungen/sida/1/etext")

        const nextLink = page.locator(".pager_ctrls a[rel=next]")
        await expect(nextLink).toHaveAttribute(
            "href",
            "/författare/LagerlöfS/titlar/Dunungen/sida/2/etext"
        )

        await nextLink.evaluate(node => node.click())
        await expect(page).toHaveURL("/författare/LagerlöfS/titlar/Dunungen/sida/2/etext")
    })

    test("should show SO modal", async ({ page }) => {
        await page.goto("/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext?so=damm", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const grundform = page.locator(".modal-dialog lemma[id=lnr132506] grundform")
        await expect(grundform).toHaveText("damm")
    })

    test("should show srcset correctly", async ({ page }) => {
        await page.goto("/författare/BureusJ/titlar/SmaragdinaTabvla/sida/1/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const img = page.locator("img.faksimil")
        await expect(img).toHaveAttribute(
            "srcset",
            "/txt/lb2514233/lb2514233_3/lb2514233_3_0001.jpeg 1x,/txt/lb2514233/lb2514233_5/lb2514233_5_0001.jpeg 2x"
        )
    })

    // test("should not show srcset", async ({ page }) => {
    //     await page.goto("/författare/BellmanCM/titlar/FredmansEpistlesSongs/sida/V/faksimil", {
    //         waitUntil: "networkidle"
    //     })
    //     await waitForAngular(page)
    //     const img = page.locator("img.faksimil")
    //     await expect(img).toHaveAttribute("srcset", null)
    // })
})

test.describe("Editor", () => {
    test.beforeEach(async ({ page }) => {
        await waitForAngular(page)
    })

    test("should change page on click", async ({ page }) => {
        await page.goto("/editor/lb238704/ix/3/f", { waitUntil: "networkidle" })
        await waitForAngular(page)
        await page.evaluate(() => {
            const overlay = document.getElementById("webpack-dev-server-client-overlay")
            if (overlay) overlay.remove()
        })
        await page.click(".pager_ctrls a[rel=next]", { force: true })
        const img = page.locator("img.faksimil")
        await expect(img).toHaveAttribute("src", "/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg")
    })

    test("should not refetch source info in a loop", async ({ page }) => {
        const getWorkInfoRequests = await mockEditorBackend(page)

        await page.goto("/editor/lbtesteditor/ix/1/f", { waitUntil: "domcontentloaded" })
        await waitForAngular(page, 1500)
        await page.waitForTimeout(1000)

        expect(getWorkInfoRequests()).toBe(1)
    })
})

test.describe("Search Links", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/sök?forfattare=MartinsonH&titlar=lb441882&avancerad", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
    })

    test("should preselect author and title", async ({ page }) => {
        const selectedTitles = await page.evaluate(() => {
            const el = window.angular.element(document.querySelector("search-page"))
            const scope = el.isolateScope() || el.scope()
            const ctrl = scope.$ctrl || scope
            return ctrl.selectedTitles
        })
        const filters = await page.evaluate(() => {
            const el = window.angular.element(document.querySelector("search-page"))
            const scope = el.isolateScope() || el.scope()
            const ctrl = scope.$ctrl || scope
            return ctrl.filters
        })

        expect(selectedTitles.length).toBe(1)
        expect(selectedTitles[0]).toBe("lb441882")
        expect(filters["authors>authorid"][0]).toBe("MartinsonH")
    })
})

test.describe("Search", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/sök", { waitUntil: "domcontentloaded" })
        await waitForAngular(page)
        await expect(page.locator('[ng-model="$ctrl.query"]')).toBeVisible()
    })

    test("should keep Bootstrap-compatible autocomplete dropdown items", async ({ page }) => {
        await page.route("**/autocomplete/*", async route => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    data: [],
                    suggest: [{ text: "Doktor Glas", score: 1 }]
                })
            })
        })

        await page.getByTitle("Snabbkommando: 's'").click()
        const autocompleteInput = page.locator("#autocomplete")
        await expect(autocompleteInput).toBeVisible()
        await autocompleteInput.fill("dok")

        const autocompleteItems = page.locator(".autocomplete .dropdown-menu > li > a")
        await expect
            .poll(async () => autocompleteItems.count(), { timeout: 5000 })
            .toBeGreaterThan(0)
        const autocompleteItem = autocompleteItems.first()
        await expect(autocompleteItem).toBeVisible()
        const itemStyle = await autocompleteItem.evaluate(item => {
            const style = getComputedStyle(item)
            return {
                display: style.display,
                left: parseFloat(style.paddingLeft),
                right: parseFloat(style.paddingRight),
                whiteSpace: style.whiteSpace
            }
        })

        expect(itemStyle.display).toBe("block")
        expect(itemStyle.left).toBeGreaterThanOrEqual(20)
        expect(itemStyle.right).toBeGreaterThanOrEqual(20)
        expect(itemStyle.whiteSpace).toBe("nowrap")
    })

    test("should give search results", async ({ page }) => {
        const input = page.locator('[ng-model="$ctrl.query"]')
        await input.fill("kriget är förklarat!")
        await page.keyboard.press("Enter")
        await expect
            .poll(async () => page.locator(".sentence").count(), { timeout: 10000 })
            .toBeGreaterThan(0)
    })
})

test.describe("Parts Navigation", () => {
    test.beforeEach(async ({ page }) => {
        await waitForAngular(page)
    })

    test("should handle parts with parent parts", async ({ page }) => {
        await page.goto("/författare/RydbergV/titlar/Singoalla1885/sida/25/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const prevPart = page.locator(".pager_ctrls a.prev_part")
        await expect(prevPart).toHaveAttribute(
            "href",
            "/författare/RydbergV/titlar/Singoalla1885/sida/20/faksimil"
        )
    })

    test("should handle many parts on same page, prev", async ({ page }) => {
        await page.goto("/författare/Anonym/titlar/ABC1746/sida/X/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const prevPart = page.locator(".pager_ctrls a.prev_part")
        await expect(prevPart).toHaveAttribute(
            "href",
            "/författare/Anonym/titlar/ABC1746/sida/IX/faksimil"
        )
    })

    test("should handle many parts on same page, next", async ({ page }) => {
        await page.goto("/författare/Anonym/titlar/ABC1746/sida/IX/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const nextPart = page.locator(".pager_ctrls a.next_part")
        await expect(nextPart).toHaveAttribute(
            "href",
            "/författare/Anonym/titlar/ABC1746/sida/X/faksimil"
        )
    })

    test("should give a prev part despite prev page being between parts", async ({ page }) => {
        await page.goto("/författare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const prevPart = page.locator(".pager_ctrls a.prev_part")
        await expect(prevPart).toHaveAttribute(
            "href",
            "/författare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil"
        )
    })

    test("should find a single page part on the prev page", async ({ page }) => {
        await page.goto(
            "/författare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXIII/faksimil",
            { waitUntil: "networkidle" }
        )
        await waitForAngular(page)
        const prevPart = page.locator(".pager_ctrls a.prev_part")
        await expect(prevPart).toHaveAttribute(
            "href",
            "/författare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXII/faksimil"
        )
    })

    test("should show current part name instead of ended part", async ({ page }) => {
        await page.goto("/författare/Euripides/titlar/Elektra1843/sida/9/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const currentPart = page.locator(".current_part .navtitle")
        await expect(currentPart).toHaveText("[Pjäsen]")
    })

    test("should go to beginning of current part rather than previous part", async ({ page }) => {
        await page.goto(
            "/författare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/325/faksimil",
            { waitUntil: "networkidle" }
        )
        await waitForAngular(page)
        const prevPart = page.locator(".pager_ctrls a.prev_part")
        await expect(prevPart).toHaveAttribute(
            "href",
            "/författare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/311/faksimil"
        )
    })

    test("should disable prev if before first part", async ({ page }) => {
        await page.goto("/författare/OmarKhayyam/titlar/UmrKhaiyamRubaIyat/sida/1/faksimil", {
            waitUntil: "networkidle"
        })
        await waitForAngular(page)
        const prevPart = page.locator(".pager_ctrls a.prev_part")
        await expect(prevPart).toHaveClass(/disabled/)
    })
})
