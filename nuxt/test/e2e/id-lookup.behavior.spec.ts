import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const description = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

type LookupBody = { work_id: string | null, titles: string[] }

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_work_lookup_requests`),
    request.delete(`${fixture}/_work_lookup_failure`),
    request.delete(`${fixture}/_work_lookup_delays`)
  ])
}

async function lookupBodies(request: APIRequestContext): Promise<LookupBody[]> {
  const response = await request.get(`${fixture}/_work_lookup_requests`)
  return (await response.json()).requests.map(
    (entry: { body: LookupBody }) => entry.body
  )
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (/hydration|duplicate keys|unhandledrejection/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function expectBodyClasses(page: Page, expected: string[]) {
  const classes = (await page.locator("body").getAttribute("class"))
    ?.split(/\s+/)
    .filter(Boolean)
    .sort()
  expect(classes).toEqual([...expected].sort())
}

async function openIdPage(page: Page, path = "/id") {
  const problems = captureBrowserProblems(page)
  const response = await page.goto(path, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  return problems
}

async function pushRoute(page: Page, path: string) {
  await page.evaluate(async target => {
    type VueRoot = HTMLElement & {
      __vue_app__: {
        config: {
          globalProperties: {
            $router: { push: (value: string) => Promise<void> }
          }
        }
      }
    }
    const root = document.querySelector("#__nuxt") as VueRoot
    await root.__vue_app__.config.globalProperties.$router.push(target)
  }, path)
}

test.beforeEach(async ({ request }) => reset(request))

test("manual ID is immediate and keeps raw display while clearing only title state", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page)
  const idInput = page.getByPlaceholder("lbid")
  const titleInput = page.getByPlaceholder("titel")
  const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")

  await idInput.fill("  LB238704  ")
  await expect(idInput).toHaveValue("  LB238704  ")
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: "lb238704", titles: [] }
  ])

  await textarea.fill("Författare – Titel\nTitel två")
  await expect(titleInput).toHaveValue("Titel")
  await idInput.fill("lb238704")
  await expect(titleInput).toHaveValue("")
  await expect(textarea).toHaveValue("Författare – Titel\nTitel två")
  expect(problems).toEqual([])
})

test("title and textarea use the exact 500 ms debounce and coupled replacement rules", async ({
  page,
  request
}) => {
  await openIdPage(page)
  await page.clock.install()
  const idInput = page.getByPlaceholder("lbid")
  const titleInput = page.getByPlaceholder("titel")
  const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")

  await titleInput.fill("Röda")
  await page.clock.runFor(499)
  expect(await lookupBodies(request)).toEqual([])
  await page.clock.runFor(1)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["Röda"] }
  ])

  await reset(request)
  await textarea.fill("A – First\nSecond\nThird")
  await expect(titleInput).toHaveValue("First")
  await titleInput.fill("Replacement")
  await expect(idInput).toHaveValue("")
  await page.clock.runFor(499)
  expect(await lookupBodies(request)).toEqual([])
  await page.clock.runFor(1)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["Replacement", "Second", "Third"] }
  ])

  await reset(request)
  await textarea.fill("A – B – C")
  await page.clock.runFor(500)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["B"] }
  ])

  await reset(request)
  await textarea.fill("A –")
  await page.clock.runFor(500)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["A –"] }
  ])
})

test("textarea preserves blank and duplicate control rows but normalizes only the request", async ({
  page,
  request
}) => {
  await openIdPage(page)
  await page.clock.install()
  const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")
  const rows = ["", "Duplicate", "Duplicate", ...Array.from(
    { length: 100 },
    (_, index) => `Title ${index + 1}`
  )]
  const raw = rows.join("\n")

  await textarea.fill(raw)
  await expect(textarea).toHaveValue(raw)
  await expect(page.getByPlaceholder("titel")).toHaveValue("")
  await page.clock.runFor(500)
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(1)
  const [body] = await lookupBodies(request)
  expect(body?.work_id).toBeNull()
  expect(body?.titles).toHaveLength(100)
  expect(body?.titles.slice(0, 3)).toEqual([
    "Duplicate",
    "Duplicate",
    "Title 1"
  ])
  expect(body?.titles.at(-1)).toBe("Title 98")
})

test("same-mode replacements clear old rows while loading and latest response wins", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page)
  const titleInput = page.getByPlaceholder("titel")
  await titleInput.fill("Röda rummet")
  await expect(page.locator(".table-striped tr")).toHaveCount(1)

  const slowBody = { work_id: null, titles: ["Gösta Berlings saga"] }
  await request.put(`${fixture}/_work_lookup_delays`, {
    data: { [JSON.stringify(slowBody)]: 500 }
  })
  await titleInput.fill("Gösta Berlings saga")
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(2)
  await expect(page.locator(".table-striped tr")).toHaveCount(0)
  await expect(page.locator("#mainview > div")).toHaveClass(/\bsearching\b/)
  await expect(page.locator(".preloader")).toBeVisible()

  await titleInput.fill("Röda rummet")
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(3)
  await expect(page.locator(".table-striped tr td").nth(0)).toHaveText("lb238704")
  await page.waitForTimeout(550)
  await expect(page.locator(".table-striped tr td").nth(0)).toHaveText("lb238704")
  await expect(page.locator("#mainview > div")).not.toHaveClass(/\bsearching\b/)
  expect(problems).toEqual([])
})

test("duplicate representations render twice in order without duplicate-key warnings", async ({
  page
}) => {
  const problems = await openIdPage(page)
  await page.getByPlaceholder("lbid").fill("lb-duplicate")

  const links = page.locator(".table-striped tr td").nth(3).locator("a")
  await expect(links).toHaveCount(2)
  await expect(links).toHaveText(["etext", "etext"])
  await expect(links.nth(0)).toHaveAttribute(
    "href",
    "/författare/TestAuthor/titlar/Duplicate/etext"
  )
  await expect(links.nth(1)).toHaveAttribute(
    "href",
    "/författare/TestAuthor/titlar/Duplicate/etext"
  )
  await expect(page.locator(".table-striped tr td").nth(3)).toHaveText(
    "etext:::etext"
  )
  expect(problems).toEqual([])
})

test("typed and thrown network failures clear loading and rows without browser errors", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page)
  await request.put(`${fixture}/_work_lookup_failure`)
  await page.getByPlaceholder("lbid").fill("lb238704")
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(1)
  await expect(page.locator("#mainview > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".table-striped tr")).toHaveCount(0)

  await request.delete(`${fixture}/_work_lookup_failure`)
  await page.route("**/api/v2/works/lookup", route => route.abort("failed"))
  await page.getByPlaceholder("lbid").fill("lb278171")
  await expect(page.locator("#mainview > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".table-striped tr")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("empty invalid and no-hit values do not leave stale requests or rows", async ({
  page,
  request
}) => {
  await openIdPage(page)
  const idInput = page.getByPlaceholder("lbid")
  const titleInput = page.getByPlaceholder("titel")

  await idInput.fill("lb238704")
  await expect(page.locator(".table-striped tr")).toHaveCount(1)
  await reset(request)
  await idInput.fill("not-an-id")
  await page.waitForTimeout(550)
  expect(await lookupBodies(request)).toEqual([])
  await expect(page.locator(".table-striped tr")).toHaveCount(0)

  await idInput.fill("")
  await titleInput.fill("no match")
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["no match"] }
  ])
  await expect(page.locator(".table-striped tr")).toHaveCount(0)
  await reset(request)
  await titleInput.fill(" ")
  await page.waitForTimeout(550)
  expect(await lookupBodies(request)).toEqual([])
})

test("hydrated route values preserve an already-decoded literal percent sequence", async ({
  page,
  request
}) => {
  await openIdPage(page)
  await pushRoute(page, "/id/Title%2520Percent")

  await expect(page.getByPlaceholder("titel")).toHaveValue("title%20percent")
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["title%20percent"] }
  ])
})

test("route changes seed lower-case state, clean up pending work, and restore metadata", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page, "/om/ide")
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expectBodyClasses(page, ["focus", "page-about", "ready"])

  await pushRoute(page, "/id/LB238704")
  await expect(page).toHaveTitle("Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    description
  )
  await expectBodyClasses(page, ["focus", "page-id", "ready"])
  await expect(page.getByPlaceholder("lbid")).toHaveValue("lb238704")
  await expect(page.locator(".table-striped tr")).toHaveCount(1)

  const slowBody = { work_id: null, titles: ["Gösta Berlings saga"] }
  await request.put(`${fixture}/_work_lookup_delays`, {
    data: { [JSON.stringify(slowBody)]: 500 }
  })
  await page.getByPlaceholder("titel").fill("Gösta Berlings saga")
  await expect.poll(async () => (await lookupBodies(request)).some(body => (
    body.titles[0] === "Gösta Berlings saga"
  ))).toBe(true)
  await pushRoute(page, "/om/ide")
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Om Litteraturbanken."
  )
  await expectBodyClasses(page, ["focus", "page-about", "ready"])
  await page.waitForTimeout(550)
  expect(problems).toEqual([])
})
