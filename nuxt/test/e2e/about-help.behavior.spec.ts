import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`
const contentPath = "/red/om/hjalp/hjalp.html"
const submenu = [
  ["SökaEfterVerk", "Söka efter verk"],
  ["SökaIVerk", "Söka i verk"],
  ["AvanceradSökning", "Avancerad sökning"],
  ["Träffvisningen", "Träffvisningen"],
  ["Etext", "Etext"],
  ["Faksimil", "Faksimil"],
  ["Pdf", "Pdf"],
  ["Epub", "Epub"],
  ["Ljudarkivet", "Ljud & bild"],
  ["Ordböcker", "Ordböcker"],
  ["Presentationer", "Presentationer"],
  ["KopieraText", "Kopiera text"],
  ["Länka", "Länka"],
  ["Uppdateringar", "Uppdateringar"],
  ["Webbläsare", "Webbläsare"],
  ["Textstorlek", "Textstorlek"],
  ["Kontakt", "Kontakt"]
] as const

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function loggedContentRequests(request: APIRequestContext) {
  const log = await (await request.get(`${fixture}/_requests`)).json()
  return (log.requests as string[]).filter(path => path === contentPath)
}

async function expectAnchorOffset(page: Page, id: string) {
  await expect.poll(async () => {
    return page.locator(`#${id}`).evaluate(element => Math.abs(element.getBoundingClientRect().top - 40))
  }).toBeLessThanOrEqual(1)
}

test.beforeEach(async ({ request }) => reset(request))

test("Help renders the exact active state and authority submenu in the toolkit without browser errors", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const response = await page.goto("/om/hjalp", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page.locator(".help_content.content.unbox.page-help")).toBeVisible()
  const activeLinks = page.locator("ul.links a.active")
  await expect(activeLinks).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Hjälp", exact: true })).toHaveClass(/\bactive\b/)

  const toolkitMenu = page.locator("#toolkit > [toolkit] > ul.help_submenu.sticky")
  await expect(toolkitMenu).toHaveCount(1)
  await expect(page.locator(".help_content .help_submenu")).toHaveCount(0)
  await expect(toolkitMenu.locator("li > a")).toHaveText(submenu.map(([, label]) => label))
  for (const [id, label] of submenu) {
    await expect(toolkitMenu.getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "href",
      `/om/hjalp?ankare=${encodeURIComponent(id)}`
    )
  }

  const initialContentRequests = await loggedContentRequests(request)
  expect(initialContentRequests.length).toBeGreaterThan(0)
  expect([...new Set(initialContentRequests)]).toEqual([contentPath])
  expect(problems).toEqual([])
})

test("Help browser alias preserves query and fragment through the permanent redirect", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const response = await page.goto("/hjalp?ankare=Epub#legacy", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL("/om/hjalp?ankare=Epub#legacy")
  await expect(page.getByRole("heading", { name: "Hjälp", exact: true })).toBeVisible()
  await expectAnchorOffset(page, "Epub")
  expect(await loggedContentRequests(request)).toEqual([contentPath])
  expect(problems).toEqual([])
})

test("Help uses browser-decoded named entities and underscore.string _id stripping", async ({ page }) => {
  await page.addInitScript(() => {
    const BrowserDOMParser = window.DOMParser
    class FixtureDOMParser {
      parseFromString(markup: string, type: DOMParserSupportedType) {
        const document = new BrowserDOMParser().parseFromString(markup, type)
        if (markup.includes('id="SökaEfterVerk"')) {
          const fixture = new BrowserDOMParser().parseFromString(
            '<a id="EntityLabel" name="Cr&egrave;me&nbsp;Br&ucirc;l&eacute;e_id"></a>',
            "text/html"
          )
          document.body.append(fixture.body.firstElementChild!)
        }
        return document
      }
    }
    Object.defineProperty(window, "DOMParser", {
      configurable: true,
      value: FixtureDOMParser,
      writable: true
    })
  })

  await page.goto("/om/hjalp", { waitUntil: "networkidle" })
  const injected = page.locator("#toolkit").getByRole("link", { name: "Crème brûlée", exact: true })
  await expect(injected).toHaveAttribute("href", "/om/hjalp?ankare=EntityLabel")
})

test("Help submenu click updates ankare and scrolls to the legacy 40px offset without refetch", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/om/hjalp", { waitUntil: "networkidle" })
  await page.locator("#toolkit").getByRole("link", { name: "Epub", exact: true }).click()
  await expect(page).toHaveURL("/om/hjalp?ankare=Epub")
  await expectAnchorOffset(page, "Epub")
  expect(await loggedContentRequests(request)).toEqual([contentPath])
  expect(problems).toEqual([])
})

test("Help direct query and browser history resynchronize scrolling without refetch", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/om/hjalp?ankare=Epub", { waitUntil: "networkidle" })
  await expectAnchorOffset(page, "Epub")

  await page.locator("#toolkit").getByRole("link", { name: "Etext", exact: true }).click()
  await expect(page).toHaveURL("/om/hjalp?ankare=Etext")
  await expectAnchorOffset(page, "Etext")

  await page.goBack()
  await expect(page).toHaveURL("/om/hjalp?ankare=Epub")
  await expectAnchorOffset(page, "Epub")

  await page.goForward()
  await expect(page).toHaveURL("/om/hjalp?ankare=Etext")
  await expectAnchorOffset(page, "Etext")

  expect(await loggedContentRequests(request)).toEqual([contentPath])
  expect(problems).toEqual([])
})
