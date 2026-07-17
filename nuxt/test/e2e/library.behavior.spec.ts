import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`)
  ])
}

async function requests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_relevance_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

test.beforeEach(async ({ request }) => reset(request))

test("client-side Library entry uses public runtime config without private-key warnings", async ({
  page,
  request
}) => {
  const warnings: string[] = []
  page.on("console", message => {
    if (message.text().includes("Could not access `libraryApiBase`")) {
      warnings.push(message.text())
    }
  })

  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } } }
    }
    await root.__vue_app__?.config.globalProperties.$router.push("/bibliotek")
  })
  await page.locator("[data-library-result], [data-library-error]").first().waitFor()

  expect(warnings).toEqual([])
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  const ledger = await requests(request)
  expect(ledger).toHaveLength(1)
  expect(ledger[0]?.path.startsWith("/api/relevance/")).toBe(true)
})

test("debounces Library input, preserves the URL, and uses the public proxy once", async ({
  page,
  request
}) => {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (message.type() === "error") problems.push(message.text())
  })

  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  await reset(request)
  await page.reload({ waitUntil: "networkidle" })
  const initialLedger = await requests(request)
  expect(initialLedger).toHaveLength(1)
  expect(initialLedger[0]?.path.startsWith("/legacy-api/relevance/")).toBe(true)

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(200)
  expect(await requests(request)).toHaveLength(initialLedger.length)
  await expect(page).toHaveURL(/filter=Selma/)
  await expect(page.locator("[data-library-result]")).toHaveCount(1)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()

  const ledger = await requests(request)
  const publicRequests = ledger.filter(entry => entry.path.startsWith("/api/relevance/"))
  expect(publicRequests).toHaveLength(1)
  expect(publicRequests[0]?.query.q).toBe("(Selma)")
  expect(problems).toEqual([])
})

test("submit before debounce persists one request and durable filter state", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await reset(request)
  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await input.press("Enter")

  await expect(page).toHaveURL(/filter=Selma/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await page.waitForTimeout(400)
  const ledger = await requests(request)
  expect(ledger.filter(entry => entry.path.startsWith("/api/relevance/"))).toHaveLength(1)
})

test("a delayed stale Library request cannot replace the latest results", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_library_relevance_delays`, {
    data: { "(Selma)": 900 }
  })
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(350)
  await input.fill("Senaste")
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toHaveCount(0)
})

test("Library reset and sort links update supported query state", async ({ page }) => {
  await page.goto("/bibliotek?filter=Selma", { waitUntil: "networkidle" })
  await page.locator("[data-library-reset]").click()
  await expect(page).not.toHaveURL(/filter=/)
  await expect(page.locator("[data-library-result]")).toHaveCount(3)

  await page.getByRole("link", { name: "Titel", exact: true }).click()
  await expect(page).toHaveURL(/sort=titlar/)
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
})

test("delayed input cannot replace an immediate sort or reset intent", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_library_relevance_delays`, {
    data: { "(Selma)|_score|desc": 900 }
  })
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(350)
  await page.getByRole("link", { name: "Titel", exact: true }).click()
  await expect(page).toHaveURL(/filter=Selma.*sort=titlar|sort=titlar.*filter=Selma/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()

  await request.put(`${fixture}/_library_relevance_delays`, {
    data: { "(Senaste)|sortkey|asc": 900 }
  })
  await input.fill("Senaste")
  await page.waitForTimeout(350)
  await page.locator("[data-library-reset]").click()
  await expect(page).not.toHaveURL(/filter=/)
  await expect(page.getByRole("link", { name: "Röda rummet" })).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.getByRole("link", { name: "Röda rummet" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toHaveCount(0)
})

test("Back and Forward restore filter, sort, and results without client duplicates", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?filter=Selma&sort=titlar", { waitUntil: "networkidle" })
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } } }
    }
    await root.__vue_app__?.config.globalProperties.$router.push(
      "/bibliotek?filter=Senaste&sort=forfattare"
    )
  })
  await expect(page.locator("[data-library-filter]")).toHaveValue("Senaste")
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await reset(request)

  await page.goBack()
  await expect(page.locator("[data-library-filter]")).toHaveValue("Selma")
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await page.goForward()
  await expect(page.locator("[data-library-filter]")).toHaveValue("Senaste")
  await expect(page.locator('[data-library-sort="forfattare"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()

  const ledger = await requests(request)
  expect(ledger.filter(entry => entry.path.startsWith("/api/relevance/"))).toHaveLength(2)
})
