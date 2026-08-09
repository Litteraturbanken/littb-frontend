import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

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

async function waitForHydration(page: Page) {
  await page.locator('[data-search-root][data-search-mounted="true"]').waitFor({
    state: "attached",
    timeout: 10_000
  })
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

test("direct result SSR returns the loading shell without starting expensive search work", async ({
  request
}) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 5000 }
  })
  const started = Date.now()

  const response = await request.get("/s%C3%B6k?fras=frihet")
  const elapsed = Date.now() - started
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(response.status()).toBe(200)
  expect(elapsed).toBeLessThan(2500)
  expect(document.querySelector<HTMLInputElement>(".submit_form input")?.value)
    .toBe("frihet")
  expect(document.querySelector(".submit_form .spinner")).not.toBeNull()
  expect(document.querySelector("#results table.results")).toBeNull()
  const globalSearchLink = [...document.querySelectorAll<HTMLAnchorElement>(".mainnav a")]
    .find(link => compactText(link.textContent) === "Sök i texterna")
  expect(globalSearchLink?.getAttribute("href")).toBe("/s%C3%B6k?fras=frihet")
  expect(document.querySelector("[data-search-error]")).toBeNull()
  expect(await requests(request, "results")).toEqual([])
  expect(await requests(request, "count")).toEqual([])
})

test("hydrated result sends the exact generated body and renders the legacy rows", async ({
  page,
  request
}) => {
  const response = await page.goto("/s%C3%B6k?fras=frihet")
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  const html = await page.content()
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
    path: "/v2/text-search/results",
    body: basicSearchBody
  }])
  expect(html).not.toContain("private-v2")
  expect(html).not.toContain(fixture)
  for (const rawField of ["author_id", "word_id", "page_name", "lbworkid", "author_facets"]) {
    expect(html, rawField).not.toContain(`"${rawField}":`)
  }
})

test("hydration preserves the no-hit copy and toolkit", async ({ page }) => {
  const response = await page.goto("/s%C3%B6k?fras=inga")
  expect(response?.status()).toBe(200)
  await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
  const { document } = parseHTML(await page.content())

  expect(compactText(document.querySelector("#results")?.textContent))
    .toBe("Din sökning gav inga träffar")
  expect(document.querySelector("#results table.results")).not.toBeNull()
  expect(document.querySelectorAll("#results table.results tr")).toHaveLength(0)
  expect(document.querySelector(".littb_pager")).not.toBeNull()
  expect(compactText(document.querySelector(".littb_pager")?.textContent))
    .toContain("Visar verk 0-0 av 0, sida 1 av 1.")
  expect(document.querySelector(".navigator")).toBeNull()
})

test("hydration replace-canonicalizes an accepted empty out-of-range result", async ({
  page,
  request
}) => {
  const response = await page.goto("/s%C3%B6k?fras=frihet&traffsida=2")
  expect(response?.status()).toBe(200)

  await expect.poll(() => new URL(page.url()).searchParams.has("traffsida")).toBe(false)
  const pager = page.locator("#toolkit .littb_pager")
  await expect(pager).toContainText("Visar verk 1-2 av 2, sida 1 av 1.")
  await expect(pager.getByRole("button", { name: "Nästa träffsida" })).toBeDisabled()
  await expect.poll(async () => (await requests(request, "results")).map(entry => entry.body.page))
    .toEqual([2, 1])
  await page.waitForTimeout(200)
  expect((await requests(request, "results")).map(entry => entry.body.page)).toEqual([2, 1])
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
  expect(document.querySelector(".gender_select")?.getAttribute("data-gender-value"))
    .toBe("female")
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

test("advanced SSR preserves chronology endpoints outside option bounds", async ({ request }) => {
  const response = await request.get(
    "/s%C3%B6k?fras=frihet&avancerad=1&intervall=1800,1900"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  const ranges = [...document.querySelectorAll<HTMLInputElement>(
    ".chronology_ranges input[type=range]"
  )]
  expect(ranges.map(input => [input.getAttribute("min"), input.getAttribute("max"), input.value])).toEqual([
    ["1800", "1940", "1800"],
    ["1800", "1940", "1900"]
  ])
  expect([...document.querySelectorAll<HTMLInputElement>(".chronology_inputs input")]
    .map(input => input.value)).toEqual(["1800", "1900"])
  expect((await requests(request, "options")).at(-1)?.body).toMatchObject({
    year_from: 1800,
    year_to: 1900
  })
})

test("a slow count never gates the hydrated primary result", async ({ page, request }) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "count", selector: "frihet", delay: 3000 }
  })
  const started = Date.now()
  const response = await page.goto("/s%C3%B6k?fras=frihet")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  const elapsed = Date.now() - started

  expect(response?.status()).toBe(200)
  expect(elapsed).toBeLessThan(2500)
  await expect.poll(async () => (await requests(request, "count")).length).toBe(1)
})

test("hydration starts the deferred primary result without a duplicate request", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k?fras=frihet")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await page.waitForTimeout(500)
  expect(await requests(request, "results")).toHaveLength(1)
})

test("primary failure keeps the shell 200 and renders a redacted local error", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "results" } })
  const response = await page.goto("/s%C3%B6k?fras=frihet")
  expect(response?.status()).toBe(200)
  await expect(page.locator("[data-search-error]")).toBeVisible()
  const html = await page.content()
  const { document } = parseHTML(html)

  expect(compactText(document.querySelector("[data-search-error]")?.textContent))
    .toBe("Sökresultatet kan inte visas just nu.")
  expect(document.querySelector("#results table.results")).toBeNull()
  expect(html).not.toContain("Unable to load text-search results")
  expect(html).not.toContain("text_search_results_unavailable")
  expect(html).not.toContain("private-v2")
  expect(html).not.toContain(fixture)
})

test("Reader hit indices restart for every work and every hydrated result page", async ({
  page
}) => {
  for (const route of [
    "/s%C3%B6k?fras=frihet",
    "/s%C3%B6k?fras=overflow&traffsida=2"
  ]) {
    const response = await page.goto(route)
    expect(response?.status()).toBe(200)
    await expect(page.locator("#results .match a")).toHaveCount(2)
    const { document } = parseHTML(await page.content())
    const links = [...document.querySelectorAll<HTMLAnchorElement>("#results .match a")]
      .map(link => new URL(link.getAttribute("href")!, "http://litteraturbanken.test"))

    expect(links.map(link => link.searchParams.get("hit"))).toEqual(["0", "0"])
    expect(links.map(link => link.searchParams.get("hit_index"))).toEqual(["0", "0"])
    expect(links.map(link => link.searchParams.get("s_page"))).toEqual([
      route.includes("traffsida=2") ? "2" : "1",
      route.includes("traffsida=2") ? "2" : "1"
    ])
  }
})

test("the client-only count is requested once and displayed after hydration", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "count", selector: "frihet", delay: 1800 }
  })

  await page.goto("/s%C3%B6k?fras=frihet")
  await expect(page.locator("#results .match").first()).toHaveText("frihet")
  await expect(page.locator(".hits_info .hits")).toHaveText("3", { timeout: 6000 })
  await expect.poll(async () => (await requests(request, "count")).length).toBe(1)
})

test("failed and aborted options ownership retries on route re-entry", async ({ page, request }) => {
  await request.put(`${fixture}/_text_search/failures`, {
    data: { operation: "options" }
  })
  await page.goto("/s%C3%B6k?fras=inga&avancerad")
  await waitForHydration(page)
  await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
  await request.delete(`${fixture}/_text_search/failures/options`)

  await page.locator("[data-search-advanced]").click()
  await expect(page.locator("[data-search-root]")).not.toHaveClass(/advanced/)
  await page.locator("[data-search-advanced]").click()
  await expect(page.locator("[data-search-root]")).toHaveClass(/advanced/)
  await expect.poll(async () => (await requests(request, "options")).length).toBe(3)

  await page.getByRole("button", { name: "Visa alternativ för Författarskap" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
  await page.keyboard.press("Escape")

  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "", delay: 1500 }
  })
  await page.locator("[data-search-advanced]").click()
  await expect(page.locator("[data-search-root]")).not.toHaveClass(/advanced/)
  await page.getByLabel("Sökfras").fill("abort-options")
  await page.getByRole("button", { name: "Sök", exact: true }).click()
  await expect(page).toHaveURL(/fras=abort-options/)
  await page.locator("[data-search-advanced]").click()
  await expect(page.locator("[data-search-root]")).toHaveClass(/advanced/)
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await page.locator("[data-search-advanced]").click()
  await expect(page.locator("[data-search-root]")).not.toHaveClass(/advanced/)
  await page.locator("[data-search-advanced]").click()
  await expect(page.locator("[data-search-root]")).toHaveClass(/advanced/)
  await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
})

test("Visa fler is work-scoped and route changes discard expanded hrefs", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k?fras=overflow")
  await waitForHydration(page)
  await page.locator("#results .overflow .more").nth(1).click()

  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  expect((await requests(request, "results"))[1]).toEqual({
    method: "POST",
    path: "/v2/text-search/results",
    body: {
      query: "overflow",
      page: 1,
      page_size: 30,
      highlight_limit: 100,
      prefix: false,
      suffix: false,
      word_form_only: true,
      include_modernized: true,
      work_ids: ["lb278171"]
    }
  })
  await expect(page.locator("#results tr.is_faksimil.sentence .match")).toHaveCount(2)

  const nextSearchPage = page.getByRole("button", { name: "Nästa träffsida" })
  await expect(nextSearchPage).not.toHaveAttribute("rel")
  await nextSearchPage.click()
  await expect(page).toHaveURL(/traffsida=2/)
  await expect(page.locator("#results")).not.toHaveClass(/searching/)
  await expect(page.locator("#results tr.is_faksimil.sentence .match")).toHaveCount(1)
  const href = await page.locator("#results tr.is_faksimil.sentence .match a").getAttribute("href")
  const reader = new URL(href!, "http://litteraturbanken.test")
  expect(reader.searchParams.get("hit")).toBe("0")
  expect(reader.searchParams.get("hit_index")).toBe("0")
  expect(reader.searchParams.get("s_page")).toBe("2")
})

test("rapid primary navigation aborts the old request and rejects stale data", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k")
  await waitForHydration(page)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 2000 }
  })
  const aborted = new Promise<string>(resolve => {
    page.on("requestfailed", failedRequest => {
      if (failedRequest.url().endsWith("/text-search/results")
        && failedRequest.postData()?.includes('"query":"frihet"')) {
        resolve(failedRequest.failure()?.errorText ?? "")
      }
    })
  })

  await page.getByLabel("Sökfras").fill("frihet")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  await page.getByLabel("Sökfras").fill("inga")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())

  await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
  expect(await Promise.race([
    aborted,
    new Promise(resolve => setTimeout(() => resolve("not-aborted"), 2500))
  ])).not.toBe("not-aborted")
  await page.waitForTimeout(2100)
  await expect(page.locator("#results td.header")).toHaveCount(0)
})

test("rapid A to B to A navigation refetches an aborted primary identity", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k")
  await waitForHydration(page)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 1800 }
  })

  await page.getByLabel("Sökfras").fill("frihet")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)

  await page.getByLabel("Sökfras").fill("inga")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 0 }
  })

  await page.getByLabel("Sökfras").fill("frihet")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect.poll(async () => (await requests(request, "results")).length).toBe(3)
  expect((await requests(request, "results")).map(entry => entry.body.query))
    .toEqual(["frihet", "inga", "frihet"])
})

test("a failed primary identity retries on history re-entry", async ({ page, request }) => {
  await request.put(`${fixture}/_text_search/failures`, {
    data: { operation: "results" }
  })
  await page.goto("/s%C3%B6k?fras=frihet")
  await waitForHydration(page)
  await expect(page.locator("[data-search-error]")).toBeVisible()
  await request.delete(`${fixture}/_text_search/failures/results`)

  await page.getByLabel("Sökfras").fill("inga")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  expect((await requests(request, "results")).map(entry => entry.body.query))
    .toEqual(["frihet", "inga", "frihet"])
})

test("advanced no-query SSR requests and renders static options", async ({ page, request }) => {
  await page.goto("/s%C3%B6k?avancerad")
  await waitForHydration(page)

  expect(await requests(request, "results")).toEqual([])
  expect(await requests(request, "count")).toEqual([])
  expect(await requests(request, "options")).toEqual([{
    method: "POST",
    path: "/private-v2/text-search/options",
    body: {
      title_filter: "",
      title_limit: 30,
      include_static_options: true,
      prefix: false,
      suffix: false,
      word_form_only: true,
      include_modernized: true
    }
  }])
  await expect(page.locator(".chronology_ranges input").first()).toHaveAttribute("min", "1849")
  await expect(page.locator(".chronology_ranges input").first()).toHaveAttribute("max", "1940")

  await page.getByRole("button", { name: "Visa alternativ för Författarskap" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Visa alternativ för Om ett författarskap" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: /Strindberg, August/ })).toHaveCount(1)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Visa alternativ för Titlar" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: "Röda rummet" })).toHaveCount(1)
})

test("route navigation cancels a queued title query before it starts", async ({ page, request }) => {
  await page.goto("/s%C3%B6k?fras=frihet&avancerad")
  await waitForHydration(page)
  await request.delete(`${fixture}/_text_search/requests/options`)

  const titleInput = page.locator(".title_select input.select2-search__field")
  await titleInput.fill("lager")
  await titleInput.dispatchEvent("change")
  await page.getByLabel("Sökfras").fill("inga")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect(page).toHaveURL(/fras=inga/)
  await page.waitForTimeout(500)

  const optionRequests = await requests(request, "options")
  expect(optionRequests).toHaveLength(1)
  expect(optionRequests[0]?.body.title_filter).toBe("")
  expect(optionRequests[0]?.body.query).toBe("inga")
})

test("route navigation aborts active title work and clears its spinner and stale choices", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k?fras=frihet&avancerad")
  await waitForHydration(page)
  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "lager", delay: 1500 }
  })
  const aborted = new Promise<string>(resolve => {
    page.on("requestfailed", failedRequest => {
      if (failedRequest.url().endsWith("/text-search/options")
        && failedRequest.postData()?.includes('"title_filter":"lager"')) {
        resolve(failedRequest.failure()?.errorText ?? "")
      }
    })
  })

  const titleInput = page.locator(".title_select input.select2-search__field")
  await titleInput.fill("lager")
  await titleInput.dispatchEvent("change")
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await expect(page.locator(".title_select .spinner")).toBeVisible()

  await page.getByLabel("Sökfras").fill("inga")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect(page).toHaveURL(/fras=inga/)
  await expect(page.locator(".title_select .spinner")).toBeHidden()
  expect(await Promise.race([
    aborted,
    new Promise(resolve => setTimeout(() => resolve("not-aborted"), 2000))
  ])).not.toBe("not-aborted")

  await page.waitForTimeout(1600)
  await page.getByRole("button", { name: "Visa alternativ för Titlar" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: "Röda rummet" })).toHaveCount(1)
  await expect(page.getByRole("option", { name: "Gösta Berlings saga" })).toHaveCount(1)
})

test("pending primary navigation fades the committed table and current failure clears it", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k?fras=frihet")
  await waitForHydration(page)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "overflow", delay: 1200 }
  })

  await page.getByLabel("Sökfras").fill("overflow")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect(page.locator("#results")).toHaveClass(/searching/)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect(page.locator("#results td.header").first())
    .toHaveCSS("opacity", "0.2")
  await expect(page.locator("#results")).not.toHaveClass(/searching/, { timeout: 5000 })

  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "results" } })
  await page.getByLabel("Sökfras").fill("current-failure")
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
  await expect(page.locator("[data-search-error]")).toHaveText(
    "Sökresultatet kan inte visas just nu."
  )
  await expect(page.locator("#results table.results")).toHaveCount(0)
})

test("ordinary and about-author controls keep their backend option sets distinct", async ({
  page
}) => {
  await page.goto("/s%C3%B6k?fras=inga&avancerad")
  await waitForHydration(page)
  await page.getByRole("button", { name: "Visa alternativ för Författarskap" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
  await expect(page.getByRole("option", { name: /Strindberg, August/ })).toHaveCount(0)
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Visa alternativ för Om ett författarskap" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: /Strindberg, August/ })).toHaveCount(1)
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(0)
})

test("search mode clicks serialize Angular-compatible mutually exclusive combinations", async ({
  page
}) => {
  await page.goto("/s%C3%B6k?fras=frihet")
  await waitForHydration(page)
  const params = () => new URL(page.url()).searchParams
  const clickMode = (name: string) => page.getByRole("button", { name, exact: true }).click()

  await clickMode("SÖK EFTER ORDBÖRJAN")
  await expect.poll(() => params().get("prefix")).toBe("1")
  expect(params().get("ej_modern")).toBe("1")
  expect(params().has("lemma")).toBe(false)

  await clickMode("SÖK EFTER ORDSLUT")
  await expect.poll(() => params().get("suffix")).toBe("1")
  expect(params().get("prefix")).toBe("1")
  expect(params().has("infix")).toBe(false)

  await clickMode("SÖK EFTER DEL AV ORD")
  await expect.poll(() => params().get("infix")).toBe("1")
  expect(params().has("prefix")).toBe(false)
  expect(params().has("suffix")).toBe(false)
  expect(params().get("ej_modern")).toBe("1")

  await clickMode("SÖK EFTER DEL AV ORD")
  await expect.poll(() => params().has("infix")).toBe(false)
  expect(params().has("prefix")).toBe(false)
  expect(params().has("suffix")).toBe(false)
  expect(params().has("lemma")).toBe(false)
  expect(params().get("ej_modern")).toBe("1")

  await clickMode("INKLUDERA BÖJNINGSFORMER")
  await expect.poll(() => params().get("lemma")).toBe("1")
  expect(params().get("ej_modern")).toBe("1")
  expect(params().has("prefix")).toBe(false)

  await clickMode("INKLUDERA ÄLDRE STAVNINGSFORMER")
  await expect.poll(() => params().has("lemma")).toBe(false)
  expect(params().has("ej_modern")).toBe(false)
  expect(params().has("prefix")).toBe(false)
  expect(params().has("suffix")).toBe(false)
})

test("chronology text and bounded range drafts commit only valid ascending pairs", async ({
  page
}) => {
  await page.goto("/s%C3%B6k?fras=frihet&avancerad")
  await waitForHydration(page)
  const ranges = page.locator(".chronology_ranges input[type='range']")
  const texts = page.locator(".chronology_inputs input[type='text']")
  const textValues = () => texts.evaluateAll(inputs => (
    inputs.map(input => (input as HTMLInputElement).value)
  ))

  await expect(ranges).toHaveCount(2)
  await expect(ranges.nth(0)).toHaveAttribute("min", "1849")
  await expect(ranges.nth(0)).toHaveAttribute("max", "1940")
  await expect(ranges.nth(1)).toHaveAttribute("min", "1849")
  await expect(ranges.nth(1)).toHaveAttribute("max", "1940")
  await expect.poll(textValues).toEqual(["1849", "1940"])

  await texts.nth(1).fill("1840")
  await texts.nth(1).blur()
  expect(new URL(page.url()).searchParams.has("intervall")).toBe(false)
  await expect.poll(textValues).toEqual(["1849", "1940"])

  await ranges.nth(0).evaluate((input: HTMLInputElement) => {
    input.value = "1900"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await ranges.nth(1).evaluate((input: HTMLInputElement) => {
    input.value = "1910"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1900,1910")
  await expect.poll(textValues).toEqual(["1900", "1910"])

  await texts.nth(0).fill("1920")
  await texts.nth(0).blur()
  expect(new URL(page.url()).searchParams.get("intervall")).toBe("1900,1910")
  await expect.poll(textValues).toEqual(["1900", "1910"])
})

test("pager page input opens and navigates only within inclusive bounds", async ({ page }) => {
  await page.goto("/s%C3%B6k?fras=overflow")
  await waitForHydration(page)
  const toggle = page.getByRole("button", { name: "Gå till träffsida . . ." })
  await toggle.click()
  const item = toggle.locator("xpath=..")
  const input = item.locator("input")
  await expect(item).toHaveClass(/open/)
  await expect(input).toBeVisible()

  await input.fill("0")
  await input.press("Enter")
  expect(new URL(page.url()).searchParams.has("traffsida")).toBe(false)
  await expect(item).toHaveClass(/open/)
  await input.fill("4")
  await input.press("Enter")
  expect(new URL(page.url()).searchParams.has("traffsida")).toBe(false)

  await input.fill("3")
  await input.press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("3")
  await expect(page.locator(".littb_pager .ctrl li.open")).toHaveCount(0)

  await page.getByRole("button", { name: "Gå till träffsida . . ." }).click()
  const boundary = page.locator(".littb_pager .ctrl li.open input")
  await boundary.fill("1")
  await boundary.press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.has("traffsida")).toBe(false)
})

test("absent and explicit all gender both show all authors without a backend filter", async ({
  page,
  request
}) => {
  await page.goto("/s%C3%B6k?fras=frihet&avancerad&k%C3%B6n=all")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  const { document } = parseHTML(await page.content())
  expect(document.querySelector(".gender_select")?.getAttribute("data-gender-value"))
    .toBe("all")
  expect((await requests(request, "results"))[0]?.body).not.toHaveProperty("gender")

  await reset(request)
  await page.goto("/s%C3%B6k?fras=frihet&avancerad")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  const absentDocument = parseHTML(await page.content()).document
  expect(absentDocument.querySelector(".gender_select")?.getAttribute("data-gender-value"))
    .toBe("all")
  expect((await requests(request, "results"))[0]?.body).not.toHaveProperty("gender")

  await reset(request)
  await page.goto("/s%C3%B6k?fras=frihet&avancerad&k%C3%B6n=female")
  await waitForHydration(page)
  const gender = page.locator(".gender_select")
  await gender.getByRole("button").click()
  await gender.getByRole("option", { name: "Alla författare" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has("kön")).toBe(false)
  await expect(page.locator(".gender_select")).toHaveAttribute("data-gender-value", "all")
})

test("result and overflow rows keep flattened Angular parity and media classes", async ({
  page
}) => {
  await page.goto("/s%C3%B6k?fras=frihet")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  const { document } = parseHTML(await page.content())
  const rows = [...document.querySelectorAll("#results table.results tr")]
  expect(rows.map(row => [...row.classList].sort())).toEqual([
    ["even"],
    ["odd", "sentence"],
    ["even", "is_faksimil"],
    ["is_faksimil", "odd", "sentence"],
    ["even", "is_faksimil", "sentence"]
  ])
  expect(rows[4]?.querySelector(".overflow .more")?.textContent?.trim()).toBe("Visa fler")
})

test("zero count preserves hits_info but hides zero hit labels", async ({ page }) => {
  await page.goto("/s%C3%B6k?fras=inga")
  await waitForHydration(page)
  await expect(page.locator(".hits_info")).toHaveCount(1)
  await page.waitForTimeout(100)
  await expect(page.locator(".hits_info .hits")).toHaveCount(1)
  await expect(page.locator(".hits_info .hits_sub")).toHaveCount(1)
  await expect(page.locator(".hits_info .hits")).toBeHidden()
  await expect(page.locator(".hits_info .hits_sub")).toBeHidden()
})
