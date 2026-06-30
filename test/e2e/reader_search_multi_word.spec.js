const { test, expect } = require("@playwright/test")

const waitForAngular = async page => {
    await page.evaluate(() => {
        return new Promise(resolve => {
            const startTime = Date.now()
            const check = () => {
                if (Date.now() - startTime > 3000) {
                    resolve()
                    return
                }

                if (!window.angular) {
                    setTimeout(check, 100)
                    return
                }

                const element = document.querySelector("[ng-app], [data-ng-app]") || document.body
                const injector = window.angular.element(element).injector()
                if (injector) {
                    resolve()
                } else {
                    setTimeout(check, 100)
                }
            }

            check()
        })
    })
}

test("setMarkee should mark a multi-word hit range", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" })
    await waitForAngular(page)

    const result = await page.evaluate(() => {
        const element = document.querySelector("[ng-app], [data-ng-app]") || document.body
        const injector = window.angular.element(element).injector()
        const setMarkee = injector.get("$filter")("setMarkee")

        return setMarkee(
            '<p><span id="w1_1">Albert</span><span id="w1_2">Bonniers</span></p>',
            "w1_1",
            "w1_2"
        )
    })

    expect(result).toContain('id="w1_1" class="markee"')
    expect(result).toContain('id="w1_2" class="markee flip"')
})

test("setMarkee should mark all words in a nested facsimile hit range", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" })
    await waitForAngular(page)

    const classes = await page.evaluate(() => {
        const element = document.querySelector("[ng-app], [data-ng-app]") || document.body
        const injector = window.angular.element(element).injector()
        const setMarkee = injector.get("$filter")("setMarkee")
        const result = setMarkee(
            [
                '<div class="overlay">',
                '<span class="w"><span id="w1_1">hade&nbsp;</span></span>',
                '<span class="w"><span id="w1_2">han&nbsp;</span></span>',
                '<span class="w"><span id="w1_3">icke&nbsp;</span></span>',
                "</div>"
            ].join(""),
            "w1_1",
            "w1_3"
        )
        const parsed = new DOMParser().parseFromString(result, "text/html")

        return ["w1_1", "w1_2", "w1_3"].map(id => ({
            id,
            className: parsed.getElementById(id).className
        }))
    })

    expect(classes).toEqual([
        { id: "w1_1", className: "markee" },
        { id: "w1_2", className: "markee flip" },
        { id: "w1_3", className: "markee" }
    ])
})
