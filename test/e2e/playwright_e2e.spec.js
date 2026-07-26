const { test, expect } = require("@playwright/test")

async function waitForNuxt(page) {
    await page.locator("#__nuxt").waitFor({ state: "attached" })
    await page.waitForFunction(
        () => Boolean(document.querySelector("#__nuxt")?.__vue_app__)
    )
}

test.describe("Nuxt live smoke", () => {
    test("loads the Nuxt library shell", async ({ page }) => {
        const response = await page.goto("/bibliotek?visa=works", {
            waitUntil: "domcontentloaded"
        })

        expect(response?.status()).toBe(200)
        await waitForNuxt(page)
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "Botanisera i biblioteket"
        )
        await expect(page.locator('[data-library-mounted="true"]')).toBeVisible()
        await expect(page.locator("[data-library-filter]")).toBeVisible()
    })

    test("navigates one Reader page", async ({ page }) => {
        const response = await page.goto(
            "/författare/StrindbergA/titlar/Fadren/sida/3/etext",
            { waitUntil: "domcontentloaded" }
        )

        expect(response?.status()).toBe(200)
        await waitForNuxt(page)
        await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
            "href",
            encodeURI("/författare/StrindbergA/titlar/Fadren/sida/4/etext")
        )
    })

    test("opens a typed dictionary article", async ({ page }) => {
        const response = await page.goto(
            "/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext",
            { waitUntil: "domcontentloaded" }
        )

        expect(response?.status()).toBe(200)
        await waitForNuxt(page)
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

    test("navigates one Editor page", async ({ page }) => {
        const response = await page.goto("/editor/lb238704/ix/3/f", {
            waitUntil: "domcontentloaded"
        })

        expect(response?.status()).toBe(200)
        await waitForNuxt(page)
        const nextPage = page.getByRole("link", { name: "Nästa sida" })
        await expect(nextPage).toBeVisible()
        await nextPage.click()

        await expect(page).toHaveURL(/\/editor\/lb238704\/ix\/4\/f$/)
        await expect(page.locator(".editor-reader img.faksimil")).toHaveAttribute(
            "src",
            "/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg"
        )
    })

    test("hydrates the text-search route", async ({ page }) => {
        const response = await page.goto("/sök", { waitUntil: "domcontentloaded" })

        expect(response?.status()).toBe(200)
        await waitForNuxt(page)
        await expect(
            page.locator('[data-search-root][data-search-mounted="true"]')
        ).toBeVisible()
        await expect(page.getByLabel("Sökfras")).toBeVisible()
        await expect(page.getByRole("button", { name: "Utökad sökning" })).toBeVisible()
    })
})
