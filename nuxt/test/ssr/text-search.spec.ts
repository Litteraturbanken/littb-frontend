import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = "http://127.0.0.1:4100"

type TextSearchOperation = "results" | "count" | "options"
type RecordedRequest = {
  method: string
  path: string
  body: Record<string, unknown>
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_text_search/requests`),
    request.delete(`${fixture}/_text_search/failures`),
    request.delete(`${fixture}/_text_search/delays`),
    request.delete(`${fixture}/_requests`)
  ])
}

async function requests(
  request: APIRequestContext,
  operation: TextSearchOperation
): Promise<RecordedRequest[]> {
  const response = await request.get(`${fixture}/_text_search/requests/${operation}`)
  return (await response.json() as { requests: RecordedRequest[] }).requests
}

function compactText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? ""
}

const basicSearchBody = {
  query: "frihet",
  page: 1,
  page_size: 30,
  highlight_limit: 5,
  prefix: false,
  suffix: false,
  word_form_only: true,
  include_modernized: true
}

test.beforeEach(async ({ request }) => reset(request))

test("SSR renders the pristine full form without requesting search results", async ({
  request
}) => {
  const response = await request.get("/s%C3%B6k")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.title).toBe("Sök | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("Sök i Litteraturbankens verk")
  expect(document.body.className).toBe("focus page-search ready")
  expect(document.documentElement.getAttribute("style"))
    .toContain("/red/bilder/bakgrundsbilder/sok_bkg.jpg")
  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Sök i texterna")
  expect(document.querySelector<HTMLInputElement>(".submit_form input")?.value).toBe("")
  expect(document.querySelector(".search_opts_widget")?.textContent)
    .toContain("SÖK EFTER ORD ELLER FRAS")
  expect(document.querySelector(".chronology")?.textContent)
    .toContain("Tidslinje: kronologisk sökning")
  expect(document.querySelectorAll(".chronology_inputs input")).toHaveLength(2)
  const advanced = document.querySelector<HTMLButtonElement>("[data-search-advanced]")
  expect(advanced?.getAttribute("type")).toBe("button")
  expect(advanced?.getAttribute("title")).toBe("Utökad sökning")
  expect(document.querySelector("#results .results")).toBeNull()

  expect(await requests(request, "results")).toEqual([])
  expect(await requests(request, "count")).toEqual([])
  expect(html).not.toContain("private-v2")
  expect(html).not.toContain(fixture)
})

test("direct result SSR sends the exact generated body and renders the legacy rows", async ({
  request
}) => {
  const response = await request.get("/s%C3%B6k?fras=frihet")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.title).toBe('Sök: "frihet" | Litteraturbanken')
  expect(document.querySelectorAll("#results table.results tr")).toHaveLength(5)
  expect([...document.querySelectorAll("#results td.header")].map(node => compactText(node.textContent)))
    .toEqual([
      "Strindberg, August Röda rummet",
      "Lagerlöf, Selma Gösta Berlings saga"
    ])
  expect([...document.querySelectorAll("#results tr.sentence .match")].map(node => (
    node.textContent?.trim()
  ))).toEqual(["frihet", "frihet"])
  expect(document.querySelector("#results tr.is_faksimil")).not.toBeNull()
  expect(document.querySelector("#results .overflow .more")?.textContent?.trim()).toBe("Visa fler")
  const links = [...document.querySelectorAll<HTMLAnchorElement>("#results .match a")]
  expect(links[0]?.getAttribute("href")).toContain(
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/sida/1/etext?"
  )
  expect(links[0]?.getAttribute("href")).toContain("q=frihet")
  expect(document.querySelector(".littb_pager")).not.toBeNull()
  expect([...document.querySelectorAll(".navigator li")].map(node => compactText(node.textContent)))
    .toEqual(["Visa alla", "Strindberg, August", "Lagerlöf, Selma"])

  expect(await requests(request, "results")).toEqual([{
    method: "POST",
    path: "/private-v2/text-search/results",
    body: basicSearchBody
  }])
  expect(html).not.toContain("private-v2")
  expect(html).not.toContain(fixture)
  for (const rawField of ["author_id", "word_id", "page_name", "lbworkid", "author_facets"]) {
    expect(html, rawField).not.toContain(`"${rawField}":`)
  }
})

test("SSR preserves the no-hit copy and toolkit", async ({ request }) => {
  const response = await request.get("/s%C3%B6k?fras=inga")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(compactText(document.querySelector("#results")?.textContent))
    .toBe("Din sökning gav inga träffar")
  expect(document.querySelector("#results table.results")).not.toBeNull()
  expect(document.querySelectorAll("#results table.results tr")).toHaveLength(0)
  expect(document.querySelector(".littb_pager")).not.toBeNull()
  expect(document.querySelector(".navigator")).toBeNull()
})

test("advanced SSR resolves every selected label through its independent options request", async ({
  request
}) => {
  const route = "/s%C3%B6k?fras=frihet&avancerad&forfattare=StrindbergA" +
    "&titlar=lb238704&k%C3%B6n=female&languages=language:swe" +
    "&keywords=texttype:roman&authorkeyword=Lagerl%C3%B6fS&intervall=1879,1912"
  const response = await request.get(route)
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector("[data-search-root]")?.classList.contains("advanced")).toBe(true)
  expect(document.querySelector(".bottom_row")).not.toBeNull()
  expect(document.querySelector("[data-search-advanced]")?.getAttribute("title"))
    .toBe("Enkel sökning")
  expect(compactText(document.querySelector(
    ".auth_select_container .select2-selection__choice"
  )?.textContent)).toContain("Strindberg")
  expect(compactText(document.querySelector(
    ".left .title_select_container .select2-selection__choice"
  )?.textContent)).toContain("Röda rummet")
  expect(compactText(document.querySelector(
    ".about_select_container .select2-selection__choice"
  )?.textContent)).toContain("Lagerlöf")
  expect(compactText(document.querySelector(
    ".lang_select_container .select2-selection__choice"
  )?.textContent)).toContain("Svenska")
  expect(compactText(document.querySelector(
    ".right .title_select_container .select2-selection__choice"
  )?.textContent)).toContain("Romaner")
  expect(document.querySelector('select.gender_select option[value="female"]')
    ?.hasAttribute("selected")).toBe(true)
  expect([...document.querySelectorAll<HTMLInputElement>(".chronology_inputs input")]
    .map(input => input.value)).toEqual(["1879", "1912"])

  expect(await requests(request, "options")).toEqual([{
    method: "POST",
    path: "/private-v2/text-search/options",
    body: {
      query: "frihet",
      title_filter: "",
      title_limit: 30,
      include_static_options: true,
      selected_work_ids: ["lb238704"],
      prefix: false,
      suffix: false,
      word_form_only: true,
      include_modernized: true,
      author_ids: ["StrindbergA"],
      about_author_ids: ["LagerlöfS"],
      work_ids: ["lb238704"],
      gender: "female",
      year_from: 1879,
      year_to: 1912,
      languages: ["language:swe"],
      categories: ["texttype:roman"]
    }
  }])
})

test("a slow count never gates result SSR", async ({ request }) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "count", selector: "frihet", delay: 3000 }
  })
  const started = Date.now()
  const response = await request.get("/s%C3%B6k?fras=frihet")
  const elapsed = Date.now() - started

  expect(response.status()).toBe(200)
  expect(elapsed).toBeLessThan(2500)
  expect((await response.text())).toContain("Röda rummet")
  await expect.poll(async () => (await requests(request, "count")).length).toBe(1)
})

test("hydration reuses the SSR primary result without a duplicate request", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k?fras=frihet")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await page.waitForTimeout(500)
  expect(await requests(request, "results")).toHaveLength(1)
})

test("primary failure returns a redacted local 502", async ({ request }) => {
  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "results" } })
  const response = await request.get("/s%C3%B6k?fras=frihet")
  expect(response.status()).toBe(502)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(compactText(document.querySelector("[data-search-error]")?.textContent))
    .toBe("Sökresultatet kan inte visas just nu.")
  expect(document.querySelector("#results table.results")).toBeNull()
  expect(html).not.toContain("Unable to load text-search results")
  expect(html).not.toContain("text_search_results_unavailable")
  expect(html).not.toContain("private-v2")
  expect(html).not.toContain(fixture)
})
