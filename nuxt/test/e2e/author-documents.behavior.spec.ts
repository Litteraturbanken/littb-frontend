import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_document_requests`),
    request.delete(`${fixture}/_author_document_failure`),
    request.delete(`${fixture}/_author_document_delay`),
    request.delete(`${fixture}/_author_document_asset_requests`),
    request.delete(`${fixture}/_author_document_pdf_requests`)
  ])
}

async function documentRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_author_document_requests`)).json()).requests
}

async function pdfRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_author_document_pdf_requests`)).json()).requests
}

async function assetRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_author_document_asset_requests`)).json()).requests
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

test("hydrates semer once without duplicate managed fetches or browser warnings", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/AlmqvistCJL/semer", { waitUntil: "networkidle" })
  await expect(page).toHaveTitle("Carl Jonas Love Almqvist, Mera om | Litteraturbanken")
  await expect(page.locator("h1").first()).toContainText("Carl Jonas Love Almqvist")
  await expect(page.locator(".page_content")).toContainText("Mera om och av författaren")
  expect(await documentRequests(request)).toEqual([
    {
      kind: "descriptor",
      path: "/private-v2/authors/AlmqvistCJL/documents/semer"
    },
    {
      kind: "content",
      path: "/red/forfattare/AlmqvistCJL/semer/index.html"
    }
  ])
  expect(problems).toEqual([])
})

test("presentation, semer, bibliography, and history change metadata and content atomically", async ({
  page
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })

  await routerPush(page, "/f%C3%B6rfattare/AlmqvistCJL/semer")
  await expect(page).toHaveTitle("Carl Jonas Love Almqvist, Mera om | Litteraturbanken")
  await expect(page.locator("h1").first()).toContainText("Carl Jonas Love Almqvist")
  await expect(page.locator(".page_content")).toContainText("Mera om och av författaren")
  await expect(page.locator(".page_content")).not.toContainText("Hjalmar Söderberg, född 1869")

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/bibliografi")
  await expect(page).toHaveTitle("Selma Lagerlöf, Bibliografi | Litteraturbanken")
  await expect(page.locator("h1").first()).toContainText("Selma Lagerlöf")
  await expect(page.locator(".page_content")).toContainText("Selma Lagerlöf. Bibliografi")
  await expect(page.locator(".page_content")).not.toContainText("Hjalmar Söderberg, född 1869")
  await expect(page.locator("ul.links a")).toHaveText([
    "Introduktion", "Verk", "Ljud", "Dramawebben", "Sök i texterna"
  ])

  await page.goBack()
  await expect(page).toHaveTitle("Carl Jonas Love Almqvist, Mera om | Litteraturbanken")
  await expect(page.locator(".page_content")).toContainText("Mera om och av författaren")
  await expect(page.locator(".page_content")).not.toContainText("Selma Lagerlöf. Bibliografi")

  await page.goBack()
  await expect(page).toHaveTitle("Hjalmar Söderberg, Presentation | Litteraturbanken")
  await expect(page.locator(".page_content")).toContainText("Hjalmar Söderberg, född 1869")
  await expect(page.locator(".page_content")).not.toContainText("Mera om och av författaren")

  await page.goForward()
  await expect(page).toHaveTitle("Carl Jonas Love Almqvist, Mera om | Litteraturbanken")
  await expect(page.locator(".page_content")).toContainText("Mera om och av författaren")

  await page.goForward()
  await expect(page).toHaveTitle("Selma Lagerlöf, Bibliografi | Litteraturbanken")
  await expect(page.locator(".page_content")).toContainText("Selma Lagerlöf. Bibliografi")
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

  const slowNavigation = routerPush(page, "/f%C3%B6rfattare/AlmqvistCJL/semer")
  await expect(page.locator(".preloader")).toBeVisible()
  await expect.poll(async () => (await documentRequests(request)).some(
    (entry: { path: string }) => entry.path.includes("AlmqvistCJL")
  )).toBe(true)

  await request.delete(`${fixture}/_author_document_delay`)
  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/bibliografi")
  await expect(page.locator(".page_content")).toContainText("Selma Lagerlöf. Bibliografi")
  await slowNavigation
  await page.waitForTimeout(900)
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS\/bibliografi$/u)
  await expect(page.locator(".page_content")).not.toContainText("Mera om och av författaren")
  await expect(page.locator(".preloader")).toBeHidden()
  expect(problems).toEqual([])
})

test("semer retains safe legacy links, managed images, and native PDF behavior", async ({
  page,
  request
}) => {
  await page.goto("/författare/AlmqvistCJL/semer", { waitUntil: "networkidle" })

  const normalized = page.locator(
    'a[href="/forfattare/AlmqvistCJL/titlar/DetGarAn1838/sida/1/faksimil"]'
  )
  await expect(normalized).toHaveAttribute(
    "href",
    "/forfattare/AlmqvistCJL/titlar/DetGarAn1838/sida/1/faksimil"
  )

  const portrait = page.locator(
    'img[src="/red/forfattare/AlmqvistCJL/semer/pictures/200_almqvist_cjl_fa1.jpeg"]'
  )
  await expect(portrait).toBeVisible()
  expect(await portrait.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(await assetRequests(request)).toContain(
    "/red/forfattare/AlmqvistCJL/semer/pictures/200_almqvist_cjl_fa1.jpeg"
  )

  const pdf = page.locator(
    'a[href="/red/forfattare/AlmqvistCJL/semer/pictures/Burman2003.pdf"]'
  )
  await expect(pdf).toHaveAttribute("target", "_blank")
  await expect(pdf).toHaveAttribute("rel", /noopener.*noreferrer/u)
  await expect(pdf).not.toHaveAttribute("download", /.*/u)
})

test("mer remains AuthorWorksContent and performs no semer source request", async ({
  page,
  request
}) => {
  await page.goto("/författare/StrindbergA/mer", { waitUntil: "networkidle" })
  await expect(page.locator("h1").first()).toContainText("August Strindberg (1849-1912)")
  await expect(page.locator(".unbox h2").first()).toHaveText("Verk om August Strindberg")
  await expect(page.locator(".unbox")).toContainText("August Strindberg (1940)")
  expect(await documentRequests(request)).toEqual([])
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
