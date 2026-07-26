import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const etextPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const nyaVagarPath = "/författare/SöderbergH/titlar/NyaVagarReader/sida/-2/etext"

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`)
  ])
}

async function fixtureRequests(
  request: APIRequestContext,
  ledger: "metadata" | "html" | "ocr" | "jpeg"
): Promise<string[]> {
  const response = await request.get(`${fixture}/_reader_${ledger}_requests`)
  return (await response.json() as { requests: string[] }).requests
}

function captureBrowserProblems(page: Page): string[] {
  const problems: string[] = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

test.beforeEach(async ({ request }) => resetReader(request))

test("Läsfokus replaces its query state and exposes text, night, and page controls", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const initial = `${etextPath}?bare&repeat=%2f&repeat=%2F#focus`
  const response = await page.goto(initial, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  const metadataBefore = await fixtureRequests(request, "metadata")
  const htmlBefore = await fixtureRequests(request, "html")
  const historyLength = await page.evaluate(() => window.history.length)

  const trigger = page.getByRole("link", { name: "Läsfokus", exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page).toHaveURL(
    `${etextPath}?bare&repeat=%2f&repeat=%2F&fokus#focus`
  )
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
  expect(await fixtureRequests(request, "metadata")).toEqual(metadataBefore)
  expect(await fixtureRequests(request, "html")).toEqual(htmlBefore)

  const reader = page.locator(".reader_main")
  await expect(reader).toHaveClass(/\bfocus\b/u)
  await expect(page.locator("#leftCorridor")).toBeHidden()
  await expect(page.locator("#rightCorridor")).toBeHidden()
  const bottomBar = page.locator(".bottomBar")
  await expect(bottomBar).toBeVisible()

  await bottomBar.getByRole("button", { name: "Textinställningar" }).click()
  const textMenu = page.locator(".text_menu.text")
  await expect(textMenu).toBeVisible()
  const transformBefore = await reader.evaluate(element => getComputedStyle(element).transform)
  await textMenu.getByRole("button", { name: "Större text" }).click()
  const transformAfter = await reader.evaluate(element => getComputedStyle(element).transform)
  expect(transformAfter).not.toBe(transformBefore)

  await textMenu.getByRole("button", { name: "Nattläge" }).click()
  await expect(page.locator("body")).toHaveClass(/\bnight\b/u)
  await expect(textMenu.getByRole("button", { name: "Ljust läge" })).toBeVisible()

  const nextHref =
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext" +
    "?bare&repeat=%2f&repeat=%2F&fokus#focus"
  const rightCover = page.locator("a.rightCover")
  await expect(rightCover).toHaveAttribute("href", nextHref)
  await rightCover.click()
  await expect(page).toHaveURL(nextHref)
  await expect(page.locator(".reader_main")).toHaveClass(/\bfocus\b/u)
  await expect(page.locator("body")).toHaveClass(/\bnight\b/u)

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(
    `${etextPath}?bare&repeat=%2f&repeat=%2F&fokus#focus`
  )
  await bottomBar.getByRole("button", { name: "Stäng Läsfokus" }).click()
  await expect(page).toHaveURL(initial)
  await expect(reader).not.toHaveClass(/\bfocus\b/u)
  expect(problems).toEqual([])
})

test("normal faksimil OCR inspection fetches the page-index overlay and preserves it in navigation", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const response = await page.goto(`${facsimilePath}?ocr`, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  const reader = page.locator(".reader_main")
  await expect(reader).toHaveClass(/\bocr\b/u)
  const overlay = reader.locator(".overlay")
  await expect(overlay).toContainText("OCR fixture")
  await expect(overlay).toHaveCSS("color", "rgb(0, 0, 0)")
  await expect(reader.locator("img.faksimil")).toBeHidden()
  expect(await fixtureRequests(request, "ocr")).toEqual([
    "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"
  ])

  await page.getByRole("link", { name: "Nästa sida" }).first().click()
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/5/faksimil?ocr"
  )
  await expect(page.locator(".reader_main")).toHaveAttribute(
    "aria-label",
    "Gösta Berlings saga, sida 5"
  )
  await expect(page.locator(".reader_main .overlay")).toContainText("OCR fixture")
  expect(await fixtureRequests(request, "ocr")).toEqual([
    "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html",
    "/txt/lb-reader-gosta-berlings-saga/ocr_00002.html"
  ])
  expect(problems).toEqual([])
})

test("ordinary searchable faksimil keeps a transparent selectable OCR layer through navigation", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(facsimilePath, { waitUntil: "networkidle" })
  const reader = page.locator(".reader_main")
  await expect(reader).not.toHaveClass(/\bocr\b/u)
  await expect(reader.locator("img.faksimil")).toBeVisible()
  const word = reader.locator(".overlay .w").first()
  await expect(word).toContainText("OCR fixture")
  await expect(word).toHaveCSS("color", "rgba(0, 0, 0, 0)")
  await expect(word).not.toHaveCSS("pointer-events", "none")
  expect(await word.evaluate(element => {
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(element)
    selection?.removeAllRanges()
    selection?.addRange(range)
    return selection?.toString() ?? ""
  })).toContain("OCR fixture")
  expect(await fixtureRequests(request, "ocr")).toEqual([
    "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"
  ])

  await page.getByRole("link", { name: "Nästa sida" }).first().click()
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/5/faksimil"
  )
  await expect(reader).toHaveAttribute("aria-label", "Gösta Berlings saga, sida 5")
  await expect(reader.locator(".overlay .w").first()).toContainText("OCR fixture")
  await expect.poll(() => fixtureRequests(request, "ocr")).toEqual([
    "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html",
    "/txt/lb-reader-gosta-berlings-saga/ocr_00002.html"
  ])
  expect(problems).toEqual([])
})

test("Nya vägar is an exact eligible-work link and is absent from ordinary works", async ({
  page
}) => {
  const eligibleResponse = await page.goto(nyaVagarPath, { waitUntil: "networkidle" })
  expect(eligibleResponse?.status()).toBe(200)
  const link = page.getByRole("link", { name: "Logotyp för Nya vägar" })
  await expect(link).toHaveAttribute(
    "href",
    "https://litteraturbanken.se/diktensmuseum/nya-vagar-inledning/"
  )
  await expect(link.locator("img")).toHaveAttribute(
    "src",
    /lb_logga_nyavagar_2\.2021\.svg/u
  )

  await page.goto(etextPath, { waitUntil: "networkidle" })
  await expect(page.getByRole("link", { name: "Logotyp för Nya vägar" })).toHaveCount(0)
})
