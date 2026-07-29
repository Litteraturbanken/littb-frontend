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

  const iconFont = await request.get(
    "/assets/fonts/font-awesome/fontawesome-littb.woff2"
  )
  expect(iconFont.status()).toBe(200)
  expect(iconFont.headers()["content-type"]).toContain("font/woff2")
  expect((await iconFont.body()).byteLength).toBeLessThan(5_000)

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

  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(0)
  const sharedStyles = page.locator("style[data-reader-shared-styles]")
  await expect(sharedStyles).toHaveCount(1)
  expect(await sharedStyles.textContent()).toContain(".txt .title")
  await expect(page.locator(
    'link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'
  )).toHaveCount(0)
  const workStyles = page.locator("style[data-reader-work-styles]")
  await expect(workStyles).toHaveCount(1)
  expect(await workStyles.textContent()).toContain(".txt .titelsida")
  expect(consoleErrors).toEqual([])
})

test("Nitro compresses generated reader HTML when the browser accepts Brotli", async ({ request }) => {
  const response = await request.get(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext",
    { headers: { "accept-encoding": "br" } }
  )

  expect(response.status()).toBe(200)
  expect(response.headers()["content-encoding"]).toBe("br")
  expect(response.headers().vary).toContain("Accept-Encoding")
})

test("immutable reader API pages are conditionally cacheable in production", async ({ request }) => {
  const path = "/api/reader/S%C3%B6derbergH/DoktorGlas/-2/etext"
  const first = await request.get(path)

  expect(first.status()).toBe(200)
  expect(first.headers()["cache-control"]).toContain("max-age=3600")
  expect(first.headers().etag).toBeTruthy()

  const conditional = await request.get(path, {
    headers: { "if-none-match": first.headers().etag! }
  })
  expect(conditional.status()).toBe(304)
})
