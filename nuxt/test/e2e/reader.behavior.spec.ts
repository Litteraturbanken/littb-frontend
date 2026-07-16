import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"

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
  const response = await page.goto(readerPath, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page).toHaveTitle("Doktor Glas sida -2 etext | Litteraturbanken")
  await expect(page.locator("body")).toHaveClass("focus page-reading ready")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("HJALMAR SÖDERBERG")
  await expect(page.locator(".reader-context")).toContainText("Doktor Glas (1905)")
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await expect(page.getByRole("link", { name: "Föregående sida" })).toHaveAttribute(
    "href",
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-3/etext"
  )
  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext"
  )
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(1)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(1)

  const recorded = await readerRequests(request)
  const metadata = recorded.filter(path => path.startsWith("/api/get_work_info?"))
  const pages = recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))
  expect(metadata.length).toBeGreaterThan(0)
  expect(new URL(metadata[0]!, fixture).searchParams.get("authorid")).toBe("SöderbergH")
  expect(new URL(metadata[0]!, fixture).searchParams.get("titlepath")).toBe("DoktorGlas")
  expect(pages).toHaveLength(metadata.length)
  expect(new URL(pages[0]!, fixture).searchParams.get("username")).toBe("app")
  for (const readerAsset of [
    "/red/css/etext.css",
    "/txt/css/lb-reader-doktor-glas-etext.css",
    "/bilder/ornament/reader-fixture.png"
  ]) {
    expect(recorded.some(path => path.startsWith(readerAsset))).toBe(true)
  }
  expect(clientReaderRequests).toEqual([])
  expect(problems).toEqual([])
})
