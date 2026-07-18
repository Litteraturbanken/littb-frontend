import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_document_requests`),
    request.delete(`${fixture}/_author_document_failure`),
    request.delete(`${fixture}/_author_document_delay`),
    request.delete(`${fixture}/_author_document_pdf_requests`)
  ])
}

async function documentRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_author_document_requests`)).json()).requests
}

async function pdfRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_author_document_pdf_requests`)).json()).requests
}

async function routerPush(page: Page, path: string) {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } } }
    }
    await root.__vue_app__?.config.globalProperties.$router.push(target)
  }, path)
}

function collectProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text())) {
      problems.push(message.text())
    }
  })
  return problems
}

test.beforeEach(async ({ request }) => reset(request))

test("hydrates the presentation once without duplicate fetches or browser warnings", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })
  await expect(page.locator("h1").first()).toContainText("Hjalmar Söderberg")
  await expect(page.locator(".page_content")).toContainText("Hjalmar Söderberg, född 1869")
  expect(await documentRequests(request)).toHaveLength(2)
  expect(problems).toEqual([])
})

test("router and history transitions replace metadata, navigation, and managed content", async ({ page }) => {
  const problems = collectProblems(page)
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/bibliografi")
  await expect(page).toHaveTitle("Selma Lagerlöf, Bibliografi | Litteraturbanken")
  await expect(page.locator("h1").first()).toContainText("Selma Lagerlöf")
  await expect(page.locator(".page_content")).toContainText("Selma Lagerlöf. Bibliografi")
  await expect(page.locator(".page_content")).not.toContainText("Hjalmar Söderberg, född 1869")
  await expect(page.locator("ul.links a")).toHaveText([
    "Introduktion", "Verk", "Ljud", "Dramawebben", "Sök i texterna"
  ])

  await page.goBack()
  await expect(page).toHaveTitle("Hjalmar Söderberg, Presentation | Litteraturbanken")
  await expect(page.locator(".page_content")).toContainText("Hjalmar Söderberg, född 1869")
  await expect(page.locator(".page_content")).not.toContainText("Selma Lagerlöf. Bibliografi")
  expect(problems).toEqual([])
})

test("a newer route clears loading state and ignores a late stale document", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })
  await reset(request)
  await request.put(`${fixture}/_author_document_delay`, { data: { delay: 800 } })

  const slowNavigation = routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/bibliografi")
  await expect(page.locator(".preloader")).toBeVisible()
  await expect.poll(async () => (await documentRequests(request)).some(
    (entry: { path: string }) => entry.path.includes("Lagerl%C3%B6fS")
  )).toBe(true)

  await request.delete(`${fixture}/_author_document_delay`)
  await routerPush(page, "/f%C3%B6rfattare/SparseDocument/presentation")
  await expect(page.locator(".page_content")).toContainText("Ett litet giltigt författardokument")
  await slowNavigation
  await page.waitForTimeout(900)
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/SparseDocument\/presentation$/u)
  await expect(page.locator(".page_content")).not.toContainText("Selma Lagerlöf. Bibliografi")
  await expect(page.locator(".preloader")).toBeHidden()
  expect(problems).toEqual([])
})

test("normalized managed links reach canonical Reader and profile pages", async ({ page }) => {
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })
  await page.locator(
    'a[href="/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext"]'
  ).first().click()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/S%C3%B6derbergH\/titlar\/F%C3%B6rvillelser\/sida\/3\/etext$/u)
  await expect(page.locator(".txt")).toContainText("KANONISK SIDA TRE")

  await page.goto("/forfattare/LagerlofS")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/u)
  await expect(page.locator("h1").first()).toContainText("Selma Lagerlöf")
})

test("preserves attachment and inline PDF browser behavior", async ({ page, request }) => {
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })
  const downloadPromise = page.waitForEvent("download")
  await page.locator('a[href$="SoderbergH_presentation.pdf"]').click()
  expect((await downloadPromise).suggestedFilename()).toBe("SoderbergH_presentation.pdf")

  await page.goto("/författare/Lagerl%C3%B6fS/bibliografi", { waitUntil: "networkidle" })
  const popupPromise = page.context().waitForEvent("page")
  await page.locator('a[href$="LagerlofS_bibliografi.pdf"]').click()
  const popup = await popupPromise
  await popup.close()

  await expect.poll(() => pdfRequests(request)).toEqual([
    "/red/forfattare/SoderbergH/presentation/SoderbergH_presentation.pdf",
    "/red/forfattare/LagerlofS/bibliografi/LagerlofS_bibliografi.pdf"
  ])
})

test("recovers from document errors without retaining stale accepted content", async ({ page, request }) => {
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })
  await request.put(`${fixture}/_author_document_failure`, { data: { failure: "content-503" } })
  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/bibliografi")
  await expect(page.locator(".error")).toHaveText(
    "Ett fel har inträffat. Författardokumentet kan inte visas just nu."
  )
  await expect(page.locator(".page_content")).toHaveCount(0)

  await request.delete(`${fixture}/_author_document_failure`)
  await routerPush(page, "/f%C3%B6rfattare/SparseDocument/presentation")
  await expect(page.locator(".page_content")).toContainText("Ett litet giltigt författardokument")
})
