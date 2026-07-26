import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`
const description = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

type LookupRequest = {
  path: string
  body: { work_id: string | null, titles: string[] }
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_work_lookup_requests`),
    request.delete(`${fixture}/_work_lookup_failure`),
    request.delete(`${fixture}/_work_lookup_delays`)
  ])
}

async function lookupRequests(request: APIRequestContext): Promise<LookupRequest[]> {
  const response = await request.get(`${fixture}/_work_lookup_requests`)
  return (await response.json()).requests
}

async function expectRenderedRodaRummet(page: Page) {
  const row = page.locator(".table-striped tr")
  await expect(row).toHaveCount(1)
  await expect(row.locator("td")).toHaveCount(4)
  await expect(row.locator("td").nth(0)).toHaveText("lb238704")
  await expect(row.locator("td").nth(1).locator("a")).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/StrindbergA"
  )
  await expect(row.locator("td").nth(2).locator("a")).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/etext"
  )
  await expect(row.locator("td").nth(3).locator("a").first()).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/etext"
  )
  await expect(row.locator("td").nth(3).locator("a").last()).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/faksimil"
  )
  await expect(row.locator("td").nth(3)).toHaveText("etext:::faksimil")
}

test.beforeEach(async ({ request }) => reset(request))

test("empty ID route renders exact authority shell without a lookup", async ({
  request
}) => {
  const response = await request.get("/id")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe(description)
  expect(document.body.className).toBe("focus page-id ready")
  const controls = [...document.querySelectorAll("#mainview input, #mainview textarea")]
  expect(controls.map(control => control.getAttribute("placeholder"))).toEqual([
    "lbid",
    "titel",
    "flera titlar separarade med nyrad"
  ])
  expect(controls[0]?.hasAttribute("autofocus")).toBe(true)
  expect(document.querySelector(".preloader")?.textContent?.trim()).toContain("Hämtar")
  expect(document.querySelector(".preloader .dots_blink")).not.toBeNull()
  expect(document.querySelector("table.table-striped")).not.toBeNull()
  expect(await lookupRequests(request)).toEqual([])
})

test("route work ID is normalized, SSR-rendered once, and uses the private base", async ({
  page,
  request
}) => {
  const response = await page.goto("/id/LB238704", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page.getByPlaceholder("lbid")).toHaveValue("lb238704")
  await expectRenderedRodaRummet(page)
  await page.waitForTimeout(100)
  expect(await lookupRequests(request)).toEqual([
    {
      path: "/private-v2/works/lookup",
      body: { work_id: "lb238704", titles: [] }
    }
  ])
})

test("route title is normalized, SSR-rendered once, and uses the private base", async ({
  page,
  request
}) => {
  const response = await page.goto("/id/R%C3%B6daRummet", {
    waitUntil: "networkidle"
  })
  expect(response?.status()).toBe(200)

  await expect(page.getByPlaceholder("titel")).toHaveValue("rödarummet")
  await expectRenderedRodaRummet(page)
  await page.waitForTimeout(100)
  const recorded = await lookupRequests(request)
  expect(recorded).toEqual([
    {
      path: "/private-v2/works/lookup",
      body: { work_id: null, titles: ["rödarummet"] }
    }
  ])
  expect(recorded.every(entry => entry.path !== "/v2/works/lookup")).toBe(true)
})

test("over-limit route values render the shell without requesting lookup", async ({
  request
}) => {
  const invalidWorkId = `lb${"x".repeat(99)}`
  const invalidTitle = "x".repeat(201)

  for (const value of [invalidWorkId, invalidTitle]) {
    const response = await request.get(`/id/${encodeURIComponent(value)}`)
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('placeholder="lbid"')
  }
  expect(await lookupRequests(request)).toEqual([])
})
