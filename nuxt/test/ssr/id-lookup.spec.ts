import { expect, test, type APIRequestContext } from "@playwright/test"
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

function expectRenderedRodaRummet(html: string) {
  const { document } = parseHTML(html)
  const row = document.querySelector(".table-striped tbody tr")
  const cells = [...row?.querySelectorAll("td") ?? []]
  expect(cells).toHaveLength(4)
  expect(cells[0]?.textContent).toBe("lb238704")
  expect(cells[1]?.querySelector("a")?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/StrindbergA")
  expect(cells[2]?.querySelector("a")?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/etext")
  const formatLinks = [...cells[3]?.querySelectorAll("a") ?? []]
  expect(formatLinks.map(link => link.getAttribute("href"))).toEqual([
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/etext",
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/faksimil"
  ])
  expect(cells[3]?.textContent).toBe("etext:::faksimil")
  return document
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
  expect(controls.map(control => document.querySelector(
    `label[for="${control.id}"]`
  )?.textContent)).toEqual(["LB-ID", "Titel", "Flera titlar, en per rad"])
  expect(controls[0]?.hasAttribute("autofocus")).toBe(true)
  const status = document.querySelector('.preloader[role="status"]')
  expect(status?.getAttribute("aria-live")).toBe("polite")
  expect(status?.querySelector(".dots_blink")).not.toBeNull()
  expect(status?.querySelector(".sr-only")?.textContent).toBe("")
  const table = document.querySelector("table.table-striped")
  expect(table?.querySelector("caption")?.textContent).toBe("Sökresultat för verk")
  expect([...table?.querySelectorAll('th[scope="col"]') ?? []].map(header => (
    header.textContent
  ))).toEqual(["LB-ID", "Författare", "Titel", "Format"])
  expect(await lookupRequests(request)).toEqual([])
})

test("route work ID is normalized, SSR-rendered once, and uses the private base", async ({
  request
}) => {
  const response = await request.get("/id/LB238704")
  expect(response.status()).toBe(200)
  const document = expectRenderedRodaRummet(await response.text())
  expect(document.querySelector('input[placeholder="lbid"]')?.getAttribute("value"))
    .toBe("lb238704")
  expect(await lookupRequests(request)).toEqual([
    {
      path: "/private-v2/works/lookup",
      body: { work_id: "lb238704", titles: [] }
    }
  ])
})

test("route title is normalized, SSR-rendered once, and uses the private base", async ({
  request
}) => {
  const response = await request.get("/id/R%C3%B6daRummet")
  expect(response.status()).toBe(200)
  const document = expectRenderedRodaRummet(await response.text())
  expect(document.querySelector('input[placeholder="titel"]')?.getAttribute("value"))
    .toBe("rödarummet")
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
