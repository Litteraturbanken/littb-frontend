import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { dramawebbenCatalogExpected } from "../fixtures/dramawebben-catalog-data.mjs"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const legacyDescription = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_dramawebben_document_requests`),
    request.delete(`${fixture}/_dramawebben_document_failure`),
    request.delete(`${fixture}/_dramawebben_document_redirect_target_requests`),
    request.delete(`${fixture}/_dramawebben_excluded_data_requests`),
    request.delete(`${fixture}/_dramawebben_catalog_requests`),
    request.delete(`${fixture}/_dramawebben_catalog_failure`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_source_info_static_requests`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_failure`)
  ])
}

async function documentRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_dramawebben_document_requests`
  )).json()).requests
}

async function expectNoExcludedDataRequests(request: APIRequestContext) {
  expect((await (await request.get(
    `${fixture}/_dramawebben_excluded_data_requests`
  )).json()).requests).toEqual([])
}

async function catalogRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_dramawebben_catalog_requests`
  )).json()).requests
}

async function sourceInfoRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_source_info_requests`
  )).json()).requests
}

async function expectOneCatalogRequest(request: APIRequestContext) {
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  await expectNoExcludedDataRequests(request)
}

async function expectPlayRows(page: Page, rows: readonly string[]) {
  await expect(page.locator("table.contenttable:not(.authors) tr")).toHaveText([...rows])
}

async function expectAuthorRows(page: Page, rows: readonly string[]) {
  await expect(page.locator("table.contenttable.authors tr")).toHaveText([...rows])
}

async function expectQuery(page: Page, key: string, value: string | null) {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value)
}

async function setCatalogFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_dramawebben_catalog_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

async function routerPush(page: Page, path: string) {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: { $router: { push: (path: string) => Promise<void> } }
        }
      }
    }
    await root.__vue_app__?.config.globalProperties.$router.push(target)
  }, path)
}

function collectProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration|unhandled/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

async function expectExactLinks(page: Page, kind: "pjäser" | "om" | "kringtexter") {
  await expect(page.locator(".subpage ul.links a")).toHaveText([
    "Pjäser", "Mer läsning", "Sök", "Om", "Till Litteraturbanken"
  ])
  expect(await page.locator(".subpage ul.links a").evaluateAll(links => links.map(link => ({
    href: link.getAttribute("href"),
    text: link.textContent?.replace(/\s+/gu, " ").trim()
  })))).toEqual([
    { href: "/dramawebben/pjäser", text: "Pjäser" },
    { href: "/dramawebben/kringtexter", text: "Mer läsning" },
    { href: "/s%C3%B6k?avancerad&keywords=keyword:Dramawebben", text: "Sök" },
    { href: "/dramawebben/om", text: "Om" },
    { href: "/", text: "Till Litteraturbanken" }
  ])
  await expect(page.locator(".subpage ul.links li.active a")).toHaveCount(
    kind === "om" ? 0 : 1
  )
  if (kind !== "om") {
    await expect(page.locator(".subpage ul.links li.active a"))
      .toHaveAttribute("href", `/dramawebben/${kind}`)
  }
}

test.beforeEach(async ({ request }) => reset(request))

for (const documentCase of [
  {
    kind: "om",
    route: "/dramawebben/om",
    heading: "Om Dramawebben",
    source: "/red/dramawebben/om.html"
  },
  {
    kind: "kringtexter",
    route: "/dramawebben/kringtexter",
    heading: "Mer läsning om svensk dramatik",
    source: "/red/dramawebben/kringtexter/kringtexter.html"
  }
] as const) {
  test(`hydrates ${documentCase.kind} once with the exact shell and links`, async ({
    page,
    request
  }) => {
    const problems = collectProblems(page)
    await page.goto(documentCase.route, { waitUntil: "networkidle" })

    await expect(page).toHaveTitle("Litteraturbanken")
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      legacyDescription
    )
    await expect(page.locator("body")).toHaveClass(
      "focus page-dramaweb drama-dramasubpage ready"
    )
    await expect(page.locator("#mainview > .cover.show")).toHaveCount(1)
    await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
    await expect(page.locator(".subpage .logo h2")).toBeHidden()
    await expect(page.getByRole("heading", { name: documentCase.heading, exact: true }))
      .toBeVisible()
    await expectExactLinks(page, documentCase.kind)
    expect(await documentRequests(request)).toEqual([{
      method: "GET",
      path: documentCase.source,
      authorization: null,
      cookie: null
    }])
    await expectNoExcludedDataRequests(request)
    expect(problems).toEqual([])
  })
}

test("query-only history preserves the managed identity without refetching", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  const initialRequests = await documentRequests(request)

  const queryPath = "/dramawebben/om?repeat=one&repeat=two&unknown=%2F"
  await routerPush(page, queryPath)
  await expect(page).toHaveURL(new RegExp(`${queryPath.replace(/[?]/gu, "\\?")}$`, "u"))
  await expect(page.getByRole("heading", { name: "Om Dramawebben", exact: true })).toBeVisible()
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goBack()
  await expect(page).toHaveURL(/\/dramawebben\/om$/u)
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goForward()
  await expect(page).toHaveURL(/repeat=one&repeat=two&unknown=%2F$/u)
  expect(await documentRequests(request)).toEqual(initialRequests)
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("om and kringtexter navigation accepts only the current document identity", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  await routerPush(page, "/dramawebben/kringtexter")

  await expect(page).toHaveURL(/\/dramawebben\/kringtexter$/u)
  await expect(page.getByRole("heading", {
    name: "Mer läsning om svensk dramatik",
    exact: true
  })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Om Dramawebben", exact: true }))
    .toHaveCount(0)
  expect(await documentRequests(request)).toEqual([
    {
      method: "GET",
      path: "/red/dramawebben/om.html",
      authorization: null,
      cookie: null
    },
    {
      method: "GET",
      path: "/red/dramawebben/kringtexter/kringtexter.html",
      authorization: null,
      cookie: null
    }
  ])
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("a delayed om response cannot replace the latest kringtexter identity", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben", { waitUntil: "networkidle" })

  let releaseOm!: () => void
  const omGate = new Promise<void>(resolve => { releaseOm = resolve })
  let omRequested!: () => void
  const omStarted = new Promise<void>(resolve => { omRequested = resolve })
  await page.route("**/api/dramawebben/documents/om", async route => {
    omRequested()
    await omGate
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        documentKind: "om",
        bodyHtml: "<h2>Om Dramawebben</h2><p>late-om-probe</p>"
      })
    })
  })

  const slowOm = routerPush(page, "/dramawebben/om")
  await omStarted
  await expect(page.locator(".page_content")).not.toContainText("late-om-probe")

  await routerPush(page, "/dramawebben/kringtexter")
  await expect(page.getByRole("heading", {
    name: "Mer läsning om svensk dramatik",
    exact: true
  })).toBeVisible()
  releaseOm()
  await slowOm
  await page.waitForTimeout(100)

  await expect(page).toHaveURL(/\/dramawebben\/kringtexter$/u)
  await expect(page.locator(".page_content")).not.toContainText("late-om-probe")
  await expect(page.locator(".error")).toHaveCount(0)
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("a malformed successful document is redacted inside the stable latest shell", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  await page.route("**/api/dramawebben/documents/kringtexter", route => route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ documentKind: "kringtexter", bodyHtml: 42 })
  }))

  await routerPush(page, "/dramawebben/kringtexter")
  await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
  await expect(page.locator(".error")).toHaveText("Innehållet kan inte visas just nu.")
  await expect(page.locator(".page_content")).not.toContainText("Om Dramawebben")
  await expectExactLinks(page, "kringtexter")
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("the catalog hydrates once from SSR without a browser or legacy data request", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const browserCatalogRequests: string[] = []
  page.on("request", outgoing => {
    if (new URL(outgoing.url()).pathname === "/api/v2/dramawebben/catalog") {
      browserCatalogRequests.push(outgoing.url())
    }
  })
  const response = await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toHaveClass(
    "focus page-dramaweb drama-dramasubpage ready"
  )
  await expect(page.locator("#mainview > .cover.show")).toHaveCount(1)
  await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
  await expectExactLinks(page, "pjäser")
  await expect(page.locator("table.contenttable:not(.authors) tr")).toHaveText(
    dramawebbenCatalogExpected.plays
  )
  expect(browserCatalogRequests).toEqual([])
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  expect(await documentRequests(request)).toEqual([])
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("a visible infopost link opens source information and close restores its focus", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser?visa=pjäser&keep=one&keep=two", {
    waitUntil: "networkidle"
  })

  const trigger = page.getByRole("link", { name: "infopost", exact: true })
  await trigger.click()

  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("Barnens teater")
  await expect(dialog).toBeFocused()
  expect(new URL(page.url()).hash).toBe("#dw")
  expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["one", "two"])
  await expect.poll(() => new URL(page.url()).searchParams.has("om-boken")).toBe(true)

  await page.getByRole("button", { name: "Stäng", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  const closed = new URL(page.url())
  expect(closed.searchParams.getAll("keep")).toEqual(["one", "two"])
  expect(closed.searchParams.has("om-boken")).toBe(false)
  expect(closed.searchParams.has("authorid")).toBe(false)
  expect(closed.searchParams.has("titlepath")).toBe(false)
  expect(closed.hash).toBe("#dw")
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("a long mixed-author catalog uses the clicked infopost identity without scrolling", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await setCatalogFailure(request, "long-mixed-media-author-200")
  await page.setViewportSize({ width: 1280, height: 420 })
  await page.goto("/dramawebben/pj%C3%A4ser?visa=pj%C3%A4ser&keep=scroll", {
    waitUntil: "networkidle"
  })

  const trigger = page.getByRole("link", { name: "infopost", exact: true })
  await trigger.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(500)

  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog).toContainText("Barnens teater")
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
  const hashTarget = page.locator("#dw")
  await expect(hashTarget).toHaveCount(1)
  expect(await hashTarget.evaluate(element => {
    const style = getComputedStyle(element)
    const bounds = element.getBoundingClientRect()
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      width: bounds.width,
      height: bounds.height,
      ariaHidden: element.getAttribute("aria-hidden")
    }
  })).toEqual({
    position: "fixed",
    pointerEvents: "none",
    width: 0,
    height: 0,
    ariaHidden: "true"
  })
  const opened = new URL(page.url())
  expect(opened.hash).toBe("#dw")
  expect(opened.searchParams.get("keep")).toBe("scroll")
  expect(opened.searchParams.get("authorid")).toBe("Anonym")
  expect(opened.searchParams.get("titlepath")).toBe("BarnensTeater")

  await page.getByRole("button", { name: "Stäng", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
  const closed = new URL(page.url())
  expect(closed.hash).toBe("#dw")
  expect(closed.searchParams.get("keep")).toBe("scroll")
  expect(closed.searchParams.has("om-boken")).toBe(false)
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/Anonym/BarnensTeater/source-info",
    query: ""
  }])
  expect(problems).toEqual([])
})

test("direct source-information query survives hydration, Escape, Back, and Forward", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const openPath = "/dramawebben/pjäser?om-boken&authorid=Alml%C3%B6fN" +
    "&titlepath=Affarer&visa=f%C3%B6rfattare&repeat=one&repeat=two#dw"
  await page.goto(openPath, { waitUntil: "networkidle" })

  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog).toContainText("Affärer")
  await expect(dialog).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  expect(new URL(page.url()).searchParams.getAll("repeat")).toEqual(["one", "two"])

  await page.goBack()
  await expect(dialog).toContainText("Affärer")
  await page.goForward()
  await expect(dialog).toHaveCount(0)
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("invalid or missing source-information identifiers stay closed without a request", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  for (const path of [
    "/dramawebben/pj%C3%A4ser?om-boken&authorid=Alml%C3%B6fN",
    "/dramawebben/pj%C3%A4ser?om-boken&authorid=..%2Fbad&titlepath=Affarer",
    "/dramawebben/pj%C3%A4ser?om-boken=&authorid=Alml%C3%B6fN&titlepath=Affarer"
  ]) {
    await routerPush(page, path)
    await expect(page.getByRole("dialog", { name: "Om boken", exact: true })).toHaveCount(0)
  }
  expect(await sourceInfoRequests(request)).toEqual([])

  await routerPush(
    page,
    "/dramawebben/pj%C3%A4ser?om-boken=yes&authorid=Alml%C3%B6fN&titlepath=Affarer"
  )
  await expect(page.getByRole("dialog", { name: "Om boken", exact: true }))
    .toContainText("Affärer")
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("a source-information failure remains modal-local and retries from history", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await request.put(`${fixture}/_source_info_failure`)
  const openPath = "/dramawebben/pj%C3%A4ser?om-boken&authorid=Alml%C3%B6fN&titlepath=Affarer"
  const response = await page.goto(openPath, { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog.getByRole("alert")).toHaveText("Ett fel har uppstått.")
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await request.delete(`${fixture}/_source_info_failure`)
  await page.goBack()
  await expect(dialog).toContainText("Affärer")
  expect(await sourceInfoRequests(request)).toHaveLength(2)
  expect(problems).toEqual([])
})

test("the list toggle pushes query-owned history and Back/Forward restores each table", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)
  await expect(page.getByRole("button", { name: "Pjäser", exact: true })).toHaveClass(/\bactive\b/u)
  await expect(page.getByRole("button", { name: "Författare", exact: true }))
    .not.toHaveClass(/\bactive\b/u)

  await page.getByRole("button", { name: "Författare", exact: true }).click()
  await expectQuery(page, "visa", "författare")
  await expectAuthorRows(page, dramawebbenCatalogExpected.authors)
  await expect(page.getByRole("button", { name: "Författare", exact: true }))
    .toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "Pjäser", exact: true }))
    .not.toHaveClass(/\bactive\b/u)
  await expect(page.getByRole("button", { name: "Författare", exact: true }))
    .toHaveClass(/\bactive\b/u)

  await page.goBack()
  await expectQuery(page, "visa", null)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)

  await page.goForward()
  await expectQuery(page, "visa", "författare")
  await expectAuthorRows(page, dramawebbenCatalogExpected.authors)

  await expectOneCatalogRequest(request)
  expect(problems).toEqual([])
})

test("every legacy catalog filter is query-owned, local, inclusive, and clearable", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })
  const clear = page.getByRole("button", { name: "Rensa filter", exact: true })

  await page.getByRole("button", { name: "Visa författare", exact: true }).click()
  await page.getByRole("option", { name: "Strindberg, August 1849-1912" }).click()
  await expectQuery(page, "author", "StrindbergA")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])
  await clear.click()
  await expectQuery(page, "author", null)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)

  await page.getByRole("button", { name: "Kön", exact: true }).click()
  await page.getByRole("option", { name: "Kvinnliga författare", exact: true }).click()
  await expectQuery(page, "gender", "female")
  await expectPlayRows(page, [
    dramawebbenCatalogExpected.plays[0]!,
    dramawebbenCatalogExpected.plays[3]!
  ])
  await clear.click()

  await page.getByRole("button", { name: "Utgivningsformat", exact: true }).click()
  await page.getByRole("option", { name: "PDF", exact: true }).click()
  await expectQuery(page, "mediatype", "pdf")
  await expectPlayRows(page, [
    dramawebbenCatalogExpected.plays[0]!,
    dramawebbenCatalogExpected.plays[2]!
  ])
  await clear.click()

  await page.getByRole("textbox", { name: "Sök", exact: true }).fill("AUGUST 1888")
  await expectQuery(page, "filterTxt", "AUGUST 1888")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])
  await clear.click()

  const rangeButton = page.getByRole("button", { name: "Akter och roller", exact: true })
  await rangeButton.click()
  await page.getByRole("button", { name: "Barnpjäs", exact: true }).click()
  await expectQuery(page, "barnlitteratur", "true")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[1]!])
  await clear.click()

  await rangeButton.click()
  const pagesFrom = page.getByRole("slider", { name: "Antal sidor från", exact: true })
  await pagesFrom.evaluate((input: HTMLInputElement) => {
    input.value = "90"
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expectQuery(page, "number_of_pages", "90,120")
  await expectPlayRows(page, [
    dramawebbenCatalogExpected.plays[2]!,
    dramawebbenCatalogExpected.plays[3]!
  ])
  const pagesTo = page.getByRole("slider", { name: "Antal sidor till", exact: true })
  await pagesTo.evaluate((input: HTMLInputElement) => {
    input.value = "100"
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expectQuery(page, "number_of_pages", "90,100")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])

  await clear.click()
  await expect(page).toHaveURL(/\/dramawebben\/pj%C3%A4ser$/u)
  await expect(clear).toHaveCount(0)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)
  await expectOneCatalogRequest(request)
  expect(problems).toEqual([])
})

test("Headless UI catalog controls support keyboard, Escape, outside close, and focus return", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  const genderButton = page.getByRole("button", { name: "Kön", exact: true })
  await genderButton.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("option", { name: "Alla författare", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("option", { name: "Alla författare", exact: true })).toHaveCount(0)
  await expect(genderButton).toBeFocused()

  await page.keyboard.press("Enter")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expectQuery(page, "gender", "female")
  await expect(genderButton).toBeFocused()
  await routerPush(page, "/dramawebben/pj%C3%A4ser")
  await expectQuery(page, "gender", null)

  const mediaButton = page.getByRole("button", { name: "Utgivningsformat", exact: true })
  await mediaButton.click()
  await expect(page.getByRole("option", { name: "PDF", exact: true })).toBeVisible()
  await page.locator(".page_content p").first().click()
  await expect(page.getByRole("option", { name: "PDF", exact: true })).toHaveCount(0)

  const rangeButton = page.getByRole("button", { name: "Akter och roller", exact: true })
  await rangeButton.click()
  const childrenButton = page.getByRole("button", { name: "Barnpjäs", exact: true })
  await childrenButton.focus()
  await page.keyboard.press("Escape")
  await expect(childrenButton).toHaveCount(0)
  await expect(rangeButton).toBeFocused()
  await rangeButton.click()
  await expect(page.getByRole("button", { name: "Barnpjäs", exact: true })).toBeVisible()
  await page.locator(".page_content p").first().click()
  await expect(page.getByRole("button", { name: "Barnpjäs", exact: true })).toHaveCount(0)
  await expect(rangeButton).toBeFocused()

  // Headless UI labels the input from its associated trigger button.
  const authorInput = page.getByRole("combobox", { name: "Visa författare", exact: true })
  await authorInput.focus()
  await expect(authorInput).toBeFocused()
  await authorInput.press("ArrowDown")
  await authorInput.fill("Strindberg")
  const strindbergOption = page.getByRole("option", { name: "Strindberg, August 1849-1912" })
  await expect(strindbergOption).toBeVisible()
  await authorInput.press("ArrowDown")
  await expect(strindbergOption).toHaveAttribute("data-headlessui-state", /\bactive\b/u)
  await authorInput.press("Enter")
  await expectQuery(page, "author", "StrindbergA")
  await expect(authorInput).toBeFocused()
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])

  await expectOneCatalogRequest(request)
  expect(problems).toEqual([])
})

test("a catalog 503 keeps the hydrated shell stable without leaking upstream text", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await setCatalogFailure(request, "status-503")
  const response = await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  expect(response?.status()).toBe(503)
  await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
  await expectExactLinks(page, "pjäser")
  await expect(page.locator(".error")).toHaveText("Innehållet kan inte visas just nu.")
  await expect(page.locator(".page_content")).not.toContainText(
    "Unable to load Dramawebben catalog"
  )
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  expect(await documentRequests(request)).toEqual([])
  await expectNoExcludedDataRequests(request)
  expect(problems.filter(problem => !/status of 503 \(Service Unavailable\)/u.test(problem)))
    .toEqual([])
})
