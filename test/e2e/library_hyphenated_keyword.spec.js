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

const makeSlsWork = overrides => ({
    lbworkid: "lb1407007",
    titlepath: "SamladeSkrifter1/DiktningenEfter1909/Dikter",
    startpagename: "1",
    has_epub: true,
    titleid: "Dikter",
    work_titleid: "SamladeSkrifter1",
    work_authors: [{ authorid: "SödergranE", surname: "Södergran", full_name: "Edith Södergran" }],
    sort_date_imprint: { plain: "1992" },
    title: "Dikter [1992]",
    shorttitle: "Dikter",
    sort_date: { plain: "1916" },
    searchable: true,
    main_author: {
        authorid: "SödergranE",
        surname: "Södergran",
        full_name: "Edith Södergran",
        name_for_index: "Södergran, Edith"
    },
    mediatype: "etext",
    keyword: ["SLS-FI"],
    export: [{ type: "epub", size: 1024 }],
    ...overrides
})

const mockLibraryBackend = async page => {
    const works = [
        makeSlsWork(),
        makeSlsWork({
            titlepath: "SamladeSkrifter1/DiktningenEfter1909/BrokigaIakttagelser1919",
            titleid: "BrokigaIakttagelser1919",
            title: "Brokiga iakttagelser [1992]",
            shorttitle: "Brokiga iakttagelser",
            startpagename: "121"
        })
    ]

    await page.route("**/api/get_authors*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                data: [
                    {
                        authorid: "SödergranE",
                        surname: "Södergran",
                        full_name: "Edith Södergran",
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

    await page.route("**/api/imprint_range*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                start_year: { value_as_string: "1800" },
                end_year: { value_as_string: "2026" }
            })
        })
    })

    await page.route("**/api/query_string/**", async route => {
        const requestUrl = new URL(route.request().url())
        const types = requestUrl.pathname
        const countOnly = requestUrl.searchParams.get("to") === "0"
        const q = requestUrl.searchParams.get("q") || ""
        const data = !countOnly && types.includes("etext,faksimil,pdf") ? works : []
        const isEpubCount = q.includes("has_epub:true")

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: isEpubCount ? works.length : data.length,
                distinct_hits: isEpubCount ? works.length : data.length,
                data,
                author_aggregation: [{ authorid: "SödergranE", count: works.length }],
                imported_aggregation: [],
                suggest: []
            })
        })
    })
}

for (const listType of ["works", "epub"]) {
    test(`renders SLS-FI ${listType} rows whose title paths share the same section`, async ({
        page
    }) => {
        await mockLibraryBackend(page)
        const errors = []
        page.on("console", msg => {
            if (msg.type() === "error") {
                errors.push(msg.text())
            }
        })

        await page.goto(
            `/bibliotek?visa=${listType}&avancerat&keywords=keyword:SLS-FI&sort=popularitet`,
            { waitUntil: "networkidle" }
        )
        await waitForAngular(page)

        await expect(page.locator("tr.work_link")).toHaveCount(2)
        expect(errors.filter(text => text.includes("ngRepeat:dupes"))).toEqual([])
    })
}
