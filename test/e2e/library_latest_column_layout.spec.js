const { test, expect, webkit } = require("@playwright/test")

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

const makeLatestWork = overrides => ({
    lbworkid: "lb-latest-layout",
    titlepath: "LatestLayout/Solitudo",
    titleid: "Solitudo",
    work_titleid: "Solitudo",
    title: "Solitudo",
    shorttitle: "Solitudo",
    startpagename: "1",
    imported: "2026-05-25",
    mediatype: "etext",
    sort_date_imprint: { plain: "1905" },
    searchable: true,
    main_author: {
        authorid: "AgrellA",
        surname: "Agrell",
        full_name: "Alfhild Agrell",
        name_for_index: "Agrell, Alfhild"
    },
    work_authors: [
        {
            authorid: "AgrellA",
            surname: "Agrell",
            full_name: "Alfhild Agrell",
            name_for_index: "Agrell, Alfhild"
        }
    ],
    export: [],
    keyword: [],
    ...overrides
})

const mockLatestLibraryBackend = async page => {
    const works = [
        makeLatestWork(),
        makeLatestWork({
            titlepath: "LatestLayout/LongTitle",
            titleid: "LongTitle",
            work_titleid: "LongTitle",
            title: "Den Helige Johannes och Klemens af Rom",
            shorttitle: "Den Helige Johannes och Klemens af Rom",
            sort_date_imprint: { plain: "1904" },
            main_author: {
                authorid: "AhnfeltA",
                surname: "Ahnfelt",
                full_name: "Arvid Ahnfelt",
                name_for_index: "Ahnfelt, Arvid"
            },
            work_authors: [
                {
                    authorid: "AhnfeltA",
                    surname: "Ahnfelt",
                    full_name: "Arvid Ahnfelt",
                    name_for_index: "Ahnfelt, Arvid"
                }
            ]
        })
    ]

    await page.route("**/api/get_authors*", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                data: works.map(work => ({
                    authorid: work.main_author.authorid,
                    surname: work.main_author.surname,
                    full_name: work.main_author.full_name,
                    name_for_index: work.main_author.name_for_index,
                    searchable: true
                }))
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
        const countOnly = requestUrl.searchParams.get("to") === "0"
        const q = requestUrl.searchParams.get("q") || ""
        const isLatestSearch = !countOnly && requestUrl.searchParams.get("imported_aggregation")
        const data = isLatestSearch && !q.includes("lskfslfhdsldjfh") ? works : []

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                hits: data.length,
                distinct_hits: data.length,
                data,
                author_aggregation: data.map(work => ({
                    authorid: work.main_author.authorid,
                    count: 1
                })),
                imported_aggregation: data.length
                    ? [{ imported: "2026-05-25", doc_count: data.length }]
                    : [],
                suggest: []
            })
        })
    })
}

const getLatestTableStructure = async page =>
    page.evaluate(() => {
        const table = document.querySelector("#table")
        const visible = row => getComputedStyle(row).display !== "none"
        const dataRow = Array.from(table.querySelectorAll("tr.work_link")).find(
            row => visible(row) && !row.classList.contains("header")
        )
        const noHitsCell = Array.from(table.querySelectorAll("tr"))
            .filter(visible)
            .find(row => row.innerText.includes("Inga träffar."))
            ?.querySelector("td")

        return {
            dataColumns: dataRow ? dataRow.cells.length : null,
            noHitsColSpan: noHitsCell ? noHitsCell.colSpan : null
        }
    })

const getLatestFirstRowMetrics = async page =>
    page.evaluate(() => {
        const table = document.querySelector("#table")
        const visible = row => getComputedStyle(row).display !== "none"
        const dataRow = Array.from(table.querySelectorAll("tr.work_link")).find(
            row => visible(row) && !row.classList.contains("header")
        )
        const cells = Array.from(dataRow.cells).map(cell => cell.getBoundingClientRect())
        const tableRect = table.getBoundingClientRect()

        return {
            titleColumnShare: cells[0].width / tableRect.width
        }
    })

const assertLatestColumnResetFlow = async page => {
    await mockLatestLibraryBackend(page)

    await page.goto("/bibliotek?visa=latest&sort=nytillkommet", { waitUntil: "networkidle" })
    await waitForAngular(page)

    await expect(page.locator("#table tr.work_link", { hasText: "Solitudo" })).toBeVisible()
    await expect.poll(() => getLatestTableStructure(page)).toMatchObject({
        dataColumns: 3
    })

    const filter = page.locator('[ng-model="$ctrl.filter"]')
    await filter.fill("lskfslfhdsldjfh")
    await page.keyboard.press("Tab")
    await expect.poll(() => getLatestTableStructure(page)).toMatchObject({
        noHitsColSpan: 3
    })

    await page.locator("svg.reset").click()
    await expect(page.locator("#table tr.work_link", { hasText: "Solitudo" })).toBeVisible()
    await expect.poll(() => getLatestTableStructure(page)).toMatchObject({
        dataColumns: 3
    })
    await expect
        .poll(async () => (await getLatestFirstRowMetrics(page)).titleColumnShare)
        .toBeGreaterThan(0.5)
}

test("keeps latest result table columns stable after clearing a zero-hit filter", async ({
    page
}) => {
    await assertLatestColumnResetFlow(page)
})

test("keeps latest result table columns stable after clearing a zero-hit filter in WebKit", async () => {
    const browser = await webkit.launch()
    const page = await browser.newPage({
        baseURL: `http://${process.env.LITTB_DOCKER_HOST || "localhost"}:9000`,
        viewport: { width: 2048, height: 768 }
    })

    try {
        await assertLatestColumnResetFlow(page)
    } finally {
        await browser.close()
    }
})
