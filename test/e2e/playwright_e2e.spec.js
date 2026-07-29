const { test, expect } = require("@playwright/test")

const browserErrors = new WeakMap()

async function waitForNuxt(page) {
    await page.locator("#__nuxt").waitFor({ state: "attached" })
    await page.waitForFunction(
        () => Boolean(document.querySelector("#__nuxt")?.__vue_app__)
    )
}

async function openNuxtRoute(page, route) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" })

    expect(response?.status(), `${route} must return HTTP 200`).toBe(200)
    await waitForNuxt(page)
    return response
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
        await openNuxtRoute(page, "/sök?fras=kyrka")

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
    })

    test("hydrates advanced text search with its route query", async ({ page }) => {
        await openNuxtRoute(page, "/sök?fras=kyrka&avancerad=1")

        const search = page.locator('[data-search-root][data-search-mounted="true"]')
        await expect(search).toBeVisible()
        await expect(search).toHaveClass(/advanced/)
        await expect(page.getByLabel("Sökfras")).toHaveValue("kyrka")
        await expect(page.locator("#text-search-advanced-panel")).toBeVisible()
        await expect(page.locator("[data-search-advanced]")).toHaveAttribute(
            "title",
            "Enkel sökning"
        )
    })

    test("loads and hydrates Hjalmar Söderberg's author route", async ({ page }) => {
        await openNuxtRoute(page, "/författare/SöderbergH")

        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "Hjalmar Söderberg"
        )
        await expect(page.getByRole("navigation", { name: "Författarsidor" }))
            .toBeVisible()
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
            }
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
})
