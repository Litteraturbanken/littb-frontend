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

const mockReaderWithZeroHitSearch = async page => {
    await page.route("**/api/get_authors*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                data: [
                    {
                        authorid: "AuthorA",
                        full_name: "Author A",
                        surname: "Author",
                        searchable: true
                    }
                ]
            })
        })
    })

    await page.route("**/api/get_work_info*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: 1,
                data: [
                    {
                        lbworkid: "lbemptyreader",
                        title: "Empty Search Work",
                        shorttitle: "Empty Search Work",
                        titleid: "TestWork",
                        work_titleid: "TestWork",
                        titlepath: "TestWork",
                        mediatype: "etext",
                        startpagename: "1",
                        endpagename: "1",
                        pagestep: 1,
                        pages: [{ pagename: "1", pageindex: 0, imagenumber: 1 }],
                        parts: [],
                        authors: [{ authorid: "AuthorA", full_name: "Author A" }],
                        main_author: { authorid: "AuthorA", full_name: "Author A" },
                        work_authors: [{ authorid: "AuthorA", full_name: "Author A" }],
                        export: [],
                        errata: "<table></table>",
                        sourcedesc: "",
                        mediatypes: ["etext"]
                    }
                ]
            })
        })
    })

    await page.route("**/api/search_document/lbemptyreader/etext/missing/**", async route => {
        await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body:
                'data: {"data": [], "num_highlights": 0}\n\n' +
                'data: {"total_hits": 0, "search_id": ""}\n\n'
        })
    })

    await page.route("**/api/log_page/**", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "{}"
        })
    })

    await page.route("**/txt/css/lbemptyreader-etext.css**", async route => {
        await route.fulfill({
            status: 200,
            contentType: "text/css",
            body: ""
        })
    })

    await page.route("**/txt/lbemptyreader/res_00000.html**", async route => {
        await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: "<html><body><p>Reader page</p></body></html>"
        })
    })
}

test("reader URL search with zero hits should not throw an undefined highlights error", async ({
    page
}) => {
    await mockReaderWithZeroHitSearch(page)
    const readerErrors = []
    page.on("console", msg => {
        const text = msg.text()
        if (msg.type() === "error" && text.includes("reading_controller.js")) {
            readerErrors.push(text)
        }
    })

    await page.goto(
        "/f%C3%B6rfattare/AuthorA/titlar/TestWork/sida/1/etext?show_search_work&s_query=missing&s_lbworkid=lbemptyreader&s_mediatype=etext&s_word_form_only",
        { waitUntil: "networkidle" }
    )
    await waitForAngular(page)
    await expect(page.locator("#search_nav .num")).toHaveText("0")

    expect(readerErrors).toEqual([])
})
