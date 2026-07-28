import { expect, test } from "@playwright/test"

test("Nitro proxies the bounded public legacy asset prefixes", async ({ request }) => {
  const sharedStylesheet = await request.get("/red/css/etext.css")
  expect(sharedStylesheet.status()).toBe(200)
  expect(sharedStylesheet.headers()["content-type"]).toContain("text/css")

  const workStylesheet = await request.get(
    "/txt/css/lb-reader-doktor-glas-etext.css"
  )
  expect(workStylesheet.status()).toBe(200)
  expect(workStylesheet.headers()["content-type"]).toContain("text/css")

  const image = await request.get("/bilder/ornament/reader-fixture.png")
  expect(image.status()).toBe(200)
  expect(image.headers()["content-type"]).toContain("image/png")

  const facsimile = await request.get("/export/faksimil/lb-DoktorGlas.pdf")
  expect(facsimile.status()).toBe(200)
  expect(facsimile.headers()["content-type"]).toContain("application/pdf")

  const map = await request.get("/litteraturkartan?s=author:SoderbergH")
  expect(map.status()).toBe(200)
  expect(map.headers()["content-type"]).toContain("text/html")

  const traversal = await request.get("/red/../private-v2/openapi.json")
  expect(traversal.status()).toBeGreaterThanOrEqual(400)
})

test("the production reader loads its stylesheets without console errors", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.goto(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext",
    { waitUntil: "networkidle" }
  )

  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(1)
  await expect(page.locator(
    'link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'
  )).toHaveCount(1)
  expect(consoleErrors).toEqual([])
})
