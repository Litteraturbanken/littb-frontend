import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const storedReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const storedNextReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"

type StoredPageView = {
  pageix: number
  pagename?: string
  timestamp: string
  mediatype: string
  lbworkid: string
  author: string
  label: string
  url: string
}

async function resetReader(request: APIRequestContext) {
  await request.delete(`${fixture}/_reader_requests`)
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (
      /hydration/i.test(message.text()) ||
      (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
    ) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function seedStoredPageViews(page: Page, value: unknown) {
  await page.addInitScript(stored => {
    const marker = "reader-history-seeded"
    if (sessionStorage.getItem(marker) !== null) return
    localStorage.setItem("lastPageViews", typeof stored === "string"
      ? stored
      : JSON.stringify(stored))
    sessionStorage.setItem(marker, "true")
  }, value)
}

async function storedPageViews(page: Page): Promise<StoredPageView[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lastPageViews") ?? "[]"))
}

async function rawStoredPageViews(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("lastPageViews"))
}

test.beforeEach(async ({ request }) => resetReader(request))

test("hydrates one runtime e-text page with ordinary reader navigation", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const clientReaderRequests: string[] = []
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/reader/")) {
      clientReaderRequests.push(request.url())
    }
  })
  expect(await readerRequests(request)).toEqual([])
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const warmupRequests = await readerRequests(request)
  for (const readerAsset of [
    "/red/css/etext.css",
    "/txt/css/lb-reader-doktor-glas-etext.css",
    "/bilder/ornament/reader-fixture.png"
  ]) {
    expect(warmupRequests.some(path => path.startsWith(readerAsset))).toBe(true)
  }

  await resetReader(request)
  clientReaderRequests.length = 0
  problems.length = 0
  expect(await readerRequests(request)).toEqual([])

  const response = await page.reload({ waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page).toHaveTitle("Doktor Glas sida -2 etext | Litteraturbanken")
  await expect(page.locator("body")).toHaveClass("focus page-reading ready")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("HJALMAR SÖDERBERG")
  await expect(page.locator(".reader-context")).toContainText("Doktor Glas (1905)")
  await expect(page.getByRole("link", { name: "Hjalmar Söderberg" })).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await expect(page.getByRole("link", { name: "Föregående sida" })).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext"
  )
  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
  )
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(1)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(1)

  const recorded = await readerRequests(request)
  const metadata = recorded.filter(path => path.startsWith("/api/get_work_info?"))
  const pages = recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))
  expect(metadata).toHaveLength(1)
  expect(new URL(metadata[0]!, fixture).searchParams.get("authorid")).toBe("SöderbergH")
  expect(new URL(metadata[0]!, fixture).searchParams.get("titlepath")).toBe("DoktorGlas")
  expect(pages).toHaveLength(1)
  expect(new URL(pages[0]!, fixture).searchParams.get("username")).toBe("app")
  expect(clientReaderRequests).toEqual([])
  expect(problems).toEqual([])
})

test("successful Reader hydration writes the complete legacy history record", async ({
  page
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const [record] = await storedPageViews(page)
  expect(record).toMatchObject({
    pageix: 2,
    pagename: "-2",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    author: "SöderbergH",
    label: "Doktor Glas",
    url: storedReaderPath
  })
  expect(Object.keys(record!).sort()).toEqual([
    "author",
    "label",
    "lbworkid",
    "mediatype",
    "pageix",
    "pagename",
    "timestamp",
    "url"
  ])
  expect(new Date(record!.timestamp).toISOString()).toBe(record!.timestamp)
})

test("a Reader visit replaces only the matching work and media record", async ({ page }) => {
  const matching = {
    pageix: 1,
    pagename: "-3",
    timestamp: "2026-07-14T10:00:00.000Z",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    author: "SöderbergH",
    label: "Old Doktor Glas",
    url: "/old-etext"
  }
  const facsimile = {
    ...matching,
    timestamp: "2026-07-13T10:00:00.000Z",
    mediatype: "faksimil",
    url: "/same-work-facsimile"
  }
  const otherWork = {
    ...matching,
    timestamp: "2026-07-12T10:00:00.000Z",
    lbworkid: "lb-other-work",
    url: "/other-work"
  }
  await seedStoredPageViews(page, [matching, facsimile, otherWork])

  await page.goto(readerPath, { waitUntil: "networkidle" })

  const records = await storedPageViews(page)
  expect(records).toHaveLength(3)
  expect(records[0]).toMatchObject({
    pageix: 2,
    pagename: "-2",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    url: storedReaderPath
  })
  expect(records.slice(1)).toEqual([facsimile, otherWork])
})

test("a Reader visit caps oversized history at 50 records", async ({ page }) => {
  const previous = Array.from({ length: 55 }, (_, index) => ({
    pageix: index,
    pagename: String(index),
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    mediatype: "etext",
    lbworkid: `lb-history-${index}`,
    author: "HistoryAuthor",
    label: `History ${index}`,
    url: `/history-${index}`
  }))
  await seedStoredPageViews(page, previous)

  await page.goto(readerPath, { waitUntil: "networkidle" })

  const records = await storedPageViews(page)
  expect(records).toHaveLength(50)
  expect(records[0]).toMatchObject({
    lbworkid: "lb-reader-doktor-glas",
    pagename: "-2",
    url: storedReaderPath
  })
  expect(records[49]).toEqual(previous[48])
})

test("next-page navigation updates the matching Reader history record", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await Promise.all([
    page.waitForURL(/\/sida\/-1\/etext$/),
    page.getByRole("link", { name: "Nästa sida" }).click()
  ])
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect.poll(async () => (await storedPageViews(page))[0]?.pagename).toBe("-1")

  const records = await storedPageViews(page)
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({
    pageix: 3,
    pagename: "-1",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    url: storedNextReaderPath
  })
})

for (const [name, raw] of [
  ["malformed JSON", "{not-json"],
  ["non-array JSON", JSON.stringify({ old: "history" })]
] as const) {
  test(`${name} is replaced by a valid fresh Reader history`, async ({ page }) => {
    await seedStoredPageViews(page, raw)

    await page.goto(readerPath, { waitUntil: "networkidle" })

    const records = await storedPageViews(page)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      lbworkid: "lb-reader-doktor-glas",
      pagename: "-2",
      url: storedReaderPath
    })
  })
}

for (const method of ["getItem", "setItem"] as const) {
  test(`throwing Storage.${method} does not break the Reader`, async ({ page }) => {
    const problems = captureBrowserProblems(page)
    await page.addInitScript(storageMethod => {
      if (storageMethod === "getItem") {
        const nativeGetItem = Storage.prototype.getItem
        Object.defineProperty(Storage.prototype, "getItem", {
          configurable: true,
          value(key: string) {
            if (key === "lastPageViews") throw new Error("blocked Storage.getItem")
            return nativeGetItem.call(this, key)
          }
        })
      } else {
        const nativeSetItem = Storage.prototype.setItem
        Object.defineProperty(Storage.prototype, "setItem", {
          configurable: true,
          value(key: string, value: string) {
            if (key === "lastPageViews") throw new Error("blocked Storage.setItem")
            return nativeSetItem.call(this, key, value)
          }
        })
      }
    }, method)

    const response = await page.goto(readerPath, { waitUntil: "networkidle" })

    expect(response?.status()).toBe(200)
    await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
    expect(problems).toEqual([])
  })
}

test("an unknown Reader page leaves stored history unchanged", async ({ page }) => {
  const raw = JSON.stringify([{
    pageix: 7,
    pagename: "7",
    timestamp: "2026-07-11T10:00:00.000Z",
    mediatype: "etext",
    lbworkid: "lb-existing",
    author: "ExistingAuthor",
    label: "Existing title",
    url: "/existing"
  }])
  await seedStoredPageViews(page, raw)

  const response = await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/missing/etext",
    { waitUntil: "networkidle" }
  )

  expect(response?.status()).toBe(404)
  expect(await rawStoredPageViews(page)).toBe(raw)
})

test("Reader history is consumed by the existing history page", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await expect.poll(async () => (await storedPageViews(page))[0]?.lbworkid)
    .toBe("lb-reader-doktor-glas")
  await page.goto("/historik", { waitUntil: "networkidle" })

  await expect(page.getByRole("link", {
    name: "Hjalmar Söderberg – Doktor Glas"
  })).toHaveAttribute("href", storedReaderPath)
})
