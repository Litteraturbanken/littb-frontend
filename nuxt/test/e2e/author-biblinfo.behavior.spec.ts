import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_profile_requests`),
    request.delete(`${fixture}/_author_profile_failure`),
    request.delete(`${fixture}/_bibliography_requests`),
    request.delete(`${fixture}/_bibliography_failure`),
    request.delete(`${fixture}/_bibliography_disconnect`),
    request.delete(`${fixture}/_bibliography_delays`)
  ])
}

async function bibliographyRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_bibliography_requests`)).json()).requests
}

function collectProblems(page: Page): string[] {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (
      !message.text().startsWith("Failed to load resource:")
      && (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text()))
    ) {
      problems.push(message.text())
    }
  })
  return problems
}

test.beforeAll(async ({ baseURL, browser, request }) => {
  await reset(request)
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const response = await page.goto(new URL("/f%C3%B6rfattare/StrindbergA/biblinfo", baseURL).href, {
      waitUntil: "networkidle"
    })
    expect(response?.status()).toBe(200)
  } finally {
    await context.close()
  }
})
test.beforeEach(async ({ request }) => reset(request))

test("hydrates once and preserves the legacy one-hit, next, previous, and all controls", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const browserBibliographyRequests: string[] = []
  page.on("request", browserRequest => {
    if (new URL(browserRequest.url()).pathname === "/api/v2/bibliography/entries") {
      browserBibliographyRequests.push(browserRequest.url())
    }
  })
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  await expect(page.getByRole("combobox", { name: "Verk" })).toBeDisabled()

  await expect(page.locator(".num_hits")).toHaveText("3 träffar")
  await expect(page.locator(".results > div")).toHaveCount(1)
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  await expect(page.locator(".results")).toContainText("[tom]")

  const next = page.getByRole("button", { name: "Visa nästa sökträff" })
  await next.focus()
  await page.keyboard.press("Space")
  await expect(page.locator(".results")).toContainText("En herrgårdssägen")
  await expect(page.locator(".results")).not.toContainText("Gösta Berlings saga")
  await page.getByRole("button", { name: "Visa föregående sökträff" }).click()
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  await page.getByRole("button", { name: "Visa alla sökträffar" }).click()
  await expect(page.locator(".results > div")).toHaveCount(3)
  await expect(page.locator(".results")).toContainText("Jerusalem i forskningen")

  expect(await bibliographyRequests(request)).toEqual([
    "/private-v2/bibliography/entries"
  ])
  expect(browserBibliographyRequests).toEqual([])
  expect(problems).toEqual([])
})

test("submits exact resource filters and free text with latest-response ownership", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  const form = page.locator("form.search")
  const search = form.getByPlaceholder("Fritextsökning i hela databasen")

  await page.getByLabel("Visa information om alla manuskript").check()
  await form.getByRole("button", { name: "Sök" }).click()
  await expect(page.locator(".num_hits")).toHaveText("1 träffar")
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  expect((await bibliographyRequests(request)).at(-1)).toBe(
    "/v2/bibliography/entries?resource=manus"
  )

  await page.getByLabel("Visa information om alla manuskript").uncheck()
  await request.put(`${fixture}/_bibliography_delays`, { data: { gösta: 500 } })
  await search.fill("gösta")
  const slow = form.getByRole("button", { name: "Sök" }).click()
  await expect.poll(async () => (await bibliographyRequests(request)).some(
    entry => entry.includes("whole_text=g%C3%B6sta")
  )).toBe(true)
  await search.fill("jerusalem")
  await form.getByRole("button", { name: "Sök" }).click()
  await expect(page.locator(".results")).toContainText("Jerusalem i forskningen")
  await slow
  await page.waitForTimeout(550)
  await expect(page.locator(".results")).toContainText("Jerusalem i forskningen")
  await expect(page.locator(".results")).not.toContainText("Gösta Berlings saga")
  expect(problems).toEqual([])
})

test("rejects overlong free text locally without replacing truthful results", async ({
  page,
  request
}) => {
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  const search = page.getByPlaceholder("Fritextsökning i hela databasen")
  const initialRequests = await bibliographyRequests(request)
  await search.evaluate((input, value) => {
    const field = input as HTMLInputElement
    field.value = value
    field.dispatchEvent(new Event("input", { bubbles: true }))
  }, "x".repeat(201))
  await page.locator("form.search").getByRole("button", { name: "Sök" }).click()

  await expect(page.getByRole("alert")).toContainText("högst 200 tecken")
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  expect(await bibliographyRequests(request)).toEqual(initialRequests)
})

test("shows empty and failure states and keeps internal author navigation client-side", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  await page.getByPlaceholder("Fritextsökning i hela databasen").fill("saknas")
  await page.locator("form.search").getByRole("button", { name: "Sök" }).click()
  await expect(page.locator(".num_hits")).toHaveText("Inga träffar")
  await expect(page.locator(".results > div")).toHaveCount(0)

  await request.put(`${fixture}/_bibliography_failure`)
  await page.locator("form.search").getByRole("button", { name: "Sök" }).click()
  await expect(page.getByRole("alert")).toContainText(
    "Den bibliografiska databasen kan inte visas just nu."
  )

  await request.delete(`${fixture}/_bibliography_failure`)
  await page.evaluate(() => sessionStorage.setItem("biblinfo-client-marker", "kept"))
  await page.getByRole("link", { name: "Verk" }).click()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/StrindbergA\/titlar$/u)
  expect(await page.evaluate(() => sessionStorage.getItem("biblinfo-client-marker"))).toBe("kept")
  expect(problems).toEqual([])
})

test("does not expose an untrusted profile search URL as navigation", async ({ page }) => {
  const problems = collectProblems(page)
  const response = await page.goto("/författare/UnsafeSearch/biblinfo", {
    waitUntil: "networkidle"
  })

  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { name: /Osäker sökprofil/u })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Författarsidor" })
    .getByRole("link", { name: "Sök i texterna" })).toHaveCount(0)
  expect(problems).toEqual([])
})
