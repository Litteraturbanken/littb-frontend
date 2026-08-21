import { expect, test } from "@playwright/test"

const fixturePort = Number(process.env.LBAPI_FIXTURE_PORT || 4120)
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`

test("Nitro proxies bounded backend requests without shadowing exact APIs", async ({ request }) => {
  const v2 = await request.get("/api/v2/openapi.json?probe=production")
  expect(v2.status()).toBe(200)
  expect(await v2.json()).toEqual({
    openapi: "3.1.0",
    path: "/private-v2/openapi.json",
    query: "probe=production"
  })
  expect((await request.head("/api/v2/openapi.json")).status()).toBe(200)

  const legacy = await request.get("/api/?q=kyrka")
  expect(legacy.status()).toBe(200)
  expect(await legacy.json()).toEqual({ query: "q=kyrka" })
  expect((await request.get(
    "/api/get_authors?exclude=intro%2Cdb_*"
  )).status()).toBe(200)

  await request.delete(`${fixtureOrigin}/_contact_submissions`)
  await request.delete(`${fixtureOrigin}/_requests`)
  const submission = {
    sender_name: "Proxy Probe",
    sender_address: "proxy@example.test",
    message: "Forward the complete body",
    audience: "litteraturbanken"
  }
  const posted = await request.post("/api/v2/contact?probe=post", {
    data: submission
  })
  expect(posted.status()).toBe(202)
  expect(await posted.json()).toEqual({ status: "accepted" })
  expect(await (await request.get(
    `${fixtureOrigin}/_contact_submissions`
  )).json()).toEqual({ contactSubmissions: [submission] })
  expect(await (await request.get(`${fixtureOrigin}/_requests`)).json())
    .toEqual({ requests: ["/private-v2/contact?probe=post"] })

  const exactReader = await request.get(
    "/nuxt-api/reader/S%C3%B6derbergH/DoktorGlas/-2/etext"
  )
  expect(exactReader.status()).toBe(200)
  expect(exactReader.headers()["cache-control"]).toBe("no-store")

  for (const exactPath of [
    "/nuxt-api/editor/lb-editor-doktor/1/f",
    "/nuxt-api/author-documents/S%C3%B6derbergH/presentation",
    "/nuxt-api/dramawebben/documents/om",
    "/api/v2/dictionary/articles?word=DOKTOR"
  ]) {
    expect((await request.get(exactPath)).status(), exactPath).toBe(200)
  }

  const developerOnly = await request.get("/nuxt-api/dev/red-ftp?q=lb123")
  expect(developerOnly.status()).toBe(404)
  expect((await developerOnly.json()).statusMessage).toBe("Not found")

  for (const exactPath of [
    "/nuxt-api/reader/S%C3%B6derbergH/DoktorGlas/-2/etext",
    "/nuxt-api/editor/lb-editor-doktor/1/f",
    "/nuxt-api/author-documents/S%C3%B6derbergH/presentation",
    "/nuxt-api/dramawebben/documents/om",
    "/nuxt-api/dev/red-ftp?q=lb123",
    "/api/v2/dictionary/articles?word=DOKTOR"
  ]) {
    expect((await request.post(exactPath)).status(), exactPath).toBe(404)
  }

  const unsupportedMethod = await request.put("/api/v2/openapi.json")
  expect(unsupportedMethod.status()).toBe(405)
})

test("same-origin Reader resources preserve read, validation, and Range semantics", async ({
  request
}) => {
  await request.delete(`${fixtureOrigin}/_content_resource_requests`)
  const resources = [
    ["/red/css/etext.css", "text/css"],
    ["/txt/css/lb-reader-doktor-glas-etext.css", "text/css"],
    ["/bilder/ornament/reader-fixture.png", "image/png"],
    ["/txt/epub/S%C3%B6derbergH_DoktorGlas.epub", "application/epub+zip"],
    ["/export/faksimil/lb-DoktorGlas.pdf", "application/pdf"]
  ] as const

  for (const [path, contentType] of resources) {
    const response = await request.get(path, {
      headers: {
        authorization: "Bearer browser-secret",
        cookie: "reader_session=browser-secret"
      }
    })
    expect(response.status(), path).toBe(200)
    expect(response.headers()["content-type"], path).toContain(contentType)
    const head = await request.head(path)
    expect(head.status(), `HEAD ${path}`).toBe(200)
    expect(await head.body()).toEqual(Buffer.alloc(0))
  }

  for (const path of [
    "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub",
    "/export/faksimil/lb-DoktorGlas.pdf"
  ]) {
    const partial = await request.get(path, { headers: { range: "bytes=1-4" } })
    expect(partial.status(), path).toBe(206)
    expect(partial.headers()["accept-ranges"]).toBe("bytes")
    expect(partial.headers()["content-range"]).toMatch(/^bytes 1-4\/\d+$/u)
    expect((await partial.body()).byteLength).toBe(4)

    const unsatisfiable = await request.get(path, {
      headers: { range: "bytes=999999-" }
    })
    expect(unsatisfiable.status(), path).toBe(416)
    expect(unsatisfiable.headers()["content-range"]).toMatch(/^bytes \*\/\d+$/u)
  }

  const resourceLedger = await request.get(`${fixtureOrigin}/_content_resource_requests`)
  const resourceEntries = (await resourceLedger.json() as {
    requests: Array<{
      authorization: string | null
      cookie: string | null
      method: string
      path: string
      range: string | null
    }>
  }).requests
  expect(resourceEntries.map(({ method, path, range }) => ({ method, path, range }))).toEqual([
    { method: "GET", path: "/txt/css/lb-reader-doktor-glas-etext.css", range: null },
    { method: "HEAD", path: "/txt/css/lb-reader-doktor-glas-etext.css", range: null },
    { method: "GET", path: "/bilder/ornament/reader-fixture.png", range: null },
    { method: "HEAD", path: "/bilder/ornament/reader-fixture.png", range: null },
    { method: "GET", path: "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub", range: null },
    { method: "HEAD", path: "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub", range: null },
    { method: "GET", path: "/export/faksimil/lb-DoktorGlas.pdf", range: null },
    { method: "HEAD", path: "/export/faksimil/lb-DoktorGlas.pdf", range: null },
    { method: "GET", path: "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub", range: "bytes=1-4" },
    { method: "GET", path: "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub", range: "bytes=999999-" },
    { method: "GET", path: "/export/faksimil/lb-DoktorGlas.pdf", range: "bytes=1-4" },
    { method: "GET", path: "/export/faksimil/lb-DoktorGlas.pdf", range: "bytes=999999-" }
  ])
  expect(resourceEntries.every(entry => (
    entry.authorization === null && entry.cookie === null
  ))).toBe(true)

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

test("the production reader keeps browser resources same-origin without private authority requests", async ({
  page
}) => {
  const consoleErrors: string[] = []
  const resourceRequests: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("request", (request) => resourceRequests.push(request.url()))

  await page.goto(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext",
    { waitUntil: "networkidle" }
  )

  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(0)
  const sharedStyles = page.locator("style[data-reader-shared-styles]")
  await expect(sharedStyles).toHaveCount(1)
  expect(await sharedStyles.textContent()).toContain(".txt .title")
  expect(await sharedStyles.textContent()).toContain(
    'url("/red/bilder/reader-rebase-fixture.png")'
  )
  await expect(page.locator(
    'link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'
  )).toHaveCount(0)
  const workStyles = page.locator("style[data-reader-work-styles]")
  await expect(workStyles).toHaveCount(1)
  expect(await workStyles.textContent()).toContain(".txt .titelsida")

  await page.goto(
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/3/faksimil",
    { waitUntil: "networkidle" }
  )
  await expect(page.locator("img.faksimil")).toBeVisible()
  const readerResources = resourceRequests.filter(url => (
    /^\/(?:red|txt|bilder|export\/faksimil)(?:\/|$)/u.test(new URL(url).pathname)
  ))
  expect(readerResources.length).toBeGreaterThan(0)
  expect(readerResources.map(url => new URL(url).pathname)).toEqual(expect.arrayContaining([
    "/txt/lb-reader-gosta-berlings-saga/" +
      "lb-reader-gosta-berlings-saga_3/lb-reader-gosta-berlings-saga_3_0009.jpeg"
  ]))
  expect(readerResources.every(url => new URL(url).origin === new URL(page.url()).origin))
    .toBe(true)
  expect(resourceRequests.some(url => url.includes("reader-origin.int.lb.se"))).toBe(false)
  expect(await page.content()).not.toContain("reader-origin.int.lb.se")
  expect(consoleErrors).toEqual([])
})

for (const [acceptEncoding, accepted] of [
  ["br", true],
  ["br;q=0", false],
  ["gzip;q=0.9, br;q=0.2", true],
  ["gzip;q=1, br;q=0", false],
  ["BR", true],
  ["br;q=bogus", false],
  ["br;q=1.1", false]
] as const) {
  test(`Nitro negotiates Brotli for ${acceptEncoding}`, async ({ request }) => {
    const response = await request.get(
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext",
      { headers: { "accept-encoding": acceptEncoding } }
    )

    expect(response.status()).toBe(200)
    expect(response.headers()["content-encoding"]).toBe(accepted ? "br" : undefined)
    if (accepted) expect(response.headers().vary).toContain("Accept-Encoding")
  })
}

test("mutable reader API pages are never shared or browser cacheable", async ({ request }) => {
  const path = "/nuxt-api/reader/S%C3%B6derbergH/DoktorGlas/-2/etext"
  const first = await request.get(path)

  expect(first.status()).toBe(200)
  expect(first.headers()["cache-control"]).toBe("no-store")

  const conditional = await request.get(path, {
    headers: { "if-none-match": first.headers().etag ?? '"stale-reader-response"' }
  })
  expect(conditional.status()).toBe(200)
  expect(conditional.headers()["cache-control"]).toBe("no-store")
})

test("development fixture permits indexing through robots and response metadata", async ({ request }) => {
  const robots = await request.get("/robots.txt")
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toBe("User-agent: *\nAllow: /\n")
  expect(robots.headers()["x-robots-tag"]).toBeUndefined()

  const page = await request.get(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  )
  expect(page.status()).toBe(200)
  expect(page.headers()["x-robots-tag"]).toBeUndefined()
})
