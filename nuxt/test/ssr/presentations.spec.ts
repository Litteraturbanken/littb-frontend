import { expect, test, type APIRequestContext } from "@playwright/test"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin
const backgroundsPath = "/red/bilder/bakgrundsbilder/backgrounds.xml"
function encodeLayers(value: string, layers: number) {
  for (let layer = 0; layer < layers; layer += 1) value = encodeURIComponent(value)
  return value
}
const deeplyEncodedTraversal = encodeLayers("../admin.html", 8)

async function resetPresentation(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_presentation_requests`),
    request.delete(`${fixture}/_presentation_failures`),
    request.delete(`${fixture}/_presentation_production_shape`)
  ])
}

async function presentationRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_presentation_requests`)).json()).requests
}

async function failPresentation(
  request: APIRequestContext,
  resource: "xhtml" | "xml" | "asset"
) {
  await request.put(`${fixture}/_presentation_failures`, { data: { resource } })
}

test.beforeEach(async ({ request }) => resetPresentation(request))

test("production-sized Presentation XHTML and text/xml background render during SSR", async ({
  request
}) => {
  await request.put(`${fixture}/_presentation_production_shape`)

  const response = await request.get(
    "/presentationer/specialomraden/ProductionSized.html"
  )
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("Production-sized Presentation")
  expect(html).toContain("The complete article remains rendered.")
  expect(html).toMatch(/<body[^>]*class="focus page-presentation ready subpage bkg-production-sized bkg-measured"/u)
  expect(html).toContain("html { background-color: #123456; }")
  expect(html).toMatch(/<html[^>]*style="[^"]*rostratt_a\.jpg/u)
  expect(await presentationRequests(request)).toEqual([
    "/red/presentationer/specialomraden/ProductionSized.html",
    backgroundsPath
  ])
})

test("Presentation index renders its exact SSR shell without background XML", async ({ request }) => {
  const response = await request.get("/presentationer")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("<title>Presentationer | Litteraturbanken</title>")
  expect(html).toContain(
    'name="description" content="Litteraturbankens presentationer."'
  )
  expect(html).toMatch(/<body[^>]*class="focus page-presentation ready"/)
  expect(html).toMatch(/<html[^>]*style="[^"]*background:[^"]*presentations[^"]*\.jpg/)
  expect(html).toContain('<div class="doc main">')
  expect(html).toContain("Presentationer och introduktioner")
  expect(html).not.toContain("PRESENTATIONER</title>")
  expect(await presentationRequests(request)).toEqual([
    "/red/presentationer/presentationerForfattare.html"
  ])
})

test("ordinary special-area article applies the ordered folder background during SSR", async ({ request }) => {
  const contentPath = "/red/presentationer/specialomraden/Censur.html"
  const response = await request.get("/presentationer/specialomraden/Censur.html")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain(
    "<title>Censur och liknande ingrepp mot | Litteraturbanken</title>"
  )
  expect(html).toContain(
    'name="description" content="Censur och liknande ingrepp mot"'
  )
  expect(html).toMatch(
    /<body[^>]*class="focus page-presentation ready subpage bkg-folder-fallback"/
  )
  expect(html).toMatch(/<html[^>]*style="[^"]*rostratt_b\.jpg/)
  expect(html).toContain('<div class="content" style="position:relative;">')
  expect(html).toContain("Censur och liknande ingrepp mot tryckta skrifter")
  expect(await presentationRequests(request)).toEqual([contentPath, backgroundsPath])
})

test("themed article owns its stylesheet, exact background, style, and classes", async ({ request }) => {
  const contentPath = "/red/presentationer/specialomraden/Rostratt.html"
  const response = await request.get("/presentationer/specialomraden/Rostratt.html")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("<title>Rösträtt 1919 | Litteraturbanken</title>")
  expect(html).toMatch(
    /<link(?=[^>]*rel="stylesheet")(?=[^>]*href="\/red\/presentationer\/specialomraden\/Rostratt\.css")[^>]*>/
  )
  expect(html).toContain("html { background-color: #382a32; }")
  expect(html).toMatch(/<html[^>]*style="[^"]*rostratt_a\.jpg/)
  expect(html).toMatch(
    /<body[^>]*class="focus page-presentation ready subpage bkg-add-border bkg-paper"/
  )
  expect(html).not.toContain("presentation-style-rostratt")
  expect(await presentationRequests(request)).toEqual([contentPath, backgroundsPath])
})

test("vandring article serializes root-normalized stylesheets and multi-class wildcard", async ({ request }) => {
  const contentPath = "/red/presentationer/vandringar/VandringElam.html"
  const response = await request.get("/presentationer/vandringar/VandringElam.html")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("<title>Såsom i en spegel | Litteraturbanken</title>")
  for (const stylesheet of ["/app/style/litteraturbanken.css", "/app/style/date.css"]) {
    expect(html).toMatch(new RegExp(
      `<link(?=[^>]*rel="stylesheet")(?=[^>]*href="${stylesheet.replaceAll("/", "\\/")}")[^>]*>`
    ))
  }
  expect(html).toMatch(
    /<body[^>]*class="focus page-presentation ready subpage bkg-vandring bkg-plain"/
  )
  expect(html).not.toContain("background: url('')")
  expect(html).toContain("Såsom i en spegel")
  expect(await presentationRequests(request)).toEqual([contentPath, backgroundsPath])
})

test("active inline article serializes trusted style order and normalized rendered URLs", async ({ request }) => {
  const contentPath =
    "/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html"
  const response = await request.get(
    "/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html"
  )
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("p.image {text-align:center}")
  const firstStylesheetIndex = html.indexOf('href="/app/style/litteraturbanken.css"')
  const secondStylesheetIndex = html.indexOf('href="/app/style/date.css"')
  const inlineStyleIndex = html.search(
    /<style[^>]*>[^<]*p\.image \{text-align:center\}[^<]*<\/style>/
  )
  expect(firstStylesheetIndex).toBeGreaterThan(-1)
  expect(secondStylesheetIndex).toBeGreaterThan(firstStylesheetIndex)
  expect(inlineStyleIndex).toBeGreaterThan(secondStylesheetIndex)
  expect(html).toContain(
    'href="/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf" download=""'
  )
  expect(html).toContain(
    'src="/red/presentationer/specialomraden/Burmanbilder/10.jpg"'
  )
  expect(await presentationRequests(request)).toEqual([contentPath, backgroundsPath])
})

test("XHTML failure keeps independently resolved background state", async ({ request }) => {
  await failPresentation(request, "xhtml")
  const response = await request.get("/presentationer/specialomraden/Censur.html")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain('<div class="content" style="position:relative;"></div>')
  expect(html).toMatch(/<html[^>]*style="[^"]*rostratt_b\.jpg/)
  expect(html).toContain("bkg-folder-fallback")
  expect(html).not.toContain("Censur och liknande ingrepp mot tryckta skrifter")
  expect(html).not.toContain("xhtml unavailable")
  expect(await presentationRequests(request)).toEqual([
    "/red/presentationer/specialomraden/Censur.html",
    backgroundsPath
  ])
})

test("background XML failure keeps article and extracted head assets", async ({ request }) => {
  await failPresentation(request, "xml")
  const response = await request.get("/presentationer/specialomraden/Rostratt.html")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("Rösträtt 1919")
  expect(html).toContain("/red/presentationer/specialomraden/Rostratt.css")
  expect(html).toMatch(/<body[^>]*class="focus page-presentation ready subpage"/)
  expect(html).not.toContain("presentation-style-rostratt")
  expect(html).not.toContain("bkg-add-border")
  expect(html).not.toContain("bkg-paper")
  expect(html).not.toContain("rostratt_a.jpg")
  expect(html).not.toContain("background-color: #382a32")
  expect(html).not.toContain("xml unavailable")
})

test("both upstream failures keep the empty document shell without leaks", async ({ request }) => {
  await failPresentation(request, "xhtml")
  await failPresentation(request, "xml")
  const response = await request.get("/presentationer/specialomraden/Rostratt.html")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain('<div class="content" style="position:relative;"></div>')
  expect(html).toMatch(/<body[^>]*class="focus page-presentation ready subpage"/)
  expect(html).not.toContain("Rösträtt 1919")
  expect(html).not.toContain("Rostratt.css")
  expect(html).not.toContain("rostratt_a.jpg")
  expect(html).not.toContain("unavailable")
})

test("safe future document requests upstream and returns the empty 200 shell on 404", async ({ request }) => {
  const document = "FutureEditorialAddition.html"
  const contentPath = `/red/presentationer/specialomraden/${document}`
  const response = await request.get(`/presentationer/specialomraden/${document}`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain('<div class="content" style="position:relative;"></div>')
  expect(html).toContain("bkg-folder-fallback")
  expect(html).not.toContain("not_found")
  expect(html).not.toContain("Resource not found")
  expect(await presentationRequests(request)).toEqual([contentPath, backgroundsPath])
})

for (const [alias, destination] of [
  ["/p/s/Censur.html", "/presentationer/specialomraden/Censur.html"],
  ["/p/v/VandringElam.html", "/presentationer/vandringar/VandringElam.html"],
  [
    "/p/s/FutureEditorialAddition.html",
    "/presentationer/specialomraden/FutureEditorialAddition.html"
  ]
] as const) {
  test(`${alias} redirects permanently without fetching content`, async ({ request }) => {
    const response = await request.get(alias, { maxRedirects: 0 })

    expect(response.status()).toBe(308)
    expect(response.headers().location).toBe(destination)
    expect(await presentationRequests(request)).toEqual([])
  })
}

test("Presentation aliases preserve the exact query in their 308 destination", async ({ request }) => {
  const response = await request.get(
    "/p/s/Censur.html?from=legacy&sort=a%2Fb&empty=",
    { maxRedirects: 0 }
  )

  expect(response.status()).toBe(308)
  expect(response.headers().location).toBe(
    "/presentationer/specialomraden/Censur.html?from=legacy&sort=a%2Fb&empty="
  )
  expect(await presentationRequests(request)).toEqual([])
})

test("Presentation aliases redirect only safe methods", async ({ request }) => {
  const head = await request.fetch(
    "/p/s/Censur.html?from=legacy&sort=a%2Fb&empty=",
    { method: "HEAD", maxRedirects: 0 }
  )
  expect(head.status()).toBe(308)
  expect(head.headers().location).toBe(
    "/presentationer/specialomraden/Censur.html?from=legacy&sort=a%2Fb&empty="
  )

  for (const method of ["POST", "PUT", "DELETE"] as const) {
    const response = await request.fetch("/p/s/Censur.html?from=legacy", {
      method,
      maxRedirects: 0
    })
    expect(response.status(), method).toBe(404)
    expect(response.headers().location, method).toBeUndefined()
  }
  expect(await presentationRequests(request)).toEqual([])
})

for (const alias of [
  "/p/x/Document.html",
  "/p/s/Document.txt",
  "/p/s/.html",
  "/p/s/one/two.html",
  "/p/s/%2E%2E%2Fadmin.html",
  "/p/v/admin%5Csecret.html",
  "/p/s/%252e%252e%252fadmin.html",
  "/p/s/title%253Fvariant.html",
  "/p/v/title%2523fragment.html",
  `/p/s/${deeplyEncodedTraversal}`
]) {
  test(`invalid Presentation alias ${alias} remains a 404`, async ({ request }) => {
    const response = await request.get(alias, { maxRedirects: 0 })

    expect(response.status()).toBe(404)
    expect(response.headers().location).toBeUndefined()
    expect(await presentationRequests(request)).toEqual([])
  })
}

for (const path of [
  "/presentationer/unknown/Document.html",
  "/presentationer/specialomraden/Document.txt",
  "/presentationer/specialomraden/.html",
  "/presentationer/specialomraden/one/two.html",
  "/presentationer/specialomraden/%2E%2E%2Fadmin.html",
  "/presentationer/specialomraden/admin%5Csecret.html",
  "/presentationer/specialomraden/%252e%252e%252fadmin.html",
  "/presentationer/specialomraden/title%253Fvariant.html",
  "/presentationer/vandringar/title%2523fragment.html",
  `/presentationer/specialomraden/${deeplyEncodedTraversal}`
]) {
  test(`invalid Presentation route ${path} is 404 before content fetch`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(404)
    expect(await presentationRequests(request)).toEqual([])
  })
}
