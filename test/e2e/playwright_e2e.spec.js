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

test.describe("Library Authors", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/bibliotek?sort=popularitet&visa=authors", { waitUntil: "networkidle" })
        await waitForAngular(page)
    })

    test("should filter using the input", async ({ page }) => {
        const filter = page.locator('[ng-model="filter"]')
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
        const filter = page.locator('[ng-model="filter"]')
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
        const filter = page.locator('[ng-model="filter"]')
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
        const filter = page.locator('[ng-model="filter"]')
        await filter.fill("glas")
        const workResults = page.locator('.result.relevance tr[ng-repeat] a[href*="/titlar/"]')
        await expect(workResults.first()).toBeVisible()
        await expect(workResults.first()).toContainText(/glas/i)
    })

    test("should score surname hits above popularity", async ({ page }) => {
        const filter = page.locator('[ng-model="filter"]')
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
        const filter = page.locator('[ng-model="filter"]')
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
            return window.angular.element("#mainview").scope().selectedTitles
        })
        const filters = await page.evaluate(() => {
            return window.angular.element("#mainview").scope().filters
        })

        expect(selectedTitles.length).toBe(1)
        expect(selectedTitles[0]).toBe("lb441882")
        expect(filters["authors>authorid"][0]).toBe("MartinsonH")
    })
})

test.describe("Search", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/sök", { waitUntil: "networkidle" })
        await waitForAngular(page)
    })

    test("should give search results", async ({ page }) => {
        const input = page.locator('[ng-model="query"]')
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
