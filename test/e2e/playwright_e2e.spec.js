const { test, expect } = require("@playwright/test")
const {
    mapWithConcurrency,
    sampleReadableWorks,
    sourceInfoSearchMatrix
} = require("./nuxt_live_source_info_corpus.cjs")

const browserErrors = new WeakMap()
const expectedGitSha = process.env.LITTB_EXPECTED_GIT_SHA
const expectedImageDigest = process.env.LITTB_EXPECTED_IMAGE_DIGEST
const expectedDeploymentIdentity = expectedGitSha && expectedImageDigest
    ? {
        schema_version: "lb.frontend.deployment.v1",
        environment: "stage",
        git_sha: expectedGitSha,
        image_digest: expectedImageDigest
    }
    : null

async function waitForNuxt(page) {
    await page.locator("#__nuxt").waitFor({ state: "attached" })
    await page.waitForFunction(
        () => document.querySelector("#__nuxt")
            ?.__vue_app__
            ?.config
            ?.globalProperties
            ?.$nuxt
            ?.isHydrating === false
    )
}

async function openNuxtRoute(page, route) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" })

    expect(response?.status(), `${route} must return HTTP 200`).toBe(200)
    await waitForNuxt(page)
    return response
}

function waitForSameOriginPost(page, pathname) {
    return page.waitForResponse(response => {
        const url = new URL(response.url())
        return url.pathname === pathname && response.request().method() === "POST"
    })
}

async function successfulJsonResponse(page, responsePromise, pathname) {
    const response = await responsePromise
    const responseUrl = new URL(response.url())

    expect(responseUrl.origin, `${pathname} must stay on the Nuxt origin`).toBe(
        new URL(page.url()).origin
    )
    expect(response.status(), `${pathname} must return HTTP 200`).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/json")
    return response.json()
}

function expectDefiningTextSearchResults(body) {
    expect(body).toMatchObject({ query: "kyrka", page: 1, page_size: 30 })
    expect(body.total_work_hits).toBeGreaterThan(0)
    expect(body.works.length).toBeGreaterThan(0)
    expect(body.works.some(work => work.highlights.some(highlight =>
        highlight.match.some(word => word.word.toLocaleLowerCase("sv") === "kyrka")
    ))).toBe(true)
}

test.describe("Nuxt whole-site staging smoke", () => {
    test.beforeEach(async ({ page }) => {
        const errors = []
        browserErrors.set(page, errors)
        page.on("console", message => {
            if (message.type() === "error") errors.push(`console: ${message.text()}`)
        })
        page.on("pageerror", error => errors.push(`pageerror: ${error.message}`))
    })

    test.afterEach(async ({ page }, testInfo) => {
        await page.waitForTimeout(100)
        const errors = browserErrors.get(page) || []
        if (errors.length) {
            await testInfo.attach("browser-errors", {
                body: Buffer.from(errors.join("\n")),
                contentType: "text/plain"
            })
        }
        expect(errors, "the hydrated page must not emit console or page errors").toEqual([])
    })

    test("loads and hydrates the home page", async ({ page }) => {
        await openNuxtRoute(page, "/")

        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Litteraturbanken"
        )
        await expect(page.locator(".home-editorial")).toBeVisible()
    })

    test("loads the advanced Library route and exercises its controls", async ({
        page
    }) => {
        await openNuxtRoute(
            page,
            "/bibliotek?avancerat=1&visa=works&sort=popularitet"
        )

        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "Botanisera i biblioteket"
        )
        await expect(page.locator('[data-library-mounted="true"]')).toBeVisible()
        await expect(page.locator("[data-library-filter]")).toBeVisible()
        await expect(page.locator('[data-library-tab="works"]')).toHaveAttribute(
            "aria-current",
            "page"
        )
        await expect(page.locator('[data-library-sort="popularitet"]')).toHaveClass(
            /active/
        )
        const libraryResponse = waitForSameOriginPost(page, "/api/v2/library/search")
        await page.locator("[data-library-filter]").fill("Doktor Glas")
        const libraryBody = await successfulJsonResponse(
            page,
            libraryResponse,
            "/api/v2/library/search"
        )
        expect(libraryBody.mode).toBe("works")
        expect(libraryBody.total_works).toBeGreaterThan(0)
        expect(libraryBody.items.length).toBeGreaterThan(0)
        expect(libraryBody.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                route_author_id: "SöderbergH",
                route_title_id: "DoktorGlas"
            })
        ]))
        await expect(page.locator("[data-library-error]")).toHaveCount(0)
        await expect(page.locator("[data-library-work-row]").first()).toBeVisible()
        await expect(page.getByRole("button", { name: "Doktor Glas", exact: true }))
            .toBeVisible()
        const advanced = page.locator("[data-library-advanced]")
        await expect(advanced).toHaveAttribute("aria-expanded", "true")
        await expect(page.locator("[data-library-advanced-panel]")).toBeVisible()
        await advanced.click()
        await expect(advanced).toHaveAttribute("aria-expanded", "false")
        await expect(page.locator("[data-library-advanced-panel]")).toHaveCount(0)
        await advanced.click()
        await expect(page.locator("[data-library-advanced-panel]")).toBeVisible()
    })

    test("hydrates simple text search with its route query", async ({ page }) => {
        const searchResponse = waitForSameOriginPost(
            page,
            "/api/v2/text-search/results"
        )
        await openNuxtRoute(page, "/sök?fras=kyrka")

        const searchBody = await successfulJsonResponse(
            page,
            searchResponse,
            "/api/v2/text-search/results"
        )
        expectDefiningTextSearchResults(searchBody)

        const search = page.locator('[data-search-root][data-search-mounted="true"]')
        await expect(search).toBeVisible()
        await expect(search).toHaveClass(/simple/)
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Sök i texterna"
        )
        await expect(page.getByLabel("Sökfras")).toHaveValue("kyrka")
        await expect(page.locator("[data-search-advanced]")).toHaveAttribute(
            "title",
            "Utökad sökning"
        )
        await expect(page.locator("[data-search-error]")).toHaveCount(0)
        await expect(page.locator("#results table.results tbody tr").first()).toBeVisible()
        await expect(page.locator("#results td.match").first()).toContainText(/kyrka/i)
    })

    test("hydrates advanced text search with its route query", async ({ page }) => {
        const searchResponse = waitForSameOriginPost(
            page,
            "/api/v2/text-search/results"
        )
        await openNuxtRoute(page, "/sök?fras=kyrka&avancerad=1")

        const searchBody = await successfulJsonResponse(
            page,
            searchResponse,
            "/api/v2/text-search/results"
        )
        expectDefiningTextSearchResults(searchBody)

        const search = page.locator('[data-search-root][data-search-mounted="true"]')
        await expect(search).toBeVisible()
        await expect(search).toHaveClass(/advanced/)
        await expect(page.getByLabel("Sökfras")).toHaveValue("kyrka")
        await expect(page.locator("#text-search-advanced-panel")).toBeVisible()
        await expect(page.locator("[data-search-advanced]")).toHaveAttribute(
            "title",
            "Enkel sökning"
        )
        await expect(page.locator("[data-search-error]")).toHaveCount(0)
        await expect(page.locator("#results table.results tbody tr").first()).toBeVisible()
        await expect(page.locator("#results td.match").first()).toContainText(/kyrka/i)
    })

    test("loads and hydrates Hjalmar Söderberg's author route", async ({ page }) => {
        await openNuxtRoute(page, "/författare/SöderbergH")

        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "Hjalmar Söderberg"
        )
        await expect(page.getByRole("navigation", { name: "Författarsidor" }))
            .toBeVisible()
    })

    test("loads Strindberg's production author works payload", async ({ page }) => {
        await openNuxtRoute(page, "/författare/StrindbergA/titlar")

        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "August Strindberg"
        )
        await expect(page.getByRole("heading", {
            name: "Tillgängliga verk",
            exact: true
        })).toBeVisible()
        await expect(page.locator(
            'a[href="/f%C3%B6rfattare/StrindbergA/titlar/'
                + 'AbuCasemsTofflor/sida/7/etext?om-boken"]'
        )).toContainText("Abu Casems tofflor")
    })

    test("loads etext Reader content and navigates to the next page", async ({ page }) => {
        await openNuxtRoute(
            page,
            "/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext"
        )

        const reader = page.locator(".reader_main")
        await expect(reader).toHaveAttribute("aria-label", /Doktor Glas, sida 1/)
        await expect(reader.locator(".etext")).toBeVisible()
        const nextPage = page.getByRole("link", { name: "Nästa sida" })
        await expect(nextPage).toBeVisible()
        await nextPage.click()
        await expect(page).toHaveURL(
            /\/f%C3%B6rfattare\/S%C3%B6derbergH\/titlar\/DoktorGlas\/sida\/2\/etext$/
        )
        await expect(reader).toHaveAttribute("aria-label", /Doktor Glas, sida 2/)
    })

    test("opens source information when one person has multiple contributor roles", async ({
        page
    }) => {
        await openNuxtRoute(
            page,
            "/författare/BergstrandPoulsenE/titlar/Kronan/sida/VIII/etext?om-boken"
        )

        const dialog = page.getByRole("dialog", { name: "Om boken" })
        await expect(dialog).toBeVisible()
        await expect(dialog.locator(".error")).toHaveCount(0)
        await expect(dialog.locator(".author a")).toHaveText([
            "Elisabeth Bergstrand-Poulsen",
            "Elisabeth Bergstrand-Poulsen ill."
        ])
    })

    test("validates a bounded diverse corpus of real source information", async ({
        request
    }) => {
        test.setTimeout(120000)
        const searches = await mapWithConcurrency(
            sourceInfoSearchMatrix(),
            4,
            async payload => {
                const response = await request.post("/api/v2/library/search", {
                    data: payload
                })
                const text = await response.text()
                if (response.status() !== 200) {
                    return {
                        payload,
                        failure: `HTTP ${response.status()}: ${text.slice(0, 300)}`
                    }
                }
                try {
                    return { payload, body: JSON.parse(text) }
                } catch {
                    return { payload, failure: `invalid JSON: ${text.slice(0, 300)}` }
                }
            }
        )
        const searchFailures = searches.filter(result => result.failure)
        expect(
            searchFailures,
            `library discovery failed:\n${JSON.stringify(searchFailures, null, 2)}`
        ).toEqual([])

        const works = sampleReadableWorks(searches.map(result => result.body), 96)
        expect(works.length, "the corpus sweep must discover at least 30 readable works")
            .toBeGreaterThanOrEqual(30)

        const audits = await mapWithConcurrency(works, 8, async work => {
            const path = [
                "/nuxt-api/reader/source-info",
                encodeURIComponent(work.route_author_id),
                encodeURIComponent(work.route_title_id)
            ].join("/") + `?media_type=${encodeURIComponent(work.route_media_type)}`
            const response = await request.get(path)
            const text = await response.text()
            if (response.status() !== 200) {
                return { path, failure: `HTTP ${response.status()}: ${text.slice(0, 300)}` }
            }
            try {
                const body = JSON.parse(text)
                if (
                    typeof body.workId !== "string"
                    || body.workId.length === 0
                    || body.mediaType !== work.route_media_type
                    || !Array.isArray(body.authors)
                ) {
                    return { path, failure: `invalid source-info body: ${text.slice(0, 300)}` }
                }
            } catch {
                return { path, failure: `invalid JSON: ${text.slice(0, 300)}` }
            }
            return { path, failure: null }
        })
        const failures = audits.filter(result => result.failure)
        expect(
            failures,
            `source-information corpus failures:\n${JSON.stringify(failures, null, 2)}`
        ).toEqual([])
    })

    test("loads facsimile Reader content and exposes its OCR layer", async ({ page }) => {
        const route = "/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil"
        await openNuxtRoute(page, route)

        const reader = page.locator(".reader_main.type-faksimil")
        await expect(reader).toHaveAttribute(
            "aria-label",
            /Ett verkligt jordiskt liv\. Brev, sida 3/
        )
        await expect(reader.locator("img.faksimil")).toBeVisible()
        await openNuxtRoute(page, `${route}?ocr`)
        await expect(page.locator(".reader_main.ocr .reader-ocr-layer .overlay"))
            .toBeVisible()
    })

    test("opens a typed dictionary article through the same-origin API", async ({
        page
    }) => {
        await openNuxtRoute(
            page,
            "/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext"
        )

        await page.locator(".etext .w", { hasText: "damm" }).first().evaluate(word => {
            const range = document.createRange()
            range.selectNodeContents(word)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
            word.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
        })
        const lookup = page.getByRole("button", {
            name: "Slå upp damm i Svensk ordbok"
        })
        await expect(lookup).toBeVisible()
        const dictionaryResponse = page.waitForResponse(result =>
            result.url().includes("/api/v2/dictionary/articles")
        )
        await lookup.click()

        expect((await dictionaryResponse).status()).toBe(200)
        await expect(page.getByRole("dialog")).toContainText(
            "Svensk ordbok utgiven av"
        )
    })

    test("loads lb12106 Editor etext and navigates to the next page", async ({
        page
    }) => {
        await openNuxtRoute(page, "/editor/lb12106/ix/0/e")

        const reader = page.locator(".editor-reader .reader_main")
        await expect(reader).not.toHaveClass(/type-faksimil/)
        await expect(reader.locator(".etext")).toBeVisible()
        await expect(
            page.locator(".editor-reader-context .editor-metadata-controls > .title")
        ).toContainText("Kejsarn av Portugallien")
        await page.getByRole("link", { name: "Nästa sida" }).click()
        await expect(page).toHaveURL(/\/editor\/lb12106\/ix\/1\/e$/)
        await expect(reader.locator(".etext")).toBeVisible()
    })

    test("reports the unavailable lb12106 Editor facsimile manifest honestly", async ({
        request
    }) => {
        const response = await request.get(
            "/api/v2/works/lb12106/editor-manifest?media_type=faksimil"
        )

        expect(response.status()).toBe(404)
        expect(await response.json()).toEqual({
            error: {
                code: "editor_manifest_not_found",
                message: "Editor manifest not found",
                details: null
            },
            request_id: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
            )
        })
    })

    test("retains Editor next-page interaction coverage", async ({ page }) => {
        await openNuxtRoute(page, "/editor/lb238704/ix/3/f")

        const nextPage = page.getByRole("link", { name: "Nästa sida" })
        await expect(nextPage).toBeVisible()
        await nextPage.click()

        await expect(page).toHaveURL(/\/editor\/lb238704\/ix\/4\/f$/)
        await expect(page.locator(".editor-reader img.faksimil")).toHaveAttribute(
            "src",
            "/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg"
        )
    })

    test("loads and hydrates the presentations landing page", async ({ page }) => {
        await openNuxtRoute(page, "/presentationer")

        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Presentationer och introduktioner"
        )
        await expect(page.locator(".doc.main")).toContainText(
            "Litteraturbankens digitala utställningar"
        )
    })

    test("loads and hydrates the Dramawebben landing page", async ({ page }) => {
        await openNuxtRoute(page, "/dramawebben")

        await expect(page.getByRole("img", { name: "Dramawebben", exact: true }))
            .toBeVisible()
        await expect(page.getByRole("heading", { level: 2 })).toContainText(
            "Fri svensk dramatik"
        )
        await expect(page.getByRole("link", { name: "Pjäser", exact: true }))
            .toBeVisible()
    })

    test("retains About content during client-side tab navigation", async ({ page }) => {
        await openNuxtRoute(page, "/om/ide")

        await expect(page.getByRole("heading", {
            name: "Introduktion",
            exact: true
        })).toBeVisible()
        await page.getByRole("link", { name: "Organisation", exact: true }).click()

        await expect(page).toHaveURL(/\/om\/organisation$/)
        await expect(page.getByRole("heading", {
            name: "Organisation",
            exact: true
        })).toBeVisible()
    })

    test("restores Reader route and state after NuxtLink history navigation", async ({
        page
    }) => {
        const readerRoute = "/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext"
        await openNuxtRoute(page, readerRoute)
        const reader = page.locator(".reader_main")
        const initialState = await reader.getAttribute("aria-label")

        await page.locator(".reader-context .author").getByRole("link", {
            name: "Hjalmar Söderberg"
        }).click()
        await expect(page).toHaveURL(/\/f%C3%B6rfattare\/S%C3%B6derbergH$/)
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "Hjalmar Söderberg"
        )

        await page.goBack({ waitUntil: "domcontentloaded" })
        await expect(page).toHaveURL(readerRoute)
        await waitForNuxt(page)
        await expect(reader).toHaveAttribute("aria-label", initialState)
        await expect(reader.locator(".etext")).toBeVisible()
    })

    test("retains the expected deployment identity after hydrated journeys", async ({
        page,
        request
    }) => {
        test.skip(!expectedDeploymentIdentity, "expected deployment identity is not configured")

        await openNuxtRoute(page, "/")
        await openNuxtRoute(page, "/om/ide")

        const response = await request.get("/_deployment")
        expect(response.status()).toBe(200)
        expect(await response.json()).toEqual(expectedDeploymentIdentity)
    })
})
