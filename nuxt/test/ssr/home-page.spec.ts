import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const description = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

async function resetHome(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_home_requests`),
    request.delete(`${fixture}/_home_failure`),
    request.delete(`${fixture}/_home_hostile_background`)
  ])
}

async function homeRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_home_requests`)).json()).requests
}

test.beforeEach(async ({ request }) => resetHome(request))

test("Home renders the exact legacy shell and parsed editorial content during SSR", async ({ request }) => {
  const response = await request.get("/")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("<title>Litteraturbanken | Svenska klassiker som e-bok och epub</title>")
  expect(html).toContain(`name="description" content="${description}"`)
  expect(html).toMatch(/<body[^>]*class="focus page-start ready"/)
  expect(html).toContain("<h1>Litteraturbanken</h1>")
  expect(html).not.toContain("nuxt-route-announcer")
  expect(html).toContain('<h2 class="caps">Nytt <i class="no-caps">&amp;</i> anmärkningsvärt</h2>')
  for (const marker of [
    "Månadens tema",
    "Lärdomsstaden Uppsala",
    "Nytt i Biblioteket",
    "LITTERATURBANKEN stöds av",
    "Jan Gossaert"
  ]) expect(html).toContain(marker)
  expect(html).toContain('href="/bibliotek?filter=uppsala&visa=latest&sort=nytillkommet"')
  expect(html).toContain('href="/författare/WernerFE/titlar/UpsalaDomkyrka/sida/VII/faksimil"')
  expect(html).toContain('href="/s%C3%B6k"')
  expect(html).not.toContain("data-ng-href")
  expect(html).not.toContain("bkg-img")
  expect(html).not.toContain("</img>")

  const requests = await homeRequests(request)
  expect(requests).toHaveLength(1)
  const cacheBuster = requests[0]?.match(/^\/red\/om\/start\/startsida-ny\.html\?(.+)$/)?.[1]
  expect(cacheBuster).toMatch(/^[a-z0-9]+$/)
  expect(html).toMatch(new RegExp(
    `<link(?=[^>]*rel="stylesheet")(?=[^>]*href="/red/css/startsida\\.css\\?${cacheBuster}")[^>]*>`
  ))
  expect(html).toMatch(
    /<html[^>]*style="background:#333 url\('\/red\/bilder\/bakgrundsbilder\/start_bkg_172_2026\.jpg'\) no-repeat"/
  )
})

test("Home failure keeps a successful empty shell without leaking upstream errors", async ({ request }) => {
  await request.put(`${fixture}/_home_failure`)

  const response = await request.get("/")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("<h1>Litteraturbanken</h1>")
  expect(html).toContain("Nytt")
  expect(html).not.toContain("Månadens tema")
  expect(html).not.toContain("content unavailable")
  expect(html).not.toContain("/red/css/startsida.css?")
  expect(html).not.toContain("start_bkg_172_2026.jpg")
  expect((await homeRequests(request)).filter(path => path.startsWith(
    "/red/om/start/startsida-ny.html?"
  ))).toHaveLength(1)
})

test("Home rejects a managed background path that breaks out of its inline CSS string", async ({
  request
}) => {
  await request.put(`${fixture}/_home_hostile_background`)

  const response = await request.get("/")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain('<p id="hostile-home-marker">Homeinnehållet är kvar</p>')
  expect(html).not.toContain("evil.test")
  expect(html).not.toContain("background:url")
  expect(html).toMatch(/<html[^>]*style=""/u)
})
