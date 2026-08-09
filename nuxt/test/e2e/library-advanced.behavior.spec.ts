import { expect, test, type APIRequestContext } from "@playwright/test"

import type { operations } from "../../app/lib/api/generated/lbapi"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
type LibrarySearchRequest = operations["v2_post_library_search"]["requestBody"]["content"]["application/json"]
type LibraryFilters = LibrarySearchRequest["filters"]

function libraryFilters(overrides: Partial<LibraryFilters> = {}): LibraryFilters {
  return {
    query: "", gender: null, categories: [], narrowing_categories: [],
    about_author_ids: [], media: [], languages: [], year_from: null, year_to: null,
    ...overrides
  }
}

async function resetRequests(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`),
    request.delete(`${fixture}/_library_query_requests`),
    request.delete(`${fixture}/_library_query_failure`),
    request.delete(`${fixture}/_library_query_delays`),
    request.delete(`${fixture}/_library_imprint_range`),
    request.delete(`${fixture}/_library_imprint_failure`),
    request.delete(`${fixture}/_library_imprint_requests`),
    request.delete(`${fixture}/_library_v2/requests`),
    request.delete(`${fixture}/_library_v2/failures`),
    request.delete(`${fixture}/_library_v2/delays`)
  ])
}

async function relevanceQueries(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_library_v2/requests`)
  const ledger = (await response.json()).search as Array<{
    method: string, path: string, scope: string, body: LibrarySearchRequest
  }>
  return ledger.filter(item => item.body.mode === "all")
}

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.locator('[data-library-mounted="true"]').waitFor({ state: "attached" })
}

async function chooseMultiOptions(
  page: import("@playwright/test").Page,
  control: import("@playwright/test").Locator,
  labels: readonly string[]
) {
  await control.click()
  for (const label of labels) await control.getByText(label, { exact: true }).click()
  await page.keyboard.press("Escape")
}

test.beforeEach(async ({ request }) => resetRequests(request))

test("advanced Library placeholders retain the production baseline at each breakpoint", async ({
  page
}) => {
  await page.goto(
    "/bibliotek?avancerat=1&keywords_aux="
      + "texttype%3Anovellsamling%3Bnovell,texttype%3Areseskildring",
    { waitUntil: "networkidle" }
  )
  await waitForHydration(page)

  const isNarrow = page.viewportSize()!.width <= 767
  await expect(page.locator(
    "[data-library-about-authors] .search-multiselect__main-trigger"
  )).toHaveCSS("padding-top", isNarrow ? "4px" : "5px")
  await expect(page.locator(
    "[data-library-about-authors] .search-multiselect__main-trigger"
  )).toHaveCSS("padding-bottom", isNarrow ? "6px" : "5px")
  await expect(page.locator(
    "[data-library-narrowing] .search-multiselect__input-row"
  )).toHaveCSS("padding-top", isNarrow ? "5px" : "4px")
  await expect(page.locator(
    "[data-library-narrowing] .search-multiselect__input-row"
  )).toHaveCSS("padding-bottom", isNarrow ? "5px" : "6px")
})

test("advanced disclosure and controls use push history and restore from the URL", async ({
  page,
  request
}, testInfo) => {
  await page.goto("/bibliotek?keep=ja&sida=4", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await resetRequests(request)

  const advanced = page.locator("[data-library-advanced]")
  await expect(advanced).toBeEnabled()
  await expect(advanced).toHaveAttribute("aria-expanded", "false")
  await advanced.click()
  await expect.poll(() => new URL(page.url()).searchParams.get("avancerat")).toBe("1")
  await expect(advanced).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator("[data-library-advanced-panel]")).toBeVisible()
  expect(await relevanceQueries(request)).toEqual([])

  const gender = page.locator("[data-library-gender]")
  await expect(gender).toHaveAccessibleName("Författarkön")
  await gender.selectOption("female")
  await expect.poll(() => new URL(page.url()).searchParams.get("kön")).toBe("female")
  expect(new URL(page.url()).searchParams.has("sida")).toBe(false)
  expect(new URL(page.url()).searchParams.get("keep")).toBe("ja")
  await expect.poll(async () => (await relevanceQueries(request)).length).toBe(1)
  expect((await relevanceQueries(request)).at(-1)?.body.filters)
    .toEqual(libraryFilters({ gender: "female" }))

  await page.goBack()
  await expect.poll(() => new URL(page.url()).searchParams.has("kön")).toBe(false)
  await expect(gender).toHaveValue("")
  await expect(advanced).toHaveAttribute("aria-expanded", "true")

  await page.goBack()
  await expect.poll(() => new URL(page.url()).searchParams.has("avancerat")).toBe(false)
  await expect(advanced).toHaveAttribute("aria-expanded", "false")

  await page.goForward()
  await page.goForward()
  await expect.poll(() => new URL(page.url()).searchParams.get("kön")).toBe("female")
  await expect(gender).toHaveValue("female")
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("[data-library-gender]")).toHaveValue("female")

  if (testInfo.project.name === "mobile-chromium") {
    for (const control of [
      page.getByRole("combobox", { name: "Utgivningsformat", exact: true }),
      page.getByRole("combobox", { name: "Språk …", exact: true })
    ]) {
      await expect(control).toHaveCount(1)
      await control.focus()
      await expect(control).toBeFocused()
    }
    await expect(page.getByLabel("Från tryckår reglage")).toBeVisible()
    await expect(page.getByLabel("Till tryckår reglage")).toBeVisible()
  }
})

test("multi facets and chronology compose exact safe predicates and commit once per change", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?avancerat=1&keep&keep=ja&sida=3", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await resetRequests(request)

  await chooseMultiOptions(page, page.locator("[data-library-media]"), ["Etext", "Epub"])
  await expect.poll(() => new URL(page.url()).searchParams.get("mediatypes"))
    .toBe("mediatype:etext,has_epub:true")

  await chooseMultiOptions(page, page.locator("[data-library-languages]"), ["Svenska", "Ej korrekturläst"])
  await expect.poll(() => new URL(page.url()).searchParams.get("languages"))
    .toBe("language:swe,proofread:false")

  const ranges = page.locator("[data-library-chronology-range] input[type=range]")
  await ranges.nth(0).evaluate((input: HTMLInputElement) => {
    input.value = "1900"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1900,2026")
  await expect.poll(async () => (await relevanceQueries(request)).length).toBe(5)
  await ranges.nth(1).evaluate((input: HTMLInputElement) => {
    input.value = "1910"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1900,1910")
  const params = new URL(page.url()).searchParams
  expect(params.getAll("keep")).toEqual(["", "ja"])
  expect(params.has("sida")).toBe(false)

  await expect.poll(async () => (await relevanceQueries(request)).length).toBe(6)
  expect((await relevanceQueries(request)).at(-1)?.body.filters).toEqual(libraryFilters({
    media: ["mediatype:etext", "has_epub:true"],
    languages: ["language:swe", "proofread:false"], year_from: 1900, year_to: 1910
  }))

  await ranges.nth(0).evaluate((input: HTMLInputElement) => {
    input.value = "1950"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect(page.getByLabel("Från tryckår", { exact: true })).toHaveValue("1910")
  await expect(page.getByLabel("Till tryckår", { exact: true })).toHaveValue("1910")
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1910,1910")

  await page.getByLabel("Från tryckår", { exact: true }).fill("1920")
  await page.getByLabel("Från tryckår", { exact: true }).blur()
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1910,1910")

  await page.locator("[data-library-reset]").click()
  await expect.poll(() => new URL(page.url()).searchParams.has("intervall")).toBe(false)
  const resetParams = new URL(page.url()).searchParams
  expect(resetParams.has("mediatypes")).toBe(false)
  expect(resetParams.has("languages")).toBe(false)
  expect(resetParams.has("kön")).toBe(false)
  expect(resetParams.getAll("keep")).toEqual(["", "ja"])
  expect(resetParams.get("avancerat")).toBe("1")
  await expect(page.locator("[data-library-media] .select2-selection__choice")).toHaveCount(0)
  await expect(page.locator("[data-library-languages] .select2-selection__choice")).toHaveCount(0)
  await expect(page.getByLabel("Från tryckår", { exact: true })).toHaveValue("1800")
  await expect(page.getByLabel("Till tryckår", { exact: true })).toHaveValue("2026")
})

test("chronology track clicks move the nearest handle and collapsed ranges expand directionally", async ({
  page
}) => {
  await page.goto("/bibliotek?avancerat=1&intervall=1900,2000", { waitUntil: "networkidle" })
  await waitForHydration(page)
  const track = page.locator("[data-library-chronology-range] .rzslider")
  const from = page.getByLabel("Från tryckår", { exact: true })
  const to = page.getByLabel("Till tryckår", { exact: true })
  const installPushCounter = () => page.evaluate(() => {
    const state = window as typeof window & { __chronologyPushes?: number }
    const original = history.pushState.bind(history)
    state.__chronologyPushes = 0
    history.pushState = (...args) => {
      state.__chronologyPushes! += 1
      return original(...args)
    }
  })
  await installPushCounter()
  const clickYear = async (year: number) => {
    await track.scrollIntoViewIfNeeded()
    const box = await track.boundingBox()
    expect(box).not.toBeNull()
    const x = box!.x + 10 + (box!.width - 20) * (year - 1800) / (2026 - 1800)
    await page.mouse.click(x, box!.y + box!.height / 2)
    await expect.poll(() => page.evaluate(
      () => (window as typeof window & { __chronologyPushes?: number }).__chronologyPushes
    )).toBeGreaterThan(0)
  }

  await clickYear(1880)
  await expect(from).toHaveValue("1880")
  await expect(to).toHaveValue("2000")
  expect(await page.evaluate(
    () => (window as typeof window & { __chronologyPushes?: number }).__chronologyPushes
  )).toBe(1)

  await page.goto("/bibliotek?avancerat=1&intervall=1900,2000", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await installPushCounter()
  await clickYear(2010)
  await expect(from).toHaveValue("1900")
  await expect(to).toHaveValue("2010")
  expect(await page.evaluate(
    () => (window as typeof window & { __chronologyPushes?: number }).__chronologyPushes
  )).toBe(1)

  await page.goto("/bibliotek?avancerat=1&intervall=1900,2000", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await installPushCounter()
  await clickYear(1950)
  await expect(from).toHaveValue("1900")
  await expect(to).toHaveValue("1950")
  expect(await page.evaluate(
    () => (window as typeof window & { __chronologyPushes?: number }).__chronologyPushes
  )).toBe(1)

  await page.goto("/bibliotek?avancerat=1&intervall=1900,1900", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await installPushCounter()
  await clickYear(1880)
  await expect(from).toHaveValue("1880")
  await expect(to).toHaveValue("1900")
  expect(await page.evaluate(
    () => (window as typeof window & { __chronologyPushes?: number }).__chronologyPushes
  )).toBe(1)
})

test("chronology thumb clicks focus the chosen slider for native keyboard input", async ({
  page
}) => {
  await page.goto("/bibliotek?avancerat=1&intervall=1900,2000", { waitUntil: "networkidle" })
  await waitForHydration(page)
  const track = page.locator("[data-library-chronology-range] .rzslider")
  await track.scrollIntoViewIfNeeded()
  const box = await track.boundingBox()
  expect(box).not.toBeNull()
  const upperThumbX = box!.x + 10 + (box!.width - 20) * (2000 - 1800) / (2026 - 1800)
  await page.mouse.click(upperThumbX, box!.y + box!.height / 2)

  const upperSlider = page.getByRole("slider", { name: "Till tryckår reglage" })
  await expect(upperSlider).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  await expect(page.getByLabel("Till tryckår", { exact: true })).toHaveValue("1999")
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1900,1999")
})

test("a delayed advanced request cannot replace a newer route-owned result", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_library_v2/delays`, { data: {
    operation: "search",
    body: { mode: "all", filters: libraryFilters({ gender: "female" }), sort: "relevance", reverse: false, page: 1 },
    delay: 900
  } })
  await page.goto("/bibliotek?avancerat=1", { waitUntil: "networkidle" })

  await page.locator("[data-library-gender]").selectOption("female")
  await expect.poll(() => new URL(page.url()).searchParams.get("kön")).toBe("female")
  await page.locator("[data-library-filter]").fill("Senaste")
  await page.locator("[data-library-filter]").press("Enter")
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Röda rummet" })).toHaveCount(0)
})

test("advanced facets retain a filter still waiting in the debounce window", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?avancerat=1&keep=ja", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await resetRequests(request)

  await page.locator("[data-library-filter]").fill("Senaste")
  await page.locator("[data-library-gender]").selectOption("female")

  await expect.poll(() => {
    const params = new URL(page.url()).searchParams
    return {
      filter: params.get("filter"),
      gender: params.get("kön"),
      keep: params.get("keep")
    }
  }).toEqual({ filter: "Senaste", gender: "female", keep: "ja" })
  await expect.poll(async () => (await relevanceQueries(request)).length).toBe(1)
  expect((await relevanceQueries(request)).at(-1)?.body.filters).toEqual(libraryFilters({
    query: "Senaste",
    gender: "female"
  }))
})

test("overlapping advanced facet commits compose from the live controls", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?avancerat=1&keep=ja", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await resetRequests(request)

  await page.evaluate(() => {
    const gender = document.querySelector<HTMLSelectElement>("[data-library-gender]")!
    gender.value = "female"
    gender.dispatchEvent(new Event("change", { bubbles: true }))
    const from = document.querySelector<HTMLInputElement>(
      "[data-library-chronology-range] input[type=range]"
    )!
    from.value = "1900"
    from.dispatchEvent(new Event("input", { bubbles: true }))
    from.dispatchEvent(new Event("change", { bubbles: true }))
  })

  await expect.poll(() => {
    const params = new URL(page.url()).searchParams
    return {
      gender: params.get("kön"),
      interval: params.get("intervall"),
      keep: params.get("keep")
    }
  }).toEqual({ gender: "female", interval: "1900,2026", keep: "ja" })
  await expect.poll(async () => (await relevanceQueries(request)).at(-1)?.body.filters)
    .toEqual(libraryFilters({ gender: "female", year_from: 1900, year_to: 2026 }))
})

test("category, publisher, about-author, and narrowing collections restore through history", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?avancerat=1&sida=4", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await resetRequests(request)

  await chooseMultiOptions(page, page.locator("[data-library-keywords]"), [
    "Romaner", "Svenska Akademien"
  ])
  await expect.poll(() => new URL(page.url()).searchParams.get("keywords"))
    .toBe("texttype:roman,provenance.library:SA")
  expect(new URL(page.url()).searchParams.has("sida")).toBe(false)

  await chooseMultiOptions(page, page.locator("[data-library-about-authors]"), ["Selma Lagerlöf"])
  await expect.poll(() => new URL(page.url()).searchParams.get("about_authors"))
    .toBe("LagerlofS")

  await chooseMultiOptions(page, page.locator("[data-library-narrowing]"), ["Humoristiska verk", "Brev"])
  await expect.poll(() => new URL(page.url()).searchParams.get("keywords_aux"))
    .toBe("texttype:brev;brevsamling,keyword:Humor")
  await expect.poll(async () => (await relevanceQueries(request)).length).toBe(5)
  expect((await relevanceQueries(request)).at(-1)?.body.filters).toEqual(libraryFilters({
    categories: ["texttype:roman", "provenance.library:SA"],
    narrowing_categories: ["texttype:brev;brevsamling", "keyword:Humor"],
    about_author_ids: ["LagerlofS"]
  }))

  await page.goBack()
  await page.goBack()
  await expect(page.locator("[data-library-narrowing] .select2-selection__choice")).toHaveCount(0)
  await page.goForward()
  await page.goForward()
  await expect(page.locator("[data-library-narrowing] .select2-selection__choice").nth(0))
    .toContainText("Brev")
  await expect(page.locator("[data-library-narrowing] .select2-selection__choice").nth(1))
    .toContainText("Humoristiska verk")
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("[data-library-about-authors] .select2-selection__choice"))
    .toContainText("Selma Lagerlöf")
})

test("source-material selection remains operable at the project viewport", async ({ page }) => {
  await page.goto("/bibliotek?avancerat=1&nedladdning=1", { waitUntil: "networkidle" })
  await waitForHydration(page)

  const checkboxes = page.locator("[data-library-source-checkbox]")
  await expect(checkboxes).toHaveCount(3)
  await checkboxes.first().check()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(1)
  await page.locator("[data-library-format-button]").click()
  await expect(page.locator("[data-library-format-popover]")).toBeVisible()
  await expect(page.locator('[data-library-source-format="etext:txt"]')).toBeEnabled()
})

test("the nonmodal format chooser suppresses the shared history shortcut", async ({ page }) => {
  const path = "/bibliotek?avancerat=1&nedladdning=1&keep=first&keep=second"
  await page.goto(path, { waitUntil: "networkidle" })
  await waitForHydration(page)
  await page.locator("[data-library-source-checkbox]").first().check({ force: true })
  await page.locator("[data-library-format-button]").click({ force: true })

  const chooser = page.getByRole("dialog", { name: "Välj format" })
  await expect(chooser).toBeVisible()
  await expect(chooser).not.toHaveAttribute("aria-modal", "true")
  const historyLength = await page.evaluate(() => window.history.length)
  await page.keyboard.press("h")
  await page.waitForTimeout(100)
  await expect(page).toHaveURL(path)
  await expect(chooser).toBeVisible()
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
})

test("download sidebar scrolling does not clip the body-level format popover", async ({ page }) => {
  await page.goto("/bibliotek?avancerat=1&nedladdning=1", { waitUntil: "networkidle" })
  await waitForHydration(page)

  const sidebar = page.locator(".dl")
  await expect(sidebar).toHaveCSS("overflow-y", "auto")
  await page.locator("[data-library-source-checkbox]").first().check({ force: true })

  const button = page.locator("[data-library-format-button]")
  await button.focus()
  await page.keyboard.press("Enter")
  const popover = page.locator("body > [data-library-format-popover]")
  await expect(popover).toBeVisible()

  const [buttonBox, popoverBox] = await Promise.all([
    button.boundingBox(),
    popover.boundingBox()
  ])
  expect(buttonBox).not.toBeNull()
  expect(popoverBox).not.toBeNull()
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  expect(popoverBox!.x).toBeGreaterThanOrEqual(8)
  expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(viewport.width - 8)
  expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(buttonBox!.y)
  await expect(popover).toHaveCSS("overflow-y", "visible")
  await expect(popover.locator(".arrow")).toHaveCount(1)
  await expect(button).toHaveAttribute("aria-haspopup", "dialog")
  await expect(button).toHaveAttribute("aria-controls", "library-format-popover")
  await expect(button).toHaveAttribute("aria-expanded", "true")
  await expect(popover).toHaveRole("dialog", { name: "Välj format" })
  await expect(page.locator("[data-library-source-format]:not(:disabled)").first()).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(popover).toHaveCount(0)
  await expect(button).toHaveAttribute("aria-expanded", "false")
  await expect(button).toBeFocused()
})

test("sticky download format chooser keeps controls reachable without clipping its arrow", async ({
  page
}) => {
  const viewportSize = page.viewportSize()
  expect(viewportSize).not.toBeNull()
  await page.setViewportSize({ width: viewportSize!.width, height: 240 })
  await page.goto("/bibliotek?avancerat=1&nedladdning=1", { waitUntil: "networkidle" })
  await waitForHydration(page)
  await page.locator("[data-library-source-checkbox]").first().check({ force: true })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.locator(".dl").evaluate(element => { element.scrollTop = element.scrollHeight })

  const button = page.locator("[data-library-format-button]")
  await button.focus()
  await page.keyboard.press("Enter")

  const popover = page.locator("body > [data-library-format-popover]")
  const scrollport = popover.locator("[data-library-format-scrollport]")
  await expect(popover).toBeVisible()
  await expect(popover).toHaveCSS("overflow-y", "visible")
  await expect(scrollport).toHaveCSS("overflow-y", "auto")
  await expect.poll(() => scrollport.evaluate(element => element.scrollHeight > element.clientHeight))
    .toBe(true)

  const format = page.locator('[data-library-source-format="etext:txt"]')
  await expect(format).toBeFocused()
  await expect(format).toBeInViewport()
  await page.keyboard.press("Space")
  await expect(format).toBeChecked()
  await expect(format).toBeFocused()

  const submit = page.locator("[data-library-download-submit]")
  await expect(submit).toBeEnabled()
  const pdf = page.locator('[data-library-source-format="faksimil:pdf"]')
  await page.keyboard.press("Tab")
  await expect(pdf).toBeFocused()
  await expect.poll(() => scrollport.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await page.evaluate(() => new Promise(requestAnimationFrame))
  await page.keyboard.press("Tab")
  expect(await submit.evaluate(element => document.activeElement === element)).toBe(true)
  await expect(submit).toBeInViewport()

  const [buttonBox, popoverBox, arrowBox] = await Promise.all([
    button.boundingBox(),
    popover.boundingBox(),
    popover.locator(".arrow").boundingBox()
  ])
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  expect(buttonBox).not.toBeNull()
  expect(popoverBox).not.toBeNull()
  expect(arrowBox).not.toBeNull()
  expect(popoverBox!.x).toBeGreaterThanOrEqual(8)
  expect(popoverBox!.y).toBeGreaterThanOrEqual(8)
  expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(viewport.width - 8)
  expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(viewport.height - 8)
  const opensBelow = popoverBox!.y >= buttonBox!.y + buttonBox!.height
  if (opensBelow) {
    await expect(popover).toHaveClass(/\bbottom\b/u)
    expect(arrowBox!.y).toBeLessThan(popoverBox!.y)
    expect(arrowBox!.y + arrowBox!.height).toBeGreaterThan(popoverBox!.y)
  } else {
    expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(buttonBox!.y)
    await expect(popover).toHaveClass(/\btop\b/u)
    expect(arrowBox!.y).toBeLessThan(popoverBox!.y + popoverBox!.height)
    expect(arrowBox!.y + arrowBox!.height).toBeGreaterThan(popoverBox!.y + popoverBox!.height)
  }
  expect(arrowBox!.y).toBeGreaterThanOrEqual(0)
  expect(arrowBox!.y + arrowBox!.height).toBeLessThanOrEqual(viewport.height)
})

test("vue-multiselect Library facets keep groups, disabled narrowing choices, and ordered route state", async ({
  page
}) => {
  await page.goto("/bibliotek?avancerat=1", { waitUntil: "networkidle" })
  await waitForHydration(page)

  const keywords = page.locator("[data-library-keywords]")
  const aboutAuthors = page.locator("[data-library-about-authors]")
  const narrowing = page.locator("[data-library-narrowing]")
  const media = page.locator("[data-library-media]")
  const languages = page.locator("[data-library-languages]")
  for (const control of [keywords, aboutAuthors, narrowing, media, languages]) {
    await expect(control.locator(".multiselect")).toHaveCount(1)
    await expect(control.locator("select[multiple]")).toHaveCount(0)
  }

  await keywords.click()
  await expect(keywords).toContainText("Kategorier")
  await expect(keywords).toContainText("Utgivare")
  await keywords.getByText("Romaner", { exact: true }).press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.get("keywords"))
    .toBe("texttype:brev;brevsamling")
  await page.keyboard.press("Escape")

  await narrowing.click()
  await expect(narrowing.getByText("Brev", { exact: true })).toHaveAttribute("aria-disabled", "true")
  await narrowing.getByText("Humoristiska verk", { exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("keywords_aux"))
    .toBe("keyword:Humor")
  await page.keyboard.press("Escape")

  await media.click()
  await media.getByText("Etext", { exact: true }).click()
  await page.keyboard.press("Escape")
  await languages.click()
  await languages.getByText("Svenska", { exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("languages")).toBe("language:swe")
  expect([...new URL(page.url()).searchParams.entries()]).toEqual([
    ["avancerat", "1"],
    ["keywords", "texttype:brev;brevsamling"],
    ["keywords_aux", "keyword:Humor"],
    ["mediatypes", "mediatype:etext"],
    ["languages", "language:swe"]
  ])
  await page.locator("[data-library-reset]").click()
  await expect.poll(() => new URL(page.url()).searchParams.has("keywords")).toBe(false)
  await expect(keywords.locator(".select2-selection__choice")).toHaveCount(0)
})
